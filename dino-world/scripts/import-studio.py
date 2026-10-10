"""Aduce dinozaurii animați din rig-lab/tempest-studio în joc (public/dinosaurs/<specie>-<vârstă>/).

Studioul exportă pentru fiecare model straturi PNG de mărimea imaginii întregi (aproape goale) și animații coapte
cadru cu cadru la 60 Hz (~30 MB JSON). Pentru joc:
  - straturile se taie la conținut, se micșorează și se împachetează într-un singur atlas webp
    (parts.webp pentru scene, parts-map.webp la jumătate pentru hartă); coordonatele UV ale plaselor se refac;
  - oasele se răresc la 30 Hz; deformările plaselor se comprimă cu PCA (medie + componente + coeficienți pe cadru);
  - originea se mută la picioare (ca la T-Rex), ca dinozaurul să stea pe insulă;
  - „swim” devine „walk” (turma folosește aceleași nume).
Apoi se adaugă scheletele în public/dinosaurs/manifest.json.

    python scripts/import-studio.py            # toate
    python scripts/import-studio.py pyroceratops-pui
"""

import base64
import json
import math
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUDIO = os.path.join(ROOT, '..', 'rig-lab', 'tempest-studio', 'public')
OUT = os.path.join(ROOT, 'public', 'dinosaurs')

SPECIES = [
    'pyroceratops', 'cineraptor', 'pelagisaur', 'fluviovenator', 'ferrankyl', 'terratitan',
    'silvosteg', 'frondonychus', 'cryolophus', 'tundraceratops', 'tempestopteryx', 'fulgurodrome',
]
STAGES = ['pui', 'juvenil', 'adult']
NAMES = {'pui': 'Pui', 'juvenil': 'Juvenil', 'adult': 'Adult'}
BODY = {
    'pyroceratops': 'quadruped', 'ferrankyl': 'quadruped', 'terratitan': 'quadruped', 'silvosteg': 'quadruped',
    'tundraceratops': 'quadruped', 'pelagisaur': 'swimmer', 'tempestopteryx': 'flyer',
}
LABELS = {'idle': 'Repaus', 'walk': 'Mers', 'attack': 'Atac', 'ultimate': 'Ultimată'}
ONE_SHOT = {'attack', 'ultimate'}

SCENE_SCALE = 1  # scene (arenă, atlas, fișa): rezoluția studioului, ca suprapunerea de un pixel dintre straturi să rămână
MAP_SCALE = 0.5  # harta
PAGE_WIDTH = 4096
# Pe hartă textura e la jumătate: suprapunerea de un pixel dintre straturi ar dispărea și s-ar vedea fundalul prin
# rosturi. Acolo fiecare strat se lărgește cu atâția pixeli (din sursă) înainte de micșorare; scenele rămân exacte.
MAP_SEAL_PX = 2
PAD = 2
BONE_STEP = 2  # 60 Hz -> 30 Hz
MAX_COMPONENTS = 24
MAX_ERROR = 0.35  # unități de schelet (~1/1500 din lungimea dinozaurului)
# Tempestopteryx adult nu are o referință în manifestul studioului; originea e ca la juvenil.
FALLBACK_ORIGIN = {'tempestopteryx-adult': (900, 650)}


def source_dir(species, stage):
    if species == 'tempestopteryx' and stage == 'adult':
        return os.path.join(STUDIO, 'model')
    return os.path.join(STUDIO, 'models', species if stage == 'adult' else f'{species}-{stage}')


def parse_atlas(text):
    """Atlasul studioului: o pagină PNG pe regiune, fiecare de mărimea imaginii."""
    regions = {}
    blocks = [b for b in re.split(r'\n\s*\n', text.strip()) if b.strip()]
    for block in blocks:
        lines = block.splitlines()
        page = lines[0].strip()
        name = lines[5].strip() if len(lines) > 5 else None
        # prima linie neindentată după antet = numele regiunii
        for line in lines[1:]:
            if line and not line.startswith(' ') and ':' not in line:
                name = line.strip()
                break
        regions[name] = page
    return regions


def rnd(v, digits):
    r = round(v, digits)
    return int(r) if r == int(r) else r


def thin(keys, step):
    """Păstrează fiecare al `step`-lea cadru și ultimul; curbele se scot (interpolare liniară)."""
    if len(keys) <= 2:
        kept = keys
    else:
        kept = keys[::step]
        if kept[-1] is not keys[-1]:
            kept.append(keys[-1])
    for k in kept:
        k.pop('curve', None)
        k.pop('c2', None)
        k.pop('c3', None)
        k.pop('c4', None)
    return kept


