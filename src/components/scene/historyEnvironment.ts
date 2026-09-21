import * as THREE from 'three';
import { addCollider, addMasonryTexture, addPath, addTrees, batch, box, boxes, makeNavigation, seededRandom, solid } from './geometryKit';
import type { DetailedEnvironment, Instance } from './geometryKit';

function gableGeometry(){
  const shape=new THREE.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,.5);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});geometry.translate(0,0,-.5);return geometry;
}

/** A schematic classical settlement, not a reconstruction of a named archaeological site. */
export function buildHistoryEnvironment():DetailedEnvironment {
  const group=new THREE.Group();group.name='Historical settlement';
  const navigation=makeNavigation({spawn:[0,0,13.5],lookAt:[0,1.6,-9]});
  const random=seededRandom(14109);
  const ground=solid(group,new THREE.BoxGeometry(58,.4,48),'#a39c7d',[0,-.22,0]);
  ground.userData.ground=true;
  const masonry:Instance[]=[],limestone:Instance[]=[],roofs:Instance[]=[],wood:Instance[]=[],dark:Instance[]=[],columns:Instance[]=[],capitals:Instance[]=[],paving:Instance[]=[],props:Instance[]=[];
  // Irregular paving stones make the central forum and connecting streets legible at eye level.
  for(let x=-6.5;x<6.5;x+=.76)for(let z=-6;z<13;z+=.76)paving.push(box([x,.014,z],[.72,.025,.72],['#aaa58e','#b7b29a','#999982','#b0aa90'][Math.floor(random()*4)]));
  for(const x of [-12,12])addPath(group,[[x,-15],[x,15]],2.1,'#a89b7c');
  for(const z of [-5,6,12])addPath(group,[[-20,z],[20,z]],1.8,'#a89b7c');
  // Temple: navigable portico, carved columns, stone steps and a terracotta pitched roof.
  for(let step=0;step<4;step++)limestone.push(box([0,.07+step*.09,-9.5],[10.6-step*.4,.15,8.7-step*.4],'#beb69d'));
  masonry.push(box([0,2.7,-11.2],[6.5,4.7,3.8],'#d8c8ad'));addCollider(navigation,0,-11.2,6.5,3.8,5.05);
  for(let side=-1;side<=1;side+=2)for(let j=0;j<4;j++){
    const x=side*4.15,z=-6.5-j*1.75;
    columns.push(box([x,2.77,z],[.63,4.8,.63],'#c9c2a7'));
    capitals.push(box([x,.52,z],[.96,.23,.96],'#cec8ae'));capitals.push(box([x,5.12,z],[1.03,.3,1.03],'#d2cbb3'));
    addCollider(navigation,x,z,.64,.64,5.25);
  }
  for(let x=-2.5;x<=2.6;x+=1.67){columns.push(box([x,2.77,-6.5],[.62,4.8,.62],'#c9c2a7'));capitals.push(box([x,.52,-6.5],[.9,.23,.9]));capitals.push(box([x,5.12,-6.5],[1,.3,1]));addCollider(navigation,x,-6.5,.65,.65,5.25);}
  limestone.push(box([0,5.4,-9.5],[9.65,.38,7.8],'#c8c0a4'));
  roofs.push(box([0,5.59,-9.5],[10.2,2.3,8.4],'#9a6247'));
  dark.push(box([0,2.25,-9.288],[1.4,3.25,.03],'#39352c'));
  for(let i=0;i<23;i++)limestone.push(box([-4.55+i*.415,5.28,-5.56],[.18,.19,.14],'#ddd2b5'));
  // Two lived-in residential streets frame the open forum.
  for(const side of [-1,1])for(let row=0;row<5;row++){
    const x=side*(9.5+(row%2)*.6),z=-10.6+row*5.1,w=3.5+random()*.55,d=3.6,h=2.9+random()*2.1;
    masonry.push(box([x,h/2,z],[w,h,d],row%2?'#d1bb96':'#c4b294'));addCollider(navigation,x,z,w,d,h);
    roofs.push(box([x,h+.08,z],[w+.5,1.8,d+.5],row%2?'#92523b':'#a46546'));
    limestone.push(box([x,h-.15,z],[w+.18,.18,d+.18],'#adac91'));
    for(const face of [-1,1])for(let column=0;column<3;column++)for(let floor=0;floor<Math.floor(h/1.5);floor++){
      const wx=x-w*.3+column*w*.3,wy=.95+floor*1.5;
      dark.push(box([wx,wy,z+face*(d/2+.005)],[.43,.7,.028],'#3c3b32'));
      wood.push(box([wx-.27,wy,z+face*(d/2+.025)],[.11,.74,.04],'#5c5f46'));wood.push(box([wx+.27,wy,z+face*(d/2+.025)],[.11,.74,.04],'#5c5f46'));
      limestone.push(box([wx,wy-.39,z+face*(d/2+.04)],[.67,.11,.13],'#bdb497'));
    }
    dark.push(box([x,.9,z+d/2+.02],[.83,1.8,.035],'#433b2c'));
    wood.push(box([x,2,z+d/2+.65],[2.7,.1,1.3],row%2?'#967859':'#81805d',[.10,0,0]));
    for(const offset of [-1.16,1.16])wood.push(box([x+offset,.94,z+d/2+1.15],[.08,1.88,.08],'#756447'));
    props.push(box([x+1,.36,z+d/2+.6],[.5,.7,.5],'#96765a'));props.push(box([x-.8,.22,z+d/2+.45],[.8,.44,.6],'#8e7651'));
  }
  // Repeated arcades and aqueduct piers form an architectural horizon.
  for(let z=-14;z<13;z+=3.6){
    for(let dx=0;dx<2;dx++)masonry.push(box([17+dx*.95,2.35,z],[.74,4.7,.8],'#c5b99b'));
    limestone.push(box([17.48,4.95,z+1.4],[1.9,.55,3.9],'#c8bfa1'));
    for(let segment=0;segment<11;segment++){
      const angle=segment/10*Math.PI;
      limestone.push(box([17.48,3.35+Math.sin(angle)*1.32,z+1.8+Math.cos(angle)*1.4],[1.3,.42,.47],'#c8bea0',[angle-Math.PI/2,0,0]));
    }
    addCollider(navigation,17.5,z,1.9,.8,5.2);
  }
  // Low walls and watchtowers enclose the town, with a genuine opening at the entrance.
  for(const side of [-1,1]){
    masonry.push(box([side*20,1.6,0],[1,3.2,33],'#c0b098'));addCollider(navigation,side*20,0,1,33,3.2);
    for(let z=-15;z<16;z+=1.6)limestone.push(box([side*20,3.48,z],[1.15,.62,.85],'#b9ad92'));
    for(const z of [-15,15]){masonry.push(box([side*18.9,2.8,z],[2.5,5.6,2.5],'#beb196'));addCollider(navigation,side*18.9,z,2.5,2.5,5.6);}
  }
  masonry.push(box([0,1.35,-16],[38,2.7,1],'#bfb195'));addCollider(navigation,0,-16,38,1,2.7);
  // Fountain, market stalls, pottery and cypress clusters establish a human scale.
  solid(group,new THREE.CylinderGeometry(1.15,1.35,.42,24),'#b5b399',[0,.2,3]);
  solid(group,new THREE.CylinderGeometry(.96,.96,.025,24),'#668a8c',[0,.43,3],{roughness:.22,metalness:.2});
  solid(group,new THREE.CylinderGeometry(.16,.27,1.8,14),'#c6c2a6',[0,1.3,3]);addCollider(navigation,0,3,2.6,2.6,2.2);
  for(let i=0;i<3;i++){
    const x=-4.6+i*4.6,z=9.7;
    if(i===1)continue;
    wood.push(box([x,.78,z],[2.5,.15,1.25],'#8a6b49'));
    for(const side of [-1,1])wood.push(box([x+side*1.1,1.3,z],[.1,2.6,.1],'#8b714f'));
    wood.push(box([x,2.6,z],[2.85,.065,1.55],i%2?'#948156':'#a3946b',[.1,0,0]));
    addCollider(navigation,x,z,2.5,1.25,.85);
  }
  boxes(group,paving,'#ada88f');addMasonryTexture(group,boxes(group,masonry,'#cebea1'),.32);boxes(group,limestone,'#c9bea2');batch(group,gableGeometry(),roofs,'#985b40');batch(group,new THREE.CylinderGeometry(.5,.57,1,16),columns,'#c8c2a7');boxes(group,capitals,'#d0c5aa');boxes(group,wood,'#8b7756');boxes(group,dark,'#3c3b32');batch(group,new THREE.CylinderGeometry(.35,.5,1,12),props,'#977452');
  const trees=Array.from({length:30},(_,i)=>({x:(i%2?-1:1)*(14+random()*1.2),z:-13+random()*26,height:3.8+random()*2.4}));
  addTrees(group,trees,true);
  group.userData.navigation=navigation;
  return{group,navigation,animated:false,animate:()=>undefined};
}
