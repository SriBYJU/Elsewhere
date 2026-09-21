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

// A fixed epoch keeps relative-time prompts reproducible after a document is reopened.
const REFERENCE_YEAR=2026;
type HistoricalTime={label:string;year?:number;relative:boolean};
const numberWords:Record<string,number>={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
const historicWords=/\b(history|historical|historically|ancient|medieval|prehistoric|prehistory|antiquity|colonial|archaeolog(?:y|ical)|bygone|stone age|bronze age|iron age|ice age|renaissance|victorian|long ago|in the past)\b/i;

function historicalTime(question:string):HistoricalTime|undefined {
  const relative=question.match(/\b(\d[\d,]*(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+(hundred|thousand|million|billion))?\s+(years?|decades?|centur(?:y|ies)|millenni(?:um|a))\s+(?:ago|in the past)\b/i);
  if(relative){
    const value=numberWords[relative[1].toLowerCase()]??Number(relative[1].replaceAll(',',''));
    const scale=relative[2]?({hundred:100,thousand:1000,million:1e6,billion:1e9}[relative[2].toLowerCase()]??1):1;
    const unit=/decade/i.test(relative[3])?10:/centur/i.test(relative[3])?100:/millenni/i.test(relative[3])?1000:1;
    return {label:relative[0],year:REFERENCE_YEAR-value*scale*unit,relative:true};
  }
  const era=question.match(/\b(\d[\d,]*)\s*(B\.?C\.?E?\.?|A\.?D\.?|C\.?E\.?)\b|\b(BCE|BC|AD|CE)\s+(\d[\d,]*)\b/i);
  if(era){
    const value=Number((era[1]??era[4]).replaceAll(',',''));
    const year=/^b/i.test(era[2]??era[3])?1-value:value;
    if(year<=REFERENCE_YEAR)return {label:era[0].replace(/[.]+$/,''),year,relative:false};
  }
  const century=question.match(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?[ -]century(?:\s*(BCE|BC|CE|AD))?\b/i);
  if(century){
    const count=Number(century[1]),year=/^b/i.test(century[2]??'')?1-count*100:(count-1)*100+1;
    if(count>0&&year<REFERENCE_YEAR)return {label:century[0],year,relative:false};
  }
  const dated=question.match(/\b(?:in|around|circa|during|as of|year)\s+(?:the year\s+)?(\d{3,4})(s)?\b|,\s*(\d{3,4})\s*[?.!]?$/i);
  if(dated){
    const year=Number(dated[1]??dated[3]);
    if(year<REFERENCE_YEAR)return {label:dated[0].replace(/^,\s*/,''),year,relative:false};
  }
  const period=question.match(historicWords);
  return period?{label:period[0],relative:false}:undefined;
}

export function hasHistoricalIntent(question:string){return historicalTime(question)!==undefined;}

const domainHints:Partial<Record<SystemArchetype,RegExp>>={
  company:/\b(companies|businesses|firms|startups|organisations?|organizations?|enterprises?|employees?|sales|management)\b/i,
  finance:/\b(banks|bonds?|stocks?|mortgages?|currenc(?:y|ies)|monetary|trading|loans?|pensions?|funds?)\b/i,
  'supply-chain':/\b(supply[ -]chains?|warehouses?|shipments?|freight|manufacturers?|containers?|ports?)\b/i,
  cpu:/\b(cpus?|processors?|ram|alu|registers?|instruction pipeline|branch prediction)\b/i,
  internet:/\b(networking|routers?|wireless|wi[ -]?fi|telecommunications?|protocols?|tcp|fiber|fibre|data cent(?:er|re)s?)\b/i,
  science:/\b(atoms?|molecules?|gravity|gravitational|chemical|biological|cells|geology|volcanoes?|tectonic|stars?|galaxies|planets|quantum)\b/i,
  energy:/\b(hydroelectric|geothermal|fossil fuels?|petroleum|power stations?|power plants?|turbines?|batteries)\b/i,
  ecosystem:/\b(ecosystems?|forests?|rainforests?|reefs?|mangroves?|savannas?|deserts?|tundra|biomes?|rivers?|lakes?|wildlife|grasslands?|habitats?)\b/i,
};
// Specific mechanisms win ties over words shared by many systems (such as network).
const archetypeOrder:SystemArchetype[]=['cpu','supply-chain','energy','finance','ecosystem','internet','company','science','history'];

export function classifyArchetype(question:string):SystemArchetype {
  if(hasHistoricalIntent(question))return 'history';
  const score=(pattern:RegExp|undefined)=>pattern?[...question.matchAll(new RegExp(pattern.source,'gi'))].reduce((total,match)=>total+(match[0].includes(' ')?3:1),0):0;
  const ranked=archetypeOrder.map(archetype=>({archetype,score:score(templates[archetype].keywords)+score(domainHints[archetype])})).sort((a,b)=>b.score-a.score);
  return ranked[0].score>0?ranked[0].archetype:'general';
}

function subjectFrom(question:string){
  const subject=question.trim().replace(/^(?:what (?:if|happens (?:if|when))|show me|explain|take me (?:inside|to)|transport me to|bring me to|travel to|go to|visit|explore|walk (?:around|through)|suppose)\s+/i,'').replace(/[?.!]+$/,'').trim();
  return (subject||'this complex system').slice(0,120);
}

export type WorldSetting={place:string;era:string;terrain:'woodland'|'desert'|'water'|'mountain'|'polar'|'urban'|'landscape';historical:boolean;deepTime:boolean};

/** Renderer cues are schematic prompt interpretation, never a geocoded reconstruction. */
export function inferWorldSetting(question:string):WorldSetting {
  const time=historicalTime(question);
  let place=subjectFrom(question).replace(/^(?:what (?:was|were|is)|how was|life in|daily life in|history of)\s+/i,'');
  if(time)place=place.replace(time.label,'').replace(/[,.?]+$/,'').replace(/\b(?:look(?:ed)? like|like|back|in|around|during|circa|as of|the year|the)\s*$/i,'').trim();
  place=place.replace(/^(?:in|around|inside|the history of|ancient|medieval|prehistoric|colonial)\s+/i,'').replace(/\s+/g,' ').trim();
  const terrain:WorldSetting['terrain']=/\b(desert|sahara|gobi|namib|atacama)\b/i.test(question)?'desert':/\b(arctic|antarctic|antarctica|tundra|polar|greenland)\b/i.test(question)?'polar':/\b(mountain|mountains|himalayas?|alps|andes|everest)\b/i.test(question)?'mountain':/\b(ocean|sea|reef|coral|coast|coastal|island|bay|pacific|atlantic|caribbean)\b/i.test(question)?'water':/\b(forest|rainforest|woodland|jungle|amazon|virginia)\b/i.test(question)?'woodland':/\b(city|cities|tokyo|london|paris|kyoto|rome|lagos|delhi|new york|são paulo|sao paulo)\b/i.test(question)?'urban':'landscape';
  const historical=!!time||templates.history.keywords.test(question);
  return {place:clean(place||'this place',80),era:time?.label??(historical?'period not specified':'present-day scenario'),terrain,historical,deepTime:(time?.year??REFERENCE_YEAR)<-10000};
}

const terrainLabels:Record<WorldSetting['terrain'],string>={woodland:'rivers & woodland',desert:'arid land & water sources',water:'waterways & shoreline',mountain:'highlands & valleys',polar:'ice, coast & seasonal light',urban:'landscape & gathering places',landscape:'land & waterways'};
const virginiaSource:Source={id:'virginia-middle-woodland',title:'Middle Woodland: 500 B.C.–A.D. 900',url:'https://www.dhr.virginia.gov/blog-posts/middle-woodland-500-b-c-a-d-900/',publisher:'Virginia Department of Historic Resources',published:'2017-01-11',accessed:'2026-09-21',note:'The overview describes scattered settled hamlets along major rivers across the valleys, Piedmont and Coastal Plain. It provides regional period context, not evidence for an exact reconstructed scene or simulated effect size.'};

function historicalPlaceTemplate(setting:WorldSetting,middleWoodland:boolean):Template {
  const place=setting.place,land=terrainLabels[setting.terrain];
  if(setting.deepTime)return {
    category:'Deep-time landscape',keywords:/$^/,
    nodes:[['conditions',`${place} · ancient terrain`,'landscape','Landforms are schematic. Present-day coastlines and borders must not be assumed for deep time.'],['institutions','Water & climate','climate','Illustrative water and climate conditions; no paleoclimate reconstruction is asserted.'],['actors','Life & habitats','habitat','Possible ecological relationships, without claiming that any depicted species lived at this place and time.'],['event','Energy & nutrients','resource','Simplified resource flows in an uncalibrated ancient environment.'],['response','Environmental change','change','Illustrative feedback across the landscape, not a dated sequence of actual events.'],['outcome','Landscape continuity','outcome','A normalized comparison index; it does not measure the survival of an actual ecosystem.']],
    edges:templates.ecosystem.edges,controls:[['inputPressure','Environmental resources',0,'conditions'],['systemCapacity','Habitat capacity',2,'actors'],['constraintPressure','Disturbance pressure',4,'response']],
  };
  return {
    category:setting.historical?'Historical landscape':'Place and community',keywords:/$^/,
    nodes:[
      ['conditions',`${place} · ${land}`,'landscape',`Explore ${land} as a schematic setting for ${place}, ${setting.era}. Terrain placement and scale are illustrative.`],
      ['institutions',middleWoodland?'River hamlets & gathering places':'Homes & gathering places','settlement',middleWoodland?'Virginia archaeological context describes scattered settled hamlets along major rivers. Building forms and positions here are illustrative.':'Explore where people might gather and live. No specific settlement, population count or building design is established by this prompt.'],
      ['actors',middleWoodland?'Indigenous communities':'Communities & social ties','community',middleWoodland?'Indigenous communities inhabit this regional historical context. The model does not infer a named tribe or later political boundary from the modern place name.':'Social relationships are modeled assumptions. Identities, institutions and customs require period-specific evidence.'],
      ['event','Food & seasonal resources','resource','An illustrative connection between seasonal availability and everyday activity; no harvest, species inventory or diet is reconstructed.'],
      ['response','Travel & exchange routes','route','Schematic routes connect the setting. They are not mapped archaeological trails or measured trade flows.'],
      ['outcome','Everyday life & continuity','outcome','Compare a hypothetical change in community conditions. The index is neither historical welfare data nor a prediction of what actually happened.'],
    ],
    edges:[[0,1,1,.55,4,'Assumption: landscape conditions influence gathering places.'],[0,3,1,.65,3,'Assumption: local conditions affect seasonal resource availability.'],[2,4,1,.55,2,'Assumption: social connections enable travel and exchange.'],[3,5,1,.7,2,'Assumption: resource availability affects everyday conditions.'],[4,3,1,.4,3,'Assumption: exchange changes access to resources.'],[1,5,1,.5,3,'Assumption: gathering places contribute to community continuity.']],
    controls:[['inputPressure','Seasonal resource availability',3,'event'],['systemCapacity','Community coordination',2,'actors'],['constraintPressure','Travel & exchange access',4,'response']],
  };
}

export function buildSystemBlueprint(question:string,sources:Source[]=[],researchStatus:SystemBlueprint['researchStatus']='offline'):SystemBlueprint {
  const archetype=classifyArchetype(question),subject=subjectFrom(question),setting=inferWorldSetting(question),time=historicalTime(question);
  const middleWoodland=archetype==='history'&&/\bvirginia\b/i.test(setting.place)&&time?.year!==undefined&&time.year>=-499&&time.year<=900;
  const travelPrompt=/^(?:(?:show|take|bring|transport) me|explore|visit|travel to|go to|walk (?:around|through))\b/i.test(question.trim());
  const shortPlaceName=/^[\p{Lu}][\p{L}\p{M}' .-]{1,79}$/u.test(subject)&&!/^(?:what|how|why|when|where|can|does|the)\b/i.test(subject);
  const geographic=archetype==='history'||(['general','ecosystem'].includes(archetype)&&(travelPrompt||shortPlaceName));
  const template=archetype==='history'||(archetype==='general'&&geographic)?historicalPlaceTemplate(setting,middleWoodland):templates[archetype];
  const contextSources=middleWoodland?[...sources.filter(source=>source.id!==virginiaSource.id),{...virginiaSource}]:sources;
  const nodes:BlueprintNode[]=template.nodes.map(([id,label,role,description],index)=>{
    const angle=(index/template.nodes.length)*Math.PI*2-Math.PI/2;
    const placeLabel=geographic&&archetype==='ecosystem'&&index===0?`${setting.place} · ${label.toLowerCase()}`:label;
    return {id,label:placeLabel.slice(0,120),role,description,baseline:100,position:[Math.cos(angle)*4,0,Math.sin(angle)*3],sourceIds:middleWoodland&&id==='institutions'?[virginiaSource.id]:[]};
  });
  const edges:BlueprintEdge[]=template.edges.map(([from,to,polarity,strength,lag,description])=>({from:nodes[from].id,to:nodes[to].id,polarity,strength,lag,confidence:'low',description,sourceIds:[]}));
  const variables:Variable[]=template.controls.map(([id,label,_targetIndex,target])=>({id,label,min:-100,max:100,step:1,initial:0,unit:'%',description:`Scenario intervention applied to ${nodes.find(node=>node.id===target)?.label??target}. Positive and negative values shift its normalized baseline.`,claimIds:['system-assumptions'],targetId:target}));
  const historicalSummary=`An illustrative historical world for ${setting.place}, ${setting.era}${middleWoodland?' — regional Middle Woodland context':''}. Explore ${terrainLabels[setting.terrain]}${setting.deepTime?', habitats and environmental change':', gathering places, seasonal resources and exchange'}. This is a schematic interpretation, not an exact reconstruction; causal effects remain uncalibrated assumptions.`;
  const summary=archetype==='history'?historicalSummary:`An exploratory ${template.category.toLowerCase()} model for “${subject}”. ${geographic?`The setting uses ${terrainLabels[setting.terrain]} as illustrative cues, not verified geography. `:''}Public references provide topic context; the causal links and sensitivities remain visible modeled assumptions.`;
  return {archetype,subject,summary,nodes,edges,variables,sources:contextSources,researchStatus,limitations:[...(archetype==='history'?[`Modern place names locate the requested region; they do not establish historical borders, peoples, structures or exact terrain.${time?.relative?` Relative dates use the fixed reference year ${REFERENCE_YEAR}.`:''}`,'The time slider shows scenario response steps, not a playback of historical years or a dated sequence of real events.']:[]),'This generated system map is an exploratory hypothesis, not a validated domain model or quantitative forecast.','Live research retrieves context pages; it does not establish causation or calibrate the simulated effect sizes.','Node baselines are normalized to 100. Edges use generic bounded propagation for comparison, not real-world units.','Important entities and competing explanations may be missing. Use Source DNA and Challenge before drawing conclusions.']};
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
    id:'system',title:blueprint.subject.charAt(0).toUpperCase()+blueprint.subject.slice(1),subtitle:blueprint.archetype==='history'?'Explore a place and time. Question the reconstruction.':'Walk through the connections. Change the system.',description:blueprint.summary,question,category:`Generated ${blueprint.archetype.replace('-',' ')} system`,coordinates:blueprint.archetype==='history'?'An illustrative historical landscape':'A navigable causal space',variables:blueprint.variables,sources:blueprint.sources,
    claims:[
      {id:'system-context',title:'Reference context and provenance',kind:'fact',detail:blueprint.sources.length?`This world includes ${blueprint.sources.length} public context reference${blueprint.sources.length===1?'':'s'}. Bundled references and any live results provide topic context only; they do not verify every depicted detail.`:'No external factual context is available for this world. Its setting and relationships are illustrative assumptions.',sourceIds:blueprint.sources.map(source=>source.id),confidence:blueprint.sources.length?'medium':'low',limitation:'Reference context does not validate the generated causal structure, exact geography or visual reconstruction.'},
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
  return {metrics,nodes,edges:blueprint.edges.map((edge,index)=>({from:edge.from,to:edge.to,weight:edge.polarity*edge.strength,order:Math.min(3,index%3+1) as 1|2|3,uncertain:edge.confidence!=='high'})),warnings:['Generated exploratory model: inspect and challenge every assumed connection.',...(blueprint.archetype==='history'?['Historical setting is illustrative; scenario steps are not historical years.']:[]),...(blueprint.researchStatus==='offline'?[blueprint.sources.length?'Live research is unavailable; bundled references provide limited regional context.':'Live public research was unavailable; this world contains no question-specific external sources.']:[])],series:Array.from({length:time+1},(_,x)=>({x,y:x===time?finalOutcome:100+(finalOutcome-100)*(1-Math.exp(-x/6))}))};
}
