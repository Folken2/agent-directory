"""
Image generation tool that directly calls OpenRouter API with proper modalities parameter.
"""

import logging
import os
import base64
import re
from typing import Dict, Any, Optional, TypedDict
import aiohttp
from google.adk.tools import FunctionTool
from google.adk.tools.tool_context import ToolContext
import google.genai.types as types
from ..config.llm import IMAGE_MODEL

logger = logging.getLogger(__name__)

# OpenRouter API endpoint
OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"


class ImageData(TypedDict):
    mime_type: str
    data: bytes
    size_bytes: int


async def generate_image_tool(
    prompt: str,
    aspect_ratio: Optional[str] = "1:1",
    tool_context: Optional[ToolContext] = None,
) -> Dict[str, Any]:
    """
    Generate an image using OpenRouter's image generation API.

    This tool directly calls OpenRouter's API with the proper modalities parameter,
    bypassing ADK/LiteLLM to ensure images are returned correctly.

    Args:
        prompt: Text description of the image to generate
        aspect_ratio: Image aspect ratio (default: "1:1")
            Supported: "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
        tool_context: Tool context (automatically provided)

    Returns:
        Dict with status, image data, and artifact information
    """
    try:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            return {"status": "error", "message": "OPENROUTER_API_KEY environment variable not set"}

        # Get the model name as a string (use environment variable directly to match config)
        model_name = os.getenv("IMAGE_MODEL", "google/gemini-2.5-flash-image")

        # Prepare the request payload
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"],  # Required for image generation
            "image_config": {"aspect_ratio": aspect_ratio},
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://agentdirectory.folch.ai",  # OpenRouter app attribution
            "X-Title": "Google ADK Directory",  # OpenRouter app attribution
        }

        logger.info(f"Calling OpenRouter API for image generation: {prompt[:50]}...")

        # Make the API call
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{OPENROUTER_API_BASE}/chat/completions", headers=headers, json=payload
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"OpenRouter API error {response.status}: {error_text}")
                    return {
                        "status": "error",
                        "message": f"OpenRouter API error: {response.status} - {error_text}",
                    }

                result = await response.json()

        # Extract images from the response
        images: list[ImageData] = []
        if result.get("choices"):
            message = result["choices"][0].get("message", {})
            if message.get("images"):
                for img in message["images"]:
                    image_url = img.get("image_url", {}).get("url", "")
                    if image_url.startswith("data:image/"):
                        # Extract base64 data
                        parts = image_url.split(",", 1)
                        if len(parts) == 2:
                            mime_part = parts[0]  # data:image/png;base64
                            base64_data = parts[1]

                            # Extract MIME type
                            mime_match = re.search(r"data:image/([^;]+)", mime_part)
                            mime_type = (
                                f"image/{mime_match.group(1)}" if mime_match else "image/png"
                            )

                            # Decode base64
                            image_bytes = base64.b64decode(base64_data)

                            images.append(
                                {
                                    "mime_type": mime_type,
                                    "data": image_bytes,
                                    "size_bytes": len(image_bytes),
                                }
                            )

        if not images:
            # Check if there's text response
            text_content = message.get("content", "")
            logger.warning(f"No images found in response. Text content: {text_content[:100]}")
            return {
                "status": "error",
                "message": "No images generated. The model may not have generated images.",
                "text_response": text_content,
            }

        # Save images as artifacts
        saved_artifacts = []
        if tool_context:
            for idx, img_data in enumerate(images):
                try:
                    # Create Part from bytes
                    image_part = types.Part.from_bytes(
                        data=img_data["data"], mime_type=img_data["mime_type"]
                    )

                    # Determine file extension
                    ext_map = {
                        "image/png": "png",
                        "image/jpeg": "jpg",
                        "image/jpg": "jpg",
                        "image/webp": "webp",
                        "image/gif": "gif",
                    }
                    ext = ext_map.get(img_data["mime_type"], "png")
                    filename = f"generated_image_{idx + 1}.{ext}"

                    # Save artifact
                    version = await tool_context.save_artifact(
                        filename=filename, artifact=image_part
                    )

                    saved_artifacts.append(
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

        return {
            "status": "success",
            "message": f"Generated {len(images)} image(s)",
            "images_count": len(images),
            "artifacts": saved_artifacts,
            "text_response": message.get("content", ""),
        }

    except Exception as e:
        logger.error(f"Error in generate_image_tool: {str(e)}", exc_info=True)
        return {"status": "error", "message": f"Failed to generate image: {str(e)}"}


# Create FunctionTool instance
generate_image = FunctionTool(generate_image_tool)