def compact_bones(timelines):
    for bone in timelines.values():
        for kind, keys in bone.items():
            keys = thin(keys, BONE_STEP)
            for k in keys:
                for f, v in list(k.items()):
                    if isinstance(v, float):
                        k[f] = rnd(v, 4 if f == 'time' else 2)
            bone[kind] = keys


def b64_int16(values):
    """Valori reale -> (scară, base64 de int16 little-endian)."""
    values = np.asarray(values, dtype=np.float64)
    peak = float(np.abs(values).max()) or 1.0
    scale = peak / 32767
    q = np.round(values / scale).astype('<i2')
    return scale, base64.b64encode(q.tobytes()).decode('ascii'), q.astype(np.float64) * scale


def pca_deform(anims, rig_id):
    """
    Deformările coapte (un vector de vârfuri pe cadru, 60 Hz) se scriu ca medie + câteva componente principale,
    plus coeficienții fiecărui cadru. Vin din ~20 de oase, deci 8-16 componente le refac sub o unitate.
    Jocul le decodează la încărcare (src/dino-lab/runtime.ts, `pcaDeform`).
    """
    meshes = {}
    for name, anim in anims.items():
        for skin, slots in anim.pop('deform', {}).items():
            for slot, atts in slots.items():
                for att, keys in atts.items():
                    meshes.setdefault((skin, slot, att), {})[name] = keys
    out = {}
    worst = 0.0
    for (skin, slot, att), per_anim in meshes.items():
        n = max(k.get('offset', 0) + len(k.get('vertices', [])) for keys in per_anim.values() for k in keys)
        rows, spans = [], {}
        for name, keys in per_anim.items():
            times = [k['time'] for k in keys]
            step = times[1] - times[0] if len(times) > 1 else 1
            if any(abs(t - i * step) > 1e-6 for i, t in enumerate(times)):
                raise SystemExit(f'{rig_id}: cadre neuniforme în {name}/{att}')
            spans[name] = (len(rows), len(keys), step)
            for k in keys:
                row = np.zeros(n)
                v = k.get('vertices', [])
                row[k.get('offset', 0):k.get('offset', 0) + len(v)] = v
                rows.append(row)
        M = np.array(rows)
        mean = M.mean(0)
        U, S, Vt = np.linalg.svd(M - mean, full_matrices=False)
        for count in range(1, min(MAX_COMPONENTS, len(S)) + 1):
            mean_scale, mean_b64, mean_q = b64_int16(mean)
            basis = Vt[:count]
            coef = U[:, :count] * S[:count]
            parts = [b64_int16(basis[j]) for j in range(count)]
            coefs = [b64_int16(coef[:, j]) for j in range(count)]
            R = mean_q + sum(np.outer(coefs[j][2], parts[j][2]) for j in range(count))
            err = float(np.abs(R - M).max())
            if err <= MAX_ERROR:
                break
        worst = max(worst, err)
        entry = {
            'n': n,
            'mean': [mean_scale, mean_b64],
            'basis': [[sc, b] for sc, b, _ in parts],
            'anims': {
                name: {
                    'step': round(step, 6),
                    'frames': length,
                    'coef': [[sc, base64.b64encode(np.asarray(q / sc).round().astype('<i2')[start:start + length].tobytes()).decode('ascii')]
                             for sc, _, q in coefs],
                }
                for name, (start, length, step) in spans.items()
            },
        }
        out.setdefault(skin, {}).setdefault(slot, {})[att] = entry
    return out, worst


def duration(anim):
    end = 0
    for group in anim.values():
        for item in group.values():
            if isinstance(item, list):
                end = max([end] + [k.get('time', 0) for k in item])
            else:
                for keys in item.values():
                    if isinstance(keys, list):
                        end = max([end] + [k.get('time', 0) for k in keys])
                    else:
                        for ks in keys.values():
                            end = max([end] + [k.get('time', 0) for k in ks])
    return round(end, 3)


