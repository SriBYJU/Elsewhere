import * as THREE from 'three';
import type { Parameters } from '../../core/types';

export interface NavigationCollider { minX:number; maxX:number; minZ:number; maxZ:number; minY:number; maxY:number }
export interface NavigationMetadata {
  /** Spawn is at the player's feet. Add eyeHeight to obtain camera Y. */
  spawn:[number,number,number]; lookAt:[number,number,number];
  bounds:{minX:number;maxX:number;minZ:number;maxZ:number};
  floor:number; eyeHeight:number; radius:number; speed:number;
  colliders:NavigationCollider[]; land?:[number,number][];
}
export interface DetailedEnvironment { group:THREE.Group; navigation:NavigationMetadata; animated?:boolean; animate:(time:number,parameters:Parameters)=>void }
export type Instance = { position:[number,number,number]; scale:[number,number,number]; rotation?:[number,number,number]; color?:string };

export function seededRandom(seed:number) {
  let state=seed;
  return()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
}

/** A batch owns its geometry and material; worldGeometry.disposeGroup releases them. */
export function batch(group:THREE.Group,geometry:THREE.BufferGeometry,instances:Instance[],color:string,options:{metalness?:number;roughness?:number;emissive?:number}={}) {
  if(!instances.length){geometry.dispose();return null;}
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:options.roughness??.86,metalness:options.metalness??.06,...(options.emissive?{emissive:color,emissiveIntensity:options.emissive}: {})});
  const mesh=new THREE.InstancedMesh(geometry,material,instances.length);
  mesh.castShadow=instances.some(instance=>instance.scale[1]>.25);mesh.receiveShadow=true;
  const dummy=new THREE.Object3D();
  instances.forEach((instance,index)=>{
    dummy.position.set(...instance.position);dummy.scale.set(...instance.scale);dummy.rotation.set(...(instance.rotation??[0,0,0]));dummy.updateMatrix();
    mesh.setMatrixAt(index,dummy.matrix);mesh.setColorAt(index,new THREE.Color(instance.color??color));
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;
}

export function boxes(group:THREE.Group,instances:Instance[],color:string,options:{metalness?:number;roughness?:number;emissive?:number}={}) {return batch(group,new THREE.BoxGeometry(1,1,1),instances,color,options);}
export function box(position:Instance['position'],scale:Instance['scale'],color?:string,rotation?:Instance['rotation']):Instance{return{position,scale,color,rotation};}
export function solid(group:THREE.Group,geometry:THREE.BufferGeometry,color:string,position:[number,number,number],options:{roughness?:number;metalness?:number;emissive?:number}={}) {
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:options.roughness??.8,metalness:options.metalness??.05,emissive:color,emissiveIntensity:options.emissive??0}));
  mesh.receiveShadow=true;mesh.position.set(...position);group.add(mesh);return mesh;
}
export function polyline(group:THREE.Group,points:THREE.Vector3[],color:string,opacity=.7) {
  const result=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));group.add(result);return result;
}
export function addCollider(navigation:NavigationMetadata,x:number,z:number,width:number,depth:number,height:number,floor=navigation.floor){navigation.colliders.push({minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2,minY:floor,maxY:floor+height});}
export function makeNavigation(overrides:Partial<NavigationMetadata>={}):NavigationMetadata {
  return {spawn:[0,0,13.5],lookAt:[0,1.6,0],bounds:{minX:-21,maxX:21,minZ:-16.7,maxZ:16.7},floor:0,eyeHeight:1.6,radius:.22,speed:4.2,colliders:[],...overrides};
}

