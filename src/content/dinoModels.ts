// Ce model 3D (public/models, vezi CREDITS.md), ce culoare și ce poză are fiecare specie.
// Folosit de lupta 3D și de randarea imaginilor (scripts/render-dinos.mjs).
// fill = cât din cadru ocupă la randare: puii mai mici, adulții umplu cadrul.

export interface ModelJob {
  model: string;
  size?: number;
  /** Rotire în jurul axei verticale (grade), ca modelul să privească spre dreapta. */
  yaw?: number;
  /** Rotire în planul imaginii (grade), ex. un înotător pus orizontal. */
  roll?: number;
  /** Înclinare a camerei de sus (grade). */
  pitch?: number;
  /** Modificare de culoare: nuanță (0–1), saturație și luminozitate (−1…1). */
  hue?: number;
  sat?: number;
  light?: number;
  /** Culoarea luminii de contur (tipul creaturii). */
  rim?: string;
  /** Animație și momentul din ea, pentru poza din imagine. */
  anim?: string;
  time?: number;
  fill?: number;
  /** Păstrează doar piesele cu centrul în această cutie (modele cu mai multe creaturi). */
  keep?: { min: [number, number, number]; max: [number, number, number] };
  /** Culoare spre care se nuanțează modelul și cât de tare (0–1). */
  tint?: string;
  tintAmt?: number;
}


const PUI = 0.74;
const JUV = 0.86;
const ADULT = 0.95;
const ptero: Record<string, NonNullable<ModelJob['keep']>> = {
  mic: { min: [-5, 1.5, -5], max: [5, 3, 5] },
  planor: { min: [-5, -0.5, -5], max: [5, 1, 5] },
  mare: { min: [-5, -3, -5], max: [5, -1.3, 5] },
};

export const MODEL_JOBS: Record<string, ModelJob> = {
  // Junglă: Triceratops (Quaternius), Dimetrodon pentru prădător
  mugurel: { model: 'triceratops', yaw: 90, fill: PUI, tint: '#7fd34a', tintAmt: 0.55, light: 0.06, rim: '#b6ff6a', anim: 'Idle', time: 0.2 },
  ferigosaur: { model: 'triceratops', yaw: 90, fill: JUV, tint: '#4f9a2f', tintAmt: 0.5, rim: '#9cff5a', anim: 'Walk', time: 0.4 },
  codrodon: { model: 'triceratops', yaw: 90, fill: ADULT, tint: '#2f5e1c', tintAmt: 0.55, rim: '#7cff5a', anim: 'Attack', time: 0.5 },
  spinodon: { model: 'dimonstrodon', yaw: 90, fill: ADULT, tint: '#5a7a2a', tintAmt: 0.45, rim: '#c04aff' },
  // Foc: Velociraptor și T-Rex (Quaternius), Allosaurus în armură pentru ramura specială
  scanteius: { model: 'velociraptor', yaw: 90, fill: PUI, tint: '#ff8a3c', tintAmt: 0.55, light: 0.05, rim: '#ffd23a', anim: 'Idle', time: 0.2 },
  jarraptor: { model: 'velociraptor', yaw: 90, fill: JUV, tint: '#e0502a', tintAmt: 0.55, rim: '#ffb43a', anim: 'Run', time: 0.3 },
  vulcanraptor: { model: 'trex', yaw: 90, fill: ADULT, tint: '#4a1c14', tintAmt: 0.6, rim: '#ff6a1a', anim: 'Attack', time: 0.5 },
  fumaripter: { model: 'armored_allosaurus', yaw: 90, fill: ADULT, tint: '#8c5a40', tintAmt: 0.35, rim: '#ffb347' },
  // Apă: Plesiomonster, Apatosaurus pentru colos
  stropel: { model: 'plesiomonster', yaw: 270, roll: 40, fill: PUI, tint: '#5fb4e8', tintAmt: 0.55, light: 0.05, rim: '#8fe0ff' },
  valusaur: { model: 'plesiomonster', yaw: 270, roll: 40, fill: JUV, tint: '#2f7fd0', tintAmt: 0.55, rim: '#6ad0ff' },
  abisaurus: { model: 'apatosaurus', yaw: 90, fill: ADULT, tint: '#1f4a8c', tintAmt: 0.6, rim: '#5fc8ff', anim: 'Idle', time: 0.3 },
  fulgerin: { model: 'plesiomonster', yaw: 270, roll: 40, fill: ADULT, tint: '#1a3f8c', tintAmt: 0.55, hue: 0.02, rim: '#ffe14a' },
  // Piatră: Stegosaurus (Quaternius), Brachio și Stegoknight în armură
  pietroi: { model: 'stegosaurus', yaw: 90, fill: PUI, tint: '#b49a78', tintAmt: 0.5, rim: '#ffd9a0', anim: 'Idle', time: 0.2 },
  scutosaur: { model: 'stegosaurus', yaw: 90, fill: JUV, tint: '#8e7454', tintAmt: 0.5, rim: '#ffc070', anim: 'Walk', time: 0.4 },
  cetatodon: { model: 'armored_brachio', yaw: 180, fill: ADULT, tint: '#6e665c', tintAmt: 0.4, rim: '#ffcf8a' },
  buzduganix: { model: 'stegoknight', yaw: 90, fill: ADULT, tint: '#6a4a30', tintAmt: 0.3, rim: '#ff9a3c' },
  // Aer: un pterozaur din stolul Pterablocktyls
  aripel: { model: 'pterablocktyls', yaw: 90, fill: 0.78, keep: ptero.planor, tint: '#6fc8f0', tintAmt: 0.75, light: 0.04, rim: '#bfe8ff' },
  planorix: { model: 'pterablocktyls', yaw: 90, fill: JUV, keep: ptero.planor, tint: '#3f7fc0', tintAmt: 0.8, rim: '#9fe0ff' },
  furtunodactil: { model: 'pterablocktyls', yaw: 90, fill: ADULT, keep: ptero.mare, tint: '#1f2f60', tintAmt: 0.85, rim: '#ffe14a' },
  norisaur: { model: 'pterablocktyls', yaw: 90, fill: ADULT, keep: ptero.planor, tint: '#d8f0ff', tintAmt: 0.55, light: 0.05, rim: '#8fd0ff' },
};
