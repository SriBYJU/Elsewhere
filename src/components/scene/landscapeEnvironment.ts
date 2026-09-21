import * as THREE from 'three';
import type { SystemBlueprint } from '../../core/types';
import { inferWorldSetting } from '../../core/universal';
import { addCollider, addPath, addSurfaceTexture, addTrees, batch, box, boxes, makeNavigation, seededRandom, solid } from './geometryKit';
import type { DetailedEnvironment, Instance } from './geometryKit';

export function buildLandscapeEnvironment(blueprint?:SystemBlueprint):DetailedEnvironment {
  const setting=inferWorldSetting(blueprint?.subject??'forest');
  const group=new THREE.Group();group.name='Illustrative landscape';
  const nav=makeNavigation({spawn:[0,0,13],lookAt:[-1,1.6,-7],bounds:{minX:-24,maxX:24,minZ:-24,maxZ:24}});
  const rng=seededRandom(27019);
  const dry=setting.terrain==='desert',polar=setting.terrain==='polar';
  const ground=solid(group,new THREE.BoxGeometry(100,.5,100),dry?'#c8b084':polar?'#ccd7d3':'#b4ac88',[0,-.27,0]);
  if(!dry&&!polar)addSurfaceTexture(group,ground,'forest',.18);
  const hills:Instance[]=[],stones:Instance[]=[],trunks:Instance[]=[],reeds:Instance[]=[];
  for(let i=0;i<30;i++){const a=i/30*Math.PI*2,r=36+rng()*16;hills.push(box([Math.cos(a)*r,-2,Math.sin(a)*r],[12+rng()*12,5+rng()*9,12+rng()*12],dry?'#b19c79':polar?'#b5c5c6':'#607553'));}
  batch(group,new THREE.SphereGeometry(1,16,10),hills,'#627453');
  const trees=[];
  for(let i=0;i<220;i++){
    const x=-38+rng()*76,z=-38+rng()*76;
    if(Math.abs(x)<7&&z>-15&&z<18||x>12&&x<19)continue;
    trees.push({x,z,height:4+rng()*7});
    if(Math.abs(x)<24&&Math.abs(z)<24)addCollider(nav,x,z,.5,.5,4);
  }
  if(!dry&&!polar)addTrees(group,trees);
  for(let i=0;i<115;i++){const x=-28+rng()*56,z=-28+rng()*56;if(Math.abs(x)<4&&z>-15&&z<18)continue;stones.push(box([x,.12,z],[.3+rng()*.6,.2+rng()*.45,.4+rng()*.6],['#8d9281','#777c6d','#aaa78c'][i%3],[rng(),rng(),rng()]));}
  batch(group,new THREE.IcosahedronGeometry(1,1),stones,'#899080');
  const river=solid(group,new THREE.BoxGeometry(5,.025,85),polar?'#9cb7bf':'#416b72',[16,-.01,0],{roughness:.2,metalness:.32});river.rotation.y=.08;
  addCollider(nav,16,0,4.8,50,.08,-.02);
  for(let i=0;i<80;i++){const z=-26+rng()*52,x=12.5+rng()*.8;reeds.push(box([x,.45,z],[.035,.8+rng()*.8,.035],'#7e8855',[0,rng(),rng()*.2]));}
  boxes(group,reeds,'#7c8756');
  addPath(group,[[0,22],[0,10],[-2,3],[1,-7],[-3,-19]],2.1,dry?'#cdb994':'#a49776',.01);
  addPath(group,[[-13,4],[-2,3],[11,4]],1.3,'#a99c7b',.014);
  if(blueprint?.archetype==='history'&&!setting.deepTime){
    // Generic shelters illustrate gathering places; forms are not archaeological claims.
    for(const [x,z] of [[-8,-8],[7,-10],[-9,7],[8,8]]){
      const hut=solid(group,new THREE.SphereGeometry(1,20,14,0,Math.PI*2,0,Math.PI/2),'#9a8665',[x,.03,z]);hut.scale.set(2.5,2.6,3.1);
      const opening=solid(group,new THREE.PlaneGeometry(1.05,1.65),'#302e26',[x,.83,z+3.105]);opening.material.side=THREE.DoubleSide;
      for(let rib=0;rib<9;rib++){trunks.push(box([x-2.2+rib*.55,.55,z+2.3],[.065,1.1,.08],'#796747'));}
      addCollider(nav,x,z,4.9,6,2.6);
    }
    boxes(group,trunks,'#806c4a');
    const logs=[];
    for(let i=0;i<8;i++){const a=i*Math.PI/4;logs.push(box([Math.cos(a)*1.7,.18,Math.sin(a)*1.7-1],[.75,.22,.28],'#7a6347',[0,a,0]));}
    boxes(group,logs,'#7a6347');
    solid(group,new THREE.CylinderGeometry(.52,.7,.08,16),'#514b3d',[0,.04,-1]);
    solid(group,new THREE.ConeGeometry(.25,.6,9),'#dbad62',[0,.31,-1],{emissive:.3});
  }
  group.userData.navigation=nav;
  return {group,navigation:nav,animated:false,animate:()=>undefined};
}
