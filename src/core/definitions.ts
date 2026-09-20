import type { Claim, Source, Variable, WorldDefinition, WorldKind } from './types';

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const source = (id: string, title: string, url: string, publisher: string, note: string): Source =>
  ({ id, title, url, publisher, published: 'Undated', accessed: '2026-09-20', note });
const claim = (id: string, title: string, kind: Claim['kind'], detail: string, sourceIds: string[] = [], limitation = 'Authored educational model; not calibrated against observations.'): Claim =>
  ({ id, title, kind, detail, sourceIds, confidence: kind === 'fact' || kind === 'derived' ? 'high' : kind === 'simulation' ? 'medium' : 'low', limitation });
const variable = (id: string, label: string, min: number, max: number, step: number, initial: number, unit: string, description: string, claimIds: string[]): Variable =>
  ({ id, label, min, max, step, initial, unit, description, claimIds });

export const definitions: WorldDefinition[] = deepFreeze([
  {
    id: 'manhattan', title: 'A Manhattan with fewer cars', subtitle: 'A city is a system of trade-offs.',
    description: 'Explore an illustrative reduction in private-car activity. Streets, transit, deliveries, and local activity respond through explicit authored equations. Every index starts at 100 before intervention.',
    question: 'What if Manhattan reduced private cars by 80%?', category: 'Urban systems', coordinates: '40.7831° N · 73.9712° W · schematic geography',
    variables: [
      variable('carReduction', 'Private-car reduction', 0, 100, 1, 80, '%', 'Target reduction in private-car activity; phased in over six modeled months.', ['m-response']),
      variable('transitInvestment', 'Transit capacity investment', 0, 100, 1, 30, '%', 'Illustrative increase in transit capacity; phased in over eighteen modeled months.', ['m-response']),
      variable('freightAdaptation', 'Freight adaptation', 0, 100, 1, 40, '%', 'Share of delivery operations assumed able to adapt, phased in over nine months.', ['m-freight']),
    ],
    sources: [source('nyc-dot', 'NYC DOT — Motorists & Parking', 'https://www.nyc.gov/html/dot/html/motorist/motorist.shtml', 'New York City Department of Transportation', 'Supports the existence of congestion pricing, transit funding, commercial traffic, and loading zones. Does not support any modeled effect size.')],
    claims: [
      claim('m-context', 'Streets connect several transport systems', 'fact', 'NYC DOT describes congestion pricing as a program to reduce congestion and fund transit. It also identifies commercial deliveries and loading zones as parts of city transport.', ['nyc-dot'], 'This context does not validate a private-car ban or any coefficient in this model.'),
      claim('m-response', 'Response speeds and mode shift are assumed', 'assumption', 'Private-car activity adjusts with a six-month exponential response. Capacity investment takes eighteen months. Forty percent of displaced private-car activity contributes to the modeled transit-load index.'),
      claim('m-freight', 'Delivery friction can be partly mitigated', 'assumption', 'Freight adaptation takes nine months. Delivery delay increases with unadapted private-car restrictions and falls with modeled street relief; coefficients are illustrative.'),
      claim('m-equations', 'Indices follow visible equations', 'derived', 'Traffic, transit load, emissions, public space, delivery delay, and local activity are calculated from the controls and elapsed time. A value of 100 means the modeled pre-intervention baseline.', [], 'Arithmetic is reproducible; the assumed causal relationships are unvalidated.'),
      claim('m-results', 'Results are scenario outputs', 'simulation', 'Map values and charts show outputs of the local deterministic model. They are neither observations nor a forecast.'),
      claim('m-business', 'Local activity may shift', 'speculation', 'The local-activity index balances assumed pedestrian gains against transit crowding and delivery disruption. Actual business outcomes depend on many omitted factors.'),
    ],
    time: { label: 'Months after intervention', unit: 'months', min: 0, max: 36, step: 1, initial: 12, events: [{ at: 0, label: 'Modeled intervention' }, { at: 6, label: 'Car-response timescale' }, { at: 18, label: 'Transit-build timescale' }, { at: 36, label: 'Scenario horizon' }] },
    limitations: ['All indices are normalized illustrations, not measured Manhattan data or policy predictions.', 'Map geometry is schematic. Neighborhood values are illustrative allocations, not local measurements.', 'Coefficients, response times, and causal links are authored assumptions. No uncertainty interval is statistically estimated.', 'Disability access, distributional effects, induced demand, weather, enforcement, and fiscal constraints are omitted.'],
  },
  {
    id: 'neural', title: 'A network learning XOR', subtitle: 'Watch a boundary emerge from gradients.',
    description: 'Train a real, small neural network on the four XOR examples. Seeded weights, tanh hidden activations, sigmoid output, and batch backpropagation make every epoch reproducible.',
    question: 'How does a neural network learn XOR?', category: 'Machine learning', coordinates: '2 inputs → hidden layer → 1 output',
    variables: [
      variable('learningRate', 'Learning rate', 0.05, 2, 0.05, 0.6, '', 'Step size for full-batch gradient descent on binary cross-entropy.', ['n-training']),
      variable('hiddenWidth', 'Hidden neurons', 2, 8, 1, 4, 'neurons', 'Number of trainable tanh units in the hidden layer.', ['n-training']),
      variable('seed', 'Random seed', 1, 9999, 1, 42, '', 'Seed of the local deterministic weight initializer. Changing it restarts training.', ['n-seed']),
    ],
    sources: [source('pytorch', 'PyTorch — Neural Networks', 'https://docs.pytorch.org/tutorials/beginner/blitz/neural_networks_tutorial.html', 'PyTorch', 'Explains forward evaluation, loss, backpropagation, and parameter updates. This app implements those mechanics directly in TypeScript; it does not run PyTorch.')],
    claims: [
      claim('n-context', 'Learning updates parameters using gradients', 'fact', 'A neural-network training loop computes predictions and loss, backpropagates derivatives, and updates model parameters.', ['pytorch'], 'The source explains general mechanics; it does not certify this implementation.'),
      claim('n-training', 'A deliberately small learning experiment', 'assumption', 'The authored architecture uses two inputs, one tanh hidden layer, and one sigmoid output. All four XOR points contribute equally to each gradient step.'),
      claim('n-seed', 'Initialization and training are reproducible', 'derived', 'A seeded integer pseudorandom generator initializes weights. Epoch zero performs no updates; epoch N performs exactly N full-batch updates.', [], 'JavaScript floating-point results may vary in the last digits across runtimes.'),
      claim('n-results', 'Activations and loss are computed', 'simulation', 'Node values are the actual activations for input (0, 1); edges are actual weights. The colored field evaluates the trained network over a 21 × 21 grid.', [], 'Accuracy measures the four training examples, not generalization.'),
      claim('n-generalization', 'Between examples is an extrapolation', 'speculation', 'Four examples do not define a unique continuous decision boundary. The learned field between training points reflects architecture and initialization.'),
    ],
    time: { label: 'Training epoch', unit: 'epochs', min: 0, max: 3000, step: 50, initial: 600, events: [{ at: 0, label: 'Seeded initialization' }, { at: 600, label: '600 gradient updates' }, { at: 1500, label: '1,500 gradient updates' }, { at: 3000, label: 'Training horizon' }] },
    limitations: ['This is a real toy network, not a large language model.', 'Training accuracy on four examples is not a test-set result.', 'A 0.5 output threshold defines the displayed classes. Hidden activations range from −1 to 1.', 'The decision field between XOR points is not ground-truth data.'],
  },
  {
    id: 'semiconductor', title: 'The semiconductor supply web', subtitle: 'One bottleneck can reshape an entire chain.',
    description: 'Follow a normalized monthly flow from design and materials through fabrication, packaging, and distribution. Inventory absorbs a demand shock until the buffer runs out.',
    question: 'What if semiconductor demand surged while exports tightened?', category: 'Supply systems', coordinates: 'A schematic global production network',
    variables: [
      variable('demandShock', 'Demand increase', 0, 100, 1, 35, '%', 'Additional monthly demand above 100 normalized units, introduced at month one.', ['s-capacity']),
      variable('fabCapacity', 'Fab capacity expansion', 0, 100, 1, 20, '%', 'Target additional fabrication capacity with an assumed eighteen-month response time.', ['s-capacity']),
      variable('exportRestriction', 'Export restriction', 0, 100, 1, 30, '%', 'Illustrative friction applied to materials and shipping capacity, not a particular country or regulation.', ['s-restriction']),
      variable('inventoryBuffer', 'Initial inventory', 0, 12, 1, 3, 'months', 'Opening inventory in months of pre-shock demand (100 normalized units each).', ['s-stock']),
    ],
    sources: [source('sia', 'How are Semiconductors Made?', 'https://www.semiconductors.org/semiconductors-101/how-are-semiconductors-made/', 'Semiconductor Industry Association', 'Supports the connected stages of research, design, fabrication, assembly, testing, and packaging. Does not supply model capacities or policy effect sizes.')],
    claims: [
      claim('s-context', 'Chip production spans connected stages', 'fact', 'The semiconductor value chain includes research, design, front-end fabrication, and back-end assembly, testing, and packaging.', ['sia'], 'Industry-stage context only; the schematic does not depict actual firms or trade volumes.'),
      claim('s-capacity', 'Capacity and construction times are assumed', 'assumption', 'Baseline fabrication capacity is 100 units per month; materials 140, design 150, packaging 125, and shipping 130. Fabrication expansion approaches its target exponentially over eighteen months.'),
      claim('s-restriction', 'Trade friction is a generic scenario control', 'assumption', 'Full restriction reduces assumed material capacity by 60% and shipping capacity by 25%. These are authored sensitivities, not estimates of any policy.'),
      claim('s-stock', 'Stock and backlog obey conservation', 'derived', 'Available units equal opening inventory plus production. Shipments are the smaller of available units and demand plus opening backlog. Closing stock and backlog remain nonnegative.', [], 'Production is a monthly bottleneck approximation with no product substitution or component-level yields.'),
      claim('s-results', 'Flow and shortages are simulated', 'simulation', 'Outputs follow the stated capacity bottlenecks and monthly stock-flow equations. All quantities are normalized scenario units.'),
      claim('s-substitution', 'Adaptation outside this chain is uncertain', 'speculation', 'Supplier switching, redesign, and geopolitical responses could change the result; these responses are omitted.'),
    ],
    time: { label: 'Months after shock', unit: 'months', min: 0, max: 36, step: 1, initial: 12, events: [{ at: 0, label: 'Opening inventory' }, { at: 1, label: 'Demand and trade shock' }, { at: 18, label: 'Fab-build timescale' }, { at: 36, label: 'Scenario horizon' }] },
    limitations: ['Normalized units, authored capacities, and generic trade friction; no live production or market data.', 'The network is schematic and does not attribute output to countries or companies.', 'No prices, yields, product substitution, transport delays, or facility-level build schedules are modeled.', 'The backlog-based delay proxy is not a delivery-date prediction.'],
  },
  {
    id: 'system', title: 'Build any complex system', subtitle: 'Ask a question. Enter its connections.',
    description: 'Turn a question about a company, market, CPU, network, scientific process, historical event, energy system, ecosystem, or another complex system into a navigable causal world.',
    question: 'How does a rainforest ecosystem respond to prolonged drought?', category: 'Universal world compiler', coordinates: 'Any place · any connected system',
    variables: [
      variable('inputPressure', 'Input pressure', -100, 100, 1, 0, '%', 'Shift the primary input or starting condition around its normalized baseline.', ['system-assumptions']),
      variable('systemCapacity', 'System capacity', -100, 100, 1, 0, '%', 'Shift the capacity of the central transformation or network.', ['system-assumptions']),
      variable('constraintPressure', 'Constraint pressure', -100, 100, 1, 0, '%', 'Shift the dominant constraint or disruption around its normalized baseline.', ['system-assumptions']),
    ],
    sources: [],
    claims: [
      claim('system-context', 'Public references describe topic context', 'fact', 'When live research succeeds, Source DNA links to public topic pages used to orient the system map.', [], 'Context sources do not validate generated causal links or effect sizes.'),
      claim('system-assumptions', 'Connections are explicit hypotheses', 'assumption', 'Nodes and links come from a reusable system archetype selected from the question. Their direction, strength, and delay are visible modeling assumptions.'),
      claim('system-output', 'The world computes a bounded scenario', 'simulation', 'Each node begins at index 100. Interventions and three damped causal passes produce repeatable comparison values.', [], 'Outputs are exploratory indices, not observations or forecasts.'),
    ],
    time: { label: 'Scenario step', unit: 'steps', min: 0, max: 24, step: 1, initial: 12, events: [{ at: 0, label: 'Baseline' }, { at: 6, label: 'Early effects' }, { at: 12, label: 'Developed scenario' }, { at: 24, label: 'Scenario horizon' }] },
    limitations: ['The generated world is a starting hypothesis that may omit essential entities or competing causal accounts.', 'Reference retrieval supplies context only; it does not calibrate the simulation.', 'All values are normalized indices and all sensitivities are generic.', 'Use Source DNA, X-ray, Why, and Challenge before drawing conclusions.'],
  },
]);

