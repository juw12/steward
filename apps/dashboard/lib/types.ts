// Steward Proxy API types — mirrors the SQLite schema in the plan (section 5)

export type GuardAction = 'allow' | 'redirect' | 'block';
export type GuardCategory =
  | 'on_mission'
  | 'off_task_curious'
  | 'off_task_abuse'
  | 'hostile_injection';

export interface AuditEntry {
  id: number;
  timestamp: string;
  feature: string;
  category: GuardCategory;
  action: GuardAction;
  reason: string | null;
  user_message: string | null;
  redirect_message: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  response_time_ms: number;
}

export interface AuditResponse {
  entries: AuditEntry[];
  limit: number;
  offset: number;
}

export interface AuditStats {
  total: number;
  by_category: Partial<Record<GuardCategory, number>>;
  by_action: Partial<Record<GuardAction, number>>;
  by_feature: Record<string, number>;
  total_cost: number;
}

export interface PolicySummary {
  id: number;
  name: string;
  feature_count: number;
}

export interface PolicyDetail {
  name: string;
  description: string;
  version: number;
  default_action: GuardAction;
  redirect_message: string;
  block_message: string;
  features: Record<
    string,
    {
      description: string;
      allowed_intents: string[];
      denied_intents: string[];
    }
  >;
}
