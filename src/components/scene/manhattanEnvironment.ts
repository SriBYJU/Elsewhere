import * as THREE from 'three';
import type { Parameters } from '../../core/types';
import { addCollider, addMasonryTexture, addPath, addSurfaceTexture, addTrees, batch, box, boxes, makeNavigation, polyline, seededRandom, solid } from './geometryKit';
import type { DetailedEnvironment, Instance } from './geometryKit';

const ISLAND:[number,number][]=[[-1.3,-21],[-3.5,-19],[-5.05,-13],[-5.75,-6],[-5.5,3],[-4.55,11],[-2.65,19],[.4,22],[2.65,20],[4.15,13],[5.35,5],[5.85,-3],[4.55,-12],[2.5,-18],[.2,-21]];
const widthAt=(z:number)=>z< -17?2.1:z< -12?3.65:z>17?2.4:z>11?3.85:4.9;

function land(group:THREE.Group,points:[number,number][],color:string,elevation:number,depth:number) {
  const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
  return solid(group,geometry,color,[0,elevation-depth,0]);
}

/** Approximately 35 instanced batches for the entire island, including window panes. */
export function buildManhattanEnvironment():DetailedEnvironment {
  const group=new THREE.Group();group.name='Manhattan street environment';
  const random=seededRandom(40712);
  const navigation=makeNavigation({spawn:[2.175,.16,4.275],lookAt:[2.175,.36,-8],bounds:{minX:-5.6,maxX:5.6,minZ:-20.6,maxZ:21.4},floor:.16,eyeHeight:.15,radius:.025,speed:.65,land:ISLAND});
  addSurfaceTexture(group,land(group,ISLAND,'#c0c6c2',.15,.64),'asphalt',1.8);
  polyline(group,[...ISLAND,ISLAND[0]].map(([x,z])=>new THREE.Vector3(x,.17,z)),'#82948b',.7);
  land(group,[[-17,-31],[-12,-28],[-11,-18],[-12,-9],[-12,3],[-11,14],[-13,27],[-25,31],[-29,-30]],'#1e292a',-.12,.3);
  land(group,[[12,-29],[10,-18],[11,-10],[12,1],[11,13],[8,25],[28,31],[32,-28]],'#243030',-.1,.3);
  const buildingBodies:Instance[]=[],masonryBodies:Instance[]=[],sidewalks:Instance[]=[],windows:Instance[]=[],warmWindows:Instance[]=[],trim:Instance[]=[],roofEquipment:Instance[]=[],awnings:Instance[]=[],doors:Instance[]=[],streetFurniture:Instance[]=[],markings:Instance[]=[],poles:Instance[]=[],lights:Instance[]=[],trafficSignals:Instance[]=[],treePositions:{x:number;z:number;height:number;y:number}[]=[];
  const facadeTones=['#666c68','#657473','#7c7e72','#52686a','#806f61','#667271','#78817c'];
  const makeBuilding=(x:number,z:number,w:number,d:number,h:number,tone:number,y=.19,base=true)=>{
    (tone===4&&h<2?masonryBodies:buildingBodies).push(box([x,y+h/2,z],[w,h,d],tone===4&&h<2?'#bdb3a2':facadeTones[tone%facadeTones.length]));
    if(base)addCollider(navigation,x,z,w,d,h,y);
    const floors=Math.max(1,Math.floor(h/.18)),colsX=Math.max(1,Math.floor(w/.115)),colsZ=Math.max(1,Math.floor(d/.14));
    for(let floor=0;floor<floors;floor++){
      const wy=y+.10+floor*.18;if(wy>y+h-.04)continue;
      for(let side=-1;side<=1;side+=2){
        for(let column=0;column<colsX;column++){
          const wx=x-w/2+(column+.5)*w/colsX;
          (random()<.12?warmWindows:windows).push(box([wx,wy,z+side*(d/2+.0015)],[Math.min(.067,w/colsX*.58),.083,.003],random()<.2?'#637d80':undefined));
        }
        for(let column=0;column<colsZ;column++){
          const wz=z-d/2+(column+.5)*d/colsZ;
          (random()<.09?warmWindows:windows).push(box([x+side*(w/2+.0015),wy,wz],[.003,.083,Math.min(.072,d/colsZ*.58)]));
        }
      }
      if(floor%4===3)trim.push(box([x,wy+.08,z],[w+.014,.012,d+.014],'#7b8581'));
    }
    trim.push(box([x,y+h+.012,z],[w+.025,.025,d+.025],'#84918a'));
    if(base){
      doors.push(box([x,y+.065,z+d/2+.003],[Math.min(.12,w*.4),.13,.006],'#13262a'));
      if(tone%3===0)awnings.push(box([x,y+.155,z+d/2+.04],[w*.86,.024,.11],tone%2?'#486a62':'#8b775c',[.08,0,0]));
      if(h>.8){roofEquipment.push(box([x-w*.2,y+h+.075,z],[w*.28,.12,d*.28],'#747e78'));roofEquipment.push(box([x+w*.2,y+h+.04,z-d*.2],[w*.24,.06,d*.32],'#374e51'));}
    }
  };
  for(let row=0;row<28;row++){
    const z=-18+row*1.35;
    for(let col=0;col<7;col++){
      const x=-3.9+col*1.35;
      if(Math.abs(x)+.56>widthAt(z)||(x> -2.65&&x<1.55&&z>5.3&&z<14.2))continue;
      sidewalks.push(box([x,.166,z],[.9,.036,.9],'#777e74'));
      const density=Math.exp(-Math.pow((z-1.2)/5,2))*4.6+Math.exp(-Math.pow((z+14.2)/2.4,2))*3.5;
      for(let subdivision=0;subdivision<3;subdivision++){
        const w=subdivision===0?.47:.37+random()*.08,d=subdivision===0?.93:.39;
        const bx=x+(subdivision===0?-.27:.27),bz=z+(subdivision===0?0:subdivision===1?-.26:.26);
        const h=.38+random()*.63+Math.pow(random(),1.5)*density,tone=Math.floor(random()*facadeTones.length);
        const streetX=x+(bx-x)*.68,streetZ=z+(bz-z)*.68;
        makeBuilding(streetX,streetZ,w*.68,d*.68,h,tone);
        if(h>2.15){makeBuilding(streetX,streetZ,w*.4556,d*.4692,h*.22,tone,.19+h,false);if(h>3.6)roofEquipment.push(box([bx,h*1.22+.58,bz],[.032,.75,.032],'#acb6a9'));}
      }
      // Street-level details use the same sidewalk coordinates as the collision map.
      poles.push(box([x+.40,.38,z+.40],[.016,.42,.016],'#424e4b'));
      poles.push(box([x+.365,.595,z+.40],[.085,.014,.012],'#424e4b'));
      lights.push(box([x+.33,.586,z+.40],[.035,.016,.028],'#e8dab1'));
      if(row%3===0){
        treePositions.push({x:x-.40,z:z+.38,height:.42+random()*.18,y:.19});
        streetFurniture.push(box([x-.4,.235,z-.36],[.055,.09,.055],'#764f39'));
        streetFurniture.push(box([x+.4,.245,z-.29],[.055,.12,.08],'#294c49'));
        streetFurniture.push(box([x,.245,z+.4],[.19,.035,.055],'#7b6650'));
        streetFurniture.push(box([x,.28,z+.425],[.19,.055,.018],'#7b6650'));
      }
      if(row%2===0&&col%2===0){
        poles.push(box([x+.41,.36,z-.41],[.018,.38,.018],'#48564d'));
        trafficSignals.push(box([x+.41,.53,z-.42],[.04,.085,.036],'#263732'));
        lights.push(box([x+.41,.55,z-.442],[.016,.016,.004],'#d3e59d'));
      }
    }
    // Crosswalks are six discrete bands spanning the carriageway between blocks.
    if(row%2===0){for(let col=0;col<6;col++){
      const x=-3.225+col*1.35;
      if(Math.abs(x)+.3>widthAt(z)||(x> -2.6&&x<1.55&&z>5.3&&z<14.2))continue;
      for(let stripe=0;stripe<5;stripe++)markings.push(box([x,.155,z+.49+(stripe-2)*.035],[.42,.007,.025],'#acb0a3'));
    }}
  }
  for(let x=-3.225;x<=3.53;x+=1.35)for(let z=-16.6;z<17;z+=.42){
    if(Math.abs(x)>.8*widthAt(z)||(x> -2.6&&x<1.55&&z>5.3&&z<14.3))continue;
    markings.push(box([x,.155,z],[.012,.006,.16],'#b0aa7a'));
  }
  boxes(group,sidewalks,'#777e74');boxes(group,buildingBodies,'#617371');addMasonryTexture(group,boxes(group,masonryBodies,'#bdb3a2'));boxes(group,windows,'#203a42',{metalness:.5,roughness:.24});boxes(group,warmWindows,'#b0a174',{emissive:.14,roughness:.5});boxes(group,trim,'#829089');boxes(group,roofEquipment,'#667570');boxes(group,awnings,'#597062');boxes(group,doors,'#1a3035',{metalness:.2,roughness:.4});boxes(group,streetFurniture,'#556352');boxes(group,markings,'#aeb1a0');boxes(group,poles,'#475950',{metalness:.35});boxes(group,trafficSignals,'#263732');boxes(group,lights,'#d7dea9',{emissive:.75});
  // Central Park remains an open, navigable landscape, with a reservoir and paths.
  addSurfaceTexture(group,boxes(group,[box([-.55,.16,9.65],[3.84,.035,8.7],'#b4c19a')],'#b4c19a'),'forest',1.2);
  for(let i=0;i<180;i++){
    const x=-2.29+random()*3.25,z=5.58+random()*8.05;
    if(Math.pow((x+.41)/.95,2)+Math.pow((z-10.5)/1.45,2)<1.1)continue;
    if(Math.abs(x+.41)<.18||Math.abs(z-8.1)<.15)continue;
    treePositions.push({x,z,height:.28+random()*.54,y:.18});
  }
  addTrees(group,treePositions);
  const reservoir=solid(group,new THREE.CylinderGeometry(.86,.86,.012,56),'#244953',[-.55,.19,10.5],{metalness:.3,roughness:.18});reservoir.scale.z=1.48;
  addCollider(navigation,-.55,10.5,1.72,2.5,.02,.14);
  addPath(group,[[-.55,5.4],[-.55,8.1],[.75,9.5],[.75,12.6],[-.55,14]],.12,'#9c9579',.193);
  addPath(group,[[-2.43,8.1],[1.3,8.1]],.12,'#9c9579',.196);
  const rim=new THREE.EllipseCurve(-.55,10.5,1.02,1.48,0,Math.PI*2,false,0);polyline(group,rim.getPoints(72).map(p=>new THREE.Vector3(p.x,.21,p.y)),'#979e84',.75);
  // Piers, bridge decks, suspension towers and river craft add recognizable scale.
  const waterside:Instance[]=[],bridgeParts:Instance[]=[];
  for(let i=0;i<11;i++){waterside.push(box([-5.58,.02,-8+i*1.5],[1.1,.14,.36],'#596962'));waterside.push(box([-5.75,.11,-8+i*1.5],[.68,.05,.28],'#879184'));}
  [[-13,-8,-4.8,-8],[4.9,-7,12,-10],[5.2,-3,12,-4],[4.9,3,12,4],[2.9,16,10,20]].forEach(([x,z,tx,tz],index)=>{
    const length=Math.hypot(tx-x,tz-z),angle=Math.atan2(tx-x,tz-z);
    bridgeParts.push(box([(x+tx)/2,.28,(z+tz)/2],[.34,.10,length],'#777d6d',[0,angle,0]));
    for(const t of [.25,.75]){
      const bx=x+(tx-x)*t,bz=z+(tz-z)*t;
      for(const side of [-1,1])bridgeParts.push(box([bx+Math.cos(angle)*side*.17,.65,bz-Math.sin(angle)*side*.17],[.045,1.35,.045],'#868c77'));
      bridgeParts.push(box([bx,1.26,bz],[.42,.055,.055],'#979b84',[0,angle,0]));
    }
    if(index<3)for(const side of [-1,1]){
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x+side*.15,.4,z),new THREE.Vector3(x+(tx-x)*.25+side*.15,1.3,z+(tz-z)*.25),new THREE.Vector3((x+tx)/2+side*.15,.64,(z+tz)/2),new THREE.Vector3(x+(tx-x)*.75+side*.15,1.3,z+(tz-z)*.75),new THREE.Vector3(tx+side*.15,.4,tz)]);
      polyline(group,curve.getPoints(40),'#9ba58e',.65);
    }
  });
  boxes(group,waterside,'#5e6d64');boxes(group,bridgeParts,'#7b8377');
  const distant:Instance[]=[];
  for(let i=0;i<130;i++){
    const side=i%2?-1:1,x=side*(12.5+random()*8),z=-26+random()*51,h=.2+Math.pow(random(),2)*1.5;
    distant.push(box([x,h/2-.1,z],[.4+random()*.6,h,.4+random()*.7],i%3?'#354743':'#41534e'));
  }
  boxes(group,distant,'#354743');
  const routes=[{x:-3.225,min:-11.8,max:11.1},{x:2.175,min:-16.5,max:16.6},{x:.825,min:-16.5,max:4.8}];
  routes.forEach(route=>polyline(group,[new THREE.Vector3(route.x+.047,.162,route.min),new THREE.Vector3(route.x+.047,.162,route.max)],'#abc980',.43));
  const carCount=96,busCount=14;
  const carBodies=batch(group,new THREE.BoxGeometry(1,1,1),Array.from({length:carCount},(_,i)=>box([0,0,0],[.055,.034,.12],['#d8ba69','#899d9c','#c7cbb9','#384b55'][i%4])),'#8eaaa1')!;
  const carRoofs=batch(group,new THREE.BoxGeometry(1,1,1),Array.from({length:carCount},()=>box([0,0,0],[.044,.027,.064],'#233e45')),'#233e45')!;
  const buses=batch(group,new THREE.BoxGeometry(1,1,1),Array.from({length:busCount},()=>box([0,0,0],[.07,.068,.25],'#a7b995')),'#a7b995')!;
  const busWindows=batch(group,new THREE.BoxGeometry(1,1,1),Array.from({length:busCount},()=>box([0,0,0],[.073,.025,.19],'#264852')),'#264852')!;
  const pedestrianCount=70;
  // Each person has articulated limbs, clothes, skin and shoes; shared geometry keeps
  // the entire crowd to six draw calls rather than creating seventy scene hierarchies.
  const coats=['#40566c','#b3aa94','#5b6b52','#8c5e46','#383e48','#99938b','#536c68'];
  const skin=['#ddb795','#bb8c68','#8e6247','#694736','#cc9f7d'];
  const trousers=['#354149','#3c4141','#545750','#495367'];
  const clothing=batch(group,new THREE.CylinderGeometry(.5,.43,1,8),Array.from({length:pedestrianCount*5},(_,i)=>box([0,0,0],[1,1,1],coats[Math.floor(i/5)%coats.length])),'#66746e')!;
  const legs=batch(group,new THREE.CylinderGeometry(.46,.5,1,7),Array.from({length:pedestrianCount*5},(_,i)=>box([0,0,0],[1,1,1],trousers[Math.floor(i/5)%trousers.length])),'#40484c')!;
  const faces=batch(group,new THREE.SphereGeometry(1,9,7),Array.from({length:pedestrianCount*3},(_,i)=>box([0,0,0],[1,1,1],skin[Math.floor(i/3)%skin.length])),'#bd9371')!;
  const hair=batch(group,new THREE.SphereGeometry(1,9,6,0,Math.PI*2,0,Math.PI*.62),Array.from({length:pedestrianCount},(_,i)=>box([0,0,0],[1,1,1],['#332d27','#625448','#a99471','#494440','#29282a'][i%5])),'#51483c')!;
  const shoes=batch(group,new THREE.BoxGeometry(1,1,1),Array.from({length:pedestrianCount*2},(_,i)=>box([0,0,0],[1,1,1],Math.floor(i/2)%4?'#303638':'#a3a49c')),'#303638')!;
  const contactShadows=batch(group,new THREE.CylinderGeometry(1,1,1,16),Array.from({length:pedestrianCount},()=>box([0,0,0],[1,1,1],'#48534a')),'#48534a')!;
  const pedestrianMeshes=[clothing,legs,faces,hair,shoes,contactShadows];
  const limbDirection=new THREE.Vector3(),upAxis=new THREE.Vector3(0,1,0);
  const dummy=new THREE.Object3D();
  const transform=(mesh:THREE.InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,angle=0)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,angle,0);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);};
  const limb=(mesh:THREE.InstancedMesh,index:number,ax:number,ay:number,az:number,bx:number,by:number,bz:number,width:number,depth=width)=>{
    limbDirection.set(bx-ax,by-ay,bz-az);
    const length=limbDirection.length();
    dummy.position.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);dummy.scale.set(width,length,depth);
    dummy.quaternion.setFromUnitVectors(upAxis,limbDirection.multiplyScalar(1/Math.max(length,.00001)));dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  };
  const animate=(time:number,parameters:Parameters)=>{
    const reduction=THREE.MathUtils.clamp(parameters.carReduction??20,0,100)/100;
    const transit=1+Math.max(0,parameters.transitInvestment??30)/100;
    carBodies.count=carRoofs.count=Math.round(carCount*(1-reduction*.9));
    for(let i=0;i<carBodies.count;i++){
      const route=routes[i%3],direction=i%2?1:-1,span=route.max-route.min;
      const progress=(i*.173+time*.018*(1+reduction*.5)*direction+100)%1;
      const x=route.x+direction*.11,z=route.min+progress*span;
      transform(carBodies,i,x,.192,z,.095,.055,.22);transform(carRoofs,i,x,.232,z-.016*direction,.076,.038,.11);
    }
    buses.count=busWindows.count=Math.min(busCount,Math.round(6+transit*3));
    for(let i=0;i<buses.count;i++){
      const route=routes[i%3],direction=i%2?1:-1,z=route.min+((i*.251+time*.014*transit*direction+100)%1)*(route.max-route.min),x=route.x+direction*.11;
      transform(buses,i,x,.215,z,.11,.11,.38);transform(busWindows,i,x,.246,z,.113,.038,.3);
    }
    for(let i=0;i<pedestrianCount;i++){
      const route=routes[i%3],direction=i%2?1:-1,z=route.min+((i*.371+time*.005*direction+100)%1)*(route.max-route.min);
      const x=route.x+direction*.265,height=.9+(i*17%9)*.018,width=.94+(i%4)*.04;
      // The stride frequency follows route speed, so feet do not churn at one fixed rate.
      const phase=time*(route.max-route.min)*.005/.056*Math.PI*2+i*2.399;
      const gait=Math.sin(phase),bob=Math.cos(phase*2)*.0014*height;
      const floor=.184,hips=floor+.081*height+bob,shoulder=hips+.055*height;
      const facing=direction>0?0:Math.PI;
      transform(clothing,i*5,x,hips+.027*height,z,.04*width,.055*height,.024*width,facing);
      transform(legs,i*5,x,hips-.005*height,z,.034*width,.021*height,.026*width,facing);
      transform(faces,i*3,x,shoulder+.0195*height,z+direction*.002,.0125*width,.017*height,.013*width,facing);
      transform(hair,i,x,shoulder+.021*height,z,.0133*width,.0174*height,.0138*width,facing);
      transform(contactShadows,i,x,floor+.001,z,.035*width,.002,.027*height);
      for(let side=0;side<2;side++){
        const sign=side?1:-1,swing=gait*sign;
        const hipX=x+sign*.009*width,ankleY=floor+.007*height+Math.max(0,swing)*.008*height;
        const kneeY=hips-.037*height,kneeZ=z+direction*(swing*.008+.004)*height,ankleZ=z+direction*swing*.023*height;
        limb(legs,i*5+1+side*2,hipX,hips,z,hipX,kneeY,kneeZ,.013*width,.014*width);
        limb(legs,i*5+2+side*2,hipX,kneeY,kneeZ,hipX,ankleY,ankleZ,.0105*width,.012*width);
        transform(shoes,i*2+side,hipX,ankleY-.003*height,ankleZ+direction*.004,.013*width,.008*height,.024*height,facing);
        const armX=x+sign*.024*width,elbowY=shoulder-.026*height,elbowZ=z-direction*swing*.01*height;
        const handY=shoulder-.05*height,handZ=z-direction*swing*.019*height;
        limb(clothing,i*5+1+side*2,x+sign*.021*width,shoulder-.004*height,z,armX,elbowY,elbowZ,.012*width);
        limb(clothing,i*5+2+side*2,armX,elbowY,elbowZ,armX,handY,handZ,.009*width);
        transform(faces,i*3+1+side,armX,handY,handZ,.005*width,.007*height,.005*width,facing);
      }
    }
    for(const mesh of [carBodies,carRoofs,buses,busWindows,...pedestrianMeshes])mesh.instanceMatrix.needsUpdate=true;
  };
  animate(0,{});
  // The animation moves instances away from their construction origin. A stable route
  // envelope prevents first-person frustum culling from making the crowd disappear.
  for(const mesh of [carBodies,carRoofs,buses,busWindows,...pedestrianMeshes])mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.3,0),19);
  group.userData.navigation=navigation;
  return{group,navigation,animated:true,animate};
}
