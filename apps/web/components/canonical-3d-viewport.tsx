'use client';

import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';

type CanonicalBox = {
  archonId: string;
  label: string;
  positionMm: [number, number, number];
  sizeMm: [number, number, number];
};

const MM_TO_M = 0.001;

const canonicalBoxes: CanonicalBox[] = [
  { archonId:'archon_slab_ground', label:'Ground slab', positionMm:[0,-100,0], sizeMm:[24800,200,15000] },
  { archonId:'archon_wall_north', label:'North wall', positionMm:[0,1600,-7400], sizeMm:[24800,3200,200] },
  { archonId:'archon_wall_south', label:'South wall', positionMm:[0,1600,7400], sizeMm:[24800,3200,200] },
  { archonId:'archon_wall_west', label:'West wall', positionMm:[-12300,1600,0], sizeMm:[200,3200,14800] },
  { archonId:'archon_wall_east', label:'East wall', positionMm:[12300,1600,0], sizeMm:[200,3200,14800] },
  { archonId:'archon_room_kitchen', label:'Kitchen volume', positionMm:[-8500,150, -3800], sizeMm:[6400,300,5200] },
  { archonId:'archon_room_dining', label:'Dining volume', positionMm:[1800,150,0], sizeMm:[11200,300,8200] }
];

function CanonicalBoxMesh({item}:{item:CanonicalBox}) {
  const position = item.positionMm.map((value)=>value*MM_TO_M) as [number,number,number];
  const size = item.sizeMm.map((value)=>value*MM_TO_M) as [number,number,number];
  return <mesh position={position} userData={{archonId:item.archonId,label:item.label}} castShadow receiveShadow>
    <boxGeometry args={size}/>
    <meshStandardMaterial roughness={0.72} metalness={0.02}/>
  </mesh>;
}

export function Canonical3DViewport({version}:{version:number}) {
  return <div className="canonical-3d-shell">
    <div className="canonical-3d-status"><span>CANONICAL GEOMETRY</span><b>Approved Version {version || '—'}</b><small>Units: mm · Web view: metres · 1 mm canonical precision</small></div>
    <Canvas shadows camera={{position:[22,18,24],fov:42}}>
      <ambientLight intensity={1.2}/>
      <directionalLight position={[12,22,8]} intensity={2.2} castShadow/>
      <Grid args={[60,60]} cellSize={1} sectionSize={5} fadeDistance={50}/>
      {canonicalBoxes.map((item)=><CanonicalBoxMesh key={item.archonId} item={item}/>)}
      <OrbitControls makeDefault target={[0,1,0]} minDistance={8} maxDistance={55}/>
    </Canvas>
    <div className="canonical-3d-legend"><strong>ARCHON Building Graph</strong><span>{canonicalBoxes.length} canonical primitives</span><span>Orbit · Pan · Zoom</span></div>
  </div>;
}