export function addTrees(group:THREE.Group,positions:{x:number;z:number;height:number;y?:number}[],conifer=false) {
  const trunks:Instance[]=[],leaves:Instance[]=[],shadow:Instance[]=[];
  const tones=conifer?['#254337','#315644','#44694a']:['#456747','#537348','#658157','#395d44'];
  positions.forEach(({x,z,height,y=0},index)=>{
    trunks.push(box([x,y+height*.3,z],[height*.07,height*.6,height*.07],index%3?'#6a5740':'#7b6950'));
    if(conifer)for(let layer=0;layer<3;layer++)leaves.push(box([x,y+height*(.48+layer*.19),z],[height*(.39-layer*.07),height*.58,height*(.39-layer*.07)],tones[index%tones.length]));
    else{
      leaves.push(box([x,y+height*.76,z],[height*.36,height*.4,height*.34],tones[index%tones.length]));
      leaves.push(box([x+height*.16,y+height*.67,z+height*.1],[height*.26,height*.31,height*.25],tones[(index+1)%tones.length]));
    }
    shadow.push(box([x,.012+y,z],[height*.7,.009,height*.7],'#22382d'));
  });
  batch(group,new THREE.CylinderGeometry(.42,.55,1,8),trunks,'#6a5740');
  batch(group,conifer?new THREE.ConeGeometry(1,1,14):new THREE.SphereGeometry(1,14,10),leaves,'#56764b');
  batch(group,new THREE.CylinderGeometry(.5,.5,1,16),shadow,'#243a2d');
}

export function addPath(group:THREE.Group,points:[number,number][],width:number,color:string,y=.015) {
  const sections:Instance[]=[];
  for(let i=1;i<points.length;i++){
    const [ax,az]=points[i-1],[bx,bz]=points[i];
    sections.push(box([(ax+bx)/2,y,(az+bz)/2],[width,.025,Math.hypot(bx-ax,bz-az)+.05],color,[0,Math.atan2(bx-ax,bz-az),0]));
  }
  boxes(group,sections,color);
}

/** World-unit UVs keep bricks the same size on both short and tall instances. */
export function addSurfaceTexture(group:THREE.Group,mesh:THREE.Mesh|null,textureName:'brick'|'asphalt'|'forest',repeat:number) {
  if(!mesh)return;
  const material=mesh.material as THREE.MeshStandardMaterial;
  const fallbackPixels=new Uint8Array(textureName==='asphalt'?[104,107,105,255,93,98,96,255,113,115,110,255,104,109,106,255]:textureName==='forest'?[100,118,66,255,90,109,62,255,114,127,71,255,99,115,64,255]:[145,118,97,255,112,91,76,255,137,113,95,255,108,98,84,255]);
  const fallback=new THREE.DataTexture(fallbackPixels,2,2,THREE.RGBAFormat);
  fallback.colorSpace=THREE.SRGBColorSpace;fallback.wrapS=fallback.wrapT=THREE.RepeatWrapping;fallback.needsUpdate=true;
  material.map=fallback;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vMasonryPoint;\nvarying vec3 vMasonryNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\nvMasonryPoint=(instanceMatrix*vec4(position,1.0)).xyz;\n#else\nvMasonryPoint=position;\n#endif\nvMasonryNormal=normal;');
    shader.fragmentShader='varying vec3 vMasonryPoint;\nvarying vec3 vMasonryNormal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP\nvec2 masonryUv=abs(vMasonryNormal.x)>.5?vMasonryPoint.zy:abs(vMasonryNormal.y)>.5?vMasonryPoint.xz:vMasonryPoint.xy;\nvec4 sampledDiffuseColor=texture2D(map,masonryUv*${repeat.toFixed(2)});\ndiffuseColor*=sampledDiffuseColor;\n#endif`);
  };
  material.customProgramCacheKey=()=>`elsewhere-${textureName}-${repeat}`;
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/higgsfield-${textureName}.webp`,texture=>{
    if(group.userData.disposed){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
    material.map=texture;material.needsUpdate=true;fallback.dispose();
  },undefined,()=>{ /* The procedural masonry remains visible when offline. */ });
}

export function addMasonryTexture(group:THREE.Group,mesh:THREE.Mesh|null,repeat=4){addSurfaceTexture(group,mesh,'brick',repeat);}
