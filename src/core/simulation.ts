import { deepFreeze, validateParameters, validateTime } from './definitions';
import type { Metric, Parameters, SimulationResult, WorldKind, WorldNode } from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const metric = (id: string, label: string, value: number, unit: string, range: [number, number], explanation: string, equation: string, inputs: string[], claimIds: string[], good: Metric['good'] = 'neutral'): Metric =>
  ({ id, label, value, unit, range, explanation, equation, inputs, claimIds, good });
const node = (id: string, label: string, value: number, position: [number, number, number], kind: string, detail: string, claimIds: string[]): WorldNode =>
  ({ id, label, value, position, kind, detail, claimIds });

function cityState(p: Parameters, time: number) {
  const reduction = p.carReduction / 100 * (1 - Math.exp(-time / 6));
  const capacity = p.transitInvestment / 100 * (1 - Math.exp(-time / 18));
  const adaptation = p.freightAdaptation / 100 * (1 - Math.exp(-time / 9));
  const traffic = 100 * (1 - reduction);
  const transit = 100 * (1 + 0.4 * reduction) / (1 + capacity);
  const emissions = 100 * (1 - 0.55 * reduction);
  const delivery = 100 * (1 + 0.3 * reduction * (1 - adaptation) - 0.15 * reduction);
  const space = 100 * (1 + 0.45 * reduction);
  const activity = 100 + 0.3 * (space - 100) - 0.12 * Math.max(0, transit - 100) - 0.2 * (delivery - 100);
  return { reduction, traffic, transit, emissions, delivery, space, activity };
}

