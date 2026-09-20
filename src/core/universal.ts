import type { BlueprintEdge, BlueprintNode, Metric, Parameters, SimulationResult, Source, SystemArchetype, SystemBlueprint, Variable, WorldDefinition, WorldNode } from './types';

type Template = {
  category:string;
  keywords:RegExp;
  nodes:Array<[string,string,string,string]>;
  edges:Array<[number,number,-1|1,number,number,string]>;
  controls:Array<[string,string,number,string]>;
};

const templates:Record<SystemArchetype,Template>={
  company:{category:'Company system',keywords:/\b(company|business|firm|startup|organization|corporation|market share|customers?|revenue|workforce)\b/i,nodes:[['inputs','Suppliers & capital','input','Resources entering the organization.'],['people','People & knowledge','capability','Skills, coordination, and institutional knowledge.'],['operations','Operations','process','The processes that turn resources into an offering.'],['offering','Products & services','output','What the organization provides to customers.'],['customers','Customers & market','demand','Demand, adoption, and customer response.'],['resilience','Cash & resilience','buffer','Capacity to absorb delays, shocks, and reinvestment.']],edges:[[0,2,1,.65,2,'Inputs enable operations.'],[1,2,1,.75,4,'Capability affects execution.'],[2,3,1,.8,2,'Operations produce the offering.'],[3,4,1,.7,2,'Offering quality affects demand.'],[4,5,1,.65,3,'Demand supports resilience.'],[5,1,1,.35,6,'Resilience supports capability.']],controls:[['inputPressure','Resource availability',0,'inputs'],['systemCapacity','Operating capacity',2,'operations'],['constraintPressure','Market pressure',-3,'customers']]},
  finance:{category:'Financial system',keywords:/\b(finance|financial|bank|banking|investment|portfolio|asset|credit|interest rate|liquidity|capital market|inflation)\b/i,nodes:[['capital','Capital','input','Funds available to allocate.'],['liquidity','Liquidity','buffer','Capacity to meet near-term obligations.'],['assets','Assets & exposure','stock','Positions that produce returns and risk.'],['cashflow','Cash flow','flow','Income and obligations moving through the system.'],['risk','Risk transmission','constraint','How volatility and losses propagate.'],['returns','Returns & solvency','output','The modeled outcome after cash flow and risk.']],edges:[[0,2,1,.75,2,'Capital funds assets.'],[1,3,1,.65,1,'Liquidity supports cash flow.'],[2,3,1,.55,3,'Assets generate cash flow.'],[2,4,1,.6,2,'Exposure transmits risk.'],[4,5,-1,.8,1,'Risk erodes returns and solvency.'],[3,5,1,.7,2,'Cash flow supports the outcome.']],controls:[['inputPressure','Capital availability',0,'capital'],['systemCapacity','Liquidity capacity',1,'liquidity'],['constraintPressure','Risk pressure',-4,'risk']]},
  'supply-chain':{category:'Supply system',keywords:/\b(supply chain|logistics|shipping|inventory|manufacturing|factory|procurement|shortage|distribution)\b/i,nodes:[['materials','Materials','input','Upstream materials and components.'],['suppliers','Suppliers','supply','Organizations providing critical inputs.'],['production','Production','process','Transformation and assembly capacity.'],['logistics','Logistics','flow','Movement between stages.'],['inventory','Inventory','buffer','Stock that absorbs timing differences.'],['demand','Demand fulfillment','output','Orders served by the whole chain.']],edges:[[0,1,1,.7,2,'Materials support suppliers.'],[1,2,1,.8,3,'Supplier output feeds production.'],[2,3,1,.75,2,'Production requires distribution.'],[3,4,1,.6,1,'Logistics replenishes inventory.'],[4,5,1,.75,1,'Inventory fulfills demand.'],[5,2,1,.3,5,'Demand signals feed production.']],controls:[['inputPressure','Input availability',0,'materials'],['systemCapacity','Production capacity',2,'production'],['constraintPressure','Logistics disruption',-3,'logistics']]},
  cpu:{category:'Machine system',keywords:/\b(cpu|processor|computer chip|microprocessor|instruction|cache|memory hierarchy|computer architecture)\b/i,nodes:[['instructions','Instruction stream','input','Operations entering the processor.'],['fetch','Fetch & predict','process','Instruction fetch and branch prediction.'],['decode','Decode & schedule','process','Translate and schedule operations.'],['execute','Execution units','process','Perform arithmetic and control work.'],['memory','Caches & memory','buffer','Data access across the memory hierarchy.'],['retire','Retired work','output','Completed instructions in architectural order.']],edges:[[0,1,1,.85,1,'Instructions enter fetch.'],[1,2,1,.8,1,'Fetched instructions are decoded.'],[2,3,1,.8,1,'Scheduled operations execute.'],[4,3,1,.65,3,'Memory supplies operands.'],[3,5,1,.85,1,'Execution produces retired work.'],[5,1,1,.2,2,'Observed control flow informs prediction.']],controls:[['inputPressure','Instruction pressure',0,'instructions'],['systemCapacity','Execution capacity',2,'execute'],['constraintPressure','Memory latency',-4,'memory']]},
  internet:{category:'Network system',keywords:/\b(internet|web|network|dns|server|cloud|packet|bandwidth|latency|website)\b/i,nodes:[['users','Users & devices','input','Requests originating at network edges.'],['naming','Naming & discovery','routing','Systems such as DNS that locate services.'],['access','Access networks','flow','Local and regional connectivity.'],['backbone','Backbone & routing','flow','Interconnected networks moving packets.'],['services','Servers & services','process','Compute and storage answering requests.'],['experience','Availability & experience','output','The resulting reachability and latency.']],edges:[[0,1,1,.55,1,'Requests depend on discovery.'],[0,2,1,.75,1,'Devices use access networks.'],[2,3,1,.7,2,'Access networks reach the backbone.'],[1,4,1,.55,1,'Discovery points to services.'],[3,4,1,.75,2,'Routes connect clients to services.'],[4,5,1,.8,1,'Service health shapes experience.']],controls:[['inputPressure','Traffic demand',0,'users'],['systemCapacity','Network capacity',2,'backbone'],['constraintPressure','Service disruption',-4,'services']]},
  science:{category:'Scientific system',keywords:/\b(science|physics|chemistry|biology|astronomy|climate|reaction|cell|molecule|planet|force|experiment)\b/i,nodes:[['conditions','Initial conditions','input','The state from which the process begins.'],['matter','Matter & components','stock','Entities participating in the system.'],['energy','Energy & drivers','driver','Forces or gradients that enable change.'],['process','Transformation','process','The principal modeled mechanism.'],['feedback','Feedback & regulation','feedback','Loops that amplify or damp the process.'],['observation','Observable outcome','output','What the system produces or makes measurable.']],edges:[[0,3,1,.55,2,'Initial conditions shape the process.'],[1,3,1,.75,1,'Components participate in transformation.'],[2,3,1,.7,1,'Drivers enable transformation.'],[3,4,1,.6,2,'The process produces feedback.'],[4,3,-1,.35,3,'Regulation can damp the process.'],[3,5,1,.8,1,'Transformation produces observations.']],controls:[['inputPressure','Initial-condition shift',0,'conditions'],['systemCapacity','Process intensity',2,'process'],['constraintPressure','Regulatory pressure',-4,'feedback']]},
  history:{category:'Historical system',keywords:/\b(history|historical|war|revolution|empire|election|movement|century|ancient|medieval|colonial)\b/i,nodes:[['conditions','Material conditions','context','Resources, geography, and prior institutions.'],['institutions','Institutions','structure','Rules and organizations shaping choices.'],['actors','Actors & coalitions','agent','Groups with distinct incentives and power.'],['event','Catalyzing events','event','Events that alter constraints or coordination.'],['response','Public response','feedback','Adaptation, resistance, and collective action.'],['outcome','Historical outcome','output','The observed or counterfactual state.']],edges:[[0,1,1,.55,8,'Conditions shape institutions.'],[1,2,1,.65,5,'Institutions distribute power.'],[2,3,1,.55,2,'Actors influence events.'],[3,4,1,.75,1,'Events trigger responses.'],[4,2,1,.4,2,'Response reshapes coalitions.'],[4,5,1,.7,3,'Responses contribute to outcomes.']],controls:[['inputPressure','Resource pressure',0,'conditions'],['systemCapacity','Institutional capacity',1,'institutions'],['constraintPressure','Conflict pressure',-3,'event']]},
  energy:{category:'Energy system',keywords:/\b(energy|electricity|power grid|renewable|solar|wind|battery|oil|gas|nuclear|emissions)\b/i,nodes:[['sources','Primary energy','input','Energy available from natural or stored sources.'],['generation','Conversion & generation','process','Facilities converting sources into usable power.'],['grid','Networks & grid','flow','Infrastructure transporting energy.'],['storage','Storage & flexibility','buffer','Resources shifting supply through time.'],['demand','Demand','demand','Loads requesting useful energy.'],['impact','Reliability & impact','output','Service reliability and system consequences.']],edges:[[0,1,1,.8,4,'Sources feed generation.'],[1,2,1,.75,3,'Generation injects into networks.'],[1,3,1,.45,2,'Surplus can charge storage.'],[3,2,1,.55,1,'Storage supports the grid.'],[2,4,1,.8,1,'The grid serves demand.'],[4,5,1,.65,2,'Demand and supply shape outcomes.']],controls:[['inputPressure','Primary supply',0,'sources'],['systemCapacity','Grid capacity',2,'grid'],['constraintPressure','Demand pressure',-4,'demand']]},
  ecosystem:{category:'Ecological system',keywords:/\b(ecosystem|ecology|forest|rainforest|ocean|coral|reef|wetland|species|biodiversity|food web|habitat|pollution|conservation)\b/i,nodes:[['climate','Climate & habitat','context','Physical conditions supporting the ecosystem.'],['producers','Primary producers','input','Organisms converting energy into biomass.'],['consumers','Consumers','flow','Organisms moving energy through the food web.'],['decomposers','Decomposers','recycle','Processes returning nutrients.'],['nutrients','Nutrients & resources','stock','Recycled resources supporting production.'],['resilience','Diversity & resilience','output','Capacity to retain function through disturbance.']],edges:[[0,1,1,.65,5,'Habitat supports producers.'],[1,2,1,.75,2,'Producers support consumers.'],[2,3,1,.5,3,'Organic matter supports decomposers.'],[3,4,1,.7,2,'Decomposition recycles nutrients.'],[4,1,1,.6,3,'Nutrients support producers.'],[1,5,1,.35,8,'Productivity supports resilience.']],controls:[['inputPressure','Habitat quality',0,'climate'],['systemCapacity','Primary productivity',1,'producers'],['constraintPressure','Disturbance pressure',-5,'resilience']]},
  general:{category:'Complex system',keywords:/$^/,nodes:[['inputs','Inputs & resources','input','Resources, information, or conditions entering the system.'],['actors','Actors & components','agent','The entities that make decisions or transform inputs.'],['process','Core process','process','The main transformation inside the system.'],['constraints','Constraints','constraint','Capacity, rules, and bottlenecks.'],['feedback','Feedback','feedback','Signals that alter later behavior.'],['outcome','Outcome','output','The state produced by the connected system.']],edges:[[0,2,1,.7,2,'Inputs enable the core process.'],[1,2,1,.65,2,'Actors shape the process.'],[3,2,-1,.55,2,'Constraints limit the process.'],[2,4,1,.5,3,'The process generates feedback.'],[4,1,1,.35,4,'Feedback changes actor behavior.'],[2,5,1,.8,2,'The process produces the outcome.']],controls:[['inputPressure','Input pressure',0,'inputs'],['systemCapacity','System capacity',2,'process'],['constraintPressure','Constraint pressure',-3,'constraints']]},
};

