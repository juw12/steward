/**
 * Intent classifier — deterministic, no external API calls (TypeScript).
 * Mirrors the Python classifier logic exactly.
 */

import type { Policy, Feature, Message, GuardAction, GuardCategory } from './types.js';

// ---------------------------------------------------------------------------
// Keyword maps: intent_name -> list of keywords/phrases
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS: Record<string, string[]> = {
  // --- Refund / returns ---
  request_refund: ['refund', 'get my money back', 'return for refund', 'full refund', 'partial refund'],
  check_refund_status: ['refund status', 'where is my refund', 'refund pending', 'refund timeline', 'when will i get my refund'],
  dispute_charge: ['dispute', 'chargeback', 'contesting the charge', 'unauthorized charge', 'fraudulent charge'],
  return_item: ['return this item', 'send back', 'return it', 'exchange', 'wrong item', 'damaged item'],
  // --- Account ---
  reset_password: ['reset password', 'forgot password', 'change password', 'password reset', "can't log in"],
  update_email: ['change email', 'update email', 'new email address', 'switch email'],
  change_plan: ['upgrade plan', 'downgrade plan', 'switch plan', 'change subscription', 'cancel subscription', 'plan change'],
  close_account: ['delete account', 'close account', 'deactivate account', 'remove my account', 'cancel my account'],
  // --- Orders ---
  track_order: ['track order', 'order status', 'where is my order', 'delivery status', 'shipment'],
  check_shipping: ['shipping', 'delivery date', 'estimated arrival', 'shipping status', 'carrier'],
  change_delivery_address: ['change address', 'new address', 'redirect package', 'update delivery'],
  cancel_order: ['cancel order', 'cancel my order', 'stop the order', 'cancel before shipping'],
  // --- Coding ---
  review_code: ['review this code', 'code review', 'check my code', 'improve this code', 'refactor'],
  find_bugs: ['bug', 'error', 'not working', 'crash', 'exception', 'stack trace', 'broken'],
  suggest_improvements: ['improve', 'optimize', 'better way', 'best practice', 'clean up'],
  check_complexity: ['complexity', 'too long', 'simplify', 'reduce cyclomatic', 'too many branches'],
  debug_error: ['debug', 'trace', 'root cause', 'why is this failing', 'fix this error'],
  trace_stack: ['stack trace', 'call stack', 'traceback', 'line number', 'frame'],
  fix_crash: ['crash', 'segfault', 'panic', 'unhandled exception', 'runtime error'],
  explain_error_message: ['what does this error mean', 'explain this error', 'error message', 'what is this exception'],
  explain_code: ['explain this code', 'what does this do', 'how does this work', 'walk me through'],
  explain_algorithm: ['algorithm', 'time complexity', 'big O', 'sort', 'search algorithm', 'dynamic programming'],
  explain_design_pattern: ['design pattern', 'singleton', 'observer', 'factory', 'strategy pattern', 'dependency injection'],
  compare_approaches: ['which is better', 'compare', 'tradeoff', 'trade-off', 'pros and cons', 'vs'],
  // --- General ---
  answer_questions: ['what is', 'who is', 'tell me about', 'define', 'meaning of', 'what does'],
  summarize_text: ['summarize', 'summary', 'tl;dr', 'key points', 'condense', 'shorten'],
  write_draft: ['write a', 'draft', 'compose', 'help me write', 'write me a'],
  brainstorm_ideas: ['ideas for', 'brainstorm', 'suggest some', 'options for', 'what if'],
  translate_text: ['translate', 'translation', 'in french', 'in spanish', 'in japanese', 'how to say'],
  explain_concept: ['explain', 'what is', 'how does', 'tell me about', 'what are'],
  search_information: ['look up', 'research', 'find information', 'search for', 'latest news about'],
  compare_options: ['compare', 'which is better', 'difference between', 'vs', 'alternatives to'],
  fact_check: ['is this true', 'fact check', 'verify', 'is it correct', 'source for'],
  // --- Denied / off-topic ---
  write_creative_content: ['write a poem', 'write a story', 'creative writing', 'short story', 'haiku', 'write a song', 'fiction', 'novel'],
  general_knowledge: ['what is the capital', 'population of', 'history of', 'trivia', 'fun fact', 'recipe', 'weather'],
  give_medical_advice: ['diagnose', 'symptoms', 'medical advice', 'treatment', 'prescribe', 'dosage', 'doctor'],
  give_legal_advice: ['legal advice', 'lawsuit', 'contract law', 'should i sue', 'legal rights', 'attorney'],
  financial_advice: ['stock pick', 'buy this stock', 'investment advice', 'crypto recommendation', 'should i invest'],
  hack_system: ['hack', 'exploit', 'breach', 'penetration test', 'bypass security', 'crack password', 'sql injection'],
  write_malware: ['malware', 'virus', 'ransomware', 'trojan', 'backdoor', 'rootkit', 'keylogger'],
  generate_hate_speech: ['hate speech', 'slur', 'discriminate against', 'dehumanize'],
  impersonate_person: ['impersonate', 'act as if you are', 'pretend to be', 'speak as'],
};

