"""LLM client — mock mode (no API key) or real OpenAI via httpx."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Tuple

import httpx

MOCK_PREFIX = "Understood. "


def get_completion(
    messages: List[Dict[str, str]],
    model: str = "gpt-4o-mini",
) -> Tuple[str, Dict[str, Any]]:
    """
    Get a completion from the LLM.

    Returns (content, usage_dict) where usage_dict has keys:
      prompt_tokens, completion_tokens, total_tokens, cost_usd
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return _mock_completion(messages, model)
    return _openai_completion(messages, model, api_key)


def _mock_completion(messages: List[Dict[str, str]], model: str) -> Tuple[str, Dict[str, Any]]:
    """Deterministic mock: echoes the last user message with a polite prefix."""
    user_msgs = [m for m in messages if m.get("role") == "user"]
    last_user = user_msgs[-1].get("content", "") if user_msgs else ""
    content = f"{MOCK_PREFIX}You said: {last_user}"

    prompt_tokens = max(1, sum(len(m.get("content", "")) for m in messages) // 4)
    completion_tokens = max(1, len(content) // 4)
    total_tokens = prompt_tokens + completion_tokens
    cost_usd = round(total_tokens * 0.000005, 8)

    return content, {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "cost_usd": cost_usd,
    }


def _openai_completion(
    messages: List[Dict[str, str]],
    model: str,
    api_key: str,
) -> Tuple[str, Dict[str, Any]]:
    """Call the real OpenAI chat completions API."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {"model": model, "messages": messages}

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    usage_raw = data.get("usage", {})

    return content, {
        "prompt_tokens": usage_raw.get("prompt_tokens", 0),
        "completion_tokens": usage_raw.get("completion_tokens", 0),
        "total_tokens": usage_raw.get("total_tokens", 0),
        "cost_usd": 0.0,
    }
