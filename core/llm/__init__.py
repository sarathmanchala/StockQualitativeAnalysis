import os
import logging
from core.llm.base import BaseLLMProvider
from core.llm.providers import (
    GeminiLLMProvider,
    OpenAILLMProvider,
    MockLLMProvider,
)

logger = logging.getLogger(__name__)

_default_llm_provider: BaseLLMProvider | None = None


def get_llm_provider() -> BaseLLMProvider:
    """
    Factory function returning the configured LLM provider based on environment settings.
    Defaults to Gemini if GEMINI_API_KEY is present, otherwise MockLLMProvider for offline safety.
    """
    global _default_llm_provider

    # Always ensure latest .env values are loaded
    try:
        from dotenv import load_dotenv
        load_dotenv(override=False)
    except ImportError:
        pass

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    provider_name = os.getenv("LLM_PROVIDER", "").lower().strip()

    # If already initialized with a real provider, reuse it
    if _default_llm_provider is not None:
        if not isinstance(_default_llm_provider, MockLLMProvider):
            return _default_llm_provider
        # If it was Mock before, but an API key is now present, upgrade to real provider
        if not gemini_key and not openai_key and provider_name == "mock":
            return _default_llm_provider

    if provider_name == "openai" or (not provider_name and openai_key and not gemini_key):
        try:
            model = os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
            _default_llm_provider = OpenAILLMProvider(model_name=model)
            logger.info("Initialized OpenAILLMProvider (model: %s)", model)
            return _default_llm_provider
        except Exception as exc:
            logger.warning("Failed to initialize OpenAILLMProvider: %s", exc)

    if provider_name in ("gemini", "google") or (not provider_name and gemini_key) or gemini_key:
        try:
            model = os.getenv("GEMINI_LLM_MODEL", "gemini-1.5-flash-8b")
            _default_llm_provider = GeminiLLMProvider(model_name=model)
            logger.info("Initialized GeminiLLMProvider (model: %s)", model)
            return _default_llm_provider
        except Exception as exc:
            logger.warning("Failed to initialize GeminiLLMProvider: %s", exc)

    # Offline / deterministic mock fallback
    _default_llm_provider = MockLLMProvider()
    logger.info("Using MockLLMProvider (offline deterministic analysis)")
    return _default_llm_provider
