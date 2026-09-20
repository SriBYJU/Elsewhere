import { z } from 'zod';
import { deepFreeze, definitions, getDefinition, validateParameters, validateTime } from './definitions';
import { simulate } from './simulation';
import { buildSystemBlueprint, definitionFromBlueprint, researchQuestion } from './universal';
import type { Branch, CompileResult, Parameters, WorldDocument, WorldKind } from './types';

const MAX_BYTES = 1024 * 1024;
const MAX_HISTORY = 200;
const MAX_BRANCHES = 32;
const safeText = (max: number) => z.string().min(1).max(max).refine((value) =>
  [...value].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }), 'Text contains control characters.');
const identifier = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const timestamp = z.string().datetime();
const parameterSchema = z.record(z.string().min(1).max(40), z.number().finite());
const branchSchema = z.object({ id: identifier, name: safeText(80), parameters: parameterSchema, time: z.number().int().nonnegative(), createdAt: timestamp, parentId: identifier.nullable() }).strict();
const sourceSchema=z.object({id:identifier,title:safeText(200),url:z.string().url().max(2048).refine(value=>value.startsWith('https://'),'Source URLs must use HTTPS.'),publisher:safeText(120),published:safeText(80),accessed:safeText(40),note:safeText(1000)}).strict();
const variableSchema=z.object({id:identifier,label:safeText(120),min:z.number().finite(),max:z.number().finite(),step:z.number().positive().finite(),initial:z.number().finite(),unit:z.string().max(30),description:safeText(500),claimIds:z.array(identifier).max(20),targetId:identifier.optional()}).strict();
const blueprintSchema=z.object({
  archetype:z.enum(['company','finance','supply-chain','cpu','internet','science','history','energy','ecosystem','general']),subject:safeText(160),summary:safeText(1000),
  nodes:z.array(z.object({id:identifier,label:safeText(120),role:safeText(60),description:safeText(500),baseline:z.number().finite().min(0).max(200),position:z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]),sourceIds:z.array(identifier).max(20)}).strict()).min(2).max(64),
  edges:z.array(z.object({from:identifier,to:identifier,polarity:z.union([z.literal(-1),z.literal(1)]),strength:z.number().finite().min(0).max(1),lag:z.number().finite().min(0).max(120),confidence:z.enum(['high','medium','low']),description:safeText(500),sourceIds:z.array(identifier).max(20)}).strict()).max(160),
  variables:z.array(variableSchema).min(1).max(12),sources:z.array(sourceSchema).max(12),researchStatus:z.enum(['researched','offline']),limitations:z.array(safeText(500)).min(1).max(20),
}).strict();
const worldSchema = z.object({
  format: z.literal('elsewhere'), version: z.literal(1), id: identifier,
  kind: z.enum(['manhattan', 'neural', 'semiconductor', 'system']), title: safeText(160), question: safeText(2000),
  createdAt: timestamp, updatedAt: timestamp, parameters: parameterSchema, time: z.number().int().nonnegative(),
  branches: z.array(branchSchema).min(1).max(MAX_BRANCHES), activeBranchId: identifier,
  history: z.array(z.object({ at: timestamp, action: safeText(240) }).strict()).max(MAX_HISTORY),
  blueprint:blueprintSchema.optional(),
}).strict();