export function classifyArchetype(question:string):SystemArchetype {
  return (Object.entries(templates) as Array<[SystemArchetype,Template]>).find(([key,template])=>key!=='general'&&template.keywords.test(question))?.[0]??'general';
}

function subjectFrom(question:string){
  const subject=question.trim().replace(/^(?:what (?:if|happens (?:if|when))|show me|explain|take me inside|suppose)\s+/i,'').replace(/[?.!]+$/,'').trim();
  return (subject||'this complex system').slice(0,120);
}

export function buildSystemBlueprint(question:string,sources:Source[]=[],researchStatus:SystemBlueprint['researchStatus']='offline'):SystemBlueprint {
  const archetype=classifyArchetype(question),template=templates[archetype],subject=subjectFrom(question);
  const nodes:BlueprintNode[]=template.nodes.map(([id,label,role,description],index)=>{
    const angle=(index/template.nodes.length)*Math.PI*2-Math.PI/2;
    return {id,label,role,description,baseline:100,position:[Math.cos(angle)*4,0,Math.sin(angle)*3],sourceIds:sources.map(source=>source.id)};
  });
  const edges:BlueprintEdge[]=template.edges.map(([from,to,polarity,strength,lag,description])=>({from:nodes[from].id,to:nodes[to].id,polarity,strength,lag,confidence:'low',description,sourceIds:[]}));
  const variables:Variable[]=template.controls.map(([id,label,_targetIndex,target])=>({id,label,min:-100,max:100,step:1,initial:0,unit:'%',description:`Scenario intervention applied to ${nodes.find(node=>node.id===target)?.label??target}. Positive and negative values shift its normalized baseline.`,claimIds:['system-assumptions'],targetId:target}));
  return {archetype,subject,summary:`An exploratory ${template.category.toLowerCase()} model for “${subject}”. Public references provide topic context; the causal links and sensitivities remain visible modeled assumptions.`,nodes,edges,variables,sources,researchStatus,limitations:['This generated system map is an exploratory hypothesis, not a validated domain model or quantitative forecast.','Live research retrieves context pages; it does not establish causation or calibrate the simulated effect sizes.','Node baselines are normalized to 100. Edges use generic bounded propagation for comparison, not real-world units.','Important entities and competing explanations may be missing. Use Source DNA and Challenge before drawing conclusions.']};
}

