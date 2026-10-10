// Construiește scheletul Spine al T-Rex-ului (public/dinosaurs/tyrannosaurus) din piesele pictate din art/.
//   node scripts/build-trex.mjs
// Fără dependențe: PNG-ul se citește și se scrie cu zlib.
//
// - Atlasul se reîmpachetează: fiecare piesă își ia doar pixelii ei (fără bucăți din vecini), iar falca de jos
//   se decupează din cap (cu dinți inferiori și gingie pictate), ca gura să se poată deschide.
// - Corpul, gâtul+capul și coada sunt mesh-uri ponderate pe mai multe oase: trunchiul se îndoaie, gâtul se
//   arcuiește, coada face val. Picioarele se rezolvă cu IK pe două segmente, labele rămân lipite de sol.
// - Animații: idle, walk, attack (mușcătură) și ultimate (răget + călcătură + erupție de cristale). Atacul și
//   ultimata refolosesc curbele dragonilor (scripts/dragon-motion.json: „attack” și „special1” ale lui Pyron),
//   transpuse pe oasele dinozaurului: bazin → corp, waist/chest → trunchi, neck/head/jaw, coada pe trei oase.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/dinosaurs/tyrannosaurus');
const MOTION = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/dragon-motion.json'), 'utf8'));

// ---------- PNG ----------

function readPNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      type = data[9];
      if (data[8] !== 8 || data[12] !== 0 || (type !== 6 && type !== 2)) throw new Error('PNG neacceptat: ' + file);
    } else if (kind === 'IDAT') idat.push(data);
    pos += len + 12;
  }
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[row + x - bpp] : 0, b = y ? px[row - stride + x] : 0, c = x >= bpp && y ? px[row - stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[row + x] = (src[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data.set(px.subarray(i * bpp, i * bpp + 3), i * 4);
    data[i * 4 + 3] = bpp === 4 ? px[i * 4 + 3] : 255;
  }
  return { width, height, data };
}

function writePNG(file, { width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const chunk = (kind, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length);
    head.write(kind, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), body])));
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

// ---------- utilitare ----------

const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;
const rot = ([x, y], a) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return [c * x - s * y, s * x + c * y]; };
const r2 = (v) => Math.round(v * 100) / 100;
/** Fereastră netedă: 0 înainte de a, urcă până la b, ține până la c, coboară până la d. */
const env = (t, a, b, c, d) => (t < a || t > d ? 0 : t < b ? smooth((t - a) / (b - a)) : t <= c ? 1 : 1 - smooth((t - c) / (d - c)));
/** Interpolare netedă între chei [timp, valoare]. */
const keys = (t, list) => {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 0; i < list.length - 1; i++) if (t <= list[i + 1][0]) return lerp(list[i][1], list[i + 1][1], smooth((t - list[i][0]) / (list[i + 1][0] - list[i][0])));
  return list.at(-1)[1];
};

function convexHull(points) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower = [], upper = [];
  for (const p of points) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  for (let i = points.length - 1; i >= 0; i--) { const p = points[i]; while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
const inside = (poly, x, y) => {
  let ok = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
};

// ---------- piesele: decupare din atlasul pictat ----------

const art = readPNG(path.join(ROOT, 'art/tyrannosaurus-parts.png'));
const crystal = readPNG(path.join(OUT, 'attack-crystal.png'));
const at = (x, y) => (y * art.width + x) * 4;

// Dreptunghiurile pieselor în atlasul pictat (se suprapun, de aceea masca vine din conturul fiecărei piese).
const REGIONS = {
  body: [16, 15, 544, 331], head: [548, 8, 486, 344], tail: [1003, 65, 528, 237], thigh: [90, 336, 374, 379], shin: [623, 344, 307, 354],
  foot: [1042, 371, 446, 308], upperarm: [105, 718, 304, 289], forearm: [605, 730, 321, 266], hip: [1146, 697, 292, 312],
};

/** O piesă: imagine proprie (w×h) + originea ei în coordonatele atlasului pictat. */
function piece(name, ox, oy, w, h) {
  return { name, ox, oy, w, h, data: new Uint8Array(w * h * 4) };
}
const pieces = {};

// Conturul piesei = învelitoarea convexă a celei mai mari componente opace (ca la scheletul inițial).
function outline([rx, ry, rw, rh]) {
  const seen = new Uint8Array(rw * rh);
  let largest = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start]) continue;
    seen[start] = 1;
    if (art.data[at(rx + (start % rw), ry + Math.floor(start / rw)) + 3] < 32) continue;
    const queue = [start];
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k], x = i % rw, y = Math.floor(i / rw);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= rw || ny >= rh) continue;
        const ni = ny * rw + nx;
        if (seen[ni]) continue;
        seen[ni] = 1;
        if (art.data[at(rx + nx, ry + ny) + 3] >= 32) queue.push(ni);
      }
    }
    if (queue.length > largest.length) largest = queue;
  }
  const rows = new Map();
  for (const i of largest) {
    const x = i % rw, y = Math.floor(i / rw), p = rows.get(y) ?? [x, x];
    rows.set(y, [Math.min(p[0], x), Math.max(p[1], x)]);
  }
  const pts = [];
  for (const [y, [l, r]] of rows) for (const x of [l, r]) for (const [dx, dy] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) pts.push([clamp(x + dx, 0, rw) + rx, clamp(y + dy, 0, rh) + ry]);
  return convexHull(pts);
}

for (const [name, reg] of Object.entries(REGIONS)) {
  const hull = outline(reg), [rx, ry, rw, rh] = reg, p = piece(name, rx, ry, rw, rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) if (inside(hull, rx + x + 0.5, ry + y + 0.5)) p.data.set(art.data.subarray(at(rx + x, ry + y), at(rx + x, ry + y) + 4), (y * rw + x) * 4);
  pieces[name] = p;
}

// ---------- gamba: în pictură, coapsa include și partea de sus a gambei, îndoită altfel decât osul.
// O decupăm și o lipim de osul gambei (altfel iese în spate, ca un al doilea genunchi).
{
  const TH = pieces.thigh, [ox, oy] = [TH.ox, TH.oy];
  const lobe = [[40, 250], [96, 238], [196, 233], [250, 238], [290, 262], [300, 379], [40, 379]];
  const calf = piece('calf', ox + 40, oy + 228, 266, 151);
  for (let y = 228; y < TH.h; y++)
    for (let x = 40; x < 306; x++) {
      if (!inside(lobe, x + 0.5, y + 0.5)) continue;
      const i = (y * TH.w + x) * 4;
      calf.data.set(TH.data.subarray(i, i + 4), ((y - 228) * calf.w + x - 40) * 4);
      TH.data[i + 3] = 0;
    }
  pieces.calf = calf;
}

// ---------- falca: decupată din cap ----------
// Coordonate „c” = relativ la colțul capului în atlasul pictat (548, 8).
const HEAD = pieces.head;
const GUM = [[200, 163], [240, 166], [262, 171], [300, 177], [330, 181], [350, 191], [370, 198], [390, 202], [410, 203], [430, 203], [450, 199], [465, 195], [478, 189], [492, 184]];
const gumY = (x) => keys(x, GUM.map(([a, b]) => [a, b])); // interpolare netedă pe linia gingiei
const HINGE = [258, 174];
const cutX = (y) => 262 - (y - 172) * 0.3; // marginea din spate a fălcii (la dreapta ei e doar falcă)
const hx = (x, y) => (y * HEAD.w + x) * 4;

