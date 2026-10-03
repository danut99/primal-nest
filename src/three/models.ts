// Încărcarea și pregătirea modelelor 3D de dinozauri (public/models).
// Comun pentru lupta 3D și pentru randarea imaginilor.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MODEL_JOBS, type ModelJob } from '../content/dinoModels';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>();

export function loadModel(model: string) {
  if (!cache.has(model)) cache.set(model, loader.loadAsync(`${import.meta.env.BASE_URL}models/${model}.glb`));
  return cache.get(model)!;
}

export interface PreparedModel {
  /** Modelul, rotit să privească spre dreapta (+X), cu picioarele pe y = 0 și centrat pe X/Z. */
  root: THREE.Group;
  animations: THREE.AnimationClip[];
  /** Dimensiunile după aliniere. */
  size: THREE.Vector3;
}

/** Clonă proprie a modelului, recolorată și izolată după setările speciei. */
export async function prepareModel(job: ModelJob): Promise<PreparedModel> {
  const gltf = await loadModel(job.model);
  // SkeletonUtils: clona normală nu copiază scheletul, iar modelele animate nu s-ar roti.
  const model = cloneSkinned(gltf.scene) as THREE.Group;
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const recolored = mats.map((m) => {
      const mat = (m as THREE.MeshStandardMaterial).clone();
      if (mat.color) {
        if (job.tint) mat.color.lerp(new THREE.Color(job.tint), job.tintAmt ?? 0.5);
        mat.color.offsetHSL(job.hue ?? 0, job.sat ?? 0, job.light ?? 0);
      }
      mat.roughness = Math.min(mat.roughness ?? 0.8, 0.75);
      mat.metalness = 0;
      return mat;
    });
    mesh.material = Array.isArray(mesh.material) ? recolored : recolored[0];
  });

  if (job.keep) {
    model.updateMatrixWorld(true);
    const lo = new THREE.Vector3(...job.keep.min);
    const hi = new THREE.Vector3(...job.keep.max);
    const drop: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      if (c.x < lo.x || c.y < lo.y || c.z < lo.z || c.x > hi.x || c.y > hi.y || c.z > hi.z) drop.push(o);
    });
    for (const o of drop) o.removeFromParent();
  }

  // Orientare: yaw spre dreapta, apoi roll (înotătorii puși orizontal).
  const yawed = new THREE.Group();
  yawed.add(model);
  yawed.rotation.y = THREE.MathUtils.degToRad(job.yaw ?? 0);
  const root = new THREE.Group();
  root.add(yawed);
  root.rotation.z = THREE.MathUtils.degToRad(job.roll ?? 0);
  // Recentrare: picioarele pe sol, centrul pe X/Z.
  const holder = new THREE.Group();
  holder.add(root);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -box.min.y, -center.z);
  return { root: holder, animations: gltf.animations, size: box.getSize(new THREE.Vector3()) };
}

export function jobFor(speciesId: string): ModelJob | undefined {
  return MODEL_JOBS[speciesId];
}
