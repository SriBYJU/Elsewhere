import { describe, expect, it } from 'vitest';
import { compileWorld, parseWorld, serializeWorld, simulate } from './index';
import { buildSystemBlueprint, classifyArchetype, definitionFromBlueprint, hasHistoricalIntent, inferWorldSetting } from './universal';

describe('place and time interpretation',()=>{
  it.each([
    'Virginia 2000 years ago',
    'What was Virginia like two thousand years ago?',
    'Take me to Kyoto in 1600',
    'Explore Timbuktu around 1300',
    'Alexandria in 200 BCE',
    'Rome AD 200',
    'London, 1666',
    'Visit Cusco in the 15th century',
    'New York 500 years ago',
  ])('recognizes a historical setting: %s',(question)=>{
    expect(hasHistoricalIntent(question)).toBe(true);
    expect(classifyArchetype(question)).toBe('history');
    const compiled=compileWorld(question);
    expect(compiled.world.kind).toBe('system');
    expect(compiled.world.blueprint?.archetype).toBe('history');
    expect(compiled.definition.description).toMatch(/illustrative historical world/i);
    expect(compiled.definition.limitations.join(' ')).toMatch(/not a playback of historical years/);
  });

  it('makes Virginia recognizable without presenting an exact historical reconstruction',()=>{
    const question='What was Virginia like 2,000 years ago?';
    const blueprint=buildSystemBlueprint(question);
    const setting=inferWorldSetting(question);
    expect(setting).toMatchObject({place:'Virginia',terrain:'woodland',historical:true,deepTime:false});
    expect(blueprint.summary).toMatch(/Virginia.*Middle Woodland/);
    expect(blueprint.nodes.map(node=>node.label).join(' ')).toMatch(/rivers & woodland.*River hamlets.*Indigenous communities/);
    expect(blueprint.nodes.some(node=>/Institutions|Actors & coalitions|Historical outcome/.test(node.label))).toBe(false);
    expect(blueprint.sources.find(source=>source.id==='virginia-middle-woodland')?.publisher).toBe('Virginia Department of Historic Resources');
    expect(blueprint.edges.every(edge=>edge.confidence==='low'&&edge.sourceIds.length===0)).toBe(true);
    expect(blueprint.summary).toMatch(/not an exact reconstruction/);
    expect(blueprint.limitations.join(' ')).toMatch(/fixed reference year 2026/);
    const definition=definitionFromBlueprint(question,blueprint);
    expect(definition.claims.find(claim=>claim.id==='system-context')?.detail).toMatch(/Bundled references/);
  });

  it('does not attach Middle Woodland evidence to a different place or period',()=>{
    for(const question of ['Kyoto 2000 years ago','Virginia in 1860','Virginia 8000 years ago']){
      const blueprint=buildSystemBlueprint(question);
      expect(blueprint.sources.some(source=>source.id==='virginia-middle-woodland')).toBe(false);
      expect(blueprint.summary).not.toMatch(/Middle Woodland/);
      expect(blueprint.nodes.map(node=>node.label).join(' ')).not.toMatch(/River hamlets|Indigenous communities/);
    }
  });

  it('supports unknown place names and Unicode without claiming a mapped location',()=>{
    const blueprint=buildSystemBlueprint('Take me to Reykjavík in 1800');
    expect(inferWorldSetting('Take me to Reykjavík in 1800').place).toBe('Reykjavík');
    expect(blueprint.nodes[0].label).toContain('Reykjavík');
    expect(blueprint.sources).toHaveLength(0);
    expect(blueprint.nodes.every(node=>node.sourceIds.length===0)).toBe(true);
    expect(blueprint.limitations.join(' ')).toMatch(/do not establish historical borders/);
    const current=buildSystemBlueprint('Take me to Bengaluru');
    expect(current.nodes[0].label).toContain('Bengaluru');
    expect(current.summary).toMatch(/illustrative cues, not verified geography/);
  });

  it('uses natural context rather than human settlement for deep-time requests',()=>{
    const blueprint=buildSystemBlueprint('Earth 65 million years ago');
    expect(inferWorldSetting('Earth 65 million years ago').deepTime).toBe(true);
    expect(blueprint.nodes.map(node=>node.label).join(' ')).not.toMatch(/Homes|Communities|hamlets|exchange/);
    expect(blueprint.nodes[0].description).toMatch(/Present-day coastlines and borders must not be assumed/);
  });

  it('does not confuse engineering quantities or future dates with historical settings',()=>{
    expect(classifyArchetype('A CPU running at 2000 MHz')).toBe('cpu');
    expect(hasHistoricalIntent('Network latency of 1000 milliseconds')).toBe(false);
    expect(hasHistoricalIntent('Tokyo in 2050')).toBe(false);
    expect(compileWorld('New York 500 years ago','manhattan').world.kind).toBe('manhattan');
  });

  it.each(['Tokyo streets','How could Lagos reduce car traffic?','Show me transit in Reykjavík'])('does not silently substitute Manhattan for another place: %s',(question)=>{
    const result=compileWorld(question);
    expect(result.world.kind).toBe('system');
    expect(result.world.question).toBe(question);
    expect(result.definition.title).not.toMatch(/Manhattan/);
  });
});

describe('domain interpretation and reproducibility',()=>{
  it.each([
    ['How do companies coordinate employees?','company'],
    ['How do banks price bonds and mortgages?','finance'],
    ['Trace freight shipments between warehouses','supply-chain'],
    ['Show branch prediction in a processor','cpu'],
    ['How do Wi-Fi routers connect devices?','internet'],
    ['Explain gravitational forces between stars','science'],
    ['Explore geothermal power plants and turbines','energy'],
    ['How do mangroves and coral reefs recover?','ecosystem'],
    ['Explore the Sahara desert','ecosystem'],
    ['Explain a power grid network','energy'],
  ])('selects the appropriate supported domain: %s',(question,archetype)=>{
    expect(classifyArchetype(question)).toBe(archetype);
  });

  it('keeps historical branches serializable and their simulation deterministic',()=>{
    const world=compileWorld('Virginia 2000 years ago').world;
    expect(parseWorld(serializeWorld(world))).toEqual(world);
    const blueprint=world.blueprint!;
    const baseline=simulate('system',world.parameters,world.time,blueprint);
    const parameters={...world.parameters,inputPressure:50};
    const changed=simulate('system',parameters,world.time,blueprint);
    expect(simulate('system',parameters,world.time,blueprint)).toEqual(changed);
    expect(changed.nodes.find(node=>node.id==='event')!.value).toBeGreaterThan(baseline.nodes.find(node=>node.id==='event')!.value);
    expect(changed.metrics.every(metric=>Number.isFinite(metric.value)&&metric.value>=0&&metric.value<=200)).toBe(true);
    expect(changed.warnings.join(' ')).toMatch(/bundled references/);
    expect(changed.warnings.join(' ')).not.toMatch(/contains no question-specific external sources/);
  });
});