function clean(value:unknown,max:number){return typeof value==='string'?[...value].map(character=>{const code=character.charCodeAt(0);return code<32||code===127?' ':character;}).join('').replace(/\s+/g,' ').trim().slice(0,max):'';}
const researchCache=new Map<string,Source[]>();

export async function researchQuestion(question:string):Promise<Source[]> {
  if(typeof fetch!=='function')return [];
  const cacheKey=question.trim().toLowerCase().replace(/\s+/g,' ');
  const cached=researchCache.get(cacheKey);if(cached)return structuredClone(cached);
  const endpoint=new URL('https://en.wikipedia.org/w/api.php');
  endpoint.search=new URLSearchParams({origin:'*',action:'query',generator:'search',gsrsearch:question,gsrlimit:'4',prop:'extracts|info',exintro:'1',explaintext:'1',exsentences:'3',inprop:'url',format:'json',formatversion:'2'}).toString();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(endpoint,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('Research provider unavailable.');
    const data:unknown=await response.json();
    if(!data||typeof data!=='object')return [];
    const pages=(data as {query?:{pages?:unknown[]}}).query?.pages;
    if(!Array.isArray(pages))return [];
    const sources=pages.slice(0,4).flatMap((page,index)=>{
      if(!page||typeof page!=='object')return [];
      const item=page as Record<string,unknown>,title=clean(item.title,160),note=clean(item.extract,600),url=clean(item.fullurl,2048);
      try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='en.wikipedia.org'||!title)return [];}catch{return [];}
      return [{id:`research-${index+1}`,title,url,publisher:'Wikipedia',published:'Live reference',accessed:new Date().toISOString().slice(0,10),note:note||'Public context page returned by the live research provider.'}];
    });
    researchCache.set(cacheKey,structuredClone(sources));
    if(researchCache.size>50)researchCache.delete(researchCache.keys().next().value!);
    return sources;
  }catch{return [];}finally{clearTimeout(timer);}
}

