export type WorldKind = 'manhattan' | 'neural' | 'semiconductor';
export type Parameters = Record<string, number>;
export type EvidenceKind = 'fact' | 'assumption' | 'derived' | 'simulation' | 'speculation';
export interface Source {id:string; title:string; url:string; publisher:string; published:string; accessed:string; note:string}
export interface Claim {id:string; title:string; kind:EvidenceKind; detail:string; sourceIds:string[]; confidence:'high'|'medium'|'low'; limitation:string}
export interface Variable {id:string; label:string; min:number; max:number; step:number; initial:number; unit:string; description:string; claimIds:string[]}
export interface Metric {id:string; label:string; value:number; unit:string; range:[number,number]; explanation:string; equation:string; inputs:string[]; claimIds:string[]; good:'up'|'down'|'neutral'}
export interface WorldNode {id:string; label:string; value:number; position:[number,number,number]; kind:string; detail:string; claimIds:string[]}
export interface WorldEdge {from:string; to:string; weight:number; order:1|2|3; uncertain:boolean}
export interface SimulationResult {metrics:Metric[]; nodes:WorldNode[]; edges:WorldEdge[]; warnings:string[]; series:{x:number;y:number}[]; samples?:{x:number;y:number;value:number;target:number}[]}
export interface WorldDefinition {id:WorldKind; title:string; subtitle:string; description:string; question:string; category:string; coordinates:string; variables:Variable[]; sources:Source[]; claims:Claim[]; time:{label:string;unit:string;min:number;max:number;step:number;initial:number;events:{at:number;label:string}[]}; limitations:string[]}
export interface Branch {id:string;name:string;parameters:Parameters;time:number;createdAt:string;parentId:string|null}
export interface WorldDocument {format:'elsewhere';version:1;id:string;kind:WorldKind;title:string;question:string;createdAt:string;updatedAt:string;parameters:Parameters;time:number;branches:Branch[];activeBranchId:string;history:{at:string;action:string}[]}
export interface CompileResult {world:WorldDocument;definition:WorldDefinition;route:'deterministic'|'precompiled';notices:string[];stages:{name:string;detail:string;count:number}[]}
export type Command = {type:'set';values:Parameters}|{type:'time';value:number}|{type:'branch'}|{type:'compare'}|{type:'panel';panel:'evidence'|'model'|'why'|'challenge'}|{type:'focus';nodeId?:string}|{type:'reset'}|{type:'unknown';message:string};
