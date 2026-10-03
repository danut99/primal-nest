// Unealtă de dezvoltare: randează modelele 3D ale speciilor în PNG-uri transparente,
// din profil, cu lumină dramatică. O pornește scripts/render-dinos.mjs prin Chrome.

import * as THREE from 'three';
import { MODEL_JOBS, type ModelJob } from '../../src/content/dinoModels';
import { prepareModel } from '../../src/three/models';

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

async function renderJob(job: ModelJob): Promise<string> {
  const size = job.size ?? 512;
  renderer.setSize(size, size, false);
  const { root, animations, size: dim } = await prepareModel(job);
  const scene = new THREE.Scene();
  scene.add(root);

  if (job.anim !== undefined && animations.length) {
    const clip = animations.find((a) => a.name.toLowerCase().includes(job.anim!.toLowerCase())) ?? animations[0];
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    mixer.setTime(job.time ?? 0.3);
  }

  // Cadru pătrat cu picioarele aproape de marginea de jos.
  const span = Math.max(dim.x, dim.y, dim.z * 0.6);
  root.position.y -= Math.max(dim.x, dim.y) / 2 - Math.max(dim.x, dim.y) * 0.04;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, span * 50);
  const dist = span / (2 * Math.tan(THREE.MathUtils.degToRad(14))) / (job.fill ?? 0.92);
  const pitch = THREE.MathUtils.degToRad(job.pitch ?? 8);
  camera.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  camera.lookAt(0, 0, 0);

  // Lumină: cheie caldă din față-stânga, contur colorat din spate, umplere rece slabă.
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a1a10, 0.6));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.6);
  key.position.set(-span, span * 1.2, span * 1.6);
  scene.add(key);
  const rimColor = new THREE.Color(job.rim ?? '#ffb347');
  const rim = new THREE.DirectionalLight(rimColor, 4.5);
  rim.position.set(span * 1.4, span * 0.8, -span * 1.8);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight(rimColor, 2.2);
  rim2.position.set(-span * 1.6, span * 0.3, -span * 1.2);
  scene.add(rim2);
  const fill = new THREE.DirectionalLight(0x8fb4ff, 0.5);
  fill.position.set(span, -span * 0.2, span);
  scene.add(fill);

  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

declare global {
  interface Window {
    renderJob: typeof renderJob;
    renderSpecies: (species: string, size?: number) => Promise<string>;
    speciesNames: string[];
    renderReady: boolean;
  }
}
window.renderJob = renderJob;
window.renderSpecies = (species, size = 512) => renderJob({ ...MODEL_JOBS[species], size });
window.speciesNames = Object.keys(MODEL_JOBS);
window.renderReady = true;
