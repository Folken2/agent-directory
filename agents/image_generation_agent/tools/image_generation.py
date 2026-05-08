"""
Image generation tool that directly calls OpenRouter API with proper modalities parameter.
"""

import logging
import os
import base64
import re
import ssl
from typing import Dict, Any, Optional, TypedDict
import aiohttp
import certifi
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext
import google.genai.types as types
from ..config.llm import IMAGE_MODEL


# Build once at import. Some Python installs (notably the python.org macOS
# framework build) ship without a usable CA store, so aiohttp falls back to
# an empty trust store and every TLS handshake fails. Pinning certifi makes
# this work uniformly across local dev, Docker, and Railway.
_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

logger = logging.getLogger(__name__)

# OpenRouter API endpoint
OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"


class ImageData(TypedDict):
    mime_type: str
    data: bytes
    size_bytes: int


_EXT_BY_MIME = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}


async def _call_openrouter(
    payload: Dict[str, Any],
    log_label: str,
) -> Dict[str, Any]:
    """POST to OpenRouter and return either {"images": [...]} or {"error": "..."}."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return {"error": "OPENROUTER_API_KEY environment variable not set"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://agentdirectory.folch.ai",
        "X-Title": "Google ADK Directory",
    }

    logger.info(f"OpenRouter call ({log_label})")
    connector = aiohttp.TCPConnector(ssl=_SSL_CONTEXT)
    async with aiohttp.ClientSession(connector=connector) as session:
        async with session.post(
            f"{OPENROUTER_API_BASE}/chat/completions", headers=headers, json=payload
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                logger.error(f"OpenRouter API error {response.status}: {error_text}")
                return {"error": f"OpenRouter API error: {response.status} - {error_text}"}
            result = await response.json()

    images: list[ImageData] = []
    message: Dict[str, Any] = {}
    if result.get("choices"):
        message = result["choices"][0].get("message", {}) or {}
        for img in message.get("images") or []:
            image_url = (img.get("image_url") or {}).get("url", "")
            if not image_url.startswith("data:image/"):
                continue
            parts = image_url.split(",", 1)
            if len(parts) != 2:
                continue
            mime_match = re.search(r"data:image/([^;]+)", parts[0])
            mime_type = f"image/{mime_match.group(1)}" if mime_match else "image/png"
            image_bytes = base64.b64decode(parts[1])
            images.append(
                {
                    "mime_type": mime_type,
                    "data": image_bytes,
                    "size_bytes": len(image_bytes),
                }
            )

    return {"images": images, "text": message.get("content", "")}


async def _save_images_as_artifacts(
    images: list[ImageData],
    tool_context: Optional[ToolContext],
    filename_prefix: str,
) -> list[Dict[str, Any]]:
    saved: list[Dict[str, Any]] = []
    if not tool_context:
        return saved
    for idx, img_data in enumerate(images):
        try:
            image_part = types.Part.from_bytes(
                data=img_data["data"], mime_type=img_data["mime_type"]
            )
            ext = _EXT_BY_MIME.get(img_data["mime_type"], "png")
            filename = f"{filename_prefix}_{idx + 1}.{ext}"
            version = await tool_context.save_artifact(filename=filename, artifact=image_part)
            saved.append(
                {
                    "filename": filename,
                    "version": version,
                    "mime_type": img_data["mime_type"],
                    "size_bytes": img_data["size_bytes"],
                }
            )
            logger.info(f"Saved image artifact: {filename} (version {version})")
        except Exception as e:
            logger.error(f"Error saving image artifact: {e}", exc_info=True)
    return saved


async def generate_image_tool(
    prompt: str,
    aspect_ratio: Optional[str] = "1:1",
    tool_context: Optional[ToolContext] = None,
) -> Dict[str, Any]:
    """
    Generate an image from a text prompt.

    Use for the FIRST image in a session, or whenever you want a fresh image
    unrelated to anything previously generated. For tweaking an existing image
    ("warmer", "remove the people", "tighter crop"), use `refine_image` instead
    so the model preserves composition and identity from the prior result.

    Args:
        prompt: Natural language description of the image.
        aspect_ratio: One of "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4",
            "9:16", "16:9", "21:9". Default "1:1".
        tool_context: Provided automatically by ADK.

    Returns:
        {"status": "success", "artifacts": [{"filename", "version", ...}], ...}
        On failure, {"status": "error", "message": "..."}.
    """
    try:
        model_name = os.getenv("IMAGE_MODEL", "google/gemini-2.5-flash-image")
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"],
            "image_config": {"aspect_ratio": aspect_ratio},
        }
        result = await _call_openrouter(payload, log_label=f"generate: {prompt[:50]}")
        if "error" in result:
            return {"status": "error", "message": result["error"]}
        images = result["images"]
        if not images:
            return {
                "status": "error",
                "message": "No images generated.",
                "text_response": result.get("text", ""),
            }
        saved = await _save_images_as_artifacts(images, tool_context, "generated_image")
        return {
            "status": "success",
            "message": f"Generated {len(images)} image(s)",
            "images_count": len(images),
            "artifacts": saved,
            "text_response": result.get("text", ""),
        }
    except Exception as e:
        logger.error(f"Error in generate_image_tool: {e}", exc_info=True)
        return {"status": "error", "message": f"Failed to generate image: {e}"}


async def refine_image_tool(
    reference_filename: str,
    refinement_prompt: str,
    aspect_ratio: Optional[str] = None,
    tool_context: Optional[ToolContext] = None,
) -> Dict[str, Any]:
    """
    Refine a previously generated image — keep its composition and subject,
    apply targeted changes ("warmer light", "remove the people", "tighter crop").

    The reference image is sent to the model as visual context, so the new
    image stays grounded in the previous one. Use this whenever the user asks
    for a variant or tweak of something you already generated; use
    `generate_image` for fresh, unrelated requests.

    Args:
        reference_filename: Filename of the prior artifact, e.g.
            "generated_image_1.png" or "refined_image_1.png".
        refinement_prompt: What to change. Be specific about what to keep AND
            what to alter (e.g. "same composition and subject; warmer color
            temperature, no people in the background").
        aspect_ratio: Optional override. If omitted, the model preserves the
            reference's proportions.
        tool_context: Provided automatically by ADK.

    Returns:
        Same shape as `generate_image_tool`. New artifact is saved as
        `refined_image_N.png` (versioned by ADK across calls).
    """
    if not tool_context:
        return {"status": "error", "message": "refine_image requires tool_context"}
    try:
        try:
            ref_part = await tool_context.load_artifact(filename=reference_filename)
        except Exception as e:
            return {
                "status": "error",
                "message": f"Could not load reference artifact '{reference_filename}': {e}",
            }
        if ref_part is None or ref_part.inline_data is None:
            return {
                "status": "error",
                "message": (
                    f"Reference artifact '{reference_filename}' not found or has no inline data. "
                    f"Call `load_artifacts` first to confirm available filenames."
                ),
            }

        ref_bytes = ref_part.inline_data.data
        ref_mime = ref_part.inline_data.mime_type or "image/png"
        ref_data_url = f"data:{ref_mime};base64,{base64.b64encode(ref_bytes).decode('ascii')}"

        # Multimodal user content: the reference image + the textual refinement.
        # Order matters for some image models — image first primes the model
        # to treat the text as an edit instruction rather than a fresh prompt.
        user_content = [
            {"type": "image_url", "image_url": {"url": ref_data_url}},
            {"type": "text", "text": refinement_prompt},
        ]

        model_name = os.getenv("IMAGE_MODEL", "google/gemini-2.5-flash-image")
        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": [{"role": "user", "content": user_content}],
            "modalities": ["image", "text"],
        }
        if aspect_ratio:
            payload["image_config"] = {"aspect_ratio": aspect_ratio}

        result = await _call_openrouter(
            payload, log_label=f"refine {reference_filename}: {refinement_prompt[:40]}"
        )
        if "error" in result:
            return {"status": "error", "message": result["error"]}
        images = result["images"]
        if not images:
            return {
                "status": "error",
                "message": "Refinement returned no image.",
                "text_response": result.get("text", ""),
            }
        saved = await _save_images_as_artifacts(images, tool_context, "refined_image")
        return {
            "status": "success",
            "message": f"Refined {reference_filename} into {len(images)} image(s)",
            "images_count": len(images),
            "reference_filename": reference_filename,
            "artifacts": saved,
            "text_response": result.get("text", ""),
        }
    except Exception as e:
        logger.error(f"Error in refine_image_tool: {e}", exc_info=True)
        return {"status": "error", "message": f"Failed to refine image: {e}"}


# Create FunctionTool instances
generate_image = FunctionTool(generate_image_tool)
refine_image = FunctionTool(refine_image_tool)
