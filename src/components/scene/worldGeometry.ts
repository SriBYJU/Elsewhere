import * as THREE from 'three';
import type { Parameters, SimulationResult, SystemBlueprint, WorldKind, WorldNode } from '../../core/types';

export const SCENE_COLORS = { ocean: '#090f13', slate: '#536967', lime: '#d1ec9c', cyan: '#85ccdb', amber: '#eab878', rose: '#ec9a9a' };
export interface SceneEnvironment { group: THREE.Group; animate: (time: number, parameters: Parameters) => void }
export interface SceneData { group: THREE.Group; nodes: Map<string, THREE.Object3D>; labels: Map<string, THREE.Vector3>; select: (id?: string) => void }
type Block = { x: number; y: number; z: number; w: number; h: number; d: number; tone: number };

function seeded(seed: number) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

export function disposeGroup(group: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.material) (Array.isArray(renderable.material) ? renderable.material : [renderable.material]).forEach(material => materials.add(material));
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
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

function shapeMesh(points: number[][], depth: number, color: string, elevation = 0) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .95 }));
  mesh.position.y = elevation - depth;
  return mesh;
}

function makeBlocks(blocks: Block[], opacity = 1) {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .88, metalness: .08, transparent: opacity < 1, opacity });
  const mesh = new THREE.InstancedMesh(geometry, material, blocks.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const edgeVertices: number[] = [];
  const color = new THREE.Color();
  const corners = [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]];
  const pairs = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  blocks.forEach((block, i) => {
    position.set(block.x, block.y + block.h / 2, block.z);
    scale.set(block.w, block.h, block.d);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
    color.setHSL(.45 + block.tone * .025, .095 + block.tone * .025, .22 + block.tone * .15);
    mesh.setColorAt(i, color);
    for (const [a,b] of pairs) for (const index of [a,b]) {
      const corner = corners[index];
      edgeVertices.push(block.x + corner[0] * block.w / 2, block.y + block.h / 2 + corner[1] * block.h / 2, block.z + corner[2] * block.d / 2);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  const edges = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3)), new THREE.LineBasicMaterial({ color: '#bfd0c5', transparent: true, opacity: .11 * opacity }));
  group.add(edges);
  return group;
}

const ISLAND = [[-1.3,-21],[-3.5,-19],[-5.05,-13],[-5.75,-6],[-5.5,3],[-4.55,11],[-2.65,19],[.4,22],[2.65,20],[4.15,13],[5.35,5],[5.85,-3],[4.55,-12],[2.5,-18],[.2,-21]];
const widthAt = (z: number) => z < -17 ? 2.1 : z < -12 ? 3.65 : z > 17 ? 2.4 : z > 11 ? 3.85 : 4.9;