const tooth = new Uint8Array(HEAD.w * HEAD.h);
for (let y = 0; y < HEAD.h; y++)
  for (let x = 250; x < HEAD.w; x++) {
    const i = hx(x, y), [r, g, b, a] = HEAD.data.subarray(i, i + 4), d = y - gumY(x);
    if (a > 40 && d > -3 && d < 46 && r > 150 && r > b + 22 && g > 120) tooth[y * HEAD.w + x] = 1;
  }
// contur întunecat al dinților: dilatare cu 2 px în banda gingiei
const toothMask = tooth.slice();
for (let y = 2; y < HEAD.h - 2; y++)
  for (let x = 252; x < HEAD.w - 2; x++) {
    if (tooth[y * HEAD.w + x]) continue;
    const d = y - gumY(x);
    if (d < -1 || d > 46) continue;
    outer: for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tooth[(y + dy) * HEAD.w + x + dx]) { toothMask[y * HEAD.w + x] = 1; break outer; }
  }

const JAW_TOP = 135; // falca include și dinții inferiori pictați deasupra gingiei
const jaw = piece('jaw', HEAD.ox + 190, HEAD.oy + JAW_TOP, HEAD.w - 190, HEAD.h - JAW_TOP);
const jx = (x, y) => ((y - JAW_TOP) * jaw.w + (x - 190)) * 4;
for (let y = JAW_TOP; y < HEAD.h; y++)
  for (let x = 190; x < HEAD.w; x++) {
    const i = hx(x, y);
    if (!HEAD.data[i + 3] || y < gumY(x) - 3 || x < cutX(y) - 48) continue;
    const o = jx(x, y);
    if (toothMask[y * HEAD.w + x]) {
      // sub dinții de sus nu există pictură: culoarea fălcii de dedesubt, ușor întunecată spre gingie
      let yy = y;
      while (yy < HEAD.h - 1 && toothMask[yy * HEAD.w + x]) yy++;
      const k = 1 - clamp((yy - y) / 60, 0, 0.18), j = hx(x, yy);
      jaw.data.set([HEAD.data[j] * k, HEAD.data[j + 1] * k, HEAD.data[j + 2] * k, HEAD.data[i + 3]], o);
    } else jaw.data.set(HEAD.data.subarray(i, i + 4), o);
  }
// dinți inferiori: colți pictați procedural deasupra gingiei (ascunși sub cap cât timp gura e închisă)
for (let tx = 334, n = 0; tx < 470; tx += 19, n++) {
  const h = 15 + (n % 3) * 4 + (tx > 400 ? 3 : 0), half = 6 + (n % 2), base = gumY(tx) + 5;
  for (let y = Math.floor(base - h - 2); y <= base; y++)
    for (let x = tx - half - 2; x <= tx + half + 2; x++) {
      const u = (base - y) / h, edge = half * (1 - u) * (1 - u * 0.15), d = Math.abs(x - tx + u * 3);
      if (u < 0 || u > 1.05 || d > edge + 1.4) continue;
      const o = jx(x, y);
      if (d > edge - 0.6 || u > 0.97) jaw.data.set([44, 30, 32, 255], o);
      else { const light = 1 - (x - tx) / (half * 2) * 0.35; jaw.data.set([Math.min(255, 238 * light), Math.min(255, 224 * light), Math.min(255, 196 * light), 255], o); }
    }
}
pieces.jaw = jaw;

// capul pierde falca (în dreapta tăieturii, sub gingie); marginea tăieturii se estompează peste falcă
for (let y = 0; y < HEAD.h; y++)
  for (let x = 190; x < HEAD.w; x++) {
    const i = hx(x, y);
    if (!HEAD.data[i + 3] || toothMask[y * HEAD.w + x] || y <= gumY(x) + 1) continue;
    const fade = clamp((cutX(y) - x) / 14, 0, 1);
    HEAD.data[i + 3] = Math.round(HEAD.data[i + 3] * fade);
  }

// interiorul gurii: un gradient roșu închis
const mouth = piece('mouth', 0, 0, 64, 64);
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const k = y / 63; mouth.data.set([Math.round(lerp(38, 96, k)), Math.round(lerp(6, 18, k)), Math.round(lerp(18, 34, k)), 255], (y * 64 + x) * 4); }
pieces.mouth = mouth;
const white = piece('fxPixel', 0, 0, 8, 8);
white.data.fill(255);
pieces.fxPixel = white;

// ---------- reîmpachetare ----------

const PAD = 4, PAGE_W = 2048;
let cx = PAD, cy = PAD, rowH = 0;
for (const p of Object.values(pieces).sort((a, b) => b.h - a.h)) {
  if (cx + p.w + PAD > PAGE_W) { cx = PAD; cy += rowH + PAD; rowH = 0; }
  p.x = cx;
  p.y = cy;
  cx += p.w + PAD;
  rowH = Math.max(rowH, p.h);
}
const PAGE_H = Math.ceil((cy + rowH + PAD) / 4) * 4;
const page = { width: PAGE_W, height: PAGE_H, data: new Uint8Array(PAGE_W * PAGE_H * 4) };
for (const p of Object.values(pieces)) for (let y = 0; y < p.h; y++) page.data.set(p.data.subarray(y * p.w * 4, (y + 1) * p.w * 4), ((p.y + y) * PAGE_W + p.x) * 4);
writePNG(path.join(OUT, 'parts.png'), page);
let atlas = `parts.png\nsize: ${PAGE_W},${PAGE_H}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n`;
for (const p of Object.values(pieces)) atlas += `${p.name}\n  rotate: false\n  xy: ${p.x},${p.y}\n  size: ${p.w},${p.h}\n  orig: ${p.w},${p.h}\n  offset: 0,0\n  index: -1\n`;
atlas += `\nattack-crystal.png\nsize: ${crystal.width},${crystal.height}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\nfxCrystal\n  rotate: false\n  xy: 0,0\n  size: ${crystal.width},${crystal.height}\n  orig: ${crystal.width},${crystal.height}\n  offset: 0,0\n  index: -1\n`;
fs.writeFileSync(path.join(OUT, 'parts.atlas'), atlas);
/** uv al unui punct din atlasul pictat (ax, ay) în piesa p */
const uvOf = (p, ax, ay) => [(ax - p.ox) / p.w, (ay - p.oy) / p.h]; // relativ la regiune (Spine o mapează în pagină)
const alphaAt = (p, ax, ay) => { const x = Math.floor(ax - p.ox), y = Math.floor(ay - p.oy); return x < 0 || y < 0 || x >= p.w || y >= p.h ? 0 : p.data[(y * p.w + x) * 4 + 3]; };

// ---------- oase ----------

