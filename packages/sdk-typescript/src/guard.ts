/**
 * Steward guard — main entry point (TypeScript).
 */

import type { Message, Policy, GuardResult, Usage } from './types.js';
import { classify, resolve } from './classifier.js';

function estimateTokens(text: string): number {
  return Math.max(1, Math.floor(text.length / 4));
}

export interface GuardParams {
  messages: Message[];
  policy: Policy;
  feature: string;
}

export function guard(params: GuardParams): GuardResult {
  const { messages, policy, feature } = params;

  const scores = classify(messages, policy, feature);
  const { action, category, reason, redirect_message } = resolve(scores, policy, feature);

  // Estimate usage (mock — real tokens come from the LLM proxy)
  const totalText = messages.map((m) => m.content).join(' ');
  const prompt_tokens = estimateTokens(totalText);
  const completion_tokens = 0;
  const total_tokens = prompt_tokens;
  const cost_usd = 0.0;

  const usage: Usage = {
    prompt_tokens,
    completion_tokens,
    total_tokens,
    cost_usd,
  };

  return {
    action,
    category,
    reason,
    redirect_message,
    usage,
  };
}
