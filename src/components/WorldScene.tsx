import { useEffect, useId, useRef, useState } from 'react';
import { Focus, Home, List, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Parameters, SimulationResult, WorldKind } from '../core/types';
import { buildData, buildEnvironment, disposeGroup, nodePosition, SCENE_COLORS } from './scene/worldGeometry';
import type { SceneData, SceneEnvironment } from './scene/worldGeometry';
import './scene/worldScene.css';

export interface WorldSceneProps {
  kind: WorldKind;
  result?: SimulationResult;
  parameters?: Parameters;
  selectedId?: string;
  onSelect?: (id: string) => void;
  mode?: 'world' | 'model';
  reducedMotion?: boolean;
  focusId?: string;
  className?: string;
}
type SceneHandle = { reset: () => void; zoom: (factor: number) => void; focus: (id?: string) => void; rotate: () => void; refresh: () => void; replace: () => void };

const worldNames: Record<WorldKind,string> = {manhattan:'Manhattan',neural:'Neural network',semiconductor:'Semiconductor supply chain'};

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

export default function WorldScene({kind,result,parameters,selectedId,onSelect,mode='world',reducedMotion=false,focusId,className=''}:WorldSceneProps) {
  const hostRef=useRef<HTMLDivElement>(null);
  const labelRefs=useRef(new Map<string,HTMLButtonElement>());
  const handleRef=useRef<SceneHandle|null>(null);
  const configRef=useRef({kind,result,parameters,selectedId,onSelect,mode,reducedMotion,focusId});
  configRef.current={kind,result,parameters,selectedId,onSelect,mode,reducedMotion,focusId};
  const [fallback,setFallback]=useState(false);
  const [flatView,setFlatView]=useState(false);
  const [paused,setPaused]=useState(false);
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
    renderer.toneMappingExposure=1.35;
    const canvas=renderer.domElement;
    canvas.className='world-scene-canvas';
    canvas.setAttribute('aria-label',`${worldNames[configRef.current.kind]} interactive 3D scene`);
    canvas.setAttribute('aria-describedby',descriptionId);
    canvas.setAttribute('role','img');
    canvas.tabIndex=0;
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
    scene.add(new THREE.HemisphereLight('#dbe7d4','#1a292f',2.3));
    const sun=new THREE.DirectionalLight('#f0f0d8',3.1);sun.position.set(-15,28,16);scene.add(sun);
    const rim=new THREE.DirectionalLight('#92c9cd',1.2);rim.position.set(12,8,-17);scene.add(rim);
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:SCENE_COLORS.ocean,roughness:.85,metalness:.15}));
    ocean.rotation.x=-Math.PI/2;ocean.position.y=-.7;scene.add(ocean);
    const grid=new THREE.GridHelper(160,40,'#20393d','#15272e');grid.position.y=-.66;scene.add(grid);
    let environment:SceneEnvironment=buildEnvironment(configRef.current.kind,configRef.current.mode);
    let data:SceneData=buildData(configRef.current.kind,configRef.current.mode,configRef.current.result);
    scene.add(environment.group,data.group);
    let previousKind=configRef.current.kind,previousMode=configRef.current.mode;
    let width=1,height=1,frame=0,clock=0,lastTime=0,visible=true;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const projected=new THREE.Vector3();
    const shouldAnimate=()=>!configRef.current.reducedMotion&&!media.matches&&!pausedRef.current&&!flatRef.current&&configRef.current.kind==='manhattan'&&configRef.current.mode==='world';
    const draw=()=>{
      if(disposed||!visible||document.hidden||flatRef.current)return;
      environment.animate(clock,configRef.current.parameters??{});
      data.select(configRef.current.selectedId);
      renderer.render(scene,camera);
      for(const [id,element] of labelRefs.current){
        const position=data.labels.get(id);
        if(!position){element.style.display='none';continue;}
        projected.copy(position).project(camera);
        const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
        element.style.display=projected.z>1||projected.z<0||x<20||x>width-20||y<12||y>height-75?'none':'';
        element.style.transform=`translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    };
    const tick=(time:number)=>{
      frame=0;
      if(disposed||document.hidden||!visible||flatRef.current)return;
      if(lastTime&&shouldAnimate())clock+=Math.min((time-lastTime)/1000,.05);
      lastTime=time;
      draw();
      if(shouldAnimate())frame=requestAnimationFrame(tick);
    };
    const refresh=()=>{
      if(frame)cancelAnimationFrame(frame);
      frame=0;lastTime=0;
      if(!disposed&&!document.hidden&&visible&&!flatRef.current)frame=requestAnimationFrame(tick);
    };
    const reset=()=>{
      const city=configRef.current.kind==='manhattan'&&configRef.current.mode==='world';
      const portrait=width/height<.9?1.3:1;
      controls.target.set(0,city?.65:configRef.current.kind==='neural'?2.4:1.5,0);
      if(city)camera.position.set(29*portrait,31*portrait,39*portrait);
      else if(configRef.current.kind==='neural'||configRef.current.mode==='model')camera.position.set(2,12*portrait,31*portrait);
      else camera.position.set(17*portrait,21*portrait,23*portrait);
      camera.lookAt(controls.target);controls.update();controls.saveState();refresh();
    };
    const zoom=(factor:number)=>{
      const offset=camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));
      camera.position.copy(controls.target).add(offset);controls.update();refresh();
    };
    const focus=(id?:string)=>{
      const object=id?data.nodes.get(id):undefined;
      if(!object){reset();return;}
      const target=object.position.clone();
      const offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(configRef.current.kind==='manhattan'&&configRef.current.mode==='world'?14:10);
      controls.target.copy(target);camera.position.copy(target).add(offset);controls.update();refresh();
    };
    const rotate=()=>{
      const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/8);camera.position.copy(controls.target).add(offset);controls.update();refresh();
    };
    const replace=()=>{
      const config=configRef.current;
      if(config.kind!==previousKind||config.mode!==previousMode){
        disposeGroup(environment.group);environment=buildEnvironment(config.kind,config.mode);scene.add(environment.group);
        previousKind=config.kind;previousMode=config.mode;reset();
      }
      disposeGroup(data.group);data=buildData(config.kind,config.mode,config.result);scene.add(data.group);
      canvas.setAttribute('aria-label',`${worldNames[config.kind]} interactive 3D ${config.mode==='model'?'causal model':'scene'}`);
      refresh();
    };
    handleRef.current={reset,zoom,focus,rotate,refresh,replace};
    controls.addEventListener('change',refresh);
    const resize=()=>{
      const rect=host.getBoundingClientRect();
      const first=width===1;
      width=Math.max(1,rect.width);height=Math.max(1,rect.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,width<720?1.5:2));
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
      if(first)reset();else refresh();
    };
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
    const intersectionObserver=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;refresh();},{threshold:0});intersectionObserver.observe(host);
    const visibility=()=>refresh();document.addEventListener('visibilitychange',visibility);media.addEventListener('change',refresh);
    const raycaster=new THREE.Raycaster();
    const pointer=new THREE.Vector2();
    let downX=0,downY=0;
    const pointerDown=(event:PointerEvent)=>{downX=event.clientX;downY=event.clientY;};
    const pointerUp=(event:PointerEvent)=>{
      if(Math.hypot(event.clientX-downX,event.clientY-downY)>6)return;
      const rect=canvas.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObjects([...data.nodes.values()],false)[0];
      if(hit?.object.userData.nodeId)configRef.current.onSelect?.(hit.object.userData.nodeId as string);
    };
    const keyDown=(event:KeyboardEvent)=>{
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
    const lost=(event:Event)=>{event.preventDefault();setFallback(true);if(frame)cancelAnimationFrame(frame);};
    const restored=()=>{setFallback(false);refresh();};
    canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('keydown',keyDown);
    canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
    return()=>{
      disposed=true;if(frame)cancelAnimationFrame(frame);handleRef.current=null;
      resizeObserver.disconnect();intersectionObserver.disconnect();document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',refresh);
      controls.removeEventListener('change',refresh);controls.dispose();
      canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('keydown',keyDown);
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
      disposeGroup(environment.group);disposeGroup(data.group);disposeGroup(scene);
      renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    };
  },[descriptionId]);

  useEffect(()=>{handleRef.current?.replace();},[kind,mode,result]);
  useEffect(()=>{handleRef.current?.refresh();},[parameters,selectedId,reducedMotion,paused,flatView]);
  useEffect(()=>{if(focusId)handleRef.current?.focus(focusId);},[focusId]);

  const isFlat=fallback||flatView;
  const nodeList=result?.nodes??[];
  const labels=nodeList.length>18?nodeList.filter(node=>node.id===selectedId||node.kind==='input'||node.kind==='output'||node.id.startsWith('input-')||node.id.startsWith('output-')):nodeList;
  return <div className={`world-scene ${className} ${isFlat?'world-scene--flat':''}`} data-world-kind={kind} data-scene-mode={mode}>
    <div ref={hostRef} className="world-scene-host" aria-hidden={isFlat||undefined}/>
    {isFlat&&<SvgFallback kind={kind} result={result} mode={mode} selectedId={selectedId} onSelect={onSelect}/>}
    <p id={descriptionId} className="world-scene-sr-only">Interactive {worldNames[kind]} {mode==='model'?'causal model':'world'}. Drag to orbit. Scroll or pinch to zoom. Shift and drag to pan. Keyboard: arrow keys orbit, Shift and arrow keys pan, plus and minus zoom, Home resets, F focuses the selected node. {nodeList.length>0?'Use the Nodes menu to inspect any node.':''}</p>
    {!isFlat&&<div className="world-scene-labels" aria-label="Scene nodes">{labels.map(node=><button type="button" key={node.id} ref={element=>{if(element)labelRefs.current.set(node.id,element);else labelRefs.current.delete(node.id);}} className={`world-scene-label ${node.id===selectedId?'is-selected':''}`} onClick={()=>onSelect?.(node.id)} tabIndex={-1} aria-hidden="true"><span>{node.label}</span>{node.id===selectedId&&<small>{Number.isFinite(node.value)?Number(node.value.toFixed(3)).toLocaleString():'—'}</small>}</button>)}</div>}
    <div className="world-scene-tools">
      {nodeList.length>0&&<details className="world-scene-node-menu"><summary aria-controls={listId}><List size={16} aria-hidden="true"/><span>Nodes</span><span className="world-scene-node-count">{nodeList.length}</span></summary><div id={listId} className="world-scene-node-list" role="group" aria-label="Inspect simulation nodes">{nodeList.map(node=><button type="button" key={node.id} onClick={()=>onSelect?.(node.id)} aria-pressed={node.id===selectedId}><span>{node.label}</span><small>{Number.isFinite(node.value)?Number(node.value.toFixed(3)).toLocaleString():'—'}</small></button>)}</div></details>}
      <div className="world-scene-camera" role="group" aria-label="Scene camera controls">
        {!isFlat&&<><button type="button" onClick={()=>handleRef.current?.zoom(.82)} aria-label="Zoom in" title="Zoom in (+)"><Plus size={17} aria-hidden="true"/></button><button type="button" onClick={()=>handleRef.current?.zoom(1.22)} aria-label="Zoom out" title="Zoom out (−)"><Minus size={17} aria-hidden="true"/></button><button type="button" onClick={()=>handleRef.current?.rotate()} aria-label="Rotate scene" title="Rotate scene"><RotateCcw size={16} aria-hidden="true"/></button><button type="button" onClick={()=>handleRef.current?.reset()} aria-label="Reset camera" title="Reset camera (Home)"><Home size={16} aria-hidden="true"/></button>{selectedId&&<button type="button" onClick={()=>handleRef.current?.focus(selectedId)} aria-label="Focus selected node" title="Focus selected node (F)"><Focus size={17} aria-hidden="true"/></button>}{kind==='manhattan'&&mode==='world'&&!reducedMotion&&<button type="button" onClick={()=>setPaused(value=>!value)} aria-label={paused?'Play transit motion':'Pause transit motion'} title={paused?'Play transit motion':'Pause transit motion'}>{paused?<Play size={15} aria-hidden="true"/>:<Pause size={15} aria-hidden="true"/>}</button>}</>}
        {!fallback&&<button type="button" onClick={()=>setFlatView(value=>!value)} aria-label={flatView?'Switch to 3D view':'Switch to 2D view'} title={flatView?'Switch to 3D view':'Switch to 2D view'} className="world-scene-view-switch">{flatView?'3D':'2D'}</button>}
        {fallback&&<span className="world-scene-fallback-note">2D view</span>}
      </div>
    </div>
  </div>;
}
