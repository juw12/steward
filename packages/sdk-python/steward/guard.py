"""Steward guard — main entry point."""

from __future__ import annotations

import re
from typing import Any

from .classifier import classify, resolve
from .types import GuardResult, Usage, Policy


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English."""
    return max(1, len(text) // 4)


def guard(
    messages: list[dict[str, str]],
    policy: Policy,
    feature: str,
) -> GuardResult:
    """
    Run the Steward guard on a set of messages.

    Args:
        messages: List of {"role": "user"|"assistant"|"system", "content": "..."}
        policy: Validated Policy object
        feature: Feature name from the policy

    Returns:
        GuardResult with action, category, reason, redirect_message, usage
    """
    scores = classify(messages, policy, feature)
    action, category, reason, redirect_message = resolve(scores, policy, feature)

    # Estimate usage (mock — real tokens come from the LLM proxy)
    total_text = " ".join(m.get("content", "") for m in messages)
    prompt_tokens = _estimate_tokens(total_text)
    completion_tokens = 0
    total_tokens = prompt_tokens
    cost_usd = 0.0

    return GuardResult(
        action=action,  # type: ignore[arg-type]
        category=category,  # type: ignore[arg-type]
        reason=reason,
        redirect_message=redirect_message,
        usage=Usage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
        ),
    )