function manhattan(p: Parameters, time: number): SimulationResult {
  const s = cityState(p, time);
  const equations = 'r=(carReduction/100)·(1−exp(−months/6)); c=(transitInvestment/100)·(1−exp(−months/18)); a=(freightAdaptation/100)·(1−exp(−months/9)). ';
  const claims = ['m-equations', 'm-response', 'm-results'];
  return {
    metrics: [
      metric('traffic', 'Private-car activity', s.traffic, 'index', [0, 100], 'Normalized private-car activity. Baseline 100; lower values mean less private-car activity in this scenario.', equations + 'traffic=100·(1−r)', ['carReduction', 'time'], claims, 'down'),
      metric('transit', 'Transit load', s.transit, 'index', [50, 140], 'Demand relative to modeled transit capacity. Above 100 means a more crowded system than the pre-intervention baseline.', equations + 'load=100·(1+0.4r)/(1+c)', ['carReduction', 'transitInvestment', 'time'], claims, 'down'),
      metric('emissions', 'Street emissions', s.emissions, 'index', [45, 100], 'Illustrative emissions index assuming private-car activity accounts for 55% of the baseline. This is not a measured emissions inventory.', equations + 'emissions=100·(1−0.55r)', ['carReduction', 'time'], claims, 'down'),
      metric('activity', 'Local activity', s.activity, 'index', [85, 115], 'Speculative balance of public-space gains, transit crowding, and delivery friction. No revenue or employment forecast is implied.', equations + 'space=100·(1+0.45r); delivery=100·(1+0.3r(1−a)−0.15r); activity=100+0.3(space−100)−0.12max(0,load−100)−0.2(delivery−100)', ['carReduction', 'transitInvestment', 'freightAdaptation', 'time'], ['m-business', 'm-equations'], 'neutral'),
      metric('delivery', 'Delivery delay', s.delivery, 'index', [85, 115], 'Illustrative delivery friction relative to baseline. Strong freight adaptation can offset the assumed restriction cost.', equations + 'delivery=100·(1+0.3r(1−a)−0.15r)', ['carReduction', 'freightAdaptation', 'time'], ['m-freight', 'm-results'], 'down'),
      metric('space', 'Public-space potential', s.space, 'index', [100, 145], 'Potential public-space index, assuming reduced private-car activity can free street space. No area in square meters is estimated.', equations + 'space=100·(1+0.45r)', ['carReduction', 'time'], claims, 'up'),
    ],
    nodes: [
      node('uptown', 'Uptown', 100 - 35 * s.reduction, [-1, 0, -3.3], 'district', 'Illustrative local traffic index: 100−35r. Schematic location, not measured neighborhood data.', claims),
      node('midtown', 'Midtown', s.traffic, [0, 0, -0.5], 'district', 'Private-car activity index from the city model. Baseline 100.', claims),
      node('downtown', 'Downtown', 100 - 80 * s.reduction, [0.8, 0, 2.5], 'district', 'Illustrative local traffic index: 100−80r. Schematic location.', claims),
      node('brooklyn', 'Brooklyn', 100 + 12 * s.reduction, [3.5, 0, 3.1], 'district', 'Assumed displacement index: 100+12r. This does not estimate actual traffic diversion.', ['m-response']),
      node('queens', 'Queens', 100 + 10 * s.reduction, [4.1, 0, -0.8], 'district', 'Assumed displacement index: 100+10r. This does not estimate actual traffic diversion.', ['m-response']),
      node('bronx', 'The Bronx', 100 + 6 * s.reduction, [1.5, 0, -5], 'district', 'Assumed displacement index: 100+6r. This does not estimate actual traffic diversion.', ['m-response']),
      node('jersey', 'New Jersey', 100 + 8 * s.reduction, [-3.8, 0, 0.1], 'district', 'Assumed displacement index: 100+8r. This does not estimate actual traffic diversion.', ['m-response']),
      node('transit', 'Transit network', s.transit, [2.1, 0.7, -2], 'system', 'Transit-load index: modeled demand divided by modeled capacity, baseline 100.', claims),
      node('freight', 'Delivery network', s.delivery, [-2.6, 0.7, 2.7], 'system', 'Delivery-delay index, baseline 100.', ['m-freight', 'm-results']),
      node('public-space', 'Public space', s.space, [-2.1, 0.5, -1.3], 'system', 'Public-space potential index, baseline 100.', claims),
    ],
    edges: [
      { from: 'uptown', to: 'midtown', weight: 0.65, order: 1, uncertain: true },
      { from: 'midtown', to: 'downtown', weight: 0.8, order: 1, uncertain: true },
      { from: 'midtown', to: 'transit', weight: 0.4, order: 1, uncertain: true },
      { from: 'midtown', to: 'public-space', weight: 0.45, order: 1, uncertain: true },
      { from: 'midtown', to: 'freight', weight: 0.3, order: 2, uncertain: true },
      { from: 'midtown', to: 'queens', weight: 0.1, order: 2, uncertain: true },
      { from: 'downtown', to: 'brooklyn', weight: 0.12, order: 2, uncertain: true },
      { from: 'uptown', to: 'bronx', weight: 0.06, order: 2, uncertain: true },
      { from: 'midtown', to: 'jersey', weight: 0.08, order: 2, uncertain: true },
      { from: 'freight', to: 'downtown', weight: -0.2, order: 3, uncertain: true },
    ],
    warnings: ['Illustrative normalized scenario; no measured traffic, business, or emissions predictions.', ...(s.transit > 110 ? ['Modeled transit demand is more than 10% above its baseline capacity ratio.'] : []), ...(s.delivery > 105 ? ['The assumed delivery-delay index exceeds 105. Test stronger freight adaptation.'] : [])],
    series: Array.from({ length: time + 1 }, (_, x) => ({ x, y: cityState(p, x).traffic })),
  };
}