const bones = [], byName = {};
/** Os definit în coordonate de lume (poza de bază); se convertește în coordonatele părintelui. */
function bone(name, parent, wx, wy, wrot = 0, length = 0, extra = {}) {
  const P = parent ? byName[parent] : { wx: 0, wy: 0, wrot: 0 };
  const [lx, ly] = rot([wx - P.wx, wy - P.wy], -P.wrot);
  const b = { name, ...(parent ? { parent } : {}), x: r2(lx), y: r2(ly), rotation: r2(wrot - P.wrot), length, ...extra };
  bones.push(b);
  byName[name] = { ...b, wx, wy, wrot, index: bones.length - 1 };
  return b;
}
const toLocal = (name, [wx, wy]) => { const b = byName[name]; return rot([wx - b.wx, wy - b.wy], -b.wrot); };

// Plasarea pieselor în lume (poza de bază), aceeași ca la scheletul inițial: os + pivot + scară + aliniere.
const place = (B, boneRot, pivot, s, align) => {
  const a = align ? -deg(Math.atan2(-align[1], align[0])) : 0;
  return (ax, ay) => { const [x, y] = rot(rot([(ax - pivot[0]) * s, (pivot[1] - ay) * s], a), boneRot); return [B[0] + x, B[1] + y]; };
};
const W = {
  body: place([0, 260], 0, [286, 176], 0.64),
  head: place([154, 338], 0, [592, 263], 0.5),
  tail: place([-143, 291], 180, [1490, 167], 0.7, [-400, 71]),
};
const headC = (cx, cy) => W.head(cx + 548, cy + 8); // coordonate „c” ale capului → lume

bone('root', null, 0, 0);
bone('body', 'root', 0, 260, 0, 125);
bone('chest', 'body', 55, 268, 8, 110);
const neckBase = headC(40, 236), skull = headC(176, 140);
bone('neck', 'chest', neckBase[0], neckBase[1], deg(Math.atan2(skull[1] - neckBase[1], skull[0] - neckBase[0])), Math.hypot(skull[0] - neckBase[0], skull[1] - neckBase[1]));
bone('head', 'neck', skull[0], skull[1], 0, 165);
const hinge = headC(...HINGE), chin = headC(480, 214);
bone('jaw', 'head', hinge[0], hinge[1], deg(Math.atan2(chin[1] - hinge[1], chin[0] - hinge[0])), Math.hypot(chin[0] - hinge[0], chin[1] - hinge[1]));

// Coada: linia de mijloc a piesei, împărțită în patru oase.
const T = pieces.tail, mid = [];
for (let ax = T.ox + T.w - 6; ax > T.ox + 4; ax -= 4) {
  let top = -1, bottom = -1;
  for (let ay = T.oy; ay < T.oy + T.h; ay++) if (alphaAt(T, ax, ay) > 100) { if (top < 0) top = ay; bottom = ay; }
  if (top >= 0) mid.push(W.tail(ax, (top + bottom) / 2));
}
const along = [0];
for (let i = 1; i < mid.length; i++) along.push(along[i - 1] + Math.hypot(mid[i][0] - mid[i - 1][0], mid[i][1] - mid[i - 1][1]));
const tailLen = along.at(-1);
const tailAt = (s) => { const d = s * tailLen; let i = 1; while (i < mid.length - 1 && along[i] < d) i++; const u = (d - along[i - 1]) / (along[i] - along[i - 1] || 1); return [lerp(mid[i - 1][0], mid[i][0], u), lerp(mid[i - 1][1], mid[i][1], u)]; };
const TAIL_S = [0.1, 0.32, 0.54, 0.76, 1];
const TAIL = ['tail1', 'tail2', 'tail3', 'tail4'];
TAIL.forEach((name, i) => {
  const a = tailAt(TAIL_S[i]), b = tailAt(TAIL_S[i + 1]);
  bone(name, i ? TAIL[i - 1] : 'body', a[0], a[1], deg(Math.atan2(b[1] - a[1], b[0] - a[0])), Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
});

// Picioare: IK pe două segmente; glezna se ține pe sol, laba rămâne orizontală.
const L1 = 128, L2 = 112;
const LEGS = {
  far: { hip: [-74, -4], ankle: [-44, 52], color: '9aa7a6ff' },
  near: { hip: [-112, -10], ankle: [-112, 52], color: null },
};
function solveLeg(side, bodyX, bodyY, bodyRot, ankleX, ankleY) {
  const L = LEGS[side];
  const [lx, ly] = rot([ankleX - bodyX, ankleY - bodyY], -bodyRot);
  const dx = lx - L.hip[0], dy = ly - L.hip[1], d = clamp(Math.hypot(dx, dy), 30, L1 + L2 - 0.01);
  const upper = deg(Math.atan2(dy, dx) + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)));
  const lower = -deg(Math.acos(clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1)));
  return { upper, lower, foot: -bodyRot - upper - lower, reach: Math.hypot(dx, dy) };
}
for (const side of ['far', 'near']) {
  const L = LEGS[side], s = solveLeg(side, 0, 260, 0, L.ankle[0], L.ankle[1]);
  L.setup = s;
  const hipW = [L.hip[0], 260 + L.hip[1]];
  bone(side + 'Thigh', 'body', hipW[0], hipW[1], s.upper, L1);
  const knee = [hipW[0] + L1 * Math.cos(rad(s.upper)), hipW[1] + L1 * Math.sin(rad(s.upper))];
  bone(side + 'Shin', side + 'Thigh', knee[0], knee[1], s.upper + s.lower, L2);
  bone(side + 'Foot', side + 'Shin', L.ankle[0], L.ankle[1], 0, 105);
}
const ARMS = { far: [79, 262, 'a3aeadff'], near: [97, 252, null] };
for (const [side, [x, y]] of Object.entries(ARMS)) {
  bone(side + 'Arm', 'chest', x, y, -40, 52);
  bone(side + 'Hand', side + 'Arm', x + 52 * Math.cos(rad(-40)), y + 52 * Math.sin(rad(-40)), -25, 50);
}
bone('hipCover', 'body', -112, 250, 0, 0);

// ---------- mesh-uri ----------

