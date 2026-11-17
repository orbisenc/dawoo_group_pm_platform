"use client";

import { Edges, Grid, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ComponentRef, RefObject } from "react";

import type { ViewerObject } from "../../lib/viewer-adapter";

export type ViewerCanvasHandle = { fit: () => void; reset: () => void };

type Props = {
  objects: ViewerObject[];
  visibleFloors: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

type OrbitControlsHandle = ComponentRef<typeof OrbitControls>;

function SceneControls({ controlRef }: { controlRef: RefObject<OrbitControlsHandle | null> }) {
  return <OrbitControls ref={controlRef} makeDefault enableDamping dampingFactor={0.08} minDistance={8} maxDistance={42} maxPolarAngle={Math.PI / 2.05} />;
}

function BuildingObject({ object, selected, onSelect }: { object: ViewerObject; selected: boolean; onSelect: (event: ThreeEvent<MouseEvent>) => void }) {
  return (
    <mesh position={object.position} castShadow receiveShadow onClick={onSelect}>
      <boxGeometry args={object.size} />
      <meshStandardMaterial color={selected ? "#20e0ce" : object.color} roughness={0.48} metalness={0.12} emissive={selected ? "#0b8178" : "#000000"} emissiveIntensity={selected ? 0.55 : 0} />
      <Edges color={selected ? "#bafff9" : "#b4e4e2"} threshold={15} />
    </mesh>
  );
}

const CameraBridge = forwardRef<ViewerCanvasHandle, { controls: RefObject<OrbitControlsHandle | null> }>(function CameraBridge({ controls }, ref) {
  const { camera } = useThree();
  useImperativeHandle(ref, () => {
    const move = (position: [number, number, number], target: [number, number, number]) => {
      camera.position.set(...position);
      controls.current?.target.set(...target);
      controls.current?.update();
    };
    return {
      fit: () => move([15, 13, 18], [0, 4.3, 0]),
      reset: () => move([15, 11, 17], [0, 4.2, 0]),
    };
  }, [camera, controls]);
  return null;
});

export const ViewerCanvas = forwardRef<ViewerCanvasHandle, Props>(function ViewerCanvas({ objects, visibleFloors, selectedId, onSelect }, ref) {
  const controls = useRef<OrbitControlsHandle | null>(null);
  const apiRef = useRef<ViewerCanvasHandle | null>(null);
  useImperativeHandle(ref, () => ({ fit: () => apiRef.current?.fit(), reset: () => apiRef.current?.reset() }), []);

  return (
    <Canvas shadows camera={{ position: [15, 11, 17], fov: 42, near: 0.1, far: 100 }} onPointerMissed={() => onSelect(null)} aria-label="자체 생성 샘플 건물 3D 캔버스">
      <color attach="background" args={["#091923"]} />
      <fog attach="fog" args={["#091923", 25, 58]} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[10, 18, 12]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-12, 8, -8]} intensity={0.7} color="#69d9d1" />
      {objects.filter((object) => visibleFloors.has(object.floorKey)).map((object) => (
        <BuildingObject key={object.id} object={object} selected={selectedId === object.id} onSelect={(event) => { event.stopPropagation(); onSelect(object.id); }} />
      ))}
      <Grid position={[0, -0.64, 0]} args={[35, 35]} cellColor="#19414c" sectionColor="#2d767d" fadeDistance={35} fadeStrength={1} infiniteGrid />
      <SceneControls controlRef={controls} />
      <CameraBridge ref={apiRef} controls={controls} />
    </Canvas>
  );
});