function manhattanEnvironment(): SceneEnvironment {
  const group = new THREE.Group();
  const random = seeded(40712);
  group.add(shapeMesh(ISLAND, .62, '#334844', .12));
  group.add(line([...ISLAND, ISLAND[0]].map(([x,z]) => new THREE.Vector3(x,.15,z)), '#7c9c8c', .5));
  // Deliberately simplified neighboring shores anchor the island in a larger geography.
  group.add(shapeMesh([[-17,-31],[-12,-28],[-11,-18],[-12,-9],[-12,3],[-11,14],[-13,27],[-25,31],[-29,-30]], .3, '#152225', -.12));
  group.add(shapeMesh([[12,-29],[10,-18],[11,-10],[12,1],[11,13],[8,25],[28,31],[32,-28]], .3, '#18272a', -.1));
  const streets: number[] = [];
  for (let z = -18.5; z < 20; z += 1.35) {
    const width = widthAt(z);
    streets.push(-width,.16,z,width,.16,z);
  }
  for (let x = -4; x <= 4; x += 1.35) {
    const end = Math.abs(x) > 3 ? 11.6 : 18.4;
    streets.push(x,.16,-end,x,.16,end);
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(streets,3)), new THREE.LineBasicMaterial({color:'#a7b7aa',transparent:true,opacity:.22})));
  const buildings: Block[] = [];
  for (let row = 0; row < 28; row++) {
    const z = -18 + row * 1.35;
    for (let col = 0; col < 7; col++) {
      const x = -3.9 + col * 1.35;
      if (Math.abs(x) + .55 > widthAt(z) || (x > -2.65 && x < 1.55 && z > 5.3 && z < 14.2)) continue;
      const density = Math.exp(-Math.pow((z - 1.2) / 5, 2)) * 4.6 + Math.exp(-Math.pow((z + 14.2) / 2.4, 2)) * 3.5;
      for (let subdivision = 0; subdivision < 3; subdivision++) {
        const w = subdivision === 0 ? .52 : .38 + random() * .13;
        const d = subdivision === 0 ? 1.02 : .42;
        const bx = x + (subdivision === 0 ? -.27 : .28);
        const bz = z + (subdivision === 0 ? 0 : subdivision === 1 ? -.28 : .28);
        const h = .28 + random() * .58 + Math.pow(random(),1.5) * density;
        const tone = random();
        buildings.push({x:bx,y:.15,z:bz,w,h,d,tone});
        if (h > 2.15) {
          buildings.push({x:bx,y:h+.15,z:bz,w:w*.66,h:h*.22,d:d*.67,tone:tone+.1});
          if (h > 3.6) buildings.push({x:bx,y:h*1.22+.15,z:bz,w:.065,h:.7,d:.065,tone:.9});
        }
      }
    }
  }
  group.add(makeBlocks(buildings));
  // The park is an intentionally legible negative space in the dense street fabric.
  const park = new THREE.Mesh(new THREE.BoxGeometry(3.85,.06,8.75),new THREE.MeshStandardMaterial({color:'#344b37',roughness:1}));
  park.position.set(-.56,.18,9.65); group.add(park);
  const treeGeometry = new THREE.IcosahedronGeometry(1,0);
  const trees = new THREE.InstancedMesh(treeGeometry,new THREE.MeshStandardMaterial({color:'#69815a',roughness:1}),165);
  const dummy = new THREE.Object3D();
  for(let i=0;i<165;i++) {
    const x=-2.3+random()*3.35,z=5.6+random()*8.1;
    const radius=.13+random()*.15;
    dummy.position.set(x,.3+radius*.55,z); dummy.scale.set(radius,radius*.9,radius); dummy.updateMatrix(); trees.setMatrixAt(i,dummy.matrix);
  }
  group.add(trees);
  const reservoir = new THREE.Mesh(new THREE.CircleGeometry(.88,32),new THREE.MeshStandardMaterial({color:'#1b3e43',roughness:.32,metalness:.2}));
  reservoir.rotation.x=-Math.PI/2;reservoir.scale.set(1,1.5,1);reservoir.position.set(-.55,.62,10.6);group.add(reservoir);
  const parkPath = new THREE.EllipseCurve(-.56,9.6,1.43,3.73,0,Math.PI*2,false,0);
  group.add(line(parkPath.getPoints(100).map(p=>new THREE.Vector3(p.x,.65,p.y)),'#a1a886',.46));
  for (let i=0;i<10;i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(.9,.12,.28),new THREE.MeshStandardMaterial({color:'#405552',roughness:1}));
    pier.position.set(-5.6,.04,-8+i*1.9);group.add(pier);
  }
  const bridges = [[-13,-8,-4.8,-8],[4.9,-7,12,-10],[5.2,-3,12,-4],[4.9,3,12,4],[2.9,16,10,20]];
  bridges.forEach(([x,z,tx,tz])=>{
    const start=new THREE.Vector3(x,.28,z),end=new THREE.Vector3(tx,.28,tz),direction=end.clone().sub(start),mid=start.clone().add(end).multiplyScalar(.5);
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(.32,.16,direction.length()),new THREE.MeshStandardMaterial({color:'#657771',roughness:1}));
    bridge.position.copy(mid);bridge.rotation.y=Math.atan2(direction.x,direction.z);group.add(bridge);
    group.add(line([start.clone().add(new THREE.Vector3(0,.15,0)),end.clone().add(new THREE.Vector3(0,.15,0))],'#b9c8ad',.45));
  });
  const routes: THREE.CatmullRomCurve3[]=[];
  [-2.72,1.38,4.05].forEach((x,i)=> {
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x*.45,.24,-19),new THREE.Vector3(x,.26,-11),new THREE.Vector3(x,.27,1),new THREE.Vector3(x*.87,.25,12),new THREE.Vector3(x*.45,.25,19)]);
    routes.push(curve);group.add(line(curve.getPoints(100),i===1?SCENE_COLORS.lime:SCENE_COLORS.cyan,.64));
  });
  const vehicles = new THREE.InstancedMesh(new THREE.BoxGeometry(.065,.07,.29),new THREE.MeshBasicMaterial({color:SCENE_COLORS.lime}),54);
  const cars = new THREE.InstancedMesh(new THREE.BoxGeometry(.04,.045,.13),new THREE.MeshBasicMaterial({color:'#8daaaa'}),62);
  group.add(vehicles,cars);
  const tangent = new THREE.Vector3();
  const point = new THREE.Vector3();
  const animate = (time:number,parameters:Parameters) => {
    const transit = 1 + Math.max(0,parameters.transitInvestment ?? 30)/100;
    const carReduction = Math.max(0,Math.min(100,parameters.carReduction ?? 20))/100;
    for(let i=0;i<54;i++) {
      const route=routes[i%routes.length],progress=(i/18+time*.021*transit*(i%2?1:-1)+100)%1;
      route.getPointAt(progress,point);route.getTangentAt(progress,tangent);
      dummy.position.copy(point);dummy.rotation.set(0,Math.atan2(tangent.x,tangent.z),0);dummy.scale.setScalar(1);dummy.updateMatrix();vehicles.setMatrixAt(i,dummy.matrix);
    }
    vehicles.count=Math.min(54,Math.round(30+transit*10));vehicles.instanceMatrix.needsUpdate=true;
    cars.count=Math.round(62*(1-carReduction*.88));
    for(let i=0;i<cars.count;i++) {
      const row=i%25,z=-16.5+row*1.35,width=widthAt(z);
      dummy.position.set(((i*.713+time*.095)%1)*width*2-width,.22,z);dummy.rotation.set(0,Math.PI/2,0);dummy.scale.setScalar(1);dummy.updateMatrix();cars.setMatrixAt(i,dummy.matrix);
    }
    cars.instanceMatrix.needsUpdate=true;
  };
  animate(0,{});
  return {group,animate};
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
  if(kind==='manhattan'&&mode==='world') return manhattanEnvironment();
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
  result.edges.forEach(edge=>{
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
    const size=city?.17:kind==='neural'?.25+activation*.22:kind==='system'?.68:.43;
    const color=kind==='neural'?new THREE.Color(SCENE_COLORS.cyan).lerp(new THREE.Color(SCENE_COLORS.lime),activation):new THREE.Color(SCENE_COLORS.cyan);
    const systemGeometry=()=>node.kind==='constraint'?new THREE.OctahedronGeometry(size,0):node.kind==='buffer'||node.kind==='stock'?new THREE.CylinderGeometry(size*.82,size,1.3,16):node.kind==='process'||node.kind==='flow'?new THREE.BoxGeometry(size*1.8,1.2,size*1.8):node.kind==='output'?new THREE.ConeGeometry(size,1.5,18):new THREE.DodecahedronGeometry(size,0);
    const geometry=kind==='semiconductor'&&mode==='world'?new THREE.BoxGeometry(size*2,.35+Math.min(3,Math.abs(node.value)/70),size*2):kind==='system'&&mode==='world'?systemGeometry():new THREE.SphereGeometry(size,20,14);
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
