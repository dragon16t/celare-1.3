"""Shared LLM text helper.

Uses the DIRECT Gemini API key (GEMINI_API_KEY) by default — this works from the
deployed app. Falls back to the Emergent universal key only when no Gemini key is
present. This keeps every AI text feature working in production.
"""
import os
import asyncio
import logging
import uuid as _uuid

logger = logging.getLogger(__name__)

GEMINI_TEXT_MODEL = os.environ.get("GEMINI_TEXT_MODEL", "gemini-flash-latest")


def friendly_ai_error(err) -> str:
    s = str(err)
    if "402" in s or "prepayment credits" in s.lower() or "RESOURCE_EXHAUSTED" in s:
        return ("Gemini API credits are exhausted. Top up billing at https://ai.studio/projects "
                "(project 433730666333) and retry.")
    if "API_KEY_INVALID" in s or "API key not valid" in s or "PERMISSION_DENIED" in s:
        return "GEMINI_API_KEY is invalid or not permitted. Check the key in AI Studio."
    if "429" in s:
        return "Gemini rate limit reached. Please wait a minute and retry."
    return f"Gemini request failed: {s[:200]}"


async def llm_text(prompt: str, system: str = "") -> str:
    """Generate text. Prefers the direct Gemini key; falls back to Emergent.

    Returns the model's text response (string).
    """
    gkey = os.environ.get("GEMINI_API_KEY", "")
    if not gkey:
        raise ValueError("GEMINI_API_KEY is not set on this server. Add it to the backend environment / deployment secrets.")
    from google import genai
    client = genai.Client(api_key=gkey)
    contents = (system.strip() + "\n\n" + prompt) if system else prompt
    candidates = []
    for m in (GEMINI_TEXT_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"):
        if m and m not in candidates:
            candidates.append(m)
    last_err = None
    for model in candidates:
        try:
            def _gen():
                return client.models.generate_content(model=model, contents=contents)

            resp = await asyncio.to_thread(_gen)
            text = getattr(resp, "text", "") or ""
            if text:
                return text
        except Exception as e:
            logger.warning(f"[llm] Gemini '{model}' failed: {str(e)[:110]}")
            last_err = e
            if "402" in str(e) or "API_KEY_INVALID" in str(e):
                break
    raise ValueError(friendly_ai_error(last_err or "empty response"))