export function definitionFromBlueprint(question:string,blueprint:SystemBlueprint):WorldDefinition {
  return {
    id:'system',title:blueprint.subject.charAt(0).toUpperCase()+blueprint.subject.slice(1),subtitle:'Walk through the connections. Change the system.',description:blueprint.summary,question,category:`Generated ${blueprint.archetype.replace('-',' ')} system`,coordinates:'A navigable causal space',variables:blueprint.variables,sources:blueprint.sources,
    claims:[
      {id:'system-context',title:'Public context was retrieved',kind:'fact',detail:blueprint.sources.length?`The research step retrieved ${blueprint.sources.length} public context page${blueprint.sources.length===1?'':'s'}. Their text informs topic context only.`:'The public research provider was unavailable, so no external factual context is asserted.',sourceIds:blueprint.sources.map(source=>source.id),confidence:blueprint.sources.length?'medium':'low',limitation:'Retrieved context does not validate the generated causal structure.'},
      {id:'system-assumptions',title:'Relationships form an exploratory hypothesis',kind:'assumption',detail:'Nodes, link polarity, strength, lag, and parameter mappings come from a disclosed system archetype selected by local rules.',sourceIds:[],confidence:'low',limitation:'A domain expert has not validated this question-specific model.'},
      {id:'system-output',title:'Ripple values are model outputs',kind:'simulation',detail:'The runtime applies bounded interventions and propagates effects through at most three causal orders with time response and damping.',sourceIds:[],confidence:'low',limitation:'Normalized values compare scenarios; they are not measured quantities or forecasts.'},
    ],
    time:{label:'Scenario step',unit:'steps',min:0,max:24,step:1,initial:12,events:[{at:0,label:'Baseline'},{at:6,label:'Early effects'},{at:12,label:'Developed scenario'},{at:24,label:'Scenario horizon'}]},limitations:blueprint.limitations,
  };
}