const slots = [], attachments = {};
/** Mesh pe grilă peste pixelii piesei. weights(ax, ay) → [[os, pondere], …] ; world(ax, ay) → [x, y]. */
function gridMesh(p, step, world, weights) {
  const nx = Math.ceil(p.w / step), ny = Math.ceil(p.h / step), index = new Map(), verts = [], uvs = [], tris = [];
  const vertex = (i, j) => {
    const key = j * (nx + 1) + i;
    if (index.has(key)) return index.get(key);
    const ax = p.ox + Math.min(i * step, p.w), ay = p.oy + Math.min(j * step, p.h);
    index.set(key, uvs.length / 2);
    uvs.push(...uvOf(p, ax, ay));
    const w = world(ax, ay), list = weights(ax, ay, w).filter(([, k]) => k > 0.001), sum = list.reduce((s, [, k]) => s + k, 0);
    verts.push(list.length);
    for (const [name, k] of list) { const [lx, ly] = toLocal(name, w); verts.push(byName[name].index, r2(lx), r2(ly), Math.round((k / sum) * 1000) / 1000); }
    return index.get(key);
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let any = false;
      for (let y = j * step - 1; y <= (j + 1) * step && !any; y++) for (let x = i * step - 1; x <= (i + 1) * step && !any; x++) if (x >= 0 && y >= 0 && x < p.w && y < p.h && p.data[(y * p.w + x) * 4 + 3] > 0) any = true;
      if (!any) continue;
      const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i + 1, j + 1), d = vertex(i, j + 1);
      tris.push(a, b, c, a, c, d);
    }
  return { type: 'mesh', path: p.name, uvs: uvs.map((v) => Math.round(v * 1e5) / 1e5), triangles: tris, vertices: verts, hull: 0, width: p.w, height: p.h };
}
/** Mesh rigid (un os), pe conturul convex al piesei, plasat ca la scheletul inițial. */
function rigidMesh(p, pivot, s, align) {
  const a = align ? -deg(Math.atan2(-align[1], align[0])) : 0, pts = [];
  for (let y = 0; y < p.h; y += 2) {
    let l = -1, r = -1;
    for (let x = 0; x < p.w; x++) if (p.data[(y * p.w + x) * 4 + 3] > 0) { if (l < 0) l = x; r = x; }
    if (l >= 0) pts.push([p.ox + l - 1, p.oy + y - 1], [p.ox + r + 2, p.oy + y - 1], [p.ox + l - 1, p.oy + y + 3], [p.ox + r + 2, p.oy + y + 3]);
  }
  const hull = convexHull(pts), vertices = [], uvs = [], triangles = [];
  for (const [ax, ay] of hull) { vertices.push(...rot([(ax - pivot[0]) * s, (pivot[1] - ay) * s], a).map(r2)); uvs.push(...uvOf(p, ax, ay)); }
  for (let i = 1; i < hull.length - 1; i++) triangles.push(0, i, i + 1);
  return { type: 'mesh', path: p.name, uvs, triangles, vertices, hull: hull.length, width: p.w * s, height: p.h * s };
}
function slot(name, boneName, attachment, extra = {}) {
  slots.push({ name, bone: boneName, attachment: name, ...extra });
  attachments[name] = { [name]: attachment };
}

const legMeshes = {
  Thigh: () => rigidMesh(pieces.thigh, [181, 413], L1 / Math.hypot(202, 195), [202, 195]),
  Shin: () => rigidMesh(pieces.shin, [870, 394], L2 / Math.hypot(-190, 247), [-190, 247]),
  Calf: () => rigidMesh(pieces.calf, [90 + 300, 336 + 252], 0.4, [-178, 84]),
  Foot: () => rigidMesh(pieces.foot, [1121, 418], 0.225),
};
const armMeshes = { Arm: () => rigidMesh(pieces.upperarm, [194, 782], 0.23, [173, 181]), Hand: () => rigidMesh(pieces.forearm, [688, 790], 0.21, [174, 82]) };
const tailWeights = (ax, ay, w) => {
  // parametrul de-a lungul cozii: proiecția pe linia de mijloc
  let best = 0, bestD = Infinity;
  for (let i = 0; i < mid.length; i++) { const d = Math.hypot(mid[i][0] - w[0], mid[i][1] - w[1]); if (d < bestD) { bestD = d; best = i; } }
  const s = along[best] / tailLen;
  const out = [];
  if (s < TAIL_S[0] + 0.06) out.push(['body', 1 - smooth((s - TAIL_S[0] + 0.06) / 0.12)]);
  TAIL.forEach((name, i) => {
    const a = TAIL_S[i], b = TAIL_S[i + 1], blend = 0.07;
    const k = (i === 0 ? smooth((s - a + blend) / (2 * blend)) : smooth((s - a + blend) / (2 * blend))) * (i === TAIL.length - 1 ? 1 : 1 - smooth((s - b + blend) / (2 * blend)));
    out.push([name, k]);
  });
  return out;
};
const bodyWeights = (ax, ay, [x]) => { const k = smooth((x + 5) / 110); return [['body', 1 - k], ['chest', k]]; };
const headWeights = (ax) => { const cxp = ax - 548, k = smooth((cxp - 100) / 95), base = 1 - smooth((cxp - 10) / 50); return [['chest', base * 0.5], ['neck', (1 - k) * (1 - base * 0.5)], ['head', k]]; };

// ordinea de desen (din spate în față)
for (const part of ['Thigh', 'Shin', 'Foot']) slot('far' + part, 'far' + part, legMeshes[part](), { color: LEGS.far.color });
slot('farCalf', 'farShin', legMeshes.Calf(), { color: LEGS.far.color });
for (const part of ['Arm', 'Hand']) slot('far' + part, 'far' + part, armMeshes[part](), { color: ARMS.far[2] });
slot('tail', 'tail1', gridMesh(pieces.tail, 16, W.tail, tailWeights));
// interiorul gurii: o bandă între gingia de sus (os: head) și cea de jos (os: jaw); se întinde doar când gura se deschide
{
  const top = [], bottom = [];
  for (let x = HINGE[0] + 2; x <= 484; x += 12) { top.push(headC(x, gumY(x) - 6)); bottom.push(headC(x, gumY(x) + 8)); }
  const n = top.length, m = pieces.mouth, vertices = [], uvs = [], triangles = [];
  [...top, ...bottom].forEach((w, i) => {
    const name = i < n ? 'head' : 'jaw', [lx, ly] = toLocal(name, w);
    vertices.push(1, byName[name].index, r2(lx), r2(ly), 1);
    uvs.push(((i % n) / (n - 1)) * 0.9 + 0.05, i < n ? 0.05 : 0.95);
  });
  for (let i = 0; i < n - 1; i++) triangles.push(i, i + 1, n + i + 1, i, n + i + 1, n + i);
  slot('mouth', 'head', { type: 'mesh', path: 'mouth', vertices, uvs, triangles, hull: 0, width: 64, height: 64 });
}
slot('jaw', 'jaw', gridMesh(pieces.jaw, 18, W.head, () => [['jaw', 1]]));
slot('head', 'head', gridMesh(pieces.head, 20, W.head, headWeights));
slot('body', 'body', gridMesh(pieces.body, 22, W.body, bodyWeights));
for (const part of ['Thigh', 'Shin', 'Foot']) slot('near' + part, 'near' + part, legMeshes[part]());
slot('nearCalf', 'nearShin', legMeshes.Calf());
for (const part of ['Arm', 'Hand']) slot('near' + part, 'near' + part, armMeshes[part]());
slot('hipCover', 'hipCover', rigidMesh(pieces.hip, [1282, 852], 0.29));

// ---------- efecte (oase + sloturi, invizibile în afara atacurilor) ----------