// ---------------------------------------------------------------------------
// Jailbreak / hostile injection patterns
// ---------------------------------------------------------------------------

const JAILBREAK_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+(in\s+)?(dan|developer|god|admin|root)\s+mode/i,
  /enable\s+(dan|developer|god|admin)\s+mode/i,
  /\bdan\s+mode\b/i,
  /do\s+anything\s+now/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|new|unrestricted|unfiltered)/i,
  /pretend\s+you\s+(are|were)\s+not\s+(ai|a\s+language\s+model)/i,
  /system\s+prompt/i,
  /reveal\s+(your|the)\s+(system\s+prompt|instructions|rules)/i,
  /show\s+(me\s+)?(your|the)\s+(system\s+prompt|instructions|rules)/i,
  /what\s+(are|is)\s+your\s+(system\s+prompt|initial\s+instructions)/i,
  /new\s+instructions?\s*:/i,
  /\[system\]/i,
  /<\s*\/?\s*system\s*>/i,
  /act\s+as\s+if\s+(you\s+have\s+)?no\s+(restrictions|limits|rules)/i,
  /without\s+(any\s+)?(restrictions|limitations|filters)/i,
  /jailbreak/i,
  /override\s+(your|the)\s+(safety|guard|policy|rules)/i,
  /bypass\s+(your|the)\s+(safety|guard|policy|filters|restrictions)/i,
  /developer\s+mode\s+(enabled|activated|on)/i,
  /i\s+am\s+(the\s+)?(developer|admin|owner)\s+of\s+(this\s+)?(system|model)/i,
];

// ---------------------------------------------------------------------------
// Off-task curious indicators
// ---------------------------------------------------------------------------

const CURIOUS_PATTERNS: RegExp[] = [
  /\b(hi|hello|hey|howdy)\b/i,
  /how are you/i,
  /tell me a (joke|story|fact)/i,
  /what (do|did) you (think|say)/i,
  /\b(do you (like|have|want))\b/i,
  /what's (the|a) (weather|time|date)/i,
  /fun fact/i,
  /recommend (a|me)\s+(movie|book|song|restaurant|show)/i,
  /write (a|me)\s+(poem|story|song|haiku)/i,
  /what (is|are)\s+(the\s+)?(capital|population|currency)\s+of/i,
  /\brecipe\b/i,
];

// ---------------------------------------------------------------------------
// Off-task abuse indicators
// ---------------------------------------------------------------------------

const ABUSE_PATTERNS: RegExp[] = [
  /(generate|write|create)\s+(a\s+)?(hate|offensive|abusive|slur)/i,
  /how\s+do\s+i\s+(hack|steal|rob|break\s+into)/i,
  /teach\s+me\s+how\s+to\s+(hack|exploit|bypass)/i,
  /write\s+(a\s+)?(scam|phishing|fraudulent)/i,
  /(create|make)\s+(a\s+)?(fake|forged|counterfeit)\s+(document|id|check)/i,
  /help\s+me\s+(cheat|defraud|embezzle)/i,
  /how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive)/i,
];

// ---------------------------------------------------------------------------
// Score types and helpers
// ---------------------------------------------------------------------------

export interface ClassificationScores {
  on_mission: number;
  off_task_curious: number;
  off_task_abuse: number;
  hostile_injection: number;
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function keywordScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const norm = normalize(text);
  let matches = 0;
  for (const kw of keywords) {
    if (norm.includes(kw.toLowerCase())) {
      matches++;
    }
  }
  const denom = Math.max(1, Math.min(keywords.length, 3));
  return Math.min(1.0, matches / denom);
}

function intentScoreForText(text: string, intents: string[]): number {
  if (intents.length === 0) return 0;
  const scores: number[] = [];
  for (const intent of intents) {
    const keywords = INTENT_KEYWORDS[intent] ?? [intent.replace(/_/g, ' ')];
    const s = keywordScore(text, keywords);
    if (s > 0) scores.push(s);
  }
  if (scores.length === 0) return 0;
  return Math.max(...scores);
}

function jailbreakScore(text: string): number {
  let matches = 0;
  for (const pat of JAILBREAK_PATTERNS) {
    if (pat.test(text)) {
      matches++;
    }
  }
  return Math.min(1.0, matches / 2.0);
}

function curiousScore(text: string): number {
  let matches = 0;
  for (const pat of CURIOUS_PATTERNS) {
    if (pat.test(text)) {
      matches++;
    }
  }
  return Math.min(1.0, matches / 2.0);
}

function abuseScore(text: string): number {
  let matches = 0;
  for (const pat of ABUSE_PATTERNS) {
    if (pat.test(text)) {
      matches++;
    }
  }
  return Math.min(1.0, matches / 1.5);
}

