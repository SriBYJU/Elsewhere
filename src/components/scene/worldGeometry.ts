import * as THREE from 'three';
import { buildManhattanEnvironment } from './manhattanEnvironment';
import { buildHistoryEnvironment } from './historyEnvironment';
import { buildLandscapeEnvironment } from './landscapeEnvironment';
import type { NavigationMetadata } from './geometryKit';
import type { Parameters, SimulationResult, SystemBlueprint, WorldKind, WorldNode } from '../../core/types';

export const SCENE_COLORS = { ocean: '#090f13', slate: '#536967', lime: '#d1ec9c', cyan: '#85ccdb', amber: '#eab878', rose: '#ec9a9a' };
export interface SceneEnvironment { navigation?: NavigationMetadata; animated?: boolean; group: THREE.Group; animate: (time: number, parameters: Parameters) => void }
export interface SceneData { group: THREE.Group; nodes: Map<string, THREE.Object3D>; labels: Map<string, THREE.Vector3>; select: (id?: string) => void }

function seeded(seed: number) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

export function disposeGroup(group: THREE.Object3D) {
  group.userData.disposed=true;
  const textures=new Set<THREE.Texture>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.material) (Array.isArray(renderable.material) ? renderable.material : [renderable.material]).forEach(material => materials.add(material));
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => {for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);material.dispose();});
  textures.forEach(texture=>texture.dispose());
  group.removeFromParent();
  group.clear();
}

function line(points: THREE.Vector3[], color: string, opacity = 1, dashed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: .2, gapSize: .14, transparent: true, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const object = new THREE.Line(geometry, material);
  if (dashed) object.computeLineDistances();
  return object;
}

function systemEnvironment(blueprint?:SystemBlueprint):SceneEnvironment {
  const group=new THREE.Group(),archetype=blueprint?.archetype??'general';
  const groundColors:Record<string,string>={ecosystem:'#1d392c',energy:'#26352d',cpu:'#102b2f',internet:'#152a34',history:'#302c26',company:'#243033',finance:'#202c30','supply-chain':'#2e3029',science:'#202b35',general:'#202e30'};
  const ground=new THREE.Mesh(new THREE.BoxGeometry(22,.28,17),new THREE.MeshStandardMaterial({color:groundColors[archetype]??groundColors.general,roughness:.82,metalness:archetype==='cpu'?.42:.08}));
  ground.position.y=-.52;group.add(ground);
  const grid=new THREE.GridHelper(22,22,archetype==='ecosystem'?'#527652':'#557472','#293f40');grid.position.y=-.36;grid.scale.z=.77;group.add(grid);
  const points=new Map((blueprint?.nodes??[]).map(node=>[node.id,new THREE.Vector3(node.position[0]*1.7,-.3,node.position[2]*1.8)]));
  blueprint?.edges.forEach(edge=>{const start=points.get(edge.from),end=points.get(edge.to);if(start&&end)group.add(line([start,end],edge.polarity<0?SCENE_COLORS.amber:SCENE_COLORS.cyan,.28,true));});
  const random=seeded((blueprint?.subject.length??19)*7919);
  if(archetype==='ecosystem'){
    const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.38,1),new THREE.MeshStandardMaterial({color:'#557a4b',roughness:1}),70),dummy=new THREE.Object3D();
    for(let i=0;i<70;i++){const x=-10+random()*20,z=-7.5+random()*15;dummy.position.set(x,.05+random()*.35,z);dummy.scale.setScalar(.5+random()*.85);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);}group.add(crowns);
  }
  if(archetype==='cpu'){
    for(let i=-8;i<=8;i+=2){group.add(line([new THREE.Vector3(i,-.3,-7),new THREE.Vector3(i,-.3,7)],i%4?SCENE_COLORS.cyan:SCENE_COLORS.lime,.24));}
    for(let i=-6;i<=6;i+=2){group.add(line([new THREE.Vector3(-10,-.3,i),new THREE.Vector3(10,-.3,i)],SCENE_COLORS.cyan,.18));}
  }
  if(archetype==='energy'){
    for(let i=0;i<7;i++){const mast=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,2.2,8),new THREE.MeshStandardMaterial({color:'#84948a',metalness:.45}));mast.position.set(-8+i*2.7,.75,-6+(i%2)*1.2);group.add(mast);const rotor=new THREE.Mesh(new THREE.TorusGeometry(.55,.025,4,20),new THREE.MeshBasicMaterial({color:SCENE_COLORS.lime}));rotor.position.set(mast.position.x,1.7,mast.position.z);rotor.rotation.y=Math.PI/2;group.add(rotor);}
  }
  return {group,animate:()=>undefined};
}

export function buildEnvironment(kind:WorldKind,mode:'world'|'model',blueprint?:SystemBlueprint):SceneEnvironment {
  if(kind==='manhattan'&&mode==='world') return buildManhattanEnvironment();
  if(kind==='system'&&mode==='world'&&blueprint?.archetype==='history')return /\b(rome|roman|greece|classical|athens)\b/i.test(blueprint.subject)?buildHistoryEnvironment():buildLandscapeEnvironment(blueprint);
  if(kind==='system'&&mode==='world'&&blueprint?.archetype==='ecosystem')return buildLandscapeEnvironment(blueprint);
  if(kind==='system'&&mode==='world')return systemEnvironment(blueprint);
  const group=new THREE.Group();
  if(kind==='semiconductor'&&mode==='world') {
    const substrate=new THREE.Mesh(new THREE.BoxGeometry(20,.4,12),new THREE.MeshStandardMaterial({color:'#172d2e',roughness:.55,metalness:.25}));
    substrate.position.y=-.7;group.add(substrate);
    const grid=new THREE.GridHelper(20,25,'#50706a','#284642');grid.position.y=-.48;grid.scale.z=.6;group.add(grid);
    for(let side=-1;side<=1;side+=2) for(let pin=0;pin<20;pin++){
      const contact=new THREE.Mesh(new THREE.BoxGeometry(.18,.07,.6),new THREE.MeshStandardMaterial({color:'#748771',metalness:.65,roughness:.4}));
      contact.position.set(-9.2+pin*.96,-.39,side*6);group.add(contact);
    }
  }
  return {group,animate:()=>undefined};
}

