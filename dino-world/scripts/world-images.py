# Variantele ușoare ale imaginilor lumii, din cele mari din public/world:
#   <insulă>-island-2k.webp      1728×1152, folosită implicit (4K se încarcă doar la zoom mare)
#   main-island-lite.webp        864×576, doar insula principală: apare imediat la pornire, 2K o înlocuiește
#   <insulă>-island-thumb.webp    330×220, miniatura din Wikipedia (carduri și antetul articolului)
#   <insulă>-island-locked.webp  gri și întunecată, pentru insulele nedescoperite (fără filtru CSS live)
#   <insulă>-island-shadow.webp  umbra insulei, deja estompată (în locul lui drop-shadow pe fiecare cadru)
#   <clădire>-building.webp      768×768 (HD se încarcă doar la zoom mare)
#   dinosaurs/<schelet>/*-map.webp + parts-map.atlas  texturile scheletelor la jumătate, pentru dinozaurii mici
#                                   (harta: src/dino-lab/herd.ts); rulează din nou
#                                   după scripts/build-trex.mjs
# Rulează după ce schimbi arta:  python scripts/world-images.py
import os
import re
import argparse
from PIL import Image, ImageEnhance, ImageFilter

WORLD = os.path.join(os.path.dirname(__file__), '..', 'public', 'world')
# lățimea în care e desenată insula în scenă (unități SVG): umbra se calculează în aceste unități
ISLANDS = {'main': 1536, 'fire': 1100, 'water': 1100, 'earth': 1100, 'jungle': 1100, 'ice': 1100, 'storm': 1100}
parser = argparse.ArgumentParser(description='Build map variants from the source world artwork.')
parser.add_argument('--island', action='append', choices=list(ISLANDS), help='Rebuild only this island; repeat for several.')
args = parser.parse_args()
if args.island:
    ISLANDS = {name: units for name, units in ISLANDS.items() if name in args.island}
SHADOW = {'pad': 90, 'dy': 30, 'blur': 20, 'rgb': (0, 30, 60), 'alpha': 0.35, 'scale': 0.3}


def save(im, name, quality=82):
    im.save(os.path.join(WORLD, name), 'WEBP', quality=quality, method=6)


for island, units in ISLANDS.items():
    src = Image.open(os.path.join(WORLD, f'{island}-island-4k.webp')).convert('RGBA')
    mid = src.resize((1728, 1152), Image.LANCZOS)
    save(mid, f'{island}-island-2k.webp')
    if island == 'main':
        save(src.resize((864, 576), Image.LANCZOS), 'main-island-lite.webp', quality=72)
    save(src.resize((330, 220), Image.LANCZOS), f'{island}-island-thumb.webp', quality=78)

    if island != 'main':
        # ca filtrul vechi: grayscale(0.85) brightness(0.65); opacitatea rămâne în CSS
        small = src.resize((1152, 768), Image.LANCZOS)
        rgb, alpha = small.convert('RGB'), small.getchannel('A')
        grey = Image.blend(rgb, rgb.convert('L').convert('RGB'), 0.85)
        grey = ImageEnhance.Brightness(grey).enhance(0.65)
        locked = grey.convert('RGBA')
        locked.putalpha(alpha)
        save(locked, f'{island}-island-locked.webp')

    # umbra: silueta insulei, coborâtă și estompată, în unități de scenă × scale
    s, pad = SHADOW['scale'], SHADOW['pad']
    w, h = round(units * s), round(units * 2 / 3 * s)
    P, dy = round(pad * s), round(SHADOW['dy'] * s)
    sil = src.getchannel('A').resize((w, h), Image.LANCZOS)
    canvas = Image.new('L', (w + 2 * P, h + 2 * P), 0)
    canvas.paste(sil, (P, P + dy))
    canvas = canvas.filter(ImageFilter.GaussianBlur(SHADOW['blur'] * s))
    canvas = canvas.point(lambda v: round(v * SHADOW['alpha']))
    shadow = Image.new('RGBA', canvas.size, SHADOW['rgb'] + (0,))
    shadow.putalpha(canvas)
    save(shadow, f'{island}-island-shadow.webp', quality=70)

for building in ([] if args.island else ['farm', 'hatchery', 'den', 'arena', 'outpost', 'forge']):
    src = Image.open(os.path.join(WORLD, f'{building}-building-hd.webp'))
    save(src.resize((768, 768), Image.LANCZOS), f'{building}-building.webp', quality=84)

DINOS = os.path.join(WORLD, '..', 'dinosaurs')
MAP_PAGES = {'parts.png': 'parts-map.webp', 'attack-crystal.png': 'attack-crystal-map.webp'}
for rig in ([] if args.island else os.listdir(DINOS)):
    folder = os.path.join(DINOS, rig)
    # doar scheletele vechi cu pagini PNG; cele din studio își fac singure varianta mică (import-studio.py)
    if not os.path.exists(os.path.join(folder, 'parts.png')):
        continue
    for page, small in MAP_PAGES.items():
        if not os.path.exists(os.path.join(folder, page)):
            continue
        im = Image.open(os.path.join(folder, page)).convert('RGBA')
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
        im.save(os.path.join(folder, small), 'WEBP', quality=88, method=6)
    # atlasul paginilor mici: aceleași regiuni, coordonatele la jumătate
    lines = []
    for line in open(os.path.join(folder, 'parts.atlas'), encoding='utf8').read().split('\n'):
        if line.strip() in MAP_PAGES:
            line = MAP_PAGES[line.strip()]
        else:
            m = re.match(r'^(\s*(?:size|xy|orig|offset):\s*)(-?\d+),\s*(-?\d+)(.*)$', line)
            if m:
                line = f'{m[1]}{round(int(m[2]) / 2)},{round(int(m[3]) / 2)}{m[4]}'
        lines.append(line)
    open(os.path.join(folder, 'parts-map.atlas'), 'w', encoding='utf8', newline='\n').write('\n'.join(lines))

print('ok')
