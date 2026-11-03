"""Steward SDK — governance layer for embedded AI.

Usage:
    from steward import guard, Policy, GuardResult, load_policy

    policy = load_policy("policies/customer-support.yaml")
    result = guard(
        messages=[{"role": "user", "content": "I want a refund"}],
        policy=policy,
        feature="refunds",
    )
    print(result.action)      # "allow"
    print(result.category)    # "on_mission"
"""

from .types import GuardResult, GuardAction, GuardCategory, Policy, Feature, Usage
from .policy import load_policy, policy_from_dict, policy_from_yaml
from .guard import guard

__version__ = "0.1.0"

__all__ = [
    "guard",
    "Policy",
    "Feature",
    "GuardResult",
    "GuardAction",
    "GuardCategory",
    "Usage",
    "load_policy",
    "policy_from_dict",
    "policy_from_yaml",
]