export function getDefinition(kind: WorldKind): WorldDefinition {
  const definition = definitions.find((item) => item.id === kind);
  if (!definition) throw new Error('Unknown world kind.');
  return definition;
}

export function validateParameters(kind: WorldKind, parameters: Record<string, number>, partial = false): void {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters) || ![Object.prototype, null].includes(Object.getPrototypeOf(parameters))) throw new Error('Parameters must be a plain object.');
  const { variables } = getDefinition(kind);
  for (const [id, value] of Object.entries(parameters)) {
    const spec = variables.find((item) => item.id === id);
    if (!spec) throw new Error(`Unknown parameter: ${id}.`);
    if (!Number.isFinite(value) || value < spec.min || value > spec.max) throw new Error(`${spec.label} must be between ${spec.min} and ${spec.max}.`);
    if (spec.step >= 1 && !Number.isInteger(value)) throw new Error(`${spec.label} must be a whole number.`);
  }
  if (!partial && variables.some((item) => !Object.hasOwn(parameters, item.id))) throw new Error('The world is missing required parameters.');
}

export function validateTime(kind: WorldKind, time: number): void {
  const spec = getDefinition(kind).time;
  if (!Number.isInteger(time) || time < spec.min || time > spec.max) throw new Error(`Time must be a whole number between ${spec.min} and ${spec.max} ${spec.unit}.`);
}
