"""
Model construction shared by every agent in the directory.

A module, not a package: ADK lists every directory in agents/ as an app, but
not files, and it puts agents/ on sys.path, so agents import this directly.

By default agents call providers directly: LiteLlm models go to OpenRouter and
native Gemini models to the Gemini API. With LITELLM_PROXY_ENABLED on, every call
goes through the LiteLLM proxy under the agent's own key, so the proxy reports
usage per agent. If the proxy is down, calls go direct instead (see
_GatewayFallback), so a gateway outage never stops the agents:

  LITELLM_PROXY_ENABLED  true/1/yes/on to use the proxy; anything else, direct
  LITELLM_PROXY_URL      proxy root, e.g. http://litellm.railway.internal:4000
  LITELLM_KEY_<APP>      the agent's virtual key, e.g. LITELLM_KEY_DEEP_RESEARCH_AGENT
  LITELLM_PROXY_API_KEY  shared key for agents without their own

The reasoning tier thinks at REASONING_EFFORT (low, medium or high; default medium).
"""

import copy
import logging
import os
import time
from functools import cached_property
from typing import AsyncGenerator

import aiohttp
import httpx
import openai
from google.adk.models.base_llm import BaseLlm
from google.adk.models.google_llm import Gemini
from google.adk.models.lite_llm import LiteLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import Client, errors, types
from pydantic import Field

logger = logging.getLogger(__name__)

# After the proxy fails, how long calls skip it and go direct
GATEWAY_RETRY_SECONDS = 60
_gateway_down_until = 0.0

# OpenRouter app attribution (direct calls; the proxy sets its own)
os.environ.setdefault("OR_SITE_URL", "https://agentdirectory.folch.ai")
os.environ.setdefault("OR_APP_NAME", "Google ADK Directory")

TIERS = {
    "fast": ("FAST_MODEL", "openrouter/google/gemini-3.8-flash"),
    "reasoning": ("REASONING_MODEL", "openrouter/deepseek/deepseek-v4.1-flash"),
    "image": ("IMAGE_MODEL", "openrouter/google/gemini-2.5-flash-image"),
}


def make_model(app: str, tier: str = "fast") -> LiteLlm:
    """An OpenRouter model for `app` (its directory name), by tier."""
    if tier not in TIERS:
        raise ValueError(
            f"Unknown model tier {tier!r}; expected one of {sorted(TIERS)}"
        )
    env_var, default = TIERS[tier]
    model = os.getenv(env_var, default)
    # OpenRouter's own reasoning field, not `reasoning_effort`, which LiteLLM
    # rejects for models missing from its price list. Models that only switch
    # reasoning on or off (e.g. DeepSeek) treat any effort as on.
    body = {}
    if tier == "reasoning":
        body["reasoning"] = {"effort": os.getenv("REASONING_EFFORT", "medium")}

    options = {"extra_body": body} if body else {}
    direct = LiteLlm(model=model, app_name="adk-samples-directory", **options)
    proxy = _proxy_url()
    if not proxy:
        return direct
    return _ProxiedLiteLlm(
        # The proxy receives `model` without the prefix and matches it in its model_list.
        model=f"litellm_proxy/{model}",
        api_base=proxy,
        api_key=_proxy_key(app),
        extra_body={"metadata": {"tags": [f"agent:{app}", f"tier:{tier}"]}, **body},
        direct=direct,
    )


def make_gemini(app: str, model: str) -> str | Gemini:
    """A native Gemini model for `app`, keeping Gemini-only features
    (code execution, search and maps grounding).

    Direct: the model name, which ADK hands to the Gemini API. Proxied: a Gemini
    client aimed at the proxy's /gemini pass-through, which forwards requests
    unchanged.
    """
    proxy = _proxy_url()
    if not proxy:
        return model
    return _ProxiedGemini(
        model=model,
        base_url=f"{proxy}/gemini",
        proxy_api_key=_proxy_key(app),
        direct=Gemini(model=model),
    )


class _GatewayFallback:
    """Sends a request through the proxy, or straight to the provider (`direct`)
    when the proxy is unreachable, and skips the proxy for GATEWAY_RETRY_SECONDS
    after that. Refusals (bad key, spent budget) still raise: that is the proxy
    working."""

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        global _gateway_down_until
        if time.monotonic() >= _gateway_down_until:
            # Models edit the request they send; keep the original for `direct`.
            attempt = llm_request.model_copy(
                update={
                    "contents": copy.deepcopy(llm_request.contents),
                    "config": llm_request.config.model_copy(deep=True),
                }
            )
            started = False
            try:
                async for response in super().generate_content_async(attempt, stream):
                    started = True
                    yield response
                return
            except Exception as e:
                if started or not _gateway_unavailable(e):
                    raise
                logger.warning(
                    "LiteLLM proxy unavailable (%s); calling the provider directly "
                    "for the next %ss",
                    e,
                    GATEWAY_RETRY_SECONDS,
                )
                _gateway_down_until = time.monotonic() + GATEWAY_RETRY_SECONDS
        # ADK names the agent's model in the request (litellm_proxy/... here),
        # and LiteLlm calls the request's model over its own.
        llm_request.model = self.direct.model
        async for response in self.direct.generate_content_async(llm_request, stream):
            yield response


def _gateway_unavailable(e: Exception) -> bool:
    """Whether `e` means the proxy could not be reached or served nothing, as
    opposed to answering with a refusal."""
    # LiteLLM re-raises connection failures as InternalServerError, so look
    # down the chain for the original.
    cause = e
    while cause is not None:
        if isinstance(
            cause,
            (openai.APIConnectionError, httpx.TransportError, aiohttp.ClientConnectionError),
        ):
            return True
        cause = cause.__cause__ or cause.__context__
    status = getattr(e, "status_code", None) or getattr(e, "code", None)
    if status in (502, 503, 504):
        return True
    # Railway's edge, when the proxy service has no running deployment
    return status == 404 and "Application not found" in str(e)


class _ProxiedLiteLlm(_GatewayFallback, LiteLlm):
    direct: BaseLlm = Field(exclude=True)


class _ProxiedGemini(_GatewayFallback, Gemini):
    """Gemini that authenticates with a proxy key instead of GOOGLE_API_KEY."""

    proxy_api_key: str
    direct: BaseLlm = Field(exclude=True)

    @cached_property
    def api_client(self) -> Client:
        base_url, api_version = self._base_url_and_api_version
        return Client(
            api_key=self.proxy_api_key,
            http_options=types.HttpOptions(
                headers=self._tracking_headers(),
                retry_options=self.retry_options,
                base_url=base_url,
                api_version=api_version,
            ),
        )


def _proxy_url() -> str:
    """The proxy root when LITELLM_PROXY_ENABLED is on, else "" (direct calls)."""
    enabled = os.getenv("LITELLM_PROXY_ENABLED", "").strip().lower()
    if enabled not in {"1", "true", "yes", "on"}:
        return ""
    url = os.getenv("LITELLM_PROXY_URL", "").strip().rstrip("/")
    if not url:
        raise RuntimeError(
            "LITELLM_PROXY_ENABLED is on but LITELLM_PROXY_URL is not set"
        )
    return url


def _proxy_key(app: str) -> str:
    own = f"LITELLM_KEY_{app.upper()}"
    key = os.getenv(own) or os.getenv("LITELLM_PROXY_API_KEY")
    if not key:
        raise RuntimeError(
            f"LITELLM_PROXY_ENABLED is on but neither {own} nor LITELLM_PROXY_API_KEY is set"
        )
    return key