function validated(value: unknown): WorldDocument {
  const parsed = worldSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid world file: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`);
  const world = parsed.data;
  if(world.kind==='system'&&!world.blueprint)throw new Error('Generated worlds require a system blueprint.');
  if(world.kind!=='system'&&world.blueprint)throw new Error('Authored worlds cannot contain a generated blueprint.');
  if(world.blueprint){
    const nodeIds=new Set(world.blueprint.nodes.map(node=>node.id));
    const sourceIds=new Set(world.blueprint.sources.map(source=>source.id));
    if(nodeIds.size!==world.blueprint.nodes.length)throw new Error('Blueprint node IDs must be unique.');
    if(sourceIds.size!==world.blueprint.sources.length)throw new Error('Blueprint source IDs must be unique.');
    if(world.blueprint.edges.some(edge=>!nodeIds.has(edge.from)||!nodeIds.has(edge.to)))throw new Error('Blueprint edges must reference known nodes.');
    if(world.blueprint.variables.some(variable=>variable.targetId&&!nodeIds.has(variable.targetId)))throw new Error('Blueprint controls must reference known nodes.');
    if([...world.blueprint.nodes,...world.blueprint.edges].some(item=>item.sourceIds.some(id=>!sourceIds.has(id))))throw new Error('Blueprint evidence links must reference known sources.');
    const expected=getDefinition('system').variables;
    if(world.blueprint.variables.length!==expected.length||expected.some(spec=>{const actual=world.blueprint!.variables.find(variable=>variable.id===spec.id);return !actual||actual.min!==spec.min||actual.max!==spec.max||actual.step!==spec.step||actual.initial!==spec.initial;}))throw new Error('Blueprint controls do not match the safe universal runtime contract.');
  }
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

export function definitionForWorld(world:Pick<WorldDocument,'kind'|'question'|'blueprint'>){
  return world.kind==='system'&&world.blueprint?definitionFromBlueprint(world.question,world.blueprint):getDefinition(world.kind);
}

/** Compile into an inspectable local model. Unknown domains become disclosed generic system maps. */
export function compileWorld(question: string, forcedKind?: WorldKind): CompileResult {
  const cleanQuestion = safeText(2000).parse(question.trim());
  const lower = cleanQuestion.toLowerCase();
  const matches = definitions.filter((definition) => definition.id!=='system'&&(() => {
    if (definition.id === 'neural') return /\b(neural|neuron|xor|backpropagation|learning rate|machine learning)\b/.test(lower);
    if (definition.id === 'semiconductor') return /\b(semiconductor|chip|chips|wafer|fabrication|fab)\b/.test(lower);
    return /\b(manhattan|nyc|new york|traffic|transit|cars?|streets?)\b/.test(lower);
  })());
  const kind = forcedKind ?? (matches.length === 1 ? matches[0].id : 'system');
  const blueprint=kind==='system'?buildSystemBlueprint(cleanQuestion):undefined;
  const definition = blueprint?definitionFromBlueprint(cleanQuestion,blueprint):getDefinition(kind);
  const parameters = Object.fromEntries(definition.variables.map((v) => [v.id, v.initial]));
  const notices = kind==='system'?['Built an exploratory system map from a reusable archetype. Causal links and sensitivities are disclosed assumptions, not researched facts.']:['Runs a precompiled educational model locally. The question does not generate or validate new causal equations.'];
  if (!forcedKind && matches.length !== 1) notices.push(matches.length === 0 ? 'No authored model matched, so Elsewhere built a question-specific universal system world.' : 'Several authored topics matched, so Elsewhere built a neutral universal system world.');
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
  const world = validated({ format: 'elsewhere', version: 1, id: crypto.randomUUID(), kind, title: definition.title, question: cleanQuestion, createdAt: at, updatedAt: at, parameters, time: definition.time.initial, branches: [baseline], activeBranchId: baseline.id, history: [{ at, action: kind==='system'?'Compiled an exploratory system world.':'Compiled a preconfigured educational world.' }], blueprint });
  const result = simulate(kind, parameters, world.time,blueprint);
  return {
    world, definition, route: kind==='system'?'deterministic':'precompiled', notices,
    stages: [
      { name: 'Interpret', detail: forcedKind ? 'Selected the requested world.' : matches.length === 1 ? 'Matched the question to an authored model.' : `Classified a ${blueprint?.archetype??'known'} connected system.`, count: 1 },
      { name: 'Assemble', detail: kind==='system'?'Created entities, flows, constraints, feedback, and intervention points.':'Loaded fixed model variables and explicitly typed claims.', count: definition.variables.length },
      { name: 'Ground', detail: kind==='system'?'Prepared the world for public context research; assumptions remain separate.':'Attached curated reference sources; no live retrieval or empirical fitting occurs during compilation.', count: definition.sources.length },
      { name: 'Simulate', detail: kind === 'neural' ? 'Ran seeded gradient descent and evaluated actual activations.' : 'Evaluated the documented deterministic scenario.', count: result.nodes.length },
      { name: 'Open world', detail: 'Saved an immutable initial baseline and local branch history.', count: result.edges.length },
    ],
  };
}

/** Adds bounded public context to universal worlds. Failure leaves a complete offline world. */
export async function compileQuestion(question:string,forcedKind?:WorldKind):Promise<CompileResult>{
  const initial=compileWorld(question,forcedKind);
  if(initial.world.kind!=='system')return initial;
  const sources=await researchQuestion(initial.world.question);
  const blueprint=buildSystemBlueprint(initial.world.question,sources,sources.length?'researched':'offline');
  const definition=definitionFromBlueprint(initial.world.question,blueprint);
  const parameters=Object.fromEntries(blueprint.variables.map(variable=>[variable.id,variable.initial]));
  const baseline={...initial.world.branches[0],parameters};
  const world=validated({...initial.world,title:definition.title,parameters,branches:[baseline],blueprint,history:[...initial.world.history,{at:new Date().toISOString(),action:sources.length?`Attached ${sources.length} public context sources.`:'Continued offline after public research was unavailable.'}]});
  const result=simulate('system',parameters,world.time,blueprint);
  return {...initial,world,definition,notices:[...initial.notices,sources.length?`Retrieved ${sources.length} public context sources. They inform topic orientation, not causal calibration.`:'Public context research was unavailable. The world remains usable offline and says so in Source DNA.'],stages:initial.stages.map(stage=>stage.name==='Ground'?{...stage,detail:sources.length?'Attached live public context while keeping causal assumptions separate.':'Research was unavailable; preserved an explicit offline evidence state.',count:sources.length}:stage.name==='Simulate'?{...stage,count:result.nodes.length}:stage)};
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
