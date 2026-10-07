import { ThemeText } from './ThemeText';
// Galerie de dezvoltare: toate speciile și ouăle (deschide /#galerie).

import { RARITIES, SPECIES_LIST, type Rarity } from '@shared/game';
import { DinoSprite } from './DinoSprite';
import { EggSprite } from './EggSprite';

export function Gallery() {
  return (
    <div className="gallery">
      {SPECIES_LIST.map((s) => (
        <figure key={s.id}>
          <DinoSprite speciesId={s.id} size={120} />
          <figcaption><ThemeText>{s.name}</ThemeText></figcaption>
        </figure>
      ))}
      {['mugurel', 'jarraptor', 'cetatodon'].map((id) => (
        <figure key={id + 'a'}>
          <DinoSprite speciesId={id} size={120} albino />
          <figcaption><ThemeText>{id}</ThemeText> albino</figcaption>
        </figure>
      ))}
      <figure>
        <DinoSprite speciesId="codrodon" size={120} silhouette />
        <figcaption>siluetă</figcaption>
      </figure>
      {(Object.keys(RARITIES) as Rarity[]).map((r, i) => (
        <figure key={r}>
          <EggSprite egg={{ rarity: r, speciesId: SPECIES_LIST[(i * 4) % SPECIES_LIST.length].id }} size={100} cracks={i === 4 ? 2 : 0} />
          <figcaption><ThemeText>{r}</ThemeText></figcaption>
        </figure>
      ))}
    </div>
  );
}