interface Network { w: number[][]; b: number[]; v: number[]; bias: number }
const xor = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
function forward(net: Network, x: number, y: number) {
  const hidden = net.w.map((w, j) => Math.tanh(w[0] * x + w[1] * y + net.b[j]));
  const logit = hidden.reduce((sum, h, j) => sum + h * net.v[j], net.bias);
  return { hidden, output: sigmoid(logit), logit };
}
function loss(net: Network) {
  return xor.reduce((sum, [x, y, target]) => {
    const { logit } = forward(net, x, y);
    // Stable binary cross entropy from logits, including saturated predictions.
    return sum + Math.max(logit, 0) - logit * target + Math.log1p(Math.exp(-Math.abs(logit)));
  }, 0) / xor.length;
}
function step(net: Network, rate: number) {
  const dw = net.w.map(() => [0, 0]);
  const db = net.b.map(() => 0);
  const dv = net.v.map(() => 0);
  let bias = 0;
  for (const [x, y, target] of xor) {
    const result = forward(net, x, y);
    const delta = (result.output - target) / xor.length;
    bias += delta;
    result.hidden.forEach((h, j) => {
      dv[j] += delta * h;
      const hiddenDelta = delta * net.v[j] * (1 - h * h);
      dw[j][0] += hiddenDelta * x;
      dw[j][1] += hiddenDelta * y;
      db[j] += hiddenDelta;
    });
  }
  net.w.forEach((w, j) => { w[0] -= rate * dw[j][0]; w[1] -= rate * dw[j][1]; net.b[j] -= rate * db[j]; net.v[j] -= rate * dv[j]; });
  net.bias -= rate * bias;
}

const neuralCache = new Map<string, SimulationResult>();
const MAX_NEURAL_CACHE = 24;
function neural(p: Parameters, time: number): SimulationResult {
  const key = `${p.learningRate}:${p.hiddenWidth}:${p.seed}:${time}`;
  const cached = neuralCache.get(key);
  if (cached) { neuralCache.delete(key); neuralCache.set(key, cached); return structuredClone(cached); }
  let state = p.seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296 * 2 - 1;
  };
  const width = p.hiddenWidth;
  const net: Network = { w: Array.from({ length: width }, () => [random(), random()]), b: Array.from({ length: width }, random), v: Array.from({ length: width }, random), bias: random() };
  const series = [{ x: 0, y: loss(net) }];
  const stride = Math.max(1, Math.ceil(time / 60));
  for (let epoch = 1; epoch <= time; epoch++) {
    step(net, p.learningRate);
    if (epoch % stride === 0 || epoch === time) series.push({ x: epoch, y: loss(net) });
  }
  const probe = forward(net, 0, 1);
  const predictions = xor.map(([x, y, target]) => ({ x, y, target, value: forward(net, x, y).output }));
  const accuracy = predictions.filter((s) => Number(s.value >= 0.5) === s.target).length / 4 * 100;
  const currentLoss = loss(net);
  const weights = [...net.w.flat(), ...net.b, ...net.v, net.bias];
  const claims = ['n-training', 'n-results'];
  const inputs = ['learningRate', 'hiddenWidth', 'seed', 'time'];
  const result: SimulationResult = {
    metrics: [
      metric('loss', 'Training loss', currentLoss, 'BCE', [0, Math.max(1, series[0].y, currentLoss)], 'Mean binary cross-entropy on the four XOR training examples. Computed after the displayed number of gradient updates.', 'L=−Σ[t·ln(p)+(1−t)·ln(1−p)]/4; θ←θ−learningRate·∇L', inputs, claims, 'down'),
      metric('accuracy', 'Training accuracy', accuracy, '%', [0, 100], 'Fraction of the four training examples classified correctly at output threshold 0.5. This is not held-out accuracy.', 'accuracy=100·Σ[1((p≥0.5)=target)]/4', inputs, claims, 'up'),
      metric('confidence', 'Probe output · (0, 1)', probe.output * 100, '%', [0, 100], 'Actual sigmoid output for input (0, 1), whose XOR target is 1. Neural node activations correspond to this probe.', 'h=tanh(W·[0,1]+b); p=sigmoid(v·h+outputBias)', inputs, claims, 'neutral'),
      metric('parameters', 'Trainable parameters', weights.length, 'weights', [9, 33], 'Two input weights, one hidden bias, and one output weight per hidden neuron, plus one output bias.', 'parameterCount=4·hiddenWidth+1', ['hiddenWidth'], ['n-seed'], 'neutral'),
    ],
    nodes: [
      node('input-0', 'Input x₁', 0, [-4, -0.65, 0], 'input', 'Probe input x₁=0. Training points are (0,0), (0,1), (1,0), and (1,1).', ['n-training']),
      node('input-1', 'Input x₂', 1, [-4, 0.65, 0], 'input', 'Probe input x₂=1. The XOR target for this probe is 1.', ['n-training']),
      ...probe.hidden.map((h, j) => node(`hidden-${j}`, `Hidden ${j + 1}`, h, [0, (j - (width - 1) / 2) * 1.3, 0], 'hidden', `Actual tanh activation for (0,1). Bias ${net.b[j].toFixed(4)}; input weights ${net.w[j].map((v) => v.toFixed(4)).join(', ')}.`, claims)),
      node('output-0', 'XOR output', probe.output, [4, 0, 0], 'output', `Actual sigmoid output for (0,1), target 1. Output bias ${net.bias.toFixed(4)}.`, claims),
    ],
    edges: net.w.flatMap((w, j) => [
      { from: 'input-0', to: `hidden-${j}`, weight: w[0], order: 1 as const, uncertain: false },
      { from: 'input-1', to: `hidden-${j}`, weight: w[1], order: 1 as const, uncertain: false },
      { from: `hidden-${j}`, to: 'output-0', weight: net.v[j], order: 2 as const, uncertain: false },
    ]),
    warnings: ['Accuracy is measured on four training examples. The continuous field between them has no unique ground truth.', ...(time === 0 ? ['Epoch zero: seeded weights have not been trained.'] : []), ...(accuracy < 100 ? ['This configuration has not learned all four XOR labels at the selected epoch.'] : [])],
    series,
    samples: Array.from({ length: 441 }, (_, i) => {
      const x = (i % 21) / 20;
      const y = Math.floor(i / 21) / 20;
      // A display reference only; the data used for training are the four corners.
      return { x, y, value: forward(net, x, y).output, target: Number((x >= 0.5) !== (y >= 0.5)) };
    }),
  };
  neuralCache.set(key, deepFreeze(structuredClone(result)));
  if (neuralCache.size > MAX_NEURAL_CACHE) neuralCache.delete(neuralCache.keys().next().value!);
  return result;
}

