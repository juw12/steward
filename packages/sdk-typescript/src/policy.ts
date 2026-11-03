/**
 * Policy loading and validation (TypeScript).
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import type { Policy, Feature, GuardAction } from './types.js';

/**
 * Validate a raw policy object against the expected schema.
 * Throws Error if validation fails.
 */
export function validatePolicy(raw: unknown): void {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Policy must be an object');
  }
  const p = raw as Record<string, unknown>;

  const required: string[] = ['name', 'description', 'version', 'default_action', 'features'];
  for (const key of required) {
    if (p[key] === undefined) {
      throw new Error(`Policy missing required field: ${key}`);
    }
  }

  if (typeof p.name !== 'string') throw new Error('Policy.name must be a string');
  if (typeof p.description !== 'string') throw new Error('Policy.description must be a string');
  if (typeof p.version !== 'number' || p.version < 1) throw new Error('Policy.version must be int >= 1');

  const validActions: GuardAction[] = ['allow', 'redirect', 'block'];
  if (!validActions.includes(p.default_action as GuardAction)) {
    throw new Error('Policy.default_action must be allow, redirect, or block');
  }

  const features = p.features;
  if (typeof features !== 'object' || features === null || Array.isArray(features)) {
    throw new Error('Policy.features must be an object');
  }
  const featNames = Object.keys(features as object);
  if (featNames.length === 0) {
    throw new Error('Policy.features must have at least one feature');
  }

  for (const fname of featNames) {
    const feat = (features as Record<string, Record<string, unknown>>)[fname];
    if (typeof feat.description !== 'string') {
      throw new Error(`Feature '${fname}' missing description`);
    }
    if (!Array.isArray(feat.allowed_intents) || feat.allowed_intents.length === 0) {
      throw new Error(`Feature '${fname}' missing allowed_intents`);
    }
  }
}

function toFeature(raw: Record<string, unknown>): Feature {
  return {
    description: raw.description as string,
    allowed_intents: (raw.allowed_intents as string[]) ?? [],
    denied_intents: (raw.denied_intents as string[]) ?? [],
  };
}

function toPolicy(raw: Record<string, unknown>): Policy {
  const features: Record<string, Feature> = {};
  const rawFeatures = raw.features as Record<string, Record<string, unknown>>;
  for (const [name, feat] of Object.entries(rawFeatures)) {
    features[name] = toFeature(feat);
  }
  return {
    name: raw.name as string,
    description: raw.description as string,
    version: raw.version as number,
    default_action: raw.default_action as GuardAction,
    redirect_message: (raw.redirect_message as string) ?? '',
    block_message: (raw.block_message as string) ?? '',
    features,
  };
}

/**
 * Load and validate a policy from a YAML file path.
 */
export function loadPolicy(source: string): Policy {
  const content = fs.readFileSync(source, 'utf-8');
  const raw = yaml.load(content);
  validatePolicy(raw);
  return toPolicy(raw as Record<string, unknown>);
}

/**
 * Load and validate a policy from a YAML string.
 */
export function policyFromYaml(text: string): Policy {
  const raw = yaml.load(text);
  validatePolicy(raw);
  return toPolicy(raw as Record<string, unknown>);
}

/**
 * Load and validate a policy from a raw object (already parsed).
 */
export function policyFromDict(raw: Record<string, unknown>): Policy {
  validatePolicy(raw);
  return toPolicy(raw);
}
