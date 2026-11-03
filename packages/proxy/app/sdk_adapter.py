"""Thin import adapter for the Steward SDK.

Handles the case where the SDK's __init__.py has a transient import bug
(e.g. referencing a class name that was renamed in types.py).
Falls back to loading submodules directly via a synthetic package entry.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import types as _pytypes

_sdk_loaded = False


def _ensure_steward_sdk() -> None:
    """Make sure the 'steward' package is importable."""
    global _sdk_loaded
    if _sdk_loaded:
        return

    try:
        import steward  # noqa: F401
        _sdk_loaded = True
        return
    except ImportError:
        pass

    # __init__.py failed — create a minimal package entry so submodule
    # imports (steward.guard, steward.types, etc.) still work.
    sys.modules.pop("steward", None)

    # Find the SDK directory
    proxy_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sdk_dir = os.path.join(proxy_dir, "..", "..", "sdk-python", "steward")
    sdk_dir = os.path.abspath(sdk_dir)

    if not os.path.isdir(sdk_dir):
        # Try via importlib (in case it's installed via pip)
        spec = importlib.util.find_spec("steward")
        if spec and spec.submodule_search_locations:
            sdk_dir = list(spec.submodule_search_locations)[0]
        else:
            raise ImportError(
                "Cannot locate the Steward SDK. "
                "Run: pip install -e ../sdk-python"
            )

    pkg = _pytypes.ModuleType("steward")
    pkg.__path__ = [sdk_dir]  # type: ignore[attr-defined]
    sys.modules["steward"] = pkg
    _sdk_loaded = True


def guard(messages, policy, feature):
    """Import and call steward.guard.guard."""
    _ensure_steward_sdk()
    from steward.guard import guard as _guard  # noqa: F401
    return _guard(messages, policy, feature)


def load_policy(name: str, policies_dir: str = ""):
    """Import and call steward.policy.load_policy."""
    _ensure_steward_sdk()
    from steward.policy import load_policy as _load
    if policies_dir:
        return _load(name, policies_dir)
    return _load(name)


def get_policy_class():
    """Return the Policy dataclass from the SDK."""
    _ensure_steward_sdk()
    from steward.types import Policy
    return Policy


def get_feature_class():
    """Return the Feature dataclass from the SDK."""
    _ensure_steward_sdk()
    from steward.types import Feature
    return Feature


def get_guard_result_class():
    """Return the GuardResult dataclass from the SDK."""
    _ensure_steward_sdk()
    from steward.types import GuardResult
    return GuardResult


def get_usage_class():
    """Return the Usage dataclass from the SDK."""
    _ensure_steward_sdk()
    from steward.types import Usage
    return Usage