function driftScore(
  messages: Message[],
  policy: Policy,
  feature: string,
  window: number = 5,
): number {
  const userMsgs = messages.filter((m) => m.role === 'user');
  if (userMsgs.length < 2) return 0;

  const recent = userMsgs.slice(-window);
  const feat = policy.features[feature];
  if (!feat) return 0;

  const offFlags: boolean[] = [];
  for (const msg of recent) {
    const text = msg.content;
    const on = intentScoreForText(text, feat.allowed_intents);
    const off = intentScoreForText(text, feat.denied_intents);
    offFlags.push(off > on && off > 0.3);
  }

  if (offFlags.length === 0) return 0;
  const driftRatio = offFlags.filter(Boolean).length / offFlags.length;
  return driftRatio >= 0.6 ? driftRatio : 0;
}

// ---------------------------------------------------------------------------
// Main classify function
// ---------------------------------------------------------------------------

export function classify(messages: Message[], policy: Policy, feature: string): ClassificationScores {
  const feat = policy.features[feature];
  if (!feat) {
    return { on_mission: 0, off_task_curious: 0.5, off_task_abuse: 0, hostile_injection: 0 };
  }

  const userMsgs = messages.filter((m) => m.role === 'user');
  if (userMsgs.length === 0) {
    return { on_mission: 0, off_task_curious: 0, off_task_abuse: 0, hostile_injection: 0 };
  }

  const lastUserText = userMsgs[userMsgs.length - 1].content;
  const fullText = userMsgs.slice(-3).map((m) => m.content).join(' ');

  // 1. On-mission score
  let onMission = intentScoreForText(lastUserText, feat.allowed_intents);
  const onMissionCtx = intentScoreForText(fullText, feat.allowed_intents);
  onMission = Math.max(onMission, onMissionCtx * 0.8);

  // 2. Off-task curious
  const deniedScore = intentScoreForText(lastUserText, feat.denied_intents);
  const curiousPattern = curiousScore(lastUserText);
  let offTaskCurious = Math.max(deniedScore * 0.7, curiousPattern);

  // 3. Off-task abuse
  const offTaskAbuse = abuseScore(lastUserText);

  // 4. Hostile injection
  const hostileInjection = jailbreakScore(lastUserText);

  // 5. Drift
  const drift = driftScore(messages, policy, feature);
  if (drift > 0.5) {
    offTaskCurious = Math.max(offTaskCurious, drift * 0.6);
    if (onMission < 0.4) {
      onMission *= 0.5;
    }
  }

  return {
    on_mission: Math.min(1.0, onMission),
    off_task_curious: Math.min(1.0, offTaskCurious),
    off_task_abuse: Math.min(1.0, offTaskAbuse),
    hostile_injection: Math.min(1.0, hostileInjection),
  };
}

// ---------------------------------------------------------------------------
// Resolve scores to action/category/reason
// ---------------------------------------------------------------------------

export interface Resolution {
  action: GuardAction;
  category: GuardCategory;
  reason: string;
  redirect_message: string | null;
}

export function resolve(
  scores: ClassificationScores,
  policy: Policy,
  feature: string,
): Resolution {
  const feat = policy.features[feature];

  // Priority 1: hostile injection
  if (scores.hostile_injection > 0.5) {
    return {
      action: 'block',
      category: 'hostile_injection',
      reason: 'Message contains jailbreak/injection patterns',
      redirect_message: null,
    };
  }

  // Priority 2: off-task abuse
  if (scores.off_task_abuse > 0.5) {
    return {
      action: 'block',
      category: 'off_task_abuse',
      reason: 'Message indicates abusive misuse outside policy scope',
      redirect_message: null,
    };
  }

  // Priority 3: on-mission
  if (
    scores.on_mission >= scores.off_task_curious &&
    scores.on_mission >= scores.off_task_abuse &&
    scores.on_mission > 0.3
  ) {
    return {
      action: 'allow',
      category: 'on_mission',
      reason: `Message aligns with allowed intents for feature '${feature}'`,
      redirect_message: null,
    };
  }

  // Priority 4: off-task curious
  if (scores.off_task_curious > scores.on_mission) {
    let action: GuardAction = 'redirect';
    if (feat && feat.denied_intents.length > 0 && scores.off_task_curious > 0.7) {
      action = 'block';
    }
    if (action === 'redirect') {
      return {
        action: 'redirect',
        category: 'off_task_curious',
        reason: `Message is off-topic for feature '${feature}'`,
        redirect_message: policy.redirect_message,
      };
    }
    return {
      action: 'block',
      category: 'off_task_abuse',
      reason: `Message matches denied intents for feature '${feature}'`,
      redirect_message: null,
    };
  }

  // Priority 5: fallback to default action
  return {
    action: policy.default_action,
    category: 'off_task_curious',
    reason: `No strong signal; applying default action '${policy.default_action}'`,
    redirect_message: policy.default_action === 'redirect' ? policy.redirect_message : null,
  };
}