function semiconductor(p: Parameters, time: number): SimulationResult {
  let inventory = p.inventoryBuffer * 100;
  let backlog = 0;
  let production = 100;
  let demand = 100;
  let shipped = 100;
  let openingBacklog = 0;
  let materials = 140;
  let fabrication = 100;
  let shipping = 130;
  const series = [{ x: 0, y: 0 }];
  for (let month = 1; month <= time; month++) {
    demand = 100 * (1 + p.demandShock / 100);
    materials = 140 * (1 - 0.6 * p.exportRestriction / 100);
    fabrication = 100 * (1 + p.fabCapacity / 100 * (1 - Math.exp(-month / 18)));
    shipping = 130 * (1 - 0.25 * p.exportRestriction / 100);
    production = Math.min(150, materials, fabrication, 125, shipping);
    openingBacklog = backlog;
    const available = inventory + production;
    const required = demand + backlog;
    shipped = Math.min(available, required);
    inventory = available - shipped;
    backlog = required - shipped;
    series.push({ x: month, y: backlog });
  }
  const fulfillment = 100 * shipped / (demand + openingBacklog);
  const delay = 2 + backlog / production;
  const claims = ['s-capacity', 's-restriction', 's-stock', 's-results'];
  const inputs = ['demandShock', 'fabCapacity', 'exportRestriction', 'inventoryBuffer', 'time'];
  const capacityEquation = 'materials=140·(1−0.6·exportRestriction/100); fab=100·(1+fabCapacity/100·(1−exp(−month/18))); shipping=130·(1−0.25·exportRestriction/100); production=min(150,materials,fab,125,shipping). ';
  return {
    metrics: [
      metric('fulfillment', 'Orders fulfilled', fulfillment, '%', [0, 100], 'Share of current demand plus opening backlog shipped in the selected month.', 'required=demand+openingBacklog; shipped=min(openingInventory+production,required); fulfillment=100·shipped/required', inputs, claims, 'up'),
      metric('production', 'Monthly production', production, 'units', [0, 150], 'Normalized finished-chip flow, limited by the smallest stage capacity. Baseline 100 units per month.', capacityEquation, ['fabCapacity', 'exportRestriction', 'time'], claims, 'up'),
      metric('backlog', 'Unfilled orders', backlog, 'units', [0, 7200], 'Accumulated demand that available production and stock have not fulfilled. Baseline zero.', 'backlog=max(0,openingBacklog+demand−openingInventory−production)', inputs, ['s-stock', 's-results'], 'down'),
      metric('inventory', 'Inventory remaining', inventory, 'units', [0, 2100], 'Closing inventory after serving current demand and all possible backlogged orders.', 'inventory=max(0,openingInventory+production−demand−openingBacklog); initialInventory=100·inventoryBuffer', inputs, ['s-stock', 's-results'], 'neutral'),
      metric('delay', 'Delay proxy', delay, 'months', [2, 132], 'Assumed two-month base cycle plus backlog divided by current production. This is an explanatory proxy, not a shipment-date prediction.', 'delay=2+backlog/production', inputs, claims, 'down'),
    ],
    nodes: [
      node('design', 'Design', 150, [-5, 0, -1.8], 'supply', 'Authored design-stage capacity: 150 normalized units per month.', ['s-context', 's-capacity']),
      node('materials', 'Materials', materials, [-5, 0, 1.8], 'supply', 'Authored material capacity after generic trade friction, normalized units per month.', claims),
      node('fabrication', 'Fabrication', fabrication, [-2.3, 0, 0], 'factory', 'Authored fabrication capacity at the selected month, normalized units per month.', claims),
      node('packaging', 'Assembly & packaging', 125, [0.4, 0, 0], 'factory', 'Authored packaging capacity: 125 normalized units per month.', ['s-context', 's-capacity']),
      node('shipping', 'Distribution', shipping, [3, 0, 0], 'logistics', 'Authored distribution capacity after trade friction, normalized units per month.', claims),
      node('demand', 'Demand', demand, [5.4, 0, 0], 'demand', 'Requested normalized units this month. Unfilled demand accumulates as backlog.', claims),
      node('inventory', 'Inventory buffer', inventory, [0.4, 0, 2.8], 'stock', 'Remaining stock after shipments, in normalized units.', ['s-stock', 's-results']),
    ],
    edges: [
      { from: 'design', to: 'fabrication', weight: production / 100, order: 1, uncertain: true },
      { from: 'materials', to: 'fabrication', weight: production / 100, order: 1, uncertain: true },
      { from: 'fabrication', to: 'packaging', weight: production / 100, order: 1, uncertain: true },
      { from: 'packaging', to: 'shipping', weight: production / 100, order: 1, uncertain: true },
      { from: 'inventory', to: 'shipping', weight: Math.max(0, shipped - production) / 100, order: 2, uncertain: true },
      { from: 'shipping', to: 'demand', weight: shipped / 100, order: 1, uncertain: true },
      { from: 'demand', to: 'fabrication', weight: backlog / 100, order: 3, uncertain: true },
    ],
    warnings: ['Normalized scenario flows; no live chip output, prices, or country-specific policy forecasts.', ...(backlog > 0 ? ['Inventory and production cannot cover all orders; backlog is accumulating.'] : []), ...(time > 0 && fabrication > Math.min(materials, 125, shipping) ? ['Another production stage limits output; additional fab capacity alone cannot remove this bottleneck.'] : [])],
    series,
  };
}

/** Pure local model evaluation. Invalid inputs fail rather than being silently clamped. */
export function simulate(kind: WorldKind, parameters: Parameters, time: number): SimulationResult {
  validateParameters(kind, parameters);
  validateTime(kind, time);
  const result = kind === 'manhattan' ? manhattan(parameters, time) : kind === 'neural' ? neural(parameters, time) : semiconductor(parameters, time);
  // Numerical failures must never be presented as plausible scenario outputs.
  if (result.metrics.some((m) => !Number.isFinite(m.value)) || result.nodes.some((n) => !Number.isFinite(n.value))) throw new Error('The model produced a non-finite result.');
  return result;
}
