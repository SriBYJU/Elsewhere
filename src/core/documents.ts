import { z } from 'zod';
import { deepFreeze, definitions, getDefinition, validateParameters, validateTime } from './definitions';
import { simulate } from './simulation';
import type { Branch, CompileResult, Parameters, WorldDocument, WorldKind } from './types';

const MAX_BYTES = 1024 * 1024;
const MAX_HISTORY = 200;
const MAX_BRANCHES = 32;
const safeText = (max: number) => z.string().min(1).max(max).refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'Text contains control characters.');
const identifier = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const timestamp = z.string().datetime();
const parameterSchema = z.record(z.string().min(1).max(40), z.number().finite());
const branchSchema = z.object({ id: identifier, name: safeText(80), parameters: parameterSchema, time: z.number().int().nonnegative(), createdAt: timestamp, parentId: identifier.nullable() }).strict();
const worldSchema = z.object({
  format: z.literal('elsewhere'), version: z.literal(1), id: identifier,
  kind: z.enum(['manhattan', 'neural', 'semiconductor']), title: safeText(160), question: safeText(2000),
  createdAt: timestamp, updatedAt: timestamp, parameters: parameterSchema, time: z.number().int().nonnegative(),
  branches: z.array(branchSchema).min(1).max(MAX_BRANCHES), activeBranchId: identifier,
  history: z.array(z.object({ at: timestamp, action: safeText(240) }).strict()).max(MAX_HISTORY),
}).strict();

