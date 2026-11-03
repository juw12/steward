/**
 * Steward SDK type definitions (TypeScript).
 */

export type GuardAction = 'allow' | 'redirect' | 'block';
export type GuardCategory = 'on_mission' | 'off_task_curious' | 'off_task_abuse' | 'hostile_injection';

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface GuardResult {
  action: GuardAction;
  category: GuardCategory;
  reason: string;
  redirect_message: string | null;
  usage: Usage;
}

export interface Feature {
  description: string;
  allowed_intents: string[];
  denied_intents: string[];
}

export interface Policy {
  name: string;
  description: string;
  version: number;
  default_action: GuardAction;
  redirect_message: string;
  block_message: string;
  features: Record<string, Feature>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
