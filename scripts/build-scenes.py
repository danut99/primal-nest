# Pregătește fundalurile expedițiilor din art/scenes pentru joc: WebP în src/assets/scenes/<regiune>.webp.
# Numele fișierului e id-ul regiunii (jungla, canion, piscuri, vulcan).
#   python scripts/build-scenes.py

import os
from PIL import Image

SRC = 'art/scenes'
OUT = 'src/assets/scenes'
WIDTH = 1600
QUALITY = 80


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name in sorted(os.listdir(SRC)):
        base, ext = os.path.splitext(name)
        if ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
            continue
        img = Image.open(os.path.join(SRC, name)).convert('RGB')
        if img.width > WIDTH:
            img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
        path = os.path.join(OUT, f'{base}.webp')
        img.save(path, 'WEBP', quality=QUALITY, method=6)
        total += os.path.getsize(path)
        print(f'{base}: {img.width}x{img.height}, {os.path.getsize(path) / 1024:.0f} KB')
    print(f'total: {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
