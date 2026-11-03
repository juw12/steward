"""FastAPI route handlers for the Steward proxy."""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, StreamingResponse

from . import audit, llm, sdk_adapter

router = APIRouter()

_subscribers: List[asyncio.Queue] = []

# Resolve policies directory
_PROXY_DIR = Path(__file__).resolve().parent.parent
STEWARD_DIR = _PROXY_DIR.parent.parent  # steward/
# Canonical location (Agent A) takes priority, local fallback (Agent B) second
POLICIES_DIRS = [
    STEWARD_DIR / "policies",
    _PROXY_DIR / "policies",
]


def _find_policy_file(name: str) -> Optional[Path]:
    """Find a policy YAML file by name across known directories."""
    for d in POLICIES_DIRS:
        for ext in (".yaml", ".yml"):
            p = d / f"{name}{ext}"
            if p.exists():
                return p
    return None


def _load_policy_yaml(name: str) -> Dict[str, Any]:
    """Load a policy YAML by name. Raises FileNotFoundError if not found."""
    path = _find_policy_file(name)
    if path is None:
        raise FileNotFoundError(f"Policy '{name}' not found")
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _broadcast(entry: Dict[str, Any]) -> None:
    """Push a new audit entry to every connected SSE subscriber."""
    dead: List[asyncio.Queue] = []
    for q in _subscribers:
        try:
            q.put_nowait(entry)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        try:
            _subscribers.remove(q)
        except ValueError:
            pass


def _build_sdk_policy(data: Dict[str, Any]):
    """Convert a raw policy dict into the SDK's Policy dataclass."""
    Policy = sdk_adapter.get_policy_class()
    Feature = sdk_adapter.get_feature_class()

    features = {}
    for feat_name, feat_data in (data.get("features") or {}).items():
        features[feat_name] = Feature(
            description=feat_data.get("description", ""),
            allowed_intents=feat_data.get("allowed_intents", []),
            denied_intents=feat_data.get("denied_intents", []),
        )

    return Policy(
        name=data.get("name", ""),
        description=data.get("description", ""),
        version=data.get("version", 1),
        default_action=data.get("default_action", "redirect"),
        redirect_message=(data.get("redirect_message") or "").strip(),
        block_message=(data.get("block_message") or "").strip(),
        features=features,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/v1/chat/completions")
async def chat_completions(request: Dict[str, Any]):
    """OpenAI-compatible chat completions with Steward guard."""
    start_time = time.time()

    model = request.get("model", "gpt-4o-mini")
    messages = request.get("messages", [])
    steward_ext = request.get("steward", {})
    policy_name = steward_ext.get("policy", "general-purpose")
    feature = steward_ext.get("feature", "")

    # Load policy
    try:
        policy_data = _load_policy_yaml(policy_name)
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"error": str(e)})

    policy = _build_sdk_policy(policy_data)

    # Run the SDK guard
    result = sdk_adapter.guard(messages=messages, policy=policy, feature=feature)

    # Extract last user message for audit
    user_msgs = [m for m in messages if m.get("role") == "user"]
    user_message = user_msgs[-1].get("content", "") if user_msgs else ""

    # Build response
    if result.action == "allow":
        content, usage = llm.get_completion(messages, model)
        response: Dict[str, Any] = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
            "usage": usage,
            "steward": {
                "action": result.action,
                "category": result.category,
                "reason": result.reason,
            },
        }
    else:
        msg = result.redirect_message or "I can only help with specific topics."
        response = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": msg},
                    "finish_reason": "stop",
                }
            ],
            "steward": {
                "action": result.action,
                "category": result.category,
                "reason": result.reason,
            },
        }

    # Write audit log
    response_time_ms = int((time.time() - start_time) * 1000)
    audit.log_entry(
        audit.DB_PATH,
        feature=feature,
        category=result.category,
        action=result.action,
        reason=result.reason,
        user_message=user_message,
        redirect_message=result.redirect_message,
        prompt_tokens=result.usage.prompt_tokens,
        completion_tokens=result.usage.completion_tokens,
        total_tokens=result.usage.total_tokens,
        cost_usd=result.usage.cost_usd,
        response_time_ms=response_time_ms,
    )

    _broadcast({
        "feature": feature,
        "category": result.category,
        "action": result.action,
        "reason": result.reason,
        "user_message": user_message,
        "redirect_message": result.redirect_message,
        "prompt_tokens": result.usage.prompt_tokens,
        "completion_tokens": result.usage.completion_tokens,
        "total_tokens": result.usage.total_tokens,
        "cost_usd": result.usage.cost_usd,
        "response_time_ms": response_time_ms,
    })

    return response


@router.get("/v1/audit")
def get_audit(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    category: Optional[str] = None,
    action: Optional[str] = None,
    feature: Optional[str] = None,
):
    """Paginated audit log with optional filters."""
    entries = audit.query_entries(
        audit.DB_PATH,
        limit=limit,
        offset=offset,
        category=category,
        action=action,
        feature=feature,
    )
    return {"entries": entries, "limit": limit, "offset": offset}


@router.get("/v1/audit/stats")
def get_audit_stats():
    """Aggregated audit stats for the dashboard."""
    return audit.get_stats(audit.DB_PATH)


async def _audit_event_stream():
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.append(queue)
    try:
        while True:
            entry = await queue.get()
            yield f"event: audit\ndata: {json.dumps(entry)}\n\n"
    finally:
        try:
            _subscribers.remove(queue)
        except ValueError:
            pass


@router.get("/v1/audit/stream")
async def stream_audit():
    """Server-Sent Events stream of new audit entries."""
    return StreamingResponse(
        _audit_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/v1/policies")
def list_policies():
    """List all available policies."""
    results = []
    seen = set()
    for d in POLICIES_DIRS:
        if not d.exists():
            continue
        for path in sorted(list(d.glob("*.yaml")) + list(d.glob("*.yml"))):
            if path.stem in seen:
                continue
            seen.add(path.stem)
            try:
                with open(path, encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                results.append(
                    {
                        "id": data.get("name", path.stem),
                        "name": data.get("name", path.stem),
                        "description": data.get("description", ""),
                        "version": data.get("version", 1),
                        "feature_count": len(data.get("features", {})),
                    }
                )
            except Exception:
                continue
    return {"policies": results}


@router.get("/v1/policies/{name}")
def get_policy(name: str):
    """Get a single policy as JSON."""
    try:
        data = _load_policy_yaml(name)
        return data
    except FileNotFoundError as e:
        return JSONResponse(status_code=404, content={"error": str(e)})