const fxPix = pieces.fxPixel, fxUV = uvOf(fxPix, fxPix.ox + 4, fxPix.oy + 4);
function fxMesh(points, triangles) { return { type: 'mesh', path: 'fxPixel', vertices: points.flat().map(r2), uvs: points.flatMap(() => fxUV), triangles, hull: points.length, width: 1, height: 1 }; }
function polygon(points) { const t = []; for (let i = 1; i < points.length - 1; i++) t.push(0, i, i + 1); return fxMesh(points, t); }
function ring(rx, ry, width, n = 64) {
  const pts = [], t = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.cos(a) * (rx - width), Math.sin(a) * (ry - width * 0.3)], [Math.cos(a) * rx, Math.sin(a) * ry]); }
  for (let i = 0; i < n; i++) { const a = i * 2, b = ((i + 1) % n) * 2; t.push(a, b, a + 1, a + 1, b, b + 1); }
  return fxMesh(pts, t);
}
/** Arc gros la mijloc și subțire la capete (urmă de colți / undă de răget). */
function crescent(r, width, a0, a1, n = 24) {
  const pts = [], t = [];
  for (let i = 0; i <= n; i++) { const u = i / n, a = rad(lerp(a0, a1, u)), w = width * Math.sin(Math.PI * u); pts.push([Math.cos(a) * (r - w), Math.sin(a) * (r - w)], [Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i < n; i++) t.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  return fxMesh(pts, t);
}
function star(radius, count = 4) {
  const pts = [[0, 0]], t = [];
  for (let i = 0; i < count * 2; i++) { const a = (i / count) * Math.PI, r = i % 2 ? radius * 0.17 : radius; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i < count * 2; i++) t.push(0, i + 1, ((i + 1) % (count * 2)) + 1);
  return fxMesh(pts, t);
}
const fxBones = [];
function fxBone(name, parent, wx, wy) { bone(name, parent, wx, wy, 0, 0); fxBones.push(name); return name; }
let fxSerial = 0;
/** Slot de efect: culoarea de bază are alfa 0; animația îi dă alfa prin chei [timp, alfa]. */
function fx(anim, boneName, shape, rgb, alpha, { behind = false, additive = true } = {}) {
  const name = `fx_${boneName}_${fxSerial++}`;
  const data = { name, bone: boneName, attachment: name, color: rgb + '00', blend: additive ? 'additive' : 'normal' };
  if (behind) slots.unshift(data);
  else slots.push(data);
  attachments[name] = { [name]: shape };
  (anim.slots ??= {})[name] = { color: alpha.map(([time, a]) => ({ time: r2(time), color: rgb + Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0') })) };
  return name;
}

// ---------- animații ----------

const FPS = 30;
/** Eșantionează o funcție de poză și scrie cheile (rotații față de poza de bază, deplasări). */
function bake(duration, poseAt, fxTracks = {}) {
  const anim = { bones: {} };
  const put = (b, kind, key) => ((anim.bones[b] ??= {})[kind] ??= []).push(key);
  const n = Math.round(duration * FPS);
  for (let i = 0; i <= n; i++) {
    const t = Math.min(duration, i / FPS), p = poseAt(t);
    const bx = p.body.x, by = 260 + p.body.y, br = p.body.rot;
    put('body', 'translate', { time: r2(t), x: r2(bx), y: r2(p.body.y) });
    put('body', 'rotate', { time: r2(t), angle: r2(br) });
    for (const name of ['chest', 'neck', 'head', 'jaw', ...TAIL]) put(name, 'rotate', { time: r2(t), angle: r2(p[name] ?? 0) });
    if (p.chestScale) put('chest', 'scale', { time: r2(t), x: r2(1 + p.chestScale * 0.4), y: r2(1 + p.chestScale) });
    for (const side of ['near', 'far']) {
      const L = LEGS[side], f = p.feet[side], s = solveLeg(side, bx, by, br, f[0], f[1]);
      put(side + 'Thigh', 'rotate', { time: r2(t), angle: r2(s.upper - L.setup.upper) });
      put(side + 'Shin', 'rotate', { time: r2(t), angle: r2(s.lower - L.setup.lower) });
      put(side + 'Foot', 'rotate', { time: r2(t), angle: r2(s.foot - L.setup.foot + (f[2] ?? 0)) });
      put(side + 'Arm', 'rotate', { time: r2(t), angle: r2(p.arms[side][0]) });
      put(side + 'Hand', 'rotate', { time: r2(t), angle: r2(p.arms[side][1]) });
    }
  }
  for (const [b, tracks] of Object.entries(fxTracks)) anim.bones[b] = { ...(anim.bones[b] ?? {}), ...tracks };
  return anim;
}
const still = () => ({ near: [LEGS.near.ankle[0], LEGS.near.ankle[1]], far: [LEGS.far.ankle[0], LEGS.far.ankle[1]] });
const TAU = Math.PI * 2;

// Curbele dragonilor, cu timp remapat: map = [[timp dino, timp dragon], …]
function dragon(name, map) {
  const d = MOTION.animations[name], n = d.waist.length;
  return (t, key) => {
    const td = keysLinear(t, map), f = clamp((td / d.duration) * (n - 1), 0, n - 1), i = Math.floor(f), u = f - i, arr = d[key];
    return lerp(arr[i], arr[Math.min(n - 1, i + 1)], u);
  };
}
function keysLinear(t, list) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 0; i < list.length - 1; i++) if (t <= list[i + 1][0]) return lerp(list[i][1], list[i + 1][1], (t - list[i][0]) / (list[i + 1][0] - list[i][0]));
  return list.at(-1)[1];
}

// --- repaus: respirație, privire, coada în val, gura care respiră
const IDLE = 3.2;
const idle = bake(IDLE, (t) => {
  const w = (TAU * t) / IDLE, b = Math.sin(w);
  const pose = { body: { x: 0, y: 3.5 * b, rot: 1.4 * b }, chest: 1.8 * Math.sin(w + 0.6), chestScale: 0.012 * Math.sin(w + 0.3) };
  pose.neck = 4 * Math.sin(w + 1.1) - 1.4 * b;
  pose.head = -3 * Math.sin(w + 1.4) + 2.2 * Math.sin(2 * w + 0.4);
  pose.jaw = -2 - 4.5 * smooth(0.5 + 0.5 * Math.sin(w - 1.2)) - 6 * env((t % IDLE) / IDLE, 0.55, 0.62, 0.66, 0.74);
  TAIL.forEach((name, i) => (pose[name] = (3 + i * 1.6) * Math.sin(w - 0.7 * i) + 1.2 * Math.sin(2 * w - 0.9 * i)));
  pose.arms = { near: [5 * Math.sin(2 * w + 0.3), 6 * Math.sin(2 * w + 1.1)], far: [5 * Math.sin(2 * w + 0.9), 6 * Math.sin(2 * w + 1.7)] };
  pose.feet = still();
  return pose;
});

// --- mers: pași alternați cu labe pe sol, corpul săltat, coada și capul în contra-fază
const WALK = 1.2, STRIDE = 104, LIFT = 42;
const walk = bake(WALK, (t) => {
  const ph = t / WALK, w = TAU * ph, bob = 5 * (1 - Math.cos(2 * w));
  const pose = { body: { x: 0, y: -bob + 3, rot: 1.8 * Math.sin(2 * w + 0.6) }, chest: -1.5 * Math.sin(2 * w + 1) };
  pose.neck = 4 * Math.sin(2 * w + 1.4);
  pose.head = -4 * Math.sin(2 * w + 1.8);
  pose.jaw = -3 - 2 * Math.sin(2 * w);
  TAIL.forEach((name, i) => (pose[name] = (4 + i * 2.2) * Math.sin(w - 0.8 * i - 0.5)));
  pose.feet = {};
  pose.arms = {};
  for (const side of ['near', 'far']) {
    const L = LEGS[side], p = (ph + (side === 'far' ? 0.5 : 0)) % 1;
    let x, y, tilt = 0;
    if (p < 0.6) { x = L.ankle[0] + STRIDE / 2 - (STRIDE * p) / 0.6; y = L.ankle[1]; }
    else { const u = (p - 0.6) / 0.4; x = L.ankle[0] - STRIDE / 2 + STRIDE * smooth(u); y = L.ankle[1] + LIFT * Math.sin(Math.PI * u); tilt = -18 * Math.sin(Math.PI * u) + 10 * Math.sin(TAU * u); }
    pose.feet[side] = [x, y, tilt];
    pose.arms[side] = [9 * Math.sin(TAU * p), 8 * Math.sin(TAU * p - 0.8)];
  }
  return pose;
});

// --- atac: mușcătură. Curbele „attack” ale dragonului (ridicare, lovitură în jos, revenire) + fălci deschise larg,
//     un pas înainte, clănțănit la impact și o scuturătură a capului.
const ATTACK = 2.1, BITE = 1.0;
const dA = dragon('attack', [[0, 0], [ATTACK, MOTION.animations.attack.duration]]);
const attack = { bones: {} };
const mouthTip = (p) => {
  // poziția vârfului botului în lume pentru o poză (cinematică directă pe lanț)
  let x = p.body.x, y = 260 + p.body.y, r = p.body.rot;
  const chain = [['chest', p.chest], ['neck', p.neck], ['head', p.head]];
  for (const [name, a] of chain) { const b = byName[name], [dx, dy] = rot([b.x, b.y], r); x += dx; y += dy; r += b.rotation + a; }
  const [dx, dy] = rot([165, -22], r);
  return [x + dx, y + dy, r];
};
const attackPose = (t) => {
  const lunge = 72 * env(t, 0.78, 0.98, 1.2, 1.75), back = dA(t, 'pelvisX') * 0.32;
  const pose = { body: { x: back + lunge, y: dA(t, 'pelvisY') * 0.6 - 10 * env(t, 0.85, 1.0, 1.15, 1.6), rot: dA(t, 'waist') * 0.55 } };
  pose.chest = dA(t, 'chest') * 0.3;
  const shake = 7 * Math.sin(TAU * 7.5 * (t - BITE)) * env(t, BITE, BITE + 0.05, BITE + 0.35, BITE + 0.6);
  pose.neck = dA(t, 'neck') * 0.75;
  pose.head = dA(t, 'head') * 0.85 + shake;
  pose.jaw = keys(t, [[0, -2], [0.35, -8], [0.62, -40], [0.9, -44], [BITE, 0], [1.1, -9], [1.2, 0], [1.32, -6], [1.45, 0], [ATTACK, -2]]);
  TAIL.forEach((name, i) => (pose[name] = dA(t, ['tail1', 'tail2', 'tail3', 'tail3'][i]) * (1.1 + i * 0.25) + (i === 3 ? 4 * Math.sin(TAU * 1.5 * t) * env(t, 0.5, 0.9, 1.4, 1.9) : 0)));
  const arm = dA(t, 'arm') * 0.5;
  pose.arms = { near: [arm, -arm * 0.6 + 10 * env(t, 0.9, 1.0, 1.1, 1.4)], far: [arm * 0.85, -arm * 0.5] };
  const f = still(), step = env(t, 0.72, 0.95, 1.45, 1.75);
  const lift = 36 * Math.sin(Math.PI * clamp((t - 0.72) / 0.23, 0, 1)) + 30 * Math.sin(Math.PI * clamp((t - 1.45) / 0.3, 0, 1));
  pose.feet = { near: [f.near[0] + 58 * step, f.near[1] + lift, -12 * Math.sin(Math.PI * clamp((t - 0.72) / 0.23, 0, 1))], far: [f.far[0], f.far[1]] };
  return pose;
};
const biteAt = mouthTip(attackPose(BITE));

// efectele mușcăturii: fulger la bot, două urme de colți care se închid, cioburi și trei cristale în fața botului
{
  const flash = fxBone('fxBite', 'root', biteAt[0] + 20, biteAt[1] - 6);
  fx(attack, flash, star(110, 6), 'bffcff', [[0, 0], [BITE - 0.02, 0], [BITE + 0.03, 1], [BITE + 0.14, 0.5], [BITE + 0.32, 0], [ATTACK, 0]]);
  fx(attack, flash, ring(60, 60, 5), 'fff0bb', [[0, 0], [BITE, 0], [BITE + 0.04, 0.9], [BITE + 0.3, 0], [ATTACK, 0]]);
  attack.bones[flash] = { scale: [{ time: 0, x: 0.1, y: 0.1 }, { time: BITE, x: 0.2, y: 0.2 }, { time: BITE + 0.06, x: 1, y: 1 }, { time: BITE + 0.32, x: 1.9, y: 1.9 }, { time: ATTACK, x: 0.1, y: 0.1 }], rotate: [{ time: 0, angle: 0 }, { time: BITE + 0.32, angle: 45 }, { time: ATTACK, angle: 45 }] };
  for (const [k, sign] of [[0, 1], [1, -1]]) {
    const b = fxBone('fxFang' + k, 'root', biteAt[0] + 30, biteAt[1]);
    fx(attack, b, crescent(95, 26, sign > 0 ? 200 : 20, sign > 0 ? 340 : 160), k ? '9dffff' : 'ffffff', [[0, 0], [BITE - 0.16, 0], [BITE - 0.08, 0.85], [BITE + 0.05, 1], [BITE + 0.28, 0], [ATTACK, 0]]);
    attack.bones[b] = {
      translate: [{ time: 0, x: 0, y: 80 * sign }, { time: BITE - 0.16, x: 0, y: 80 * sign }, { time: BITE, x: 0, y: 8 * sign }, { time: BITE + 0.28, x: 16, y: 0 }, { time: ATTACK, x: 0, y: 0 }],
      scale: [{ time: 0, x: 0.7, y: 0.7 }, { time: BITE - 0.16, x: 0.7, y: 0.7 }, { time: BITE, x: 1, y: 1 }, { time: BITE + 0.28, x: 1.35, y: 1.2 }, { time: ATTACK, x: 1, y: 1 }],
    };
  }
  for (let i = 0; i < 3; i++) {
    const b = fxBone('fxBiteCrystal' + i, 'root', biteAt[0] + 40 + i * 70, 2), h = [150, 210, 170][i], start = BITE + 0.02 + i * 0.05, peak = start + 0.12;
    const region = { type: 'region', path: 'fxCrystal', x: 0, y: h * 0.5, width: (h * crystal.width) / crystal.height, height: h };
    fx(attack, b, region, 'ffffff', [[0, 0], [start, 0], [peak, 0.95], [1.62 + i * 0.04, 0.9], [1.9 + i * 0.04, 0], [ATTACK, 0]], { additive: false });
    fx(attack, b, { ...region }, '73ffff', [[0, 0], [start, 0], [peak, 0.25], [1.7, 0], [ATTACK, 0]]);
    attack.bones[b] = { scale: [{ time: 0, x: 0.2, y: 0.01 }, { time: start, x: 0.3, y: 0.01 }, { time: peak, x: 1, y: 1.12 }, { time: peak + 0.08, x: 1, y: 1 }, { time: 1.6 + i * 0.04, x: 1, y: 1 }, { time: 1.9 + i * 0.04, x: 0.5, y: 0.03 }, { time: ATTACK, x: 0.2, y: 0.01 }], rotate: [{ time: 0, angle: 0 }, { time: peak, angle: (i % 2 ? -1 : 1) * (6 + i * 3) }, { time: ATTACK, angle: 0 }] };
  }
  for (let i = 0; i < 7; i++) {
    const b = fxBone('fxBiteShard' + i, 'root', biteAt[0] + 10, biteAt[1]), a = rad(-50 + i * 17), sp = 150 + (i % 3) * 60;
    fx(attack, b, polygon([[0, 16], [6, 0], [0, -9], [-6, 0]]), i % 2 ? 'baffff' : 'ffe8ab', [[0, 0], [BITE, 0], [BITE + 0.04, 1], [BITE + 0.4, 0.7], [BITE + 0.62, 0], [ATTACK, 0]]);
    const tr = [{ time: 0, x: 0, y: 0 }, { time: BITE, x: 0, y: 0 }];
    for (let k = 1; k <= 8; k++) { const u = k / 8, tt = BITE + u * 0.62; tr.push({ time: r2(tt), x: r2(Math.cos(a) * sp * u * 1.6 + 40 * u), y: r2(Math.sin(a) * sp * u * 1.2 - 160 * u * u) }); }
    tr.push({ time: ATTACK, x: 0, y: 0 });
    attack.bones[b] = { translate: tr, rotate: [{ time: 0, angle: 0 }, { time: BITE + 0.62, angle: 220 + i * 25 }, { time: ATTACK, angle: 0 }] };
  }
  // praf sub laba care calcă înainte
  const dust = fxBone('fxStep', 'root', LEGS.near.ankle[0] + 70, 6);
  fx(attack, dust, ring(70, 13, 5), 'c7ffff', [[0, 0], [0.94, 0], [0.98, 0.7], [1.3, 0], [ATTACK, 0]]);
  attack.bones[dust] = { scale: [{ time: 0, x: 0.2, y: 0.2 }, { time: 0.95, x: 0.3, y: 0.3 }, { time: 1.3, x: 1.8, y: 1.6 }, { time: ATTACK, x: 0.2, y: 0.2 }] };
}
Object.assign(attack.bones, bake(ATTACK, attackPose).bones);

// --- ultimata „Ruptura Riftului”: se ghemuiește încărcând runele, se ridică și rage spre cer (unde din bot),
//     calcă apăsat, iar cristalele erup în cascadă. Corpul urmează curbele „special1” ale dragonului.
const ULT = 4.0, STOMP = 2.72;
const dS = dragon('special1', [[0, 0], [0.9, 0.6], [2.55, 1.85], [2.95, 2.2], [ULT, 2.5]]);
const ultimate = { bones: {} };
const ultPose = (t) => {
  const rear = env(t, 0.9, 1.4, 2.35, 2.7);
  const pose = { body: { x: dS(t, 'pelvisX') * 0.35, y: dS(t, 'pelvisY') * 1.1 + 14 * rear, rot: (dS(t, 'waist') + dS(t, 'chest')) * 0.55 } };
  pose.chest = dS(t, 'chest') * 0.22;
  pose.chestScale = 0.05 * env(t, 0.2, 0.8, 1.0, 1.3) + 0.03 * rear;
  const tremble = Math.sin(TAU * 11 * t) * env(t, 1.15, 1.35, 2.3, 2.5);
  pose.neck = dS(t, 'neck') * 0.8 + 2 * tremble;
  pose.head = dS(t, 'head') * 0.8 + 2.5 * tremble;
  pose.jaw = keys(t, [[0, -2], [0.6, -6], [0.95, -10], [1.15, -46], [2.35, -48], [STOMP - 0.05, -4], [STOMP + 0.05, -16], [3.2, -24], [3.6, -6], [ULT, -2]]) + 3 * tremble;
  TAIL.forEach((name, i) => (pose[name] = dS(t, ['tail1', 'tail2', 'tail3', 'tail3'][i]) * (0.9 + i * 0.2) + 5 * Math.sin(TAU * 1.2 * t - i * 0.8) * rear));
  const arms = 26 * rear;
  pose.arms = { near: [arms + 6 * tremble, -arms * 0.4 + 5 * tremble], far: [arms * 0.85 - 4 * tremble, -arms * 0.3] };
  const f = still(), up = env(t, 1.6, 2.3, 2.45, STOMP);
  pose.feet = { near: [f.near[0] + 26 * env(t, 1.6, 2.3, 3.4, 3.9), f.near[1] + 66 * up, -20 * up], far: [f.far[0], f.far[1]] };
  return pose;
};
const roarAt = mouthTip(ultPose(1.8));
{
  // aura de încărcare în spatele corpului + scântei care orbitează
  const aura = fxBone('fxCharge', 'body', -20, 290);
  for (const [r, w, rgb, a] of [[210, 8, '45edff', 0.8], [228, 4, 'ffe8a6', 0.65], [218, 24, '258bff', 0.17], [225, 34, '247abf', 0.06]])
    fx(ultimate, aura, ring(r, r * 0.65, w), rgb, [[0, 0], [0.2, 0], [0.8, a * 0.5], [1.3, a], [2.4, a * 0.9], [STOMP, a], [STOMP + 0.25, 0], [ULT, 0]], { behind: true });
  ultimate.bones[aura] = { scale: [{ time: 0, x: 0.6, y: 0.6 }, { time: 1.0, x: 1, y: 1 }, { time: 2.4, x: 1.12, y: 1.12 }, { time: STOMP + 0.2, x: 1.5, y: 1.5 }, { time: ULT, x: 1, y: 1 }] };
  for (const name of ['body', 'head', 'jaw', 'hipCover']) fx(ultimate, name, structuredClone(attachments[name][name]), '7cf7ff', [[0, 0], [0.3, 0], [0.9, 0.12], [1.3, 0.24], [2.0, 0.14], [STOMP - 0.05, 0.3], [STOMP + 0.2, 0.05], [3.2, 0], [ULT, 0]]);
  for (let i = 0; i < 6; i++) {
    const b = fxBone('fxChargeSpark' + i, 'body', 0, 260), ph = (i / 6) * TAU;
    fx(ultimate, b, star(10), 'b8ffff', [[0, 0], [0.3, 0], [0.7, 0.9], [2.4, 1], [STOMP, 0], [ULT, 0]]);
    const tr = [];
    for (let k = 0; k <= 36; k++) { const tt = 0.3 + (k / 36) * (STOMP - 0.3), a = ph + (k / 36) * TAU * 2.2, rr = lerp(240, 150, k / 36); tr.push({ time: r2(tt), x: r2(Math.cos(a) * rr), y: r2(Math.sin(a) * rr * 0.62 + 30) }); }
    ultimate.bones[b] = { translate: tr };
  }
  // undele răgetului: inele care pleacă din bot, de-a lungul direcției capului
  for (let i = 0; i < 4; i++) {
    const start = 1.2 + i * 0.3, b = fxBone('fxRoar' + i, 'root', roarAt[0], roarAt[1]), dir = roarAt[2];
    fx(ultimate, b, crescent(70, 14, -70, 70), i % 2 ? 'fff0bb' : 'c7ffff', [[0, 0], [start, 0], [start + 0.06, 0.9], [start + 0.5, 0], [ULT, 0]]);
    const [dx, dy] = rot([260, 0], dir);
    ultimate.bones[b] = {
      rotate: [{ time: 0, angle: r2(dir) }],
      translate: [{ time: 0, x: 0, y: 0 }, { time: start, x: 0, y: 0 }, { time: start + 0.5, x: r2(dx), y: r2(dy) }, { time: ULT, x: 0, y: 0 }],
      scale: [{ time: 0, x: 0.2, y: 0.3 }, { time: start, x: 0.25, y: 0.35 }, { time: start + 0.5, x: 1.7, y: 2.4 }, { time: ULT, x: 0.2, y: 0.3 }],
    };
  }
  const roarFlash = fxBone('fxRoarFlash', 'root', roarAt[0], roarAt[1]);
  fx(ultimate, roarFlash, star(90, 8), '9dffff', [[0, 0], [1.1, 0], [1.2, 0.8], [1.4, 0.3], [2.3, 0.25], [2.45, 0], [ULT, 0]]);
  ultimate.bones[roarFlash] = { rotate: [{ time: 0, angle: 0 }, { time: 2.45, angle: 140 }, { time: ULT, angle: 140 }] };
  // impactul călcăturii: unde pe sol, fixe în scenă
  const stompX = LEGS.near.ankle[0] + 26 + 40;
  const impact = fxBone('fxImpact', 'root', stompX, 8);
  for (const [rx, ry, w, rgb, a] of [[95, 17, 6, 'c7ffff', 0.95], [95, 17, 17, '45cfff', 0.24], [115, 21, 3, 'ffe3a0', 0.8]])
    fx(ultimate, impact, ring(rx, ry, w), rgb, [[0, 0], [STOMP - 0.02, 0], [STOMP + 0.08, a], [STOMP + 0.4, a * 0.8], [STOMP + 0.8, a * 0.3], [STOMP + 1.1, 0], [ULT, 0]]);
  ultimate.bones[impact] = { scale: [{ time: 0, x: 0.02, y: 0.02 }, { time: STOMP - 0.02, x: 0.02, y: 0.02 }, { time: STOMP + 0.1, x: 1, y: 1 }, { time: STOMP + 0.4, x: 2.3, y: 2.3 }, { time: STOMP + 0.8, x: 3.8, y: 3.8 }, { time: STOMP + 1.1, x: 4.4, y: 4.4 }, { time: ULT, x: 0.02, y: 0.02 }] };
  // cascada de cristale, de la labă înainte
  for (let i = 0; i < 6; i++) {
    const b = fxBone('fxCrystal' + i, 'root', 250 + i * 105, 4), h = [240, 330, 290, 400, 350, 300][i], start = STOMP + 0.06 + i * 0.07, peak = start + 0.15;
    const region = { type: 'region', path: 'fxCrystal', x: 0, y: h * 0.5, width: (h * crystal.width) / crystal.height, height: h };
    fx(ultimate, b, region, i % 2 ? 'e4efff' : 'ffffff', [[0, 0], [start, 0], [peak, 0.95], [3.45 + i * 0.03, 0.92], [3.85, 0], [ULT, 0]], { additive: false });
    fx(ultimate, b, { ...region }, '73ffff', [[0, 0], [start, 0], [peak, 0.22], [3.4, 0.08], [3.85, 0], [ULT, 0]]);
    fx(ultimate, b, star(14), 'cfffff', [[0, 0], [start, 0], [peak, 0.95], [peak + 0.18, 0], [ULT, 0]]);
    ultimate.bones[b] = {
      scale: [{ time: 0, x: 0.1, y: 0.01 }, { time: start, x: 0.3, y: 0.01 }, { time: peak, x: 1, y: 1.14 }, { time: peak + 0.1, x: 1, y: 1 }, { time: 3.5 + i * 0.03, x: 1, y: 1 }, { time: 3.9, x: 0.5, y: 0.04 }, { time: ULT, x: 0.1, y: 0.01 }],
      rotate: [{ time: 0, angle: 0 }, { time: peak, angle: (i % 2 ? -1 : 1) * (5 + i) }, { time: ULT, angle: 0 }],
    };
  }
  for (let i = 0; i < 8; i++) {
    const b = fxBone('fxShard' + i, 'root', stompX + 60, 40), start = STOMP + 0.05 + i * 0.03;
    fx(ultimate, b, polygon([[0, 14], [5, 0], [0, -8], [-5, 0]]), i % 2 ? 'baffff' : 'ffe8ab', [[0, 0], [start, 0], [start + 0.06, 1], [STOMP + 0.7, 0.8], [STOMP + 1.1, 0], [ULT, 0]]);
    const tr = [{ time: 0, x: 0, y: 0 }, { time: r2(start), x: 0, y: 0 }];
    for (let k = 1; k <= 12; k++) { const u = k / 12; tr.push({ time: r2(start + u * 0.95), x: r2(u * (200 + i * 60)), y: r2(u * (300 + i * 20) - u * u * 300) }); }
    tr.push({ time: ULT, x: 0, y: 0 });
    ultimate.bones[b] = { translate: tr, rotate: [{ time: 0, angle: 0 }, { time: STOMP + 1, angle: 270 + i * 20 }, { time: ULT, angle: 0 }] };
  }
}
Object.assign(ultimate.bones, bake(ULT, ultPose).bones);

// ---------- scriere ----------

const skeleton = {
  skeleton: { spine: '3.8.99', name: 'Astravor · Crown of the Rift', x: -510, y: 0, width: 900, height: 540 },
  bones,
  slots,
  skins: [{ name: 'default', attachments }],
  animations: { idle, walk, attack, ultimate },
};
fs.writeFileSync(path.join(OUT, 'skeleton.json'), JSON.stringify(skeleton));
for (const old of ['attack.json', 'rig-layout.json']) fs.rmSync(path.join(OUT, old), { force: true });
const manifestFile = path.join(ROOT, 'public/dinosaurs/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const rig = manifest.rigs.find((r) => r.id === 'tyrannosaurus');
rig.animations = [
  { name: 'idle', label: 'Repaus', duration: IDLE, loop: true },
  { name: 'walk', label: 'Mers', duration: WALK, loop: true },
  { name: 'attack', label: 'Mușcătură', duration: ATTACK, loop: false },
  { name: 'ultimate', label: 'Ruptura Riftului', duration: ULT, loop: false },
];
rig.animationBounds = { attack: { x: -560, y: -18, width: 1300, height: 680 }, ultimate: { x: -560, y: -18, width: 1500, height: 760 } };
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log(`T-Rex: ${bones.length - fxBones.length} oase, ${fxBones.length} oase de efecte, ${slots.length} sloturi, atlas ${PAGE_W}×${PAGE_H}`);
