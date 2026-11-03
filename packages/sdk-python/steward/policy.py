"""Policy loading and validation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from .types import Feature, Policy

# JSON Schema for policy validation
_POLICY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["name", "description", "version", "default_action", "features"],
    "properties": {
        "name": {"type": "string"},
        "description": {"type": "string"},
        "version": {"type": "integer", "minimum": 1},
        "default_action": {"type": "string", "enum": ["allow", "redirect", "block"]},
        "redirect_message": {"type": "string"},
        "block_message": {"type": "string"},
        "features": {
            "type": "object",
            "minProperties": 1,
            "additionalProperties": {
                "type": "object",
                "required": ["description", "allowed_intents"],
                "properties": {
                    "description": {"type": "string"},
                    "allowed_intents": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "denied_intents": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
        },
    },
}


def _validate(raw: dict[str, Any]) -> None:
    """Validate policy dict against schema. Raises ValueError on failure."""
    try:
        import jsonschema

        jsonschema.validate(instance=raw, schema=_POLICY_SCHEMA)
    except ImportError:
        # Fallback: manual validation without jsonschema
        _manual_validate(raw)
    except Exception as e:
        raise ValueError(f"Policy validation failed: {e}") from e


def _manual_validate(raw: dict[str, Any]) -> None:
    """Minimal manual validation when jsonschema is not installed."""
    for key in ("name", "description", "version", "default_action", "features"):
        if key not in raw:
            raise ValueError(f"Policy missing required field: {key}")
    if raw["default_action"] not in ("allow", "redirect", "block"):
        raise ValueError("default_action must be allow, redirect, or block")
    if not isinstance(raw["features"], dict) or not raw["features"]:
        raise ValueError("features must be a non-empty dict")
    for fname, feat in raw["features"].items():
        if "description" not in feat:
            raise ValueError(f"Feature '{fname}' missing description")
        if "allowed_intents" not in feat or not feat["allowed_intents"]:
            raise ValueError(f"Feature '{fname}' missing allowed_intents")


def load_policy(source: str | Path) -> Policy:
    """Load and validate a policy from a YAML file path."""
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"Policy file not found: {path}")
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Policy file must contain a YAML mapping")
    _validate(raw)
    return _to_policy(raw)


def policy_from_dict(raw: dict[str, Any]) -> Policy:
    """Load and validate a policy from a raw dict (already parsed)."""
    if not isinstance(raw, dict):
        raise ValueError("Policy must be a dict")
    _validate(raw)
    return _to_policy(raw)


def policy_from_yaml(text: str) -> Policy:
    """Load and validate a policy from a YAML string."""
    raw = yaml.safe_load(text)
    if not isinstance(raw, dict):
        raise ValueError("Policy YAML must be a mapping")
    _validate(raw)
    return _to_policy(raw)


def _to_policy(raw: dict[str, Any]) -> Policy:
    features: dict[str, Feature] = {}
    for name, feat_raw in raw.get("features", {}).items():
        features[name] = Feature(
            description=feat_raw["description"],
            allowed_intents=feat_raw.get("allowed_intents", []),
            denied_intents=feat_raw.get("denied_intents", []),
        )
    return Policy(
        name=raw["name"],
        description=raw["description"],
        version=raw["version"],
        default_action=raw["default_action"],
        redirect_message=raw.get("redirect_message", ""),
        block_message=raw.get("block_message", ""),
        features=features,
    )
