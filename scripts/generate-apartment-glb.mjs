import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import * as THREE from "../apps/web/node_modules/three/build/three.module.js";
import { GLTFExporter } from "../apps/web/node_modules/three/examples/jsm/exporters/GLTFExporter.js";

globalThis.FileReader ??= class FileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }

  readAsDataURL(blob) {
    void blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const output = resolve("apps/web/public/samples/models/project-hub-apartment-tower.glb");
const scene = new THREE.Scene();
scene.name = "PROJECT HUB 자체 제작 아파트 1개 동";
scene.userData = {
  author: "PROJECT HUB",
  license: "PROJECT HUB 프로젝트 내부 사용",
  source: "외부 모델을 사용하지 않은 절차적 자체 제작 자산",
  generatedBy: "scripts/generate-apartment-glb.mjs",
};

const materials = {
  concrete: new THREE.MeshStandardMaterial({ name: "밝은 콘크리트", color: 0xd7dde1, roughness: 0.82 }),
  accent: new THREE.MeshStandardMaterial({ name: "외벽 포인트", color: 0xb36543, roughness: 0.68 }),
  glass: new THREE.MeshStandardMaterial({ name: "창호 유리", color: 0x4f7893, roughness: 0.18, metalness: 0.22 }),
  frame: new THREE.MeshStandardMaterial({ name: "창호 프레임", color: 0x28343d, roughness: 0.5 }),
  balcony: new THREE.MeshStandardMaterial({ name: "발코니 난간", color: 0xb7c6cc, roughness: 0.35, metalness: 0.2 }),
  roof: new THREE.MeshStandardMaterial({ name: "옥상 구조물", color: 0x66747c, roughness: 0.72 }),
  ground: new THREE.MeshStandardMaterial({ name: "기단", color: 0x7f898d, roughness: 0.92 }),
};

function box(name, size, position, material, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const building = new THREE.Group();
building.name = "아파트 101동";
scene.add(building);

const floorHeight = 3.05;
const floors = 18;
const towerHeight = floorHeight * floors;

box("대지 기단", [24, 0.8, 16], [0, -0.4, 0], materials.ground, building);
box("필로티 및 코어", [13.6, towerHeight, 8.2], [0, towerHeight / 2, 0], materials.concrete, building);
box("중앙 수직 포인트", [2.2, towerHeight + 0.25, 0.24], [0, towerHeight / 2, 4.22], materials.accent, building);

for (let floor = 0; floor < floors; floor += 1) {
  const y = floor * floorHeight + 1.45;
  box(`${floor + 1}층 바닥 슬래브`, [14.4, 0.18, 9], [0, floor * floorHeight + 0.1, 0], materials.frame, building);
  box(`${floor + 1}층 전면 발코니`, [13.8, 0.18, 1.05], [0, y - 0.9, 4.45], materials.concrete, building);
  box(`${floor + 1}층 전면 난간`, [13.8, 0.72, 0.08], [0, y - 0.5, 4.94], materials.balcony, building);
  box(`${floor + 1}층 후면 발코니`, [13.8, 0.18, 0.78], [0, y - 0.9, -4.28], materials.concrete, building);
  box(`${floor + 1}층 후면 난간`, [13.8, 0.72, 0.08], [0, y - 0.5, -4.64], materials.balcony, building);

  for (const side of [-1, 1]) {
    for (let bay = 0; bay < 4; bay += 1) {
      const x = -5.15 + bay * 3.45;
      box(`${floor + 1}층 ${side > 0 ? "전면" : "후면"} ${bay + 1}번 창`, [2.15, 1.42, 0.12], [x, y + 0.15, side * 4.14], materials.glass, building);
    }
  }

  for (const side of [-1, 1]) {
    box(`${floor + 1}층 측면 창 ${side > 0 ? "동" : "서"}`, [0.12, 1.5, 2.6], [side * 6.86, y + 0.1, 0], materials.glass, building);
  }
}

box("주출입구", [3.8, 2.7, 0.28], [0, 1.35, 4.16], materials.glass, building);
box("출입구 캐노피", [5.8, 0.25, 2.6], [0, 3.05, 5.12], materials.accent, building);
box("옥상 기계실", [5.2, 3.2, 4.4], [0, towerHeight + 1.6, 0], materials.roof, building);
box("옥상 파라펫 전면", [14.2, 0.9, 0.22], [0, towerHeight + 0.45, 4.2], materials.concrete, building);
box("옥상 파라펫 후면", [14.2, 0.9, 0.22], [0, towerHeight + 0.45, -4.2], materials.concrete, building);

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  trs: false,
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(result));
console.log(`Generated ${output}`);
