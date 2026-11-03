/**
 * @steward/sdk — governance layer for embedded AI (TypeScript).
 *
 * Usage:
 *   import { guard, loadPolicy } from '@steward/sdk';
 *
 *   const policy = loadPolicy('policies/customer-support.yaml');
 *   const result = guard({
 *     messages: [{ role: 'user', content: 'I want a refund' }],
 *     policy,
 *     feature: 'refunds',
 *   });
 *   console.log(result.action);   // "allow"
 *   console.log(result.category); // "on_mission"
 */

export { guard } from './guard.js';
export { loadPolicy, policyFromYaml, policyFromDict, validatePolicy } from './policy.js';
export { classify, resolve } from './classifier.js';
export type {
  GuardAction,
  GuardCategory,
  GuardResult,
  Message,
  Policy,
  Feature,
  Usage,
} from './types.js';
export type { ClassificationScores, Resolution } from './classifier.js';
export type { GuardParams } from './guard.js';

export const version = '0.1.0';
