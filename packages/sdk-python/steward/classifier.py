"""Intent classifier — deterministic, no external API calls."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .types import Feature, Policy, GuardCategory

# ---------------------------------------------------------------------------
# Keyword maps: intent_name -> list of keywords/phrases
# ---------------------------------------------------------------------------

INTENT_KEYWORDS: dict[str, list[str]] = {
    # --- Refund / returns ---
    "request_refund": ["refund", "get my money back", "return for refund", "full refund", "partial refund"],
    "check_refund_status": ["refund status", "where is my refund", "refund pending", "refund timeline", "when will i get my refund"],
    "dispute_charge": ["dispute", "chargeback", "contesting the charge", "unauthorized charge", "fraudulent charge"],
    "return_item": ["return this item", "send back", "return it", "exchange", "wrong item", "damaged item"],
    # --- Account ---
    "reset_password": ["reset password", "forgot password", "change password", "password reset", "can't log in"],
    "update_email": ["change email", "update email", "new email address", "switch email"],
    "change_plan": ["upgrade plan", "downgrade plan", "switch plan", "change subscription", "cancel subscription", "plan change"],
    "close_account": ["delete account", "close account", "deactivate account", "remove my account", "cancel my account"],
    # --- Orders ---
    "track_order": ["track order", "order status", "where is my order", "delivery status", "shipment"],
    "check_shipping": ["shipping", "delivery date", "estimated arrival", "shipping status", "carrier"],
    "change_delivery_address": ["change address", "new address", "redirect package", "update delivery"],
    "cancel_order": ["cancel order", "cancel my order", "stop the order", "cancel before shipping"],
    # --- Coding ---
    "review_code": ["review this code", "code review", "check my code", "improve this code", "refactor"],
    "find_bugs": ["bug", "error", "not working", "crash", "exception", "stack trace", "broken"],
    "suggest_improvements": ["improve", "optimize", "better way", "best practice", "clean up"],
    "check_complexity": ["complexity", "too long", "simplify", "reduce cyclomatic", "too many branches"],
    "debug_error": ["debug", "trace", "root cause", "why is this failing", "fix this error"],
    "trace_stack": ["stack trace", "call stack", "traceback", "line number", "frame"],
    "fix_crash": ["crash", "segfault", "panic", "unhandled exception", "runtime error"],
    "explain_error_message": ["what does this error mean", "explain this error", "error message", "what is this exception"],
    "explain_code": ["explain this code", "what does this do", "how does this work", "walk me through"],
    "explain_algorithm": ["algorithm", "time complexity", "big O", "sort", "search algorithm", "dynamic programming"],
    "explain_design_pattern": ["design pattern", "singleton", "observer", "factory", "strategy pattern", "dependency injection"],
    "compare_approaches": ["which is better", "compare", "tradeoff", "trade-off", "pros and cons", "vs"],
    # --- General ---
    "answer_questions": ["what is", "who is", "tell me about", "define", "meaning of", "what does"],
    "summarize_text": ["summarize", "summary", "tl;dr", "key points", "condense", "shorten"],
    "write_draft": ["write a", "draft", "compose", "help me write", "write me a"],
    "brainstorm_ideas": ["ideas for", "brainstorm", "suggest some", "options for", "what if"],
    "translate_text": ["translate", "translation", "in french", "in spanish", "in japanese", "how to say"],
    "explain_concept": ["explain", "what is", "how does", "tell me about", "what are"],
    "search_information": ["look up", "research", "find information", "search for", "latest news about"],
    "compare_options": ["compare", "which is better", "difference between", "vs", "alternatives to"],
    "fact_check": ["is this true", "fact check", "verify", "is it correct", "source for"],
    # --- Denied / off-topic ---
    "write_creative_content": ["write a poem", "write a story", "creative writing", "short story", "haiku", "write a song", "fiction", "novel"],
    "general_knowledge": ["what is the capital", "population of", "history of", "trivia", "fun fact", "recipe", "weather"],
    "give_medical_advice": ["diagnose", "symptoms", "medical advice", "treatment", "prescribe", "dosage", "doctor"],
    "give_legal_advice": ["legal advice", "lawsuit", "contract law", "should i sue", "legal rights", "attorney"],
    "financial_advice": ["stock pick", "buy this stock", "investment advice", "crypto recommendation", "should i invest"],
    "hack_system": ["hack", "exploit", "breach", "penetration test", "bypass security", "crack password", "sql injection"],
    "write_malware": ["malware", "virus", "ransomware", "trojan", "backdoor", "rootkit", "keylogger"],
    "generate_hate_speech": ["hate speech", "slur", "discriminate against", "dehumanize"],
    "impersonate_person": ["impersonate", "act as if you are", "pretend to be", "speak as"],
}

# ---------------------------------------------------------------------------
# Jailbreak / hostile injection patterns
# ---------------------------------------------------------------------------

JAILBREAK_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"ignore\s+(all\s+)?prior\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"forget\s+(all\s+)?(previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(in\s+)?(dan|developer|god|admin|root)\s+mode", re.IGNORECASE),
    re.compile(r"enable\s+(dan|developer|god|admin)\s+mode", re.IGNORECASE),
    re.compile(r"\bdan\s+mode\b", re.IGNORECASE),
    re.compile(r"do\s+anything\s+now", re.IGNORECASE),
    re.compile(r"pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|new|unrestricted|unfiltered)", re.IGNORECASE),
    re.compile(r"pretend\s+you\s+(are|were)\s+not\s+(ai|a\s+language\s+model)", re.IGNORECASE),
    re.compile(r"system\s+prompt", re.IGNORECASE),
    re.compile(r"reveal\s+(your|the)\s+(system\s+prompt|instructions|rules)", re.IGNORECASE),
    re.compile(r"show\s+(me\s+)?(your|the)\s+(system\s+prompt|instructions|rules)", re.IGNORECASE),
    re.compile(r"what\s+(are|is)\s+your\s+(system\s+prompt|initial\s+instructions)", re.IGNORECASE),
    re.compile(r"new\s+instructions?\s*:", re.IGNORECASE),
    re.compile(r"\[system\]", re.IGNORECASE),
    re.compile(r"<\s*/?\s*system\s*>", re.IGNORECASE),
    re.compile(r"act\s+as\s+if\s+(you\s+have\s+)?no\s+(restrictions|limits|rules)", re.IGNORECASE),
    re.compile(r"without\s+(any\s+)?(restrictions|limitations|filters)", re.IGNORECASE),
    re.compile(r"jailbreak", re.IGNORECASE),
    re.compile(r"override\s+(your|the)\s+(safety|guard|policy|rules)", re.IGNORECASE),
    re.compile(r"bypass\s+(your|the)\s+(safety|guard|policy|filters|restrictions)", re.IGNORECASE),
    re.compile(r"developer\s+mode\s+(enabled|activated|on)", re.IGNORECASE),
    re.compile(r"i\s+am\s+(the\s+)?(developer|admin|owner)\s+of\s+(this\s+)?(system|model)", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Off-task curious indicators (harmless but off-topic)
# ---------------------------------------------------------------------------

CURIOUS_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\b(hi|hello|hey|howdy)\b", re.IGNORECASE),
    re.compile(r"how are you", re.IGNORECASE),
    re.compile(r"tell me a (joke|story|fact)", re.IGNORECASE),
    re.compile(r"what (do|did) you (think|say)", re.IGNORECASE),
    re.compile(r"\b(do you (like|have|want))\b", re.IGNORECASE),
    re.compile(r"what's (the|a) (weather|time|date)", re.IGNORECASE),
    re.compile(r"fun fact", re.IGNORECASE),
    re.compile(r"recommend (a|me)\s+(movie|book|song|restaurant|show)", re.IGNORECASE),
    re.compile(r"write (a|me)\s+(poem|story|song|haiku)", re.IGNORECASE),
    re.compile(r"what (is|are)\s+(the\s+)?(capital|population|currency)\s+of", re.IGNORECASE),
    re.compile(r"\brecipe\b", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Off-task abuse indicators (aggressive misuse, not direct injection)
# ---------------------------------------------------------------------------

ABUSE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(generate|write|create)\s+(a\s+)?(hate|offensive|abusive|slur)", re.IGNORECASE),
    re.compile(r"how\s+do\s+i\s+(hack|steal|rob|break\s+into)", re.IGNORECASE),
    re.compile(r"teach\s+me\s+how\s+to\s+(hack|exploit|bypass)", re.IGNORECASE),
    re.compile(r"write\s+(a\s+)?(scam|phishing|fraudulent)", re.IGNORECASE),
    re.compile(r"(create|make)\s+(a\s+)?(fake|forged|counterfeit)\s+(document|id|check)", re.IGNORECASE),
    re.compile(r"help\s+me\s+(cheat|defraud|embezzle)", re.IGNORECASE),
    re.compile(r"how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive)", re.IGNORECASE),
]


@dataclass
class ClassificationScores:
    """Scores for each category, each in [0, 1]."""

    on_mission: float = 0.0
    off_task_curious: float = 0.0
    off_task_abuse: float = 0.0
    hostile_injection: float = 0.0


def _normalize(text: str) -> str:
    return text.lower().strip()


def _keyword_score(text: str, keywords: list[str]) -> float:
    """Score how well text matches a list of keywords. Returns 0-1."""
    if not keywords:
        return 0.0
    norm = _normalize(text)
    matches = 0
    for kw in keywords:
        if kw.lower() in norm:
            matches += 1
    return min(1.0, matches / max(1, min(len(keywords), 3)))


def _intent_score_for_text(text: str, intents: list[str]) -> float:
    """Aggregate keyword score across multiple intents."""
    if not intents:
        return 0.0
    scores = []
    for intent in intents:
        keywords = INTENT_KEYWORDS.get(intent, [intent.replace("_", " ")])
        s = _keyword_score(text, keywords)
        if s > 0:
            scores.append(s)
    if not scores:
        return 0.0
    return max(scores)


def _jailbreak_score(text: str) -> float:
    """Score how many jailbreak patterns match. Returns 0-1."""
    norm = _normalize(text)
    matches = 0
    for pat in JAILBREAK_PATTERNS:
        if pat.search(text):
            matches += 1
    return min(1.0, matches / 2.0)  # 2+ matches → full score


def _curious_score(text: str) -> float:
    """Score how curious/off-topic (harmless) the text seems."""
    matches = 0
    for pat in CURIOUS_PATTERNS:
        if pat.search(text):
            matches += 1
    return min(1.0, matches / 2.0)


def _abuse_score(text: str) -> float:
    """Score how abusive the text seems."""
    matches = 0
    for pat in ABUSE_PATTERNS:
        if pat.search(text):
            matches += 1
    return min(1.0, matches / 1.5)


def _drift_score(
    messages: list[dict[str, str]],
    policy: Policy,
    feature: str,
    window: int = 5,
) -> float:
    """
    Multi-turn drift detection.
    Checks if recent user messages are increasingly off-topic.
    Returns 0-1: higher = more drift.
    """
    user_msgs = [m for m in messages if m.get("role") == "user"]
    if len(user_msgs) < 2:
        return 0.0

    recent = user_msgs[-window:]
    feat = policy.features.get(feature)
    if feat is None:
        return 0.0

    allowed = feat.allowed_intents
    denied = feat.denied_intents

    # Score each recent message for on-mission relevance
    on_scores = []
    for msg in recent:
        text = msg.get("content", "")
        on = _intent_score_for_text(text, allowed)
        off = _intent_score_for_text(text, denied)
        # If message is clearly off-task (denied match > allowed match), flag it
        on_scores.append(off > on and off > 0.3)

    # Drift: if 60%+ of recent messages are off-task, we have drift
    if len(on_scores) == 0:
        return 0.0
    drift_ratio = sum(on_scores) / len(on_scores)
    return drift_ratio if drift_ratio >= 0.6 else 0.0


def classify(
    messages: list[dict[str, str]],
    policy: Policy,
    feature: str,
) -> ClassificationScores:
    """
    Classify the conversation against the policy's feature.
    Returns scores for each category in [0, 1].
    """
    feat = policy.features.get(feature)
    if feat is None:
        # Unknown feature → treat everything as off-task
        return ClassificationScores(
            on_mission=0.0,
            off_task_curious=0.5,
            off_task_abuse=0.0,
            hostile_injection=0.0,
        )

    # Use the last user message as primary signal
    user_msgs = [m for m in messages if m.get("role") == "user"]
    if not user_msgs:
        return ClassificationScores()

    last_user_text = user_msgs[-1].get("content", "")
    # Also consider full conversation for drift
    full_text = " ".join(m.get("content", "") for m in user_msgs[-3:])

    # 1. On-mission score: keyword match against allowed intents
    on_mission = _intent_score_for_text(last_user_text, feat.allowed_intents)
    # Also check full recent context
    on_mission_ctx = _intent_score_for_text(full_text, feat.allowed_intents)
    on_mission = max(on_mission, on_mission_ctx * 0.8)

    # 2. Off-task curious: denied intent match + curious patterns
    denied_score = _intent_score_for_text(last_user_text, feat.denied_intents)
    curious_pattern = _curious_score(last_user_text)
    off_task_curious = max(denied_score * 0.7, curious_pattern)

    # 3. Off-task abuse: abuse patterns
    off_task_abuse = _abuse_score(last_user_text)

    # 4. Hostile injection: jailbreak patterns
    hostile_injection = _jailbreak_score(last_user_text)

    # 5. Drift: multi-turn signal
    drift = _drift_score(messages, policy, feature)
    if drift > 0.5:
        # Drift increases off-task scores
        off_task_curious = max(off_task_curious, drift * 0.6)
        # If the current message is on-mission but drift is high, reduce on_mission
        if on_mission < 0.4:
            on_mission *= 0.5

    # Clamp
    return ClassificationScores(
        on_mission=min(1.0, on_mission),
        off_task_curious=min(1.0, off_task_curious),
        off_task_abuse=min(1.0, off_task_abuse),
        hostile_injection=min(1.0, hostile_injection),
    )


def resolve(scores: ClassificationScores, policy: Policy, feature: str) -> tuple[str, str, str, str | None]:
    """
    Resolve scores to (action, category, reason, redirect_message).
    
    Priority:
      1. hostile_injection > 0.5 → block
      2. off_task_abuse > 0.5 → block
      3. on_mission is highest and > 0.3 → allow
      4. off_task_curious is highest → redirect (or default_action)
      5. Fallback → default_action
    """
    feat = policy.features.get(feature)

    # Priority 1: hostile injection
    if scores.hostile_injection > 0.5:
        return (
            "block",
            "hostile_injection",
            "Message contains jailbreak/injection patterns",
            None,
        )

    # Priority 2: off-task abuse
    if scores.off_task_abuse > 0.5:
        return (
            "block",
            "off_task_abuse",
            "Message indicates abusive misuse outside policy scope",
            None,
        )

    # Priority 3: on-mission
    if scores.on_mission >= scores.off_task_curious and scores.on_mission >= scores.off_task_abuse and scores.on_mission > 0.3:
        return (
            "allow",
            "on_mission",
            f"Message aligns with allowed intents for feature '{feature}'",
            None,
        )

    # Priority 4: off-task curious
    if scores.off_task_curious > scores.on_mission:
        action = "redirect"
        if feat and feat.denied_intents and scores.off_task_curious > 0.7:
            action = "block"
        if action == "redirect":
            return (
                "redirect",
                "off_task_curious",
                f"Message is off-topic for feature '{feature}'",
                policy.redirect_message,
            )
        return (
            "block",
            "off_task_abuse",
            f"Message matches denied intents for feature '{feature}'",
            None,
        )

    # Priority 5: fallback to default action
    return (
        policy.default_action,
        "off_task_curious",
        f"No strong signal; applying default action '{policy.default_action}'",
        policy.redirect_message if policy.default_action == "redirect" else None,
    )
