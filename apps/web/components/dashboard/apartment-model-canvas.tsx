"use client";

import { Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

const apartmentModelUrl = "/samples/models/project-hub-apartment-tower.glb";

function ApartmentTower() {
  const { scene } = useGLTF(apartmentModelUrl);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return <primitive object={model} scale={0.12} position={[0, 0, 0]} />;
}

export function ApartmentModelCanvas() {
  return (
    <Canvas
      shadows
      camera={{ position: [13, 9, 15], fov: 42, near: 0.1, far: 150 }}
      aria-label="PROJECT HUB 자체 제작 아파트 1개 동 3D 모델"
    >
      <color attach="background" args={["#071724"]} />
      <fog attach="fog" args={["#071724", 28, 75]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[14, 22, 12]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-10, 12, -8]} intensity={0.8} color="#6ddbd4" />
      <Suspense fallback={null}>
        <ApartmentTower />
      </Suspense>
      <Grid position={[0, -0.05, 0]} args={[34, 34]} cellColor="#174052" sectionColor="#2f7784" fadeDistance={42} fadeStrength={1} infiniteGrid />
      <OrbitControls makeDefault target={[0, 3.4, 0]} enableDamping dampingFactor={0.08} minDistance={7} maxDistance={45} maxPolarAngle={Math.PI / 2.02} />
    </Canvas>
  );
}

useGLTF.preload(apartmentModelUrl);