const cityLocations:Record<string,[number,number,number]>={uptown:[.5,1,16],midtown:[1.4,5.5,1],downtown:[.3,4,-14],brooklyn:[13,.6,-11],queens:[13,.6,6],bronx:[1.5,1,24],jersey:[-14,.6,2],transit:[1.38,.6,10],freight:[-5.4,.6,-7], 'public-space':[-1,.8,8]};

export function nodePosition(node:WorldNode,kind:WorldKind,mode:'world'|'model') {
  if(kind==='manhattan'&&mode==='world') return new THREE.Vector3(...(cityLocations[node.id]??[node.position[0]*1.2,1,node.position[2]*3]));
  if(kind==='neural') return new THREE.Vector3(node.position[0]*2.1,node.position[1]*1.35+2.4,node.position[2]*1.6);
  if(mode==='model') return new THREE.Vector3(node.position[0]*1.6,2.4+node.position[2]*1.7,node.position[1]);
  return new THREE.Vector3(node.position[0]*1.7,.75+node.position[1],node.position[2]*1.8);
}

export function buildData(kind:WorldKind,mode:'world'|'model',result?:SimulationResult):SceneData {
  const group=new THREE.Group(),nodes=new Map<string,THREE.Object3D>(),labels=new Map<string,THREE.Vector3>();
  const rings=new Map<string,THREE.Mesh>();
  if(!result) return {group,nodes,labels,select:()=>undefined};
  const city=kind==='manhattan'&&mode==='world';
  const positions=new Map(result.nodes.map(node=>[node.id,nodePosition(node,kind,mode)]));
  (mode==='model'||kind==='neural'?result.edges:[]).forEach(edge=>{
    const start=positions.get(edge.from),end=positions.get(edge.to);
    if(!start||!end)return;
    const color=edge.uncertain?SCENE_COLORS.amber:edge.weight<0&&kind==='neural'?SCENE_COLORS.rose:edge.order===1?SCENE_COLORS.cyan:SCENE_COLORS.lime;
    const midpoint=start.clone().add(end).multiplyScalar(.5);
    if(city) midpoint.y+=2.4+start.distanceTo(end)*.12;
    else midpoint.z-=.6;
    const curve=new THREE.QuadraticBezierCurve3(start,midpoint,end);
    const opacity=city?.36:Math.min(.8,.22+Math.abs(edge.weight)*.17);
    if(edge.uncertain) group.add(line(curve.getPoints(40),color,opacity,true));
    else {
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,24,city?.018:.014+Math.min(4,Math.abs(edge.weight))*.012,4,false),new THREE.MeshBasicMaterial({color,transparent:true,opacity}));group.add(tube);
    }
    if(mode==='model'||kind==='semiconductor') {
      const direction=curve.getTangent(.83).normalize();
      const arrow=new THREE.Mesh(new THREE.ConeGeometry(.085,.27,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.82}));
      arrow.position.copy(curve.getPoint(.83));arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(arrow);
    }
  });
  result.nodes.forEach(node=>{
    const position=positions.get(node.id)!;
    const activation=kind==='neural'?Math.max(0,Math.min(1,node.value)):.5;
    const size=city?.045:kind==='neural'?.25+activation*.22:kind==='system'?.18:.43;
    const color=kind==='neural'?new THREE.Color(SCENE_COLORS.cyan).lerp(new THREE.Color(SCENE_COLORS.lime),activation):new THREE.Color(SCENE_COLORS.cyan);
    const geometry=kind==='semiconductor'&&mode==='world'?new THREE.BoxGeometry(size*2,.35+Math.min(3,Math.abs(node.value)/70),size*2):kind==='system'&&mode==='world'?new THREE.SphereGeometry(size,12,10):new THREE.SphereGeometry(size,20,14);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:city?.65:.22,roughness:.36,metalness:.3}));
    mesh.position.copy(position);mesh.userData.nodeId=node.id;group.add(mesh);nodes.set(node.id,mesh);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(size+ .17,.025,6,40),new THREE.MeshBasicMaterial({color:SCENE_COLORS.lime,transparent:true,opacity:.9}));
    ring.position.copy(position);if(city||kind==='semiconductor'&&mode==='world')ring.rotation.x=Math.PI/2;ring.visible=false;group.add(ring);rings.set(node.id,ring);
    if(city){
      const ground=position.clone();ground.y=.2;group.add(line([ground,position],SCENE_COLORS.cyan,.55));
      const base=new THREE.Mesh(new THREE.RingGeometry(.24,.29,32),new THREE.MeshBasicMaterial({color:SCENE_COLORS.cyan,side:THREE.DoubleSide,transparent:true,opacity:.6}));base.rotation.x=-Math.PI/2;base.position.copy(ground);group.add(base);
    }
    labels.set(node.id,position.clone().add(new THREE.Vector3(0,size+.55,0)));
  });
  return {group,nodes,labels,select:(id)=>{
    rings.forEach((ring,key)=>{ring.visible=key===id;});
    nodes.forEach((object,key)=>{const mesh=object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;mesh.material.emissiveIntensity=key===id?1:city?.65:.22;});
  }};
}