const clamp=(value:number,min=0,max=200)=>Math.max(min,Math.min(max,value));
export function simulateBlueprint(blueprint:SystemBlueprint,parameters:Parameters,time:number):SimulationResult {
  const progress=1-Math.exp(-time/6),values=new Map(blueprint.nodes.map(node=>[node.id,node.baseline]));
  blueprint.variables.forEach((variable,index)=>{
    const target=variable.targetId??blueprint.nodes[Math.min(index*2,blueprint.nodes.length-1)]?.id;
    if(target)values.set(target,clamp((values.get(target)??100)+(parameters[variable.id]??0)*.65*progress));
  });
  for(let order=1;order<=3;order++){
    const changes=new Map<string,number>();
    blueprint.edges.forEach(edge=>{
      const sourceShift=(values.get(edge.from)??100)-100;
      const lagResponse=1-Math.exp(-time/Math.max(1,edge.lag));
      const effect=sourceShift*edge.polarity*edge.strength*lagResponse*.46;
      changes.set(edge.to,(changes.get(edge.to)??0)+effect);
    });
    changes.forEach((change,id)=>values.set(id,clamp((values.get(id)??100)+change)));
  }
  const nodes:WorldNode[]=blueprint.nodes.map(node=>({id:node.id,label:node.label,value:values.get(node.id)??100,position:node.position,kind:node.role,detail:node.description,claimIds:['system-assumptions','system-output',...node.sourceIds.map(()=>'system-context')]}));
  const metrics:Metric[]=nodes.slice(-4).map(node=>{const uncertainty=12+blueprint.edges.filter(edge=>edge.to===node.id&&edge.confidence==='low').length*8;return {id:node.id,label:node.label,value:node.value,unit:'index',range:[clamp(node.value-uncertainty),clamp(node.value+uncertainty)],explanation:`Normalized scenario state for ${node.label}. Baseline 100. ${node.detail}`,equation:'state = bounded baseline + local intervention + three damped causal passes',inputs:blueprint.variables.map(variable=>variable.id),claimIds:['system-assumptions','system-output'],good:'neutral'};});
  const finalOutcome=metrics.at(-1)?.value??100;
  return {metrics,nodes,edges:blueprint.edges.map((edge,index)=>({from:edge.from,to:edge.to,weight:edge.polarity*edge.strength,order:Math.min(3,index%3+1) as 1|2|3,uncertain:edge.confidence!=='high'})),warnings:['Generated exploratory model: inspect and challenge every assumed connection.',...(blueprint.researchStatus==='offline'?['Live public research was unavailable; this world contains no question-specific external sources.']:[])],series:Array.from({length:time+1},(_,x)=>({x,y:x===time?finalOutcome:100+(finalOutcome-100)*(1-Math.exp(-x/6))}))};
}
