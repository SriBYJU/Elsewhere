import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair, Focus, Footprints, Home, List, Minus, Pause, Play, Plus, RotateCcw, ScanEye, X } from 'lucide-react';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Parameters, SimulationResult, SystemBlueprint, WorldKind } from '../core/types';
import { buildData, buildEnvironment, disposeGroup, nodePosition, SCENE_COLORS } from './scene/worldGeometry';
import type { SceneData, SceneEnvironment } from './scene/worldGeometry';
import './scene/worldScene.css';

export interface WorldSceneProps {
  kind: WorldKind;
  result?: SimulationResult;
  parameters?: Parameters;
  blueprint?: SystemBlueprint;
  selectedId?: string;
  onSelect?: (id: string) => void;
  mode?: 'world' | 'model';
  reducedMotion?: boolean;
  focusId?: string;
  className?: string;
  decorative?: boolean;
  initialWalking?: boolean;
}
type MoveDirection='forward'|'back'|'left'|'right';
type Navigation = {spawn:[number,number,number];lookAt:[number,number,number];bounds:{minX:number;maxX:number;minZ:number;maxZ:number};floor:number;eyeHeight:number;radius:number;speed:number;colliders:{minX:number;maxX:number;minZ:number;maxZ:number;minY:number;maxY:number}[];land?:[number,number][]};
type SceneHandle = { reset: () => void; zoom: (factor: number) => void; focus: (id?: string) => void; rotate: () => void; walk: (enabled:boolean) => void; move: (direction:MoveDirection,held:boolean) => void; jump:()=>void; lock:()=>void; inspect:()=>void; refresh: () => void; replace: () => void };
const insidePolygon=(x:number,z:number,polygon:[number,number][])=>{
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;
  }
  return inside;
};
const mapPoint=(position:THREE.Vector3,kind:WorldKind):[number,number]=>kind==='manhattan'?[60+position.x*2.8,60+position.z*2.05]:[60+position.x*2.65,60+position.z*3.1];

const worldNames: Record<WorldKind,string> = {manhattan:'Manhattan',neural:'Neural network',semiconductor:'Semiconductor supply chain',system:'generated complex system'};

function SvgFallback({kind,result,mode,onSelect,selectedId}:WorldSceneProps) {
  const projection=(x:number,y:number,z:number):[number,number]=>[350+x*11+z*6,260+z*5-x*3-y*12];
  const city=kind==='manhattan'&&mode!=='model';
  const nodes=result?.nodes??[];
  const nodePoints=new Map(nodes.map(node=>{
    const position=nodePosition(node,kind,mode??'world');
    return [node.id,city?projection(position.x,position.y,position.z):[350+position.x*22,270-position.y*20+position.z*8] as [number,number]];
  }));
  const blocks=Array.from({length:168},(_,i)=>{
    const x=(i%7-3)*1.35,z=(Math.floor(i/7)-12)*1.45;
    if((x>-2.7&&x<1.5&&z>5&&z<14)||(Math.abs(z)>14&&Math.abs(x)>2.5))return null;
    const h=.6+((i*47)%13)/6+Math.exp(-Math.pow(z/5,2))*((i*19)%5)*.65;
    const a=projection(x,.1,z),b=projection(x+.85,.1,z),c=projection(x+.85,.1,z+.95),d=projection(x,.1,z+.95);
    const top=[a,b,c,d].map(([px,py])=>[px,py-h*12]);
    return <g key={i}><polygon points={[a,b,top[1],top[0]].map(p=>p.join(',')).join(' ')} fill="#34494a" stroke="#6e8378" strokeWidth=".35"/><polygon points={[b,c,top[2],top[1]].map(p=>p.join(',')).join(' ')} fill="#24383c" stroke="#6e8378" strokeWidth=".35"/><polygon points={top.map(p=>p.join(',')).join(' ')} fill="#60746a" stroke="#869586" strokeWidth=".35"/></g>;
  });
  return <svg className="world-scene-fallback" viewBox="0 0 700 520" role="img" aria-label={`${worldNames[kind]} schematic, shown in 2D. Use the node list to inspect the simulation.`}>
    <defs><pattern id={`scene-grid-${kind}`} width="42" height="42" patternUnits="userSpaceOnUse"><path d="M 42 0 L 0 0 0 42" fill="none" stroke="#173037" strokeWidth=".5"/></pattern></defs>
    <rect width="700" height="520" fill={SCENE_COLORS.ocean}/><rect width="700" height="520" fill={`url(#scene-grid-${kind})`}/>
    {city&&<><polygon points={[[-1,-21],[-5,-13],[-5,8],[-2,20],[1,22],[4,14],[5,-4],[2,-19]].map(([x,z])=>projection(x,0,z).join(',')).join(' ')} fill="#29413b" stroke="#6b8374"/>{blocks}<path d="M225 172 L351 254 L452 353" fill="none" stroke={SCENE_COLORS.lime} strokeWidth="1.7"/></>}
    {result?.edges.map((edge,i)=>{const a=nodePoints.get(edge.from),b=nodePoints.get(edge.to);return a&&b?<line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={edge.uncertain?SCENE_COLORS.amber:edge.weight<0?SCENE_COLORS.rose:SCENE_COLORS.cyan} strokeWidth={1+Math.min(3,Math.abs(edge.weight))*.4} opacity=".55" strokeDasharray={edge.uncertain?'5 5':undefined}/>:null;})}
    {nodes.map(node=>{const point=nodePoints.get(node.id)!;return <g key={node.id} className="world-scene-svg-node" role="button" tabIndex={0} aria-label={`Inspect ${node.label}`} aria-pressed={node.id===selectedId} onClick={()=>onSelect?.(node.id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect?.(node.id);}}}><circle cx={point[0]} cy={point[1]} r={node.id===selectedId?10:7} fill={node.id===selectedId?SCENE_COLORS.lime:SCENE_COLORS.cyan}/><circle cx={point[0]} cy={point[1]} r="21" fill="transparent"/><text x={point[0]} y={point[1]-16} textAnchor="middle" fill="#eef0e9" fontSize="12">{node.label}</text></g>;})}
  </svg>;
}