def seal(img, grow=MAP_SEAL_PX):
    """
    Lărgește stratul cu câțiva pixeli, cu culoarea vecinilor. Straturile studioului se suprapun doar cu un pixel la
    tăieturi; micșorată textura, rostul ar lăsa să se vadă fundalul (linii deschise pe zăpadă).
    """
    a = np.asarray(img, dtype=np.float32)
    alpha = a[..., 3] / 255
    k = 2 * grow + 1
    grown = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(k)), dtype=np.float32) / 255
    # culoarea pixelilor noi: media culorilor opace din jur (premultiplicat, apoi împărțit la alfa)
    r = grow + 1

    def blur(x):
        # medie pe o fereastră (2r+1)², pe rânduri apoi pe coloane, cu sume cumulate
        for axis in (0, 1):
            pad = [(0, 0), (0, 0)]
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(x, pad, mode='edge'), axis=axis)
            x = (np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
        return x
    w = blur(alpha)
    rgb = np.stack([blur(a[..., c] * alpha) for c in range(3)], -1) / np.maximum(w, 1e-4)[..., None]
    new = alpha < grown
    out = a.copy()
    out[..., :3][new] = rgb[new]
    out[..., 3] = np.maximum(alpha, grown) * 255
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def pack(crops, scale):
    """Împachetează pe rânduri (cele mai înalte întâi). Întoarce imaginea și pozițiile."""
    items = []
    for name, img in crops.items():
        w = max(1, round(img.width * scale))
        h = max(1, round(img.height * scale))
        # cu alfa premultiplicat: culoarea pixelilor transparenți nu se scurge în margini
        items.append((name, img.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')))
    items.sort(key=lambda it: -it[1].height)
    x = y = row = 0
    places = {}
    for name, img in items:
        if x + img.width + PAD > PAGE_WIDTH:
            x, y, row = 0, y + row + PAD, 0
        places[name] = (x, y, img)
        x += img.width + PAD
        row = max(row, img.height)
    width = min(PAGE_WIDTH, max(px + im.width for px, _, im in places.values()))
    height = y + row
    page = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    for px, py, im in places.values():
        page.paste(im, (px, py))
    return page, {n: (px, py, im.width, im.height) for n, (px, py, im) in places.items()}


def write_atlas(path, page_name, page, places):
    lines = []
    lines += [page_name, f'size: {page.width},{page.height}', 'format: RGBA8888', 'filter: Linear,Linear',
              'repeat: none']
    for name, (x, y, w, h) in places.items():
        lines += [name, '  rotate: false', f'  xy: {x}, {y}', f'  size: {w}, {h}', f'  orig: {w}, {h}',
                  '  offset: 0, 0', '  index: -1']
    with open(path, 'w', encoding='utf8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')


def import_model(species, stage, studio_manifest):
    rig_id = f'{species}-{stage}'
    src = source_dir(species, stage)
    studio_id = species if stage == 'adult' else rig_id
    entry = next((m for m in studio_manifest['models'] if m['id'] == studio_id), {})
    with open(os.path.join(src, 'animated.json'), encoding='utf8') as f:
        data = json.load(f)
    with open(os.path.join(src, 'rig.atlas'), encoding='utf8') as f:
        regions = parse_atlas(f.read())

    # ---- texturile: tăiate la conținut (plus tot ce acoperă plasele, ca UV-urile să rămână în regiune)
    attachments = []
    for skin in data['skins']:
        for slot, atts in skin['attachments'].items():
            for name, att in atts.items():
                if att.get('type', 'region') != 'mesh':
                    raise SystemExit(f'{rig_id}: atașament {name} de tip {att.get("type")} (aștept doar plase)')
                attachments.append(att | {'_region': att.get('path', name), '_ref': att})
    crops, boxes, sizes, bottom = {}, {}, {}, 0
    for region, page in regions.items():
        img = Image.open(os.path.join(src, page)).convert('RGBA')
        sizes[region] = img.size
        box = img.getchannel('A').getbbox() or (0, 0, 1, 1)
        bottom = max(bottom, box[3])
        x0, y0, x1, y1 = box
        for a in attachments:
            if a['_region'] != region:
                continue
            us, vs = a['uvs'][0::2], a['uvs'][1::2]
            x0, x1 = min(x0, math.floor(min(us) * img.width)), max(x1, math.ceil(max(us) * img.width))
            y0, y1 = min(y0, math.floor(min(vs) * img.height)), max(y1, math.ceil(max(vs) * img.height))
        x0, y0 = max(0, x0 - PAD), max(0, y0 - PAD)
        x1, y1 = min(img.width, x1 + PAD), min(img.height, y1 + PAD)
        boxes[region] = (x0, y0, x1, y1)
        crop = img.crop((x0, y0, x1, y1))
        crops[region] = crop
    for a in attachments:
        (x0, y0, x1, y1), (iw, ih) = boxes[a['_region']], sizes[a['_region']]
        uvs = a['_ref']['uvs']
        for i in range(0, len(uvs), 2):
            uvs[i] = rnd((uvs[i] * iw - x0) / (x1 - x0), 5)
            uvs[i + 1] = rnd((uvs[i + 1] * ih - y0) / (y1 - y0), 5)
        # plasele ponderate (bone, os, x, y, greutate, ...) rămân exacte: rotunjite, greutățile n-ar mai da 1
        if len(a['_ref']['vertices']) == len(uvs):
            a['_ref']['vertices'] = [rnd(v, 3) for v in a['_ref']['vertices']]

    # ---- originea la picioare: y din schelet = originY - y din imagine
    origin = (entry.get('reference') or {}).get('origin') or FALLBACK_ORIGIN[rig_id]
    lift = bottom - origin[1]  # cât urcă totul ca cel mai de jos pixel să ajungă la y = 0
    root = data['bones'][0]
    root['y'] = root.get('y', 0) + lift

    # ---- animațiile
    anims = data['animations']
    if 'swim' in anims and 'walk' not in anims:
        anims['walk'] = anims.pop('swim')
    for anim in anims.values():
        compact_bones(anim.get('bones', {}))
    durations = {n: duration(a) for n, a in anims.items()}
    data['pcaDeform'], worst = pca_deform(anims, rig_id)
    for b in data['bones']:
        for f, v in list(b.items()):
            if isinstance(v, float):
                b[f] = rnd(v, 3)

    bounds = dict(entry.get('bounds') or {'x': -900, 'y': -500, 'width': 1800, 'height': 1250})
    bounds['y'] += lift
    data['skeleton'].update(
        {'x': bounds['x'], 'y': bounds['y'], 'width': bounds['width'], 'height': bounds['height'], 'images': './'}
    )

    out = os.path.join(OUT, rig_id)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'skeleton.json'), 'w', encoding='utf8') as f:
        json.dump(data, f, separators=(',', ':'), ensure_ascii=False)
    sealed = {name: seal(img) for name, img in crops.items()}
    for suffix, scale, source in (('', SCENE_SCALE, crops), ('-map', MAP_SCALE, sealed)):
        page, places = pack(source, scale)
        page.save(os.path.join(out, f'parts{suffix}.webp'), 'WEBP', quality=88, method=6, exact=False)
        write_atlas(os.path.join(out, f'parts{suffix}.atlas'), f'parts{suffix}.webp', page, places)

    order = ['idle', 'walk', 'attack', 'ultimate']
    names = sorted(anims, key=lambda n: order.index(n) if n in order else 9)
    return {
        'id': rig_id,
        'name': f'{species.capitalize()} · {NAMES[stage]}',
        'body': BODY.get(species, 'biped'),
        'skeleton': f'{rig_id}/skeleton.json',
        'atlas': f'{rig_id}/parts.atlas',
        'texture': f'{rig_id}/parts.webp',
        'animations': [
            {'name': n, 'label': LABELS.get(n, n), 'duration': durations[n], 'loop': n not in ONE_SHOT}
            for n in names
        ],
        'bounds': bounds,
    }, worst


def main():
    with open(os.path.join(STUDIO, 'manifest.json'), encoding='utf8') as f:
        studio_manifest = json.load(f)
    only = set(sys.argv[1:])
    manifest_path = os.path.join(OUT, 'manifest.json')
    for species in SPECIES:
        for stage in STAGES:
            rig_id = f'{species}-{stage}'
            if only and rig_id not in only:
                continue
            entry, worst = import_model(species, stage, studio_manifest)
            # manifestul se recitește la fiecare model: alte scripturi (ex. build-ignisaur.mjs) îl pot scrie între timp
            with open(manifest_path, encoding='utf8') as f:
                manifest = json.load(f)
            manifest['rigs'] = [r for r in manifest['rigs'] if r['id'] != rig_id] + [entry]
            with open(manifest_path, 'w', encoding='utf8', newline='\n') as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False)
                f.write('\n')
            size = sum(os.path.getsize(os.path.join(OUT, rig_id, n)) for n in os.listdir(os.path.join(OUT, rig_id)))
            print(f'{rig_id}: {size / 1e6:.2f} MB, eroare max {worst:.2f}', flush=True)


if __name__ == '__main__':
    main()
