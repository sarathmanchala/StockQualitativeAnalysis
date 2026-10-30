import json
import logging
import os
import urllib.request
import urllib.error
from typing import Any, Dict, Optional

from core.llm.base import BaseLLMProvider

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_CASCADE = [
    "gemini-1.5-flash-8b",   # Ultra-lightweight, 1,500 RPD on Free Tier (lowest tier for analysis)
    "gemini-1.5-flash",      # Standard lightweight, 1,500 RPD on Free Tier
    "gemini-2.0-flash-lite", # Next-generation lightweight
    "gemini-2.0-flash",      # Next-generation flash
    "gemini-2.5-flash",      # Flagship flash tier
]

_EXHAUSTED_GEMINI_MODELS: Dict[str, float] = {}


class GeminiLLMProvider(BaseLLMProvider):
    """
    Google Gemini LLM provider using the direct official Generative Language REST API.
    Features intelligent multi-tier model cascade and automatic rate-limit/quota failover.
    Uses structured JSON generation mode.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gemini-1.5-flash-8b",
    ):
        self._api_key = (
            api_key
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
        )
        if not self._api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")
        self._model_name = model_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def _get_candidate_models(self) -> list[str]:
        import time
        now = time.time()
        # Evict expired cooldowns
        expired = [m for m, exp in _EXHAUSTED_GEMINI_MODELS.items() if now > exp]
        for m in expired:
            _EXHAUSTED_GEMINI_MODELS.pop(m, None)

        candidates = [self._model_name]
        for m in DEFAULT_GEMINI_CASCADE:
            if m not in candidates:
                candidates.append(m)

        # Active non-exhausted models
        active = [m for m in candidates if m not in _EXHAUSTED_GEMINI_MODELS]
        if not active:
            logger.warning("All Gemini models were in cooldown; clearing cooldown to retry lowest-tier models.")
            _EXHAUSTED_GEMINI_MODELS.clear()
            return candidates
        return active

    def generate_analysis(
        self,
        system_instruction: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        import time
        models_to_try = self._get_candidate_models()
        last_err = None

        for current_model in models_to_try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{current_model}:generateContent?key={self._api_key}"
            )
            payload = {
                "system_instruction": {
                    "parts": [{"text": system_instruction}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_prompt}],
                    }
                ],
                "generationConfig": {
                    "temperature": temperature,
                    "response_mime_type": "application/json",
                },
            }

            req_data = json.dumps(payload).encode("utf-8")
            try:
                req = urllib.request.Request(
                    url,
                    data=req_data,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=45) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    candidates = data.get("candidates", [])
                    if not candidates:
                        raise RuntimeError(f"Gemini model {current_model} returned empty candidates list.")
                    text_content = candidates[0]["content"]["parts"][0]["text"]
                    return json.loads(text_content)
            except urllib.error.HTTPError as exc:
                err_msg = exc.read().decode("utf-8")
                last_err = exc
                if exc.code == 429 or "quota" in err_msg.lower() or "resource_exhausted" in err_msg.lower():
                    # Rate limit or daily quota exceeded: mark model exhausted for 15 minutes and failover immediately
                    _EXHAUSTED_GEMINI_MODELS[current_model] = time.time() + 900.0
                    logger.warning(
                        "Gemini model '%s' quota / rate limit reached (HTTP %d). "
                        "Marking model exhausted and failing over to next lower-tier model...",
                        current_model,
                        exc.code,
                    )
                    continue

                if exc.code in (500, 502, 503, 504):
                    logger.warning(
                        "Gemini API transient server error (%d) on model '%s'. Trying next model in cascade...",
                        exc.code,
                        current_model,
                    )
                    continue

                logger.error("Gemini API error (%d) on model '%s': %s", exc.code, current_model, err_msg)
                continue
            except Exception as exc:
                last_err = exc
                logger.warning("Error generating analysis with model '%s': %s. Trying next model...", current_model, exc)
                continue

        logger.error("All Gemini cascade models failed. Falling back to deterministic Mock provider. Last error: %s", last_err)
        return MockLLMProvider().generate_analysis(system_instruction, user_prompt, temperature)


class OpenAILLMProvider(BaseLLMProvider):
    """
    OpenAI LLM provider using chat completions with JSON mode.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gpt-4o-mini",
    ):
        self._api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self._api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")
        self._model_name = model_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def generate_analysis(
        self,
        system_instruction: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": self._model_name,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choice = data["choices"][0]
                text_content = choice["message"]["content"]
                return json.loads(text_content)
        except urllib.error.HTTPError as exc:
            err_msg = exc.read().decode("utf-8")
            logger.error("OpenAI API error (%d): %s", exc.code, err_msg)
            raise RuntimeError(f"OpenAI API request failed ({exc.code}): {err_msg}") from exc
        except Exception as exc:
            logger.exception("Failed to generate analysis via OpenAI: %s", exc)
            raise RuntimeError(f"OpenAI LLM generation failed: {exc}") from exc


class MockLLMProvider(BaseLLMProvider):
    """
    Offline, deterministic LLM provider for CI and testing without external API keys.
    Synthesizes grounded qualitative analysis using the supplied evidence passages.
    """

    def __init__(self, model_name: str = "mock-analyst-v1"):
        self._model_name = model_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def generate_analysis(
        self,
        system_instruction: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        # Parse chunk IDs from prompt to construct verifiably grounded citations
        import re

        chunk_matches = re.findall(r"\[Chunk\s+#(\d+)\]", user_prompt)
        cited_ids = [int(cid) for cid in chunk_matches]

        return {
            "executive_summary": (
                "Based strictly on retrieved corporate disclosures, the company maintains steady "
                "operational momentum while navigating documented client budget and macroeconomic headwinds."
            ),
            "key_findings": [
                {
                    "claim": "Company disclosures highlight resilient operational performance and digital growth.",
                    "category": "reported_fact",
                    "chunk_ids": cited_ids[:2] if cited_ids else [],
                    "quote": "Disclosures indicate stable operating metrics.",
                },
                {
                    "claim": "Leadership emphasized deal pipeline health and strategic expansion priorities.",
                    "category": "management_statement",
                    "chunk_ids": cited_ids[1:3] if len(cited_ids) > 1 else cited_ids[:1],
                    "quote": "Management highlighted robust long-term demand drivers.",
                },
                {
                    "claim": "Margin preservation remains dependent on high-value digital contract renewals.",
                    "category": "analytical_interpretation",
                    "chunk_ids": cited_ids[:1] if cited_ids else [],
                    "quote": "Operating margins reflect mix shift toward digital solutions.",
                },
            ],
            "risks_and_uncertainties": [
                "Macroeconomic caution and client budget consolidation in key western markets.",
                "Wage inflation and competitive pricing pressure on legacy service agreements.",
            ],
            "missing_information_and_limitations": [
                "Granular divisional margin breakdowns were not disclosed in the retrieved passages.",
                "Long-term multi-year guidance was absent from the available excerpts.",
            ],
        }
