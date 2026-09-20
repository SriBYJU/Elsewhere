import { parseWorld, serializeWorld } from './core';
import type { WorldDocument } from './core/types';

const PREFIX='elsewhere:v1:';
const LIMIT=30;
export interface SavedWorld {world:WorldDocument;recovered:boolean}
export interface SaveResult {ok:boolean;message:string}
/** Keep the previous validated snapshot until the new one has been read back. */
export function saveWorld(world:WorldDocument, storage:Storage=localStorage):SaveResult {
  try {
    const key=PREFIX+world.id;
    const text=serializeWorld(world);
    const previous=storage.getItem(key);
    if(previous===text) return {ok:true,message:'Saved on this device'};
    if(previous){try{parseWorld(previous);storage.setItem(key+':recovery',previous);}catch{/* Preserve any existing valid recovery. */}}
    storage.setItem(key,text);
    if(storage.getItem(key)!==text) throw new Error('Storage verification failed');
    return {ok:true,message:'Saved on this device'};
  }catch {return {ok:false,message:'Device storage is unavailable or full. Export your world to keep it.'};}
}
export function listWorlds(storage:Storage=localStorage):SavedWorld[] {
  const found:SavedWorld[]=[];
  const keys=new Set<string>();
  try{
    for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(PREFIX))keys.add(key.replace(/:recovery$/,''));}
    for(const key of keys){
      let world:WorldDocument|null=null;let recovered=false;
      try{world=parseWorld(storage.getItem(key)||'');}catch{try{world=parseWorld(storage.getItem(key+':recovery')||'');recovered=true;}catch{/* Invalid snapshots are not executable. */}}
      if(world)found.push({world,recovered});
    }
  }catch{return [];}
  return found.sort((a,b)=>b.world.updatedAt.localeCompare(a.world.updatedAt)).slice(0,LIMIT);
}
export function deleteWorld(id:string,storage:Storage=localStorage){storage.removeItem(PREFIX+id);storage.removeItem(PREFIX+id+':recovery');}
export function exportWorld(world:WorldDocument){
  const url=URL.createObjectURL(new Blob([serializeWorld(world)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=world.title.replace(/[^a-z0-9-]/gi,'-').slice(0,70)+'.elsewhere';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function shareUrl(world:WorldDocument){
  const bytes=new TextEncoder().encode(serializeWorld(world));
  if(bytes.length>24000)throw new Error('This world is too large for a link. Export the .elsewhere file instead.');
  const encoded=btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''));
  return location.href.split('#')[0]+'#/share/'+encodeURIComponent(encoded);
}
export function readShare(encoded:string){
  if(encoded.length>100000)throw new Error('Shared world exceeds the size limit.');
  const data=atob(decodeURIComponent(encoded));
  return parseWorld(new TextDecoder().decode(Uint8Array.from(data,c=>c.charCodeAt(0))));
}