function validated(value: unknown): WorldDocument {
  const parsed = worldSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid world file: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`);
  const world = parsed.data;
  validateParameters(world.kind, world.parameters);
  validateTime(world.kind, world.time);
  const seen = new Set<string>();
  for (const [index, branch] of world.branches.entries()) {
    if (seen.has(branch.id)) throw new Error('Branch IDs must be unique.');
    if (index === 0 && (branch.id !== 'baseline' || branch.parentId !== null)) throw new Error('The first branch must be the baseline.');
    if (index > 0 && (!branch.parentId || !seen.has(branch.parentId))) throw new Error('Every scenario must reference an earlier parent branch.');
    validateParameters(world.kind, branch.parameters);
    validateTime(world.kind, branch.time);
    seen.add(branch.id);
  }
  const active = world.branches.find((branch) => branch.id === world.activeBranchId);
  if (!active || active.time !== world.time || Object.entries(world.parameters).some(([id, value]) => active.parameters[id] !== value)) throw new Error('The active branch must match the world parameters and time.');
  return deepFreeze(world);
}

function record(world: WorldDocument, action: string): WorldDocument {
  const at = new Date().toISOString();
  return { ...world, updatedAt: at, history: [...world.history, { at, action }].slice(-MAX_HISTORY) };
}

/** Accepts data only: imported equations, code, sources, and unknown fields are rejected. */
export function parseWorld(text: string): WorldDocument {
  if (typeof text !== 'string' || text.length > MAX_BYTES || new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new Error('World files must be no larger than 1 MB.');
  let data: unknown;
  try {
    data = JSON.parse(text, (key, value: unknown) => {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('Unsafe key.');
      return value;
    });
  } catch {
    throw new Error('Could not read world JSON. The file is malformed or contains unsafe keys.');
  }
  return validated(data);
}

export function serializeWorld(world: WorldDocument): string {
  const text = JSON.stringify(validated(world), null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new Error('World files must be no larger than 1 MB.');
  return text;
}

/** Compile into a supported, inspectable model. No generated science or remote LLM is implied. */
export function compileWorld(question: string, forcedKind?: WorldKind): CompileResult {
  const cleanQuestion = safeText(2000).parse(question.trim());
  const lower = cleanQuestion.toLowerCase();
  const matches = definitions.filter((definition) => {
    if (definition.id === 'neural') return /\b(neural|neuron|xor|backpropagation|learning rate|machine learning)\b/.test(lower);
    if (definition.id === 'semiconductor') return /\b(semiconductor|chip|chips|wafer|fabrication|fab|supply chain)\b/.test(lower);
    return /\b(manhattan|nyc|new york|traffic|transit|cars?|streets?)\b/.test(lower);
  });
  const kind = forcedKind ?? (matches.length === 1 ? matches[0].id : 'manhattan');
  const definition = getDefinition(kind);
  const parameters = Object.fromEntries(definition.variables.map((v) => [v.id, v.initial]));
  const notices = ['Runs a precompiled educational model locally. The question does not generate or validate new causal equations.'];
  if (!forcedKind && matches.length !== 1) notices.push(matches.length === 0 ? 'No supported topic matched. Opened the Manhattan example; your original question is preserved.' : 'Several topics matched. Opened the Manhattan example; choose a specific world to change the model.');
  if (forcedKind) notices.push(`Using the explicitly selected ${definition.title} model.`);
  // Only this narrow, reviewable phrase changes a starting parameter.
  if (kind === 'manhattan') {
    const reduction = lower.match(/\b(?:reduce|reduced|reducing|cut|cutting)\s+(?:private[ -]?)?cars?(?:\s+(?:activity|traffic))?\s+by\s+(\d+(?:\.\d+)?)\s*%/);
    if (reduction) {
      const amount = Number(reduction[1]);
      validateParameters(kind, { carReduction: amount }, true);
      parameters.carReduction = amount;
      notices.push(`Recognized private-car reduction: ${amount}%. Other starting values use the documented defaults.`);
    }
  }
  const at = new Date().toISOString();
  const baseline: Branch = { id: 'baseline', name: 'Baseline', parameters: { ...parameters }, time: definition.time.initial, createdAt: at, parentId: null };
  const world = validated({ format: 'elsewhere', version: 1, id: crypto.randomUUID(), kind, title: definition.title, question: cleanQuestion, createdAt: at, updatedAt: at, parameters, time: definition.time.initial, branches: [baseline], activeBranchId: baseline.id, history: [{ at, action: 'Compiled a preconfigured educational world.' }] });
  const result = simulate(kind, parameters, world.time);
  return {
    world, definition, route: 'precompiled', notices,
    stages: [
      { name: 'Interpret', detail: forcedKind ? 'Selected the requested world.' : matches.length === 1 ? 'Matched the question to a supported topic using local keywords.' : 'Used the disclosed example fallback.', count: 1 },
      { name: 'Assemble', detail: 'Loaded fixed model variables and explicitly typed claims.', count: definition.variables.length },
      { name: 'Ground', detail: 'Attached curated reference sources; no live retrieval or empirical fitting occurs during compilation.', count: definition.sources.length },
      { name: 'Simulate', detail: kind === 'neural' ? 'Ran seeded gradient descent and evaluated actual activations.' : 'Evaluated the documented scenario equations.', count: result.nodes.length },
      { name: 'Open world', detail: 'Saved an immutable initial baseline and local branch history.', count: result.edges.length },
    ],
  };
}

export function createBranch(world: WorldDocument, name?: string): WorldDocument {
  const valid = validated(world);
  if (valid.branches.length >= MAX_BRANCHES) throw new Error('This world already has 32 branches. Export it and start a new world to explore more.');
  const branchName = safeText(80).parse(name?.trim() || `Scenario ${valid.branches.length}`);
  const branch: Branch = { id: crypto.randomUUID(), name: branchName, parameters: { ...valid.parameters }, time: valid.time, createdAt: new Date().toISOString(), parentId: valid.activeBranchId };
  return validated(record({ ...valid, branches: [...valid.branches, branch], activeBranchId: branch.id }, `Created branch: ${branchName}`));
}

/** Updating the baseline forks it first. Existing branch snapshots never share mutable parameters. */
export function updateWorld(world: WorldDocument, values: Parameters = {}, time = world.time): WorldDocument {
  const valid = validated(world);
  validateParameters(valid.kind, values, true);
  validateTime(valid.kind, time);
  const parameters = { ...valid.parameters, ...values };
  if (time === valid.time && Object.entries(parameters).every(([id, value]) => valid.parameters[id] === value)) return valid;
  const target = valid.activeBranchId === 'baseline' ? createBranch(valid) : valid;
  const branches = target.branches.map((branch) => branch.id === target.activeBranchId ? { ...branch, parameters: { ...parameters }, time } : branch);
  const edits = Object.entries(values).map(([id, value]) => `${id}=${value}`).join(', ');
  return validated(record({ ...target, parameters, time, branches }, `Updated ${edits || 'timeline'}; time=${time}`));
}

export function switchBranch(world: WorldDocument, id: string): WorldDocument {
  const valid = validated(world);
  const branch = valid.branches.find((item) => item.id === id);
  if (!branch) throw new Error('That branch does not exist.');
  if (valid.activeBranchId === id) return valid;
  return validated(record({ ...valid, activeBranchId: id, parameters: { ...branch.parameters }, time: branch.time }, `Switched to ${branch.name}`));
}
