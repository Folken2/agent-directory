"""
Model construction shared by every agent in the directory.

A module, not a package: ADK lists every directory in agents/ as an app, but
not files, and it puts agents/ on sys.path, so agents import this directly.

By default agents call providers directly: LiteLlm models go to OpenRouter and
native Gemini models to the Gemini API. With LITELLM_PROXY_ENABLED on, every call
goes through the LiteLLM proxy under the agent's own key, so the proxy reports
usage per agent:

  LITELLM_PROXY_ENABLED  true/1/yes/on to use the proxy; anything else, direct
  LITELLM_PROXY_URL      proxy root, e.g. http://litellm.railway.internal:4000
  LITELLM_KEY_<APP>      the agent's virtual key, e.g. LITELLM_KEY_DEEP_RESEARCH_AGENT
  LITELLM_PROXY_API_KEY  shared key for agents without their own

The reasoning tier thinks at REASONING_EFFORT (low, medium or high; default medium).
"""

import os
from functools import cached_property

from google.adk.models.google_llm import Gemini
from google.adk.models.lite_llm import LiteLlm
from google.genai import Client, types

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

    proxy = _proxy_url()
    if not proxy:
        options = {"extra_body": body} if body else {}
        return LiteLlm(model=model, app_name="adk-samples-directory", **options)
    return LiteLlm(
        # The proxy receives `model` without the prefix and matches it in its model_list.
        model=f"litellm_proxy/{model}",
        api_base=proxy,
        api_key=_proxy_key(app),
        extra_body={"metadata": {"tags": [f"agent:{app}", f"tier:{tier}"]}, **body},
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
        model=model, base_url=f"{proxy}/gemini", proxy_api_key=_proxy_key(app)
    )


class _ProxiedGemini(Gemini):
    """Gemini that authenticates with a proxy key instead of GOOGLE_API_KEY."""

    proxy_api_key: str

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
