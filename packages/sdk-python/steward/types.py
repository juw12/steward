"""Steward SDK type definitions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional

GuardAction = Literal["allow", "redirect", "block"]
GuardCategory = Literal["on_mission", "off_task_curious", "off_task_abuse", "hostile_injection"]


@dataclass
class Usage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0


@dataclass
class GuardResult:
    action: GuardAction
    category: GuardCategory
    reason: str
    redirect_message: Optional[str] = None
    usage: Usage = field(default_factory=Usage)


@dataclass
class Feature:
    description: str
    allowed_intents: list[str] = field(default_factory=list)
    denied_intents: list[str] = field(default_factory=list)


@dataclass
class Policy:
    name: str
    description: str
    version: int
    default_action: GuardAction = "redirect"
    redirect_message: str = ""
    block_message: str = ""
    features: dict[str, Feature] = field(default_factory=dict)
