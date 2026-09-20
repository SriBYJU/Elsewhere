import { getDefinition, validateParameters, validateTime } from './definitions';
import type { Command, Parameters, WorldKind } from './types';

const normalize = (text: string) => text.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
const aliases: Record<WorldKind, Record<string, string[]>> = {
  manhattan: {
    carReduction: ['car reduction', 'private car reduction', 'cars', 'private cars'],
    transitInvestment: ['transit investment', 'transit capacity', 'transit capacity investment', 'transit'],
    freightAdaptation: ['freight adaptation', 'freight', 'delivery adaptation'],
  },
  neural: { learningRate: ['learning rate', 'rate'], hiddenWidth: ['hidden width', 'hidden neurons', 'neurons', 'width'], seed: ['seed', 'random seed'] },
  semiconductor: { demandShock: ['demand', 'demand shock', 'demand increase'], fabCapacity: ['fab capacity', 'fab capacity expansion', 'fabrication capacity'], exportRestriction: ['export restriction', 'exports', 'trade restriction'], inventoryBuffer: ['inventory', 'inventory buffer', 'initial inventory'] },
};

export function interpretCommand(text: string, kind: WorldKind): Command {
  const definition = getDefinition(kind);
  const unknown = (message: string): Command => ({ type: 'unknown', message });
  if (typeof text !== 'string' || !text.trim() || text.length > 1000) return unknown('Enter a command of 1–1,000 characters.');
  const normalized = normalize(text).replace(/[?.!]+$/, '').trim();
  if (/^(?:create |new |fork |make )?(?:a )?branch$|^fork$/.test(normalized)) return { type: 'branch' };
  if (/^(?:compare|compare branches|compare with baseline|show comparison)$/.test(normalized)) return { type: 'compare' };
  if (/^(?:reset|reset world|restore baseline)$/.test(normalized)) return { type: 'reset' };
  if (/^(?:why|why did (?:this|that) (?:happen|change)|explain|explain this)$/.test(normalized)) return { type: 'panel', panel: 'why' };
  if (/^(?:challenge|challenge (?:this|the) model|what are the limitations|limitations)$/.test(normalized)) return { type: 'panel', panel: 'challenge' };
  if (/^(?:evidence|sources|show (?:me )?(?:the )?(?:evidence|sources))$/.test(normalized)) return { type: 'panel', panel: 'evidence' };
  if (/^(?:model|equations|show (?:me )?(?:the )?(?:model|equations))$/.test(normalized)) return { type: 'panel', panel: 'model' };
  if (/^(?:focus|focus world|overview|show world)$/.test(normalized)) return { type: 'focus' };
  const focus = normalized.match(/^(?:focus|inspect)\s+(.+)$/);
  if (focus) {
    const nodes: Record<WorldKind, Record<string, string>> = {
      manhattan: { uptown: 'uptown', midtown: 'midtown', downtown: 'downtown', brooklyn: 'brooklyn', queens: 'queens', bronx: 'bronx', 'the bronx': 'bronx', jersey: 'jersey', 'new jersey': 'jersey', transit: 'transit', freight: 'freight', 'public space': 'public-space' },
      neural: { 'input 0': 'input-0', 'input 1': 'input-1', 'output': 'output-0', 'output 0': 'output-0' },
      semiconductor: { design: 'design', materials: 'materials', fabrication: 'fabrication', packaging: 'packaging', shipping: 'shipping', distribution: 'shipping', demand: 'demand', inventory: 'inventory' },
    };
    const id = nodes[kind][focus[1]];
    if (id) return { type: 'focus', nodeId: id };
    return unknown('That node is not available. Select a visible node in the world.');
  }
  const timeline = normalized.match(/^(?:(?:set |go to |jump to )?(?:time|month|epoch)(?: to|=)?\s*|(?:go to|jump to)\s+)(-?\d+(?:\.\d+)?)(?:\s*(?:months?|epochs?))?$/);
  if (timeline) {
    const value = Number(timeline[1]);
    try { validateTime(kind, value); return { type: 'time', value }; } catch (error) { return unknown((error as Error).message); }
  }
  const values: Parameters = {};
  const fragments = normalized.split(/\s*(?:,|;|\band\b)\s*/);
  for (const fragment of fragments) {
    const match = fragment.match(/^(?:set |change |make )?(.+?)\s*(?:=| to |\s)\s*(-?\d+(?:\.\d+)?)(?:\s*(?:%|percent|neurons?|months?))?$/);
    if (!match) return unknown(`Unrecognized command. Try “set ${definition.variables[0].label.toLowerCase()} to ${definition.variables[0].initial}”, “time ${definition.time.initial}”, “branch”, or “evidence”.`);
    const name = normalize(match[1]);
    const variable = definition.variables.find((v) => normalize(v.id) === name || normalize(v.label) === name || aliases[kind][v.id].includes(name));
    if (!variable) return unknown(`Unknown parameter “${match[1]}”. Available controls: ${definition.variables.map((v) => v.label).join(', ')}.`);
    if (Object.hasOwn(values, variable.id)) return unknown(`Specify ${variable.label} only once per command.`);
    values[variable.id] = Number(match[2]);
  }
  try { validateParameters(kind, values, true); return { type: 'set', values }; } catch (error) { return unknown((error as Error).message); }
}
