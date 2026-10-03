# Pregătește imaginile 360° din art/turntables pentru joc (art/ nu intră în joc: e prea mare).
# Pentru fiecare corp și vârstă scoate în src/assets/turntables/:
#   <corp>-<stadiu>.webp      o singură poză (3/4, privește spre dreapta), pentru carduri și liste
#   <corp>-<stadiu>-360.webp  toate cele 8 unghiuri într-o bandă orizontală, pentru rotire
# Toate cele 8 cadre ale unei vârste au aceeași decupare, ca dinozaurul să nu „sară” la rotire.
#   python scripts/build-turntables.py

import os
from PIL import Image

SRC = 'art/turntables'
OUT = 'src/assets/turntables'
ANGLES = ['000', '045', '090', '135', '180', '225', '270', '315']
STILL = '045'  # 3/4 din față, cu capul spre dreapta
AGES = {'01-pui': 'pui', '02-juvenil': 'juvenil', '04-adult': 'adult'}
STILL_SIZE = 256
FRAME_SIZE = 360
QUALITY = 82


def union_box(frames):
    boxes = [f.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox() for f in frames]
    boxes = [b for b in boxes if b]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def fit(img, box, size):
    """Decupează la cutia comună și așază jos pe mijloc într-un pătrat (picioarele pe aceeași linie)."""
    crop = img.crop(box)
    scale = (size * 0.96) / max(crop.width, crop.height)
    crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
    square = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    square.alpha_composite(crop, ((size - crop.width) // 2, size - crop.height - round(size * 0.02)))
    return square


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for body in sorted(os.listdir(SRC)):
        if not os.path.isdir(os.path.join(SRC, body)):
            continue
        for folder, stage in AGES.items():
            paths = [os.path.join(SRC, body, folder, f'{a}.png') for a in ANGLES]
            if not all(os.path.exists(p) for p in paths):
                print(f'lipsesc cadre: {body}/{folder}')
                continue
            frames = [Image.open(p).convert('RGBA') for p in paths]
            box = union_box(frames)
            strip = Image.new('RGBA', (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
            for i, f in enumerate(frames):
                strip.alpha_composite(fit(f, box, FRAME_SIZE), (i * FRAME_SIZE, 0))
            still = fit(frames[ANGLES.index(STILL)], box, STILL_SIZE)
            for name, img in ((f'{body}-{stage}-360.webp', strip), (f'{body}-{stage}.webp', still)):
                path = os.path.join(OUT, name)
                img.save(path, 'WEBP', quality=QUALITY, method=6)
                total += os.path.getsize(path)
            print(f'{body}-{stage}: ok')
    print(f'total: {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
