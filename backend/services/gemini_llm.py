"""GeminiChat — drop-in replacement for emergentintegrations LlmChat that talks
DIRECTLY to Google Gemini using GEMINI_API_KEY (no Emergent universal key needed).

If the key handed in is an Emergent universal key (sk-emergent-*), it delegates
to emergentintegrations' LlmChat so legacy behaviour is preserved.

Interface mirrors LlmChat: with_model / with_params / send_message /
send_message_sync / send_message_multimodal_response.
"""
import asyncio
import base64
import logging
import os

logger = logging.getLogger(__name__)

_IMAGE_MODEL = "gemini-2.5-flash-image"  # verified working with GEMINI_API_KEY
_TEXT_FALLBACKS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"]


def _normalize_model(model, image_out=False):
    m = (model or "").lower()
    if image_out or "image" in m:
        return _IMAGE_MODEL
    if model in ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"):
        return model
    return "gemini-flash-latest"


def _client(api_key):
    from google import genai
    return genai.Client(api_key=api_key)


def _parts_from(user_message):
    from google.genai import types as gt
    parts = []
    text = getattr(user_message, "text", "") or ""
    if text:
        parts.append(text)
    for fc in (getattr(user_message, "file_contents", None) or []):
        b64 = getattr(fc, "image_base64", None)
        if not b64:
            continue
        try:
            data = base64.b64decode(b64)
        except Exception:
            continue
        mime = "image/png"
        try:
            mime = fc.get_mime_type() or mime
        except Exception:
            pass
        parts.append(gt.Part.from_bytes(data=data, mime_type=mime))
    return parts


class GeminiChat:
    def __init__(self, api_key, session_id=None, system_message=""):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set on this server. Add it to the backend environment / deployment secrets.")
        self._key = api_key
        self._system = system_message or ""
        self._model = None
        self._image_out = False
        self._delegate = None
        if api_key and str(api_key).startswith("sk-emergent"):
            from emergentintegrations.llm.chat import LlmChat
            self._delegate = LlmChat(
                api_key=api_key,
                session_id=session_id or "chat",
                system_message=system_message or "You are a helpful assistant.",
            )

    def with_model(self, provider, model):
        if self._delegate is not None:
            self._delegate.with_model(provider, model)
        else:
            self._model = _normalize_model(model, self._image_out)
        return self

    def with_params(self, modalities=None, **kwargs):
        if self._delegate is not None:
            self._delegate.with_params(modalities=modalities, **kwargs)
        else:
            if modalities and "image" in modalities:
                self._image_out = True
                self._model = _IMAGE_MODEL
        return self

    async def send_message(self, user_message) -> str:
        if self._delegate is not None:
            return await self._delegate.send_message(user_message)
        return await asyncio.to_thread(self._gen_text_sync, user_message)

    def send_message_sync(self, user_message) -> str:
        if self._delegate is not None:
            return self._delegate.send_message_sync(user_message)
        return self._gen_text_sync(user_message)

    async def send_message_multimodal_response(self, user_message):
        if self._delegate is not None:
            return await self._delegate.send_message_multimodal_response(user_message)
        return await asyncio.to_thread(self._gen_image_sync, user_message)

    def _gen_text_sync(self, user_message) -> str:
        client = _client(self._key)
        parts = ([self._system] if self._system else []) + _parts_from(user_message)
        models = []
        for m in ([self._model] if self._model else []) + _TEXT_FALLBACKS:
            if m and "image" not in m and m not in models:
                models.append(m)
        if not models:
            models = ["gemini-flash-latest"]
        last_err = None
        for model in models:
            try:
                resp = client.models.generate_content(model=model, contents=parts)
                text = getattr(resp, "text", "") or ""
                if text:
                    return text
            except Exception as e:
                logger.warning(f"[gemini-chat] text model '{model}' failed: {str(e)[:110]}")
                last_err = e
                if "402" in str(e) or "API_KEY_INVALID" in str(e):
                    break
        from services.llm_helper import friendly_ai_error
        raise ValueError(friendly_ai_error(last_err or "Gemini returned an empty response"))

    def _gen_image_sync(self, user_message):
        client = _client(self._key)
        parts = ([self._system] if self._system else []) + _parts_from(user_message)
        try:
            resp = client.models.generate_content(model=_IMAGE_MODEL, contents=parts)
        except Exception as e:
            from services.llm_helper import friendly_ai_error
            raise ValueError(friendly_ai_error(e))
        text_out = ""
        images = []
        for part in (resp.candidates[0].content.parts if resp.candidates else []):
            inline = getattr(part, "inline_data", None)
            if inline and getattr(inline, "data", None):
                images.append({
                    "data": base64.b64encode(inline.data).decode("utf-8"),
                    "mime_type": getattr(inline, "mime_type", None) or "image/png",
                })
            elif getattr(part, "text", None):
                text_out += part.text
        return text_out, images


def any_ai_key() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY"))
