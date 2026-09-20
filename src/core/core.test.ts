import { describe, expect, it } from 'vitest';
import {
  compileWorld,
  createBranch,
  definitions,
  interpretCommand,
  parseWorld,
  serializeWorld,
  simulate,
  switchBranch,
  updateWorld,
} from './index';

describe('Reality Compiler', () => {
  it('routes the three authored domains and exposes the universal compiler', () => {
    expect(compileWorld('What if Manhattan removed private cars?').world.kind).toBe('manhattan');
    expect(compileWorld('Show me how a neural network learns XOR').world.kind).toBe('neural');
    expect(compileWorld('Trace the semiconductor supply chain').world.kind).toBe('semiconductor');
    expect(definitions).toHaveLength(4);
    expect(definitions.some((definition)=>definition.id==='system')).toBe(true);
  });

  it('turns an unsupported question into a question-specific system world', () => {
    const result = compileWorld('How do coral reefs recover?');
    expect(result.world.kind).toBe('system');
    expect(result.world.blueprint?.archetype).toBe('ecosystem');
    expect(result.notices.join(' ')).toMatch(/universal system world/);
    expect(result.world.question).toBe('How do coral reefs recover?');
    const simulation=simulate('system',result.world.parameters,result.world.time,result.world.blueprint);
    expect(simulation.nodes).toHaveLength(6);
    expect(simulation.edges.length).toBeGreaterThan(0);
  });
});

describe('deterministic simulations', () => {
  it('changes Manhattan outputs in the expected direction', () => {
    const baseline = simulate('manhattan', { carReduction: 0, transitInvestment: 30, freightAdaptation: 40 }, 12);
    const scenario = simulate('manhattan', { carReduction: 100, transitInvestment: 30, freightAdaptation: 40 }, 12);
    expect(scenario.metrics.find((metric) => metric.id === 'traffic')!.value)
      .toBeLessThan(baseline.metrics.find((metric) => metric.id === 'traffic')!.value);
    expect(scenario.metrics.find((metric) => metric.id === 'space')!.value)
      .toBeGreaterThan(baseline.metrics.find((metric) => metric.id === 'space')!.value);
  });

  it('replays the neural network exactly for a fixed seed', () => {
    const parameters = { learningRate: 0.6, hiddenWidth: 4, seed: 42 };
    const first = simulate('neural', parameters, 600);
    const second = simulate('neural', parameters, 600);
    expect(second).toEqual(first);
    expect(first.samples).toHaveLength(441);
    expect(Number.isFinite(first.metrics.find((metric) => metric.id === 'loss')!.value)).toBe(true);
  });

  it('keeps semiconductor stock and backlog nonnegative under stress', () => {
    const result = simulate('semiconductor', { demandShock: 100, fabCapacity: 0, exportRestriction: 100, inventoryBuffer: 0 }, 36);
    expect(result.metrics.find((metric) => metric.id === 'inventory')!.value).toBeGreaterThanOrEqual(0);
    expect(result.metrics.find((metric) => metric.id === 'backlog')!.value).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).toMatch(/backlog/i);
  });

  it('rejects missing, unknown, and out-of-range inputs', () => {
    expect(() => simulate('manhattan', { carReduction: 10 }, 1)).toThrow(/missing/i);
    expect(() => simulate('manhattan', { carReduction: 10, transitInvestment: 10, freightAdaptation: 10, invented: 1 }, 1)).toThrow(/Unknown parameter/);
    expect(() => simulate('neural', { learningRate: 50, hiddenWidth: 4, seed: 42 }, 1)).toThrow(/between/);
  });
});

describe('.elsewhere documents', () => {
  it('forks before editing an immutable baseline and reopens both realities', () => {
    const original = compileWorld('What if Manhattan had no private cars?', 'manhattan').world;
    const edited = updateWorld(original, { carReduction: 100 });
    expect(edited.branches).toHaveLength(2);
    expect(edited.branches[0].parameters).toEqual(original.parameters);
    expect(edited.activeBranchId).not.toBe('baseline');
    const reopened = switchBranch(edited, 'baseline');
    expect(reopened.parameters).toEqual(original.parameters);
  });

  it('serializes and validates a branched world', () => {
    const world = createBranch(compileWorld('How does XOR learn?', 'neural').world, 'Different seed');
    expect(parseWorld(serializeWorld(world))).toEqual(world);
  });

  it('serializes a generated world without executable content',()=>{
    const world=compileWorld('How does a CPU move instructions through memory?').world;
    expect(world.kind).toBe('system');
    expect(parseWorld(serializeWorld(world))).toEqual(world);
  });

  it('rejects executable or prototype-like imported fields', () => {
    const world = compileWorld('Show the chip supply web', 'semiconductor').world;
    const unknown = { ...world, equation: 'globalThis.alert(1)' };
    expect(() => parseWorld(JSON.stringify(unknown))).toThrow(/Unrecognized key|Invalid world file/);
    const unsafe = serializeWorld(world).replace('"parameters": {', '"__proto__": {}, "parameters": {');
    expect(() => parseWorld(unsafe)).toThrow(/malformed|unsafe/i);
  });
});

describe('command interpreter', () => {
  it('translates structured operations and fails closed', () => {
    expect(interpretCommand('set learning rate to 0.5', 'neural')).toEqual({ type: 'set', values: { learningRate: 0.5 } });
    expect(interpretCommand('compare with baseline', 'manhattan')).toEqual({ type: 'compare' });
    expect(interpretCommand('invent a source', 'manhattan').type).toBe('unknown');
  });
});