export default function WorldScene({kind,result,parameters,blueprint,selectedId,onSelect,mode='world',reducedMotion=false,focusId,className='',decorative=false,initialWalking=false}:WorldSceneProps) {
  const hostRef=useRef<HTMLDivElement>(null);
  const labelRefs=useRef(new Map<string,HTMLButtonElement>());
  const handleRef=useRef<SceneHandle|null>(null);
  const configRef=useRef({kind,result,parameters,blueprint,selectedId,onSelect,mode,reducedMotion,focusId});
  configRef.current={kind,result,parameters,blueprint,selectedId,onSelect,mode,reducedMotion,focusId};
  const [fallback,setFallback]=useState(false);
  const [flatView,setFlatView]=useState(false);
  const [paused,setPaused]=useState(false);
  const [walking,setWalking]=useState(initialWalking);
  const [capture,setCapture]=useState<'ready'|'locked'|'drag'>('ready');
  const [visitedCount,setVisitedCount]=useState(0);
  const visitedRef=useRef(new Set<string>());
  const mapPlayerRef=useRef<SVGGElement>(null);
  const coordinatesRef=useRef<HTMLSpanElement>(null);
  const headingRef=useRef<HTMLSpanElement>(null);
  const aimRef=useRef<HTMLSpanElement>(null);
  const motionRef=useRef<HTMLSpanElement>(null);
  const pausedRef=useRef(false);
  pausedRef.current=paused;
  const flatRef=useRef(false);
  flatRef.current=flatView;
  const descriptionId=useId();
  const listId=useId();

  useEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    let disposed=false;
    let renderer:THREE.WebGLRenderer;
    try {
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    } catch {
      setFallback(true);
      return;
    }
    renderer.setClearColor(SCENE_COLORS.ocean);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;
    const gl=renderer.getContext(),rendererInfo=gl.getExtension('WEBGL_debug_renderer_info');
    const softwareGraphics=rendererInfo?/swiftshader|llvmpipe|software|microsoft basic/i.test(String(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL))):false;
    renderer.shadowMap.enabled=!decorative&&!softwareGraphics;renderer.shadowMap.type=THREE.PCFShadowMap;
    const canvas=renderer.domElement;
    canvas.className='world-scene-canvas';canvas.dataset.graphics=softwareGraphics?'balanced':'high';
    if(decorative){canvas.setAttribute('aria-hidden','true');canvas.setAttribute('role','presentation');canvas.tabIndex=-1;}else{canvas.setAttribute('aria-label',`${worldNames[configRef.current.kind]} interactive 3D scene`);canvas.setAttribute('aria-describedby',descriptionId);canvas.setAttribute('role','img');canvas.tabIndex=0;}
    host.appendChild(canvas);
    const scene=new THREE.Scene();
    scene.fog=new THREE.Fog(SCENE_COLORS.ocean,70,135);
    const camera=new THREE.PerspectiveCamera(37,1,.1,220);
    const controls=new OrbitControls(camera,canvas);
    controls.enableDamping=false;
    controls.minDistance=5;controls.maxDistance=115;
    controls.minPolarAngle=.14;controls.maxPolarAngle=Math.PI*.47;
    controls.rotateSpeed=.55;controls.zoomSpeed=.8;controls.panSpeed=.65;
    controls.screenSpacePanning=true;
    controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
    const ambient=new THREE.HemisphereLight('#dbe7d4','#1a292f',2.3);scene.add(ambient);
    const sun=new THREE.DirectionalLight('#f0f0d8',3.1);sun.position.set(-15,28,16);scene.add(sun);
    sun.castShadow=renderer.shadowMap.enabled;sun.shadow.mapSize.set(1024,1024);sun.shadow.autoUpdate=false;sun.shadow.bias=-.00008;scene.add(sun.target);
    const skyDome=new Sky();skyDome.scale.setScalar(200);skyDome.material.uniforms.sunPosition.value.copy(sun.position).normalize();skyDome.material.uniforms.turbidity.value=3;skyDome.material.uniforms.rayleigh.value=1.6;skyDome.material.uniforms.cloudCoverage.value=.25;skyDome.material.uniforms.cloudScale.value=.0008;skyDome.material.toneMapped=false;
    const atmosphereScene=new THREE.Scene();atmosphereScene.add(skyDome);
    const atmosphereTarget=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType});
    const atmosphereCamera=new THREE.CubeCamera(.1,220,atmosphereTarget);let atmosphereReady=false;
    const shadowCenter=new THREE.Vector3(Infinity,Infinity,Infinity);
    const rim=new THREE.DirectionalLight('#92c9cd',1.2);rim.position.set(12,8,-17);scene.add(rim);
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:SCENE_COLORS.ocean,roughness:.85,metalness:.15}));
    ocean.rotation.x=-Math.PI/2;ocean.position.y=-.7;scene.add(ocean);
    const grid=new THREE.GridHelper(160,40,'#20393d','#15272e');grid.position.y=-.66;scene.add(grid);
    let environment:SceneEnvironment=buildEnvironment(configRef.current.kind,configRef.current.mode,configRef.current.blueprint);
    let data:SceneData=buildData(configRef.current.kind,configRef.current.mode,configRef.current.result);
    scene.add(environment.group,data.group);
    let previousKind=configRef.current.kind,previousMode=configRef.current.mode,previousBlueprint=configRef.current.blueprint;
    let width=1,height=1,frame=0,clock=0,lastTime=0,lastDraw=0,visible=true;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const projected=new THREE.Vector3();
    const pressed=new Set<string>();
    const touchMoves=new Set<MoveDirection>();
    const directionVector=new THREE.Vector3();
    const aimRay=new THREE.Raycaster();
    const screenCenter=new THREE.Vector2(0,0);
    let walkActive=false,yaw=0,pitch=0,verticalVelocity=0,grounded=true,aimedId:string|undefined,lastHud=0;
    const applyAtmosphere=()=>{
      const config=configRef.current;
      const outdoors=config.mode==='world'&&(config.kind==='manhattan'||config.kind==='system'&&!['cpu','internet','finance'].includes(config.blueprint?.archetype??'general'));
      const sky=outdoors?'#bbcbd3':'#18262d';
      if(outdoors&&!atmosphereReady){atmosphereCamera.update(renderer,atmosphereScene);atmosphereReady=true;}
      scene.environment=outdoors&&!softwareGraphics?atmosphereTarget.texture:null;scene.environmentIntensity=.3;
      sun.castShadow=outdoors&&renderer.shadowMap.enabled;shadowCenter.setScalar(Infinity);
      renderer.toneMappingExposure=outdoors?1.18:1.35;rim.intensity=outdoors?.22:1.2;
      scene.background=outdoors?atmosphereTarget.texture:new THREE.Color(sky);scene.fog=new THREE.Fog(sky,outdoors?(walkActive?18:55):65,outdoors?(walkActive?70:110):135);
      ocean.material.color.set(outdoors?'#344f59':SCENE_COLORS.ocean);grid.visible=!outdoors;
      ambient.color.set(outdoors?'#eef1e7':'#dbe7d4');ambient.groundColor.set(outdoors?'#55635c':'#314149');ambient.intensity=outdoors?1.65:2.3;
      sun.color.set(outdoors?'#fff2d5':'#f0f0d8');sun.intensity=outdoors?2.8:3.1;
    };
    applyAtmosphere();
    const navigation=():Navigation=>(environment as SceneEnvironment&{navigation?:Navigation}).navigation??{
      spawn:[0,0,10],lookAt:[0,1.6,0],bounds:{minX:-18,maxX:18,minZ:-16,maxZ:16},floor:0,eyeHeight:1.6,radius:.22,speed:4.2,colliders:[],
    };
    const clearInput=()=>{pressed.clear();touchMoves.clear();};
    const releasePointer=()=>{if(document.pointerLockElement===canvas)document.exitPointerLock();};
    const syncLook=()=>{
      camera.rotation.set(pitch,yaw,0,'YXZ');
      camera.getWorldDirection(directionVector);controls.target.copy(camera.position).add(directionVector);
    };
    const canStand=(x:number,z:number)=>{
      const nav=navigation(),radius=nav.radius,bounds=nav.bounds,feet=camera.position.y-nav.eyeHeight;
      if(x<bounds.minX+radius||x>bounds.maxX-radius||z<bounds.minZ+radius||z>bounds.maxZ-radius)return false;
      if(nav.land&&[[x-radius,z],[x+radius,z],[x,z-radius],[x,z+radius]].some(([px,pz])=>!insidePolygon(px,pz,nav.land!)))return false;
      return !nav.colliders.some(box=>feet<box.maxY-.005&&camera.position.y+.025>box.minY&&x>box.minX-radius&&x<box.maxX+radius&&z>box.minZ-radius&&z<box.maxZ+radius);
    };
    const groundHeight=()=>{
      const nav=navigation(),feet=camera.position.y-nav.eyeHeight;
      let floor=nav.floor;
      for(const box of nav.colliders){
        if(camera.position.x>box.minX-nav.radius*.5&&camera.position.x<box.maxX+nav.radius*.5&&camera.position.z>box.minZ-nav.radius*.5&&camera.position.z<box.maxZ+nav.radius*.5&&box.maxY<=feet+.008)floor=Math.max(floor,box.maxY);
      }
      return floor;
    };
    const jump=()=>{
      if(!walkActive||!grounded)return;
      verticalVelocity=navigation().eyeHeight<.5?1.2:5.2;grounded=false;refresh();
    };
    const move=(direction:MoveDirection,held:boolean)=>{if(held)touchMoves.add(direction);else touchMoves.delete(direction);refresh();};
    const updatePlayer=(elapsed:number)=>{
      if(elapsed<=0)return;
      const nav=navigation();
      const forward=Number(pressed.has('w')||pressed.has('arrowup')||touchMoves.has('forward'))-Number(pressed.has('s')||pressed.has('arrowdown')||touchMoves.has('back'));
      const sideways=Number(pressed.has('d')||pressed.has('arrowright')||touchMoves.has('right'))-Number(pressed.has('a')||pressed.has('arrowleft')||touchMoves.has('left'));
      const length=Math.hypot(forward,sideways)||1;
      const speed=nav.speed*(pressed.has('shift')?1.9:1);
      const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*sideways)/length*speed;
      const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*sideways)/length*speed;
      // Substeps and separate axes prevent tunneling through narrow city blocks and allow wall sliding.
      const steps=Math.max(1,Math.ceil(elapsed/(1/120))),dt=elapsed/steps;
      for(let step=0;step<steps;step++){
        if(canStand(camera.position.x+dx*dt,camera.position.z))camera.position.x+=dx*dt;
        if(canStand(camera.position.x,camera.position.z+dz*dt))camera.position.z+=dz*dt;
        const floor=groundHeight()+nav.eyeHeight;
        verticalVelocity-=(nav.eyeHeight<.5?4.5:17)*dt;
        camera.position.y+=verticalVelocity*dt;
        if(camera.position.y<=floor){camera.position.y=floor;verticalVelocity=0;grounded=true;}else grounded=false;
      }
      // Keyboard look keeps traversal usable without mouse capture.
      yaw+=((pressed.has('j')?1:0)-(pressed.has('l')?1:0))*elapsed*1.5;
      pitch=THREE.MathUtils.clamp(pitch+((pressed.has('i')?1:0)-(pressed.has('k')?1:0))*elapsed*1.1,-1.42,1.42);
      syncLook();
    };
    const worldMotion=()=>!configRef.current.reducedMotion&&!media.matches&&!pausedRef.current&&configRef.current.mode==='world'&&((environment as SceneEnvironment&{animated?:boolean}).animated??configRef.current.kind==='manhattan');
    const shouldAnimate=()=>walkActive&&(pressed.size>0||touchMoves.size>0||!grounded)||worldMotion();
    const inspect=()=>{
      if(!aimedId)return;
      releasePointer();clearInput();configRef.current.onSelect?.(aimedId);
    };
    const lock=()=>{
      if(!walkActive)return;
      canvas.focus({preventScroll:true});
      if(document.pointerLockElement===canvas)return;
      if(!canvas.requestPointerLock){setCapture('drag');return;}
      try{const request=canvas.requestPointerLock();if(request)request.catch(()=>{if(!disposed)setCapture('drag');});}catch{setCapture('drag');}
    };
    const visibilityRay=new THREE.Ray(),occluder=new THREE.Box3(),intersection=new THREE.Vector3();
    const canSee=(point:THREE.Vector3)=>{
      if(!walkActive)return true;
      const distance=camera.position.distanceToSquared(point),range=configRef.current.kind==='manhattan'?5:18;
      if(distance>range*range)return false;
      visibilityRay.origin.copy(camera.position);visibilityRay.direction.copy(point).sub(camera.position).normalize();
      for(const block of navigation().colliders){
        occluder.min.set(block.minX,block.minY,block.minZ);occluder.max.set(block.maxX,block.maxY,block.maxZ);
        if(visibilityRay.intersectBox(occluder,intersection)&&camera.position.distanceToSquared(intersection)<distance-.00001)return false;
      }
      return true;
    };
    const draw=()=>{
      if(disposed||!visible||document.hidden||flatRef.current)return;
      environment.animate(clock,configRef.current.parameters??{});
      data.select(configRef.current.selectedId);
      if(sun.castShadow){
        const city=configRef.current.kind==='manhattan',range=walkActive?(city?4:20):32;
        const center=walkActive?camera.position:controls.target;
        if(shadowCenter.distanceToSquared(center)>(city?.2:1)**2){
          shadowCenter.copy(center);sun.target.position.set(center.x,0,center.z);sun.position.copy(sun.target.position).add(new THREE.Vector3(-15,28,16));
          Object.assign(sun.shadow.camera,{left:-range,right:range,top:range,bottom:-range,near:1,far:80});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=city?.001:.015;sun.shadow.needsUpdate=true;
        }
      }
      renderer.render(scene,camera);
      if(walkActive){canvas.dataset.position=`${camera.position.x.toFixed(4)},${camera.position.y.toFixed(4)},${camera.position.z.toFixed(4)}`;canvas.dataset.grounded=String(grounded);canvas.dataset.heading=yaw.toFixed(4);}
      if(walkActive&&performance.now()-lastHud>75){
        lastHud=performance.now();
        aimRay.setFromCamera(screenCenter,camera);
        const hit=aimRay.intersectObjects([...data.nodes.values()],false)[0];
        aimedId=hit&&canSee(hit.object.position)?hit.object.userData.nodeId as string:undefined;
        const aimLabel=configRef.current.result?.nodes.find(node=>node.id===aimedId)?.label;
        if(aimRef.current)aimRef.current.textContent=aimLabel?`E · Inspect ${aimLabel}`:'Find a glowing node to inspect';
        if(mapPlayerRef.current){const [x,z]=mapPoint(camera.position,configRef.current.kind);mapPlayerRef.current.setAttribute('transform',`translate(${x} ${z}) rotate(${-yaw*180/Math.PI})`);}
        if(coordinatesRef.current)coordinatesRef.current.textContent=`${camera.position.x.toFixed(1)} / ${camera.position.z.toFixed(1)}`;
        if(headingRef.current)headingRef.current.textContent=`${Math.round(((-yaw*180/Math.PI)%360+360)%360).toString().padStart(3,'0')}°`;
        if(motionRef.current)motionRef.current.textContent=!grounded?'AIRBORNE':pressed.has('shift')?'SPRINTING':'ON FOOT';

      }
      for(const [id,element] of labelRefs.current){
        const position=data.labels.get(id);
        if(!position||!canSee(data.nodes.get(id)?.position??position)){element.style.display='none';continue;}
        projected.copy(position).project(camera);
        const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
        element.style.display=projected.z>1||projected.z<0||x<20||x>width-20||y<12||y>height-75?'none':'';
        element.style.transform=`translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    };
    const tick=(time:number)=>{
      frame=0;
      if(disposed||document.hidden||!visible||flatRef.current)return;
      if(lastDraw&&time-lastDraw<1000/(walkActive?30:20)){frame=requestAnimationFrame(tick);return;}
      lastDraw=time;
      const elapsed=lastTime?Math.min((time-lastTime)/1000,.05):0;
      if(lastTime&&worldMotion())clock+=elapsed;
      if(walkActive)updatePlayer(elapsed);
      lastTime=time;
      draw();
      if(shouldAnimate())frame=requestAnimationFrame(tick);else lastTime=0;
    };
    const refresh=()=>{
      if(!frame&&!disposed&&!document.hidden&&visible&&!flatRef.current){lastTime=0;frame=requestAnimationFrame(tick);}
    };
    const reset=()=>{
      if(walkActive){
        const nav=navigation();camera.position.set(...nav.spawn);camera.position.y+=nav.eyeHeight;camera.lookAt(new THREE.Vector3(...nav.lookAt));
        const rotation=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');yaw=rotation.y;pitch=rotation.x;verticalVelocity=0;grounded=true;clearInput();syncLook();refresh();return;
      }
      const city=configRef.current.kind==='manhattan'&&configRef.current.mode==='world';
      const portrait=width/height<.9?1.3:1;
      controls.target.set(0,city?.65:configRef.current.kind==='neural'?2.4:1.5,0);
      if(city){controls.target.set(0,1.1,1.5);camera.position.set(12*portrait,9*portrait,18*portrait);}
      else if(configRef.current.kind==='neural'||configRef.current.mode==='model')camera.position.set(2,12*portrait,31*portrait);
      else camera.position.set(15*portrait,11*portrait,21*portrait);
      camera.lookAt(controls.target);controls.update();controls.saveState();refresh();
    };
    const zoom=(factor:number)=>{
      if(walkActive){camera.fov=THREE.MathUtils.clamp(camera.fov*factor,48,88);camera.updateProjectionMatrix();refresh();return;}
      const offset=camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));
      camera.position.copy(controls.target).add(offset);controls.update();refresh();
    };
    const focus=(id?:string)=>{
      const object=id?data.nodes.get(id):undefined;
      if(!object){reset();return;}
      if(walkActive){camera.lookAt(object.position);const rotation=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');yaw=rotation.y;pitch=THREE.MathUtils.clamp(rotation.x,-1.42,1.42);syncLook();refresh();return;}
      const target=object.position.clone();
      const offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(configRef.current.kind==='manhattan'&&configRef.current.mode==='world'?14:10);
      controls.target.copy(target);camera.position.copy(target).add(offset);controls.update();refresh();
    };
    const rotate=()=>{
      if(walkActive){yaw-=Math.PI/8;syncLook();refresh();return;}
      const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/8);camera.position.copy(controls.target).add(offset);controls.update();refresh();
    };
    const walk=(enabled:boolean)=>{
      if(walkActive===enabled)return;
      walkActive=enabled;clearInput();controls.enabled=!enabled;camera.fov=enabled?74:45;camera.near=enabled?.005:.1;camera.updateProjectionMatrix();canvas.dataset.traversal=enabled?'walking':'overview';applyAtmosphere();
      if(!enabled){releasePointer();setCapture('ready');}else canvas.focus({preventScroll:true});
      reset();
    };
    const replace=()=>{
      const config=configRef.current;
      if(config.kind!==previousKind||config.mode!==previousMode||config.blueprint!==previousBlueprint){
        disposeGroup(environment.group);environment=buildEnvironment(config.kind,config.mode,config.blueprint);scene.add(environment.group);
        previousKind=config.kind;previousMode=config.mode;previousBlueprint=config.blueprint;clearInput();releasePointer();applyAtmosphere();reset();
      }
      disposeGroup(data.group);data=buildData(config.kind,config.mode,config.result);scene.add(data.group);
      canvas.setAttribute('aria-label',`${worldNames[config.kind]} interactive 3D ${config.mode==='model'?'causal model':'scene'}`);
      refresh();
    };
    handleRef.current={reset,zoom,focus,rotate,walk,move,jump,lock,inspect,refresh,replace};
    controls.addEventListener('change',refresh);
    const resize=()=>{
      const rect=host.getBoundingClientRect();
      const first=width===1;
      width=Math.max(1,rect.width);height=Math.max(1,rect.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,softwareGraphics?.8:width<720?1.5:2));
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
      if(first)reset();else refresh();
    };
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
    const intersectionObserver=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;refresh();},{threshold:0});intersectionObserver.observe(host);
    const visibility=()=>{if(document.hidden){clearInput();releasePointer();}refresh();};document.addEventListener('visibilitychange',visibility);media.addEventListener('change',refresh);
    const raycaster=new THREE.Raycaster();
    const pointer=new THREE.Vector2();
    let downX=0,downY=0,lastX=0,lastY=0,lookPointer:number|null=null,capturedAtDown=false;
    const pointerDown=(event:PointerEvent)=>{
      if(decorative||event.button!==0)return;
      downX=lastX=event.clientX;downY=lastY=event.clientY;capturedAtDown=document.pointerLockElement===canvas;
      if(walkActive){
        canvas.focus({preventScroll:true});
        if(event.pointerType==='mouse'&&!capturedAtDown)lock();
        if(!capturedAtDown){lookPointer=event.pointerId;canvas.setPointerCapture(event.pointerId);}
      }
    };
    const pointerMove=(event:PointerEvent)=>{
      if(!walkActive)return;
      const captured=document.pointerLockElement===canvas;
      if(!captured&&lookPointer!==event.pointerId)return;
      const dx=captured?event.movementX:event.clientX-lastX,dy=captured?event.movementY:event.clientY-lastY;
      lastX=event.clientX;lastY=event.clientY;
      yaw-=dx*.0023;pitch=THREE.MathUtils.clamp(pitch-dy*.0023,-1.42,1.42);syncLook();refresh();
    };
    const endLook=(event:PointerEvent)=>{if(lookPointer===event.pointerId){lookPointer=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}};
    const pointerUp=(event:PointerEvent)=>{
      endLook(event);
      if(walkActive&&capturedAtDown){inspect();return;}
      if(walkActive&&event.pointerType==='mouse'&&document.pointerLockElement===canvas)return;
      if(Math.hypot(event.clientX-downX,event.clientY-downY)>6)return;
      const rect=canvas.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObjects([...data.nodes.values()],false)[0];
      if(hit?.object.userData.nodeId&&canSee(hit.object.position))configRef.current.onSelect?.(hit.object.userData.nodeId as string);
    };
    const keyDown=(event:KeyboardEvent)=>{
      if(decorative||document.activeElement!==canvas&&document.pointerLockElement!==canvas)return;
      const key=event.key.toLowerCase();
      if(walkActive){
        if(['w','a','s','d','i','j','k','l','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();pressed.add(key);refresh();return;}
        if(event.code==='Space'){event.preventDefault();if(!event.repeat)jump();return;}
        if(key==='e'){event.preventDefault();if(!event.repeat)inspect();return;}
        if(key==='escape'){clearInput();releasePointer();return;}
      }
      if(event.key==='+'||event.key==='='){event.preventDefault();zoom(.82);}
      else if(event.key==='-'){event.preventDefault();zoom(1.22);}
      else if(event.key==='Home'||event.key==='0'){event.preventDefault();reset();}
      else if(event.key.toLowerCase()==='f'){event.preventDefault();focus(configRef.current.selectedId);}
      else if(event.key.startsWith('Arrow')){
        event.preventDefault();
        const offset=camera.position.clone().sub(controls.target);
        if(event.shiftKey){
          const displacement=new THREE.Vector3(event.key==='ArrowLeft'?-.7:event.key==='ArrowRight'?.7:0,event.key==='ArrowUp'?.7:event.key==='ArrowDown'?-.7:0,0).applyQuaternion(camera.quaternion);
          camera.position.add(displacement);controls.target.add(displacement);
        }else{
          const spherical=new THREE.Spherical().setFromVector3(offset);
          spherical.theta+=event.key==='ArrowLeft'?.12:event.key==='ArrowRight'?-.12:0;
          spherical.phi=THREE.MathUtils.clamp(spherical.phi+(event.key==='ArrowUp'?-.1:event.key==='ArrowDown'?.1:0),controls.minPolarAngle,controls.maxPolarAngle);
          camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
        }
        controls.update();refresh();
      }
    };
    const keyUp=(event:KeyboardEvent)=>{pressed.delete(event.key.toLowerCase());};
    const blur=()=>{clearInput();lookPointer=null;};
    const pointerLockChange=()=>{clearInput();lookPointer=null;canvas.dataset.pointerLocked=String(document.pointerLockElement===canvas);if(!disposed)setCapture(document.pointerLockElement===canvas?'locked':'ready');refresh();};
    const pointerLockError=()=>{if(!disposed)setCapture('drag');};
    const lost=(event:Event)=>{event.preventDefault();clearInput();releasePointer();setWalking(false);setFallback(true);if(frame)cancelAnimationFrame(frame);frame=0;};
    const restored=()=>{atmosphereReady=false;applyAtmosphere();setFallback(false);refresh();};
    canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',endLook);canvas.addEventListener('blur',blur);
    document.addEventListener('pointermove',pointerMove);document.addEventListener('pointerlockchange',pointerLockChange);document.addEventListener('pointerlockerror',pointerLockError);
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);
    canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
    return()=>{
      disposed=true;clearInput();releasePointer();if(frame)cancelAnimationFrame(frame);handleRef.current=null;
      resizeObserver.disconnect();intersectionObserver.disconnect();document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',refresh);
      controls.removeEventListener('change',refresh);controls.dispose();
      canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',endLook);canvas.removeEventListener('blur',blur);
      document.removeEventListener('pointermove',pointerMove);document.removeEventListener('pointerlockchange',pointerLockChange);document.removeEventListener('pointerlockerror',pointerLockError);
      window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
      disposeGroup(environment.group);disposeGroup(data.group);disposeGroup(scene);disposeGroup(atmosphereScene);atmosphereTarget.dispose();
      renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    };
  },[descriptionId,decorative]);

  useEffect(()=>{handleRef.current?.replace();},[kind,mode,result,blueprint]);
  useEffect(()=>{handleRef.current?.refresh();},[parameters,selectedId,reducedMotion,paused,flatView]);
  useEffect(()=>{if(focusId)handleRef.current?.focus(focusId);},[focusId]);
  useEffect(()=>{handleRef.current?.walk(walking&&mode==='world'&&!flatView&&!fallback);},[walking,mode,flatView,fallback]);
  useEffect(()=>{visitedRef.current.clear();setVisitedCount(0);},[kind,blueprint]);
  useEffect(()=>{if(walking&&selectedId&&!visitedRef.current.has(selectedId)){visitedRef.current.add(selectedId);setVisitedCount(visitedRef.current.size);}},[walking,selectedId]);

  const isFlat=fallback||flatView;
  const isWalking=walking&&!isFlat&&mode==='world';
  const nodeList=result?.nodes??[];
  const labels=nodeList.length>18?nodeList.filter(node=>node.id===selectedId||node.kind==='input'||node.kind==='output'||node.id.startsWith('input-')||node.id.startsWith('output-')):nodeList;
  return <div className={`world-scene ${className} ${isFlat?'world-scene--flat':''} ${isWalking?'world-scene--walking':''}`} data-world-kind={kind} data-scene-mode={mode}>
    <div ref={hostRef} className="world-scene-host" aria-hidden={decorative||isFlat||undefined}/>
    {isFlat&&<SvgFallback kind={kind} result={result} mode={mode} selectedId={selectedId} onSelect={onSelect}/>}
    {!decorative&&<p id={descriptionId} className="world-scene-sr-only">Interactive {worldNames[kind]} {mode==='model'?'causal model':'world'}. {isWalking?'Walk with W A S D or arrow keys. Shift sprints. Space jumps. Click the world for mouse look; Escape releases the mouse. Drag to look on touch screens. I J K L also look around. E inspects the node under the crosshair.':'Drag to orbit. Scroll or pinch to zoom. Shift and drag to pan.'} Home resets and F faces the selected node. {nodeList.length>0?'Use the Nodes menu to inspect any node.':''}</p>}
    {!decorative&&!isFlat&&mode==='world'&&!isWalking&&<button type="button" className="world-scene-enter" onClick={()=>setWalking(true)}><Footprints size={18} aria-hidden="true"/><span>Enter world<small>Explore on foot</small></span><span aria-hidden="true">↗</span></button>}
    {isWalking&&!decorative&&<>
      <div className="world-scene-objective"><div><span className="world-scene-live-dot"/>EXPLORATION MODE<button type="button" onClick={()=>setWalking(false)} aria-label="Leave exploration and return to overview"><X size={15}/></button></div><strong>{kind==='system'?blueprint?.subject??'Explore this system':worldNames[kind]}</strong><p>Follow a connection. Inspect what changes.</p><div className="world-scene-objective-progress"><span style={{width:`${nodeList.length?Math.min(100,visitedCount/nodeList.length*100):0}%`}}/></div><small aria-live="polite">{visitedCount} / {nodeList.length} nodes inspected</small></div>
      <div className="world-scene-compass" aria-hidden="true"><span>W</span><i/><span>N</span><i/><span>E</span><b ref={headingRef}>000°</b></div>
      <div className="world-scene-crosshair" aria-hidden="true"><i/><i/><i/><i/><b/></div>
      <div className="world-scene-interact"><span ref={aimRef}>Find a glowing node to inspect</span>{capture!=='locked'&&<button type="button" className="world-scene-capture" onClick={()=>handleRef.current?.lock()}><ScanEye size={15}/>{capture==='drag'?'Drag to look · click to retry capture':'Click to look around'}</button>}</div>
      <div className="world-scene-minimap" aria-label="Schematic minimap. Your position is marked by an arrow."><div><span>LOCAL MAP</span><span aria-hidden="true">N ↑</span></div><svg viewBox="0 0 120 120" role="img" aria-label="World nodes and your current position"><path d="M0 30H120M0 60H120M0 90H120M30 0V120M60 0V120M90 0V120" stroke="#344b4c" strokeWidth=".5"/>{kind==='manhattan'&&<path d="M57 17L50 24L44 45L46 76L53 99L61 106L68 93L76 55L73 35L63 18Z" fill="#466259" stroke="#718979" strokeWidth=".6"/>}{result?.edges.map((edge,index)=>{const from=nodeList.find(node=>node.id===edge.from),to=nodeList.find(node=>node.id===edge.to);if(!from||!to)return null;const a=mapPoint(nodePosition(from,kind,mode),kind),b=mapPoint(nodePosition(to,kind,mode),kind);return <line key={index} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#85ccdb" opacity=".22" strokeWidth=".6"/>;})}{nodeList.map(node=>{const [x,y]=mapPoint(nodePosition(node,kind,mode),kind);return <circle key={node.id} cx={x} cy={y} r={selectedId===node.id?2.6:1.6} fill={visitedRef.current.has(node.id)?'#d1ec9c':'#85ccdb'}/>;})}<g ref={mapPlayerRef} transform="translate(60 60)"><circle r="8" fill="#d1ec9c" opacity=".13"/><path d="M0 -5L3.5 4L0 2L-3.5 4Z" fill="#e5ffb5" stroke="#121e1b" strokeWidth=".7"/></g></svg><span ref={coordinatesRef} aria-hidden="true">0.0 / 0.0</span></div>
      <div className="world-scene-walk-hud"><span><Footprints size={14} aria-hidden="true"/><span ref={motionRef}>ON FOOT</span><b>GRAVITY ON</b></span><small><kbd>WASD</kbd> move <kbd>SHIFT</kbd> sprint <kbd>SPACE</kbd> jump<br/><kbd>MOUSE</kbd> look <kbd>E</kbd> inspect <kbd>ESC</kbd> release</small></div>
      <div className="world-scene-touch" role="group" aria-label="Touch exploration controls"><div className="world-scene-dpad">{([{direction:'forward',label:'Walk forward',Icon:ArrowUp},{direction:'left',label:'Walk left',Icon:ArrowLeft},{direction:'back',label:'Walk backward',Icon:ArrowDown},{direction:'right',label:'Walk right',Icon:ArrowRight}] as const).map(({direction,label,Icon})=><button type="button" key={direction} className={`walk-${direction}`} aria-label={label} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);handleRef.current?.move(direction,true);}} onPointerUp={event=>{handleRef.current?.move(direction,false);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>handleRef.current?.move(direction,false)} onLostPointerCapture={()=>handleRef.current?.move(direction,false)} onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();handleRef.current?.move(direction,true);}}} onKeyUp={()=>handleRef.current?.move(direction,false)} onBlur={()=>handleRef.current?.move(direction,false)}><Icon size={19}/></button>)}</div><div className="world-scene-touch-actions"><small>Drag the world to look</small><button type="button" onClick={()=>handleRef.current?.inspect()} aria-label="Inspect node under crosshair"><Crosshair size={19}/></button><button type="button" onClick={()=>handleRef.current?.jump()} aria-label="Jump">JUMP</button></div></div>
    </>}
    {!isFlat&&<div className="world-scene-labels" aria-label="Scene nodes">{labels.map(node=><button type="button" key={node.id} ref={element=>{if(element)labelRefs.current.set(node.id,element);else labelRefs.current.delete(node.id);}} className={`world-scene-label ${node.id===selectedId?'is-selected':''}`} onClick={()=>onSelect?.(node.id)} tabIndex={-1} aria-hidden="true"><span>{node.label}</span>{node.id===selectedId&&<small>{Number.isFinite(node.value)?Number(node.value.toFixed(3)).toLocaleString():'—'}</small>}</button>)}</div>}
    {!decorative&&<div className="world-scene-tools">
      {nodeList.length>0&&<details className="world-scene-node-menu"><summary aria-controls={listId}><List size={16} aria-hidden="true"/><span>Nodes</span><span className="world-scene-node-count">{nodeList.length}</span></summary><div id={listId} className="world-scene-node-list" role="group" aria-label="Inspect simulation nodes">{nodeList.map(node=><button type="button" key={node.id} onClick={()=>onSelect?.(node.id)} aria-pressed={node.id===selectedId}><span>{node.label}</span><small>{Number.isFinite(node.value)?Number(node.value.toFixed(3)).toLocaleString():'—'}</small></button>)}</div></details>}
      <div className="world-scene-camera" role="group" aria-label="Scene camera controls">
        {!isFlat&&mode==='world'&&<button type="button" className={walking?'is-active':''} onClick={()=>setWalking(value=>!value)} aria-pressed={walking} aria-label={walking?'Return to overview':'Enter and walk through world'} title={walking?'Return to overview':'Enter world'}><Footprints size={17} aria-hidden="true"/></button>}
        {!isFlat&&<><button type="button" onClick={()=>handleRef.current?.zoom(.82)} aria-label="Zoom in" title="Zoom in (+)"><Plus size={17} aria-hidden="true"/></button><button type="button" onClick={()=>handleRef.current?.zoom(1.22)} aria-label="Zoom out" title="Zoom out (−)"><Minus size={17} aria-hidden="true"/></button><button type="button" onClick={()=>handleRef.current?.rotate()} aria-label="Rotate scene" title="Rotate scene"><RotateCcw size={16} aria-hidden="true"/></button><button type="button" onClick={()=>handleRef.current?.reset()} aria-label="Reset camera" title="Reset camera (Home)"><Home size={16} aria-hidden="true"/></button>{selectedId&&<button type="button" onClick={()=>handleRef.current?.focus(selectedId)} aria-label="Focus selected node" title="Focus selected node (F)"><Focus size={17} aria-hidden="true"/></button>}{kind==='manhattan'&&mode==='world'&&!reducedMotion&&<button type="button" onClick={()=>setPaused(value=>!value)} aria-label={paused?'Play transit motion':'Pause transit motion'} title={paused?'Play transit motion':'Pause transit motion'}>{paused?<Play size={15} aria-hidden="true"/>:<Pause size={15} aria-hidden="true"/>}</button>}</>}
        {!fallback&&<button type="button" onClick={()=>setFlatView(value=>!value)} aria-label={flatView?'Switch to 3D view':'Switch to 2D view'} title={flatView?'Switch to 3D view':'Switch to 2D view'} className="world-scene-view-switch">{flatView?'3D':'2D'}</button>}
        {fallback&&<span className="world-scene-fallback-note">2D view</span>}
      </div>
    </div>}
  </div>;
}
