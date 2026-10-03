// Momentul eclozării: oul tremură, crapă, lumină, iar puiul apare. Apoi îi dai un nume.

import { useEffect, useRef, useState } from 'react';
import { type Dino, type Egg, SPECIES, TEMPERAMENTS, geneStars } from '@shared/game';
import { DinoTurntable } from '../components/DinoTurntable';
import { EggSprite } from '../components/EggSprite';
import { Modal, Sparkles, Stars, TypeBadge } from '../components/ui';
import type { Game } from '../hooks/useGame';
import { sound } from '../utils/sound';

type Phase = 'shake' | 'crack' | 'flash' | 'reveal';

export function HatchModal({ game, egg, onClose }: { game: Game; egg: Egg; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('shake');
  const [dino, setDino] = useState<Dino | null>(null);
  const [name, setName] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // Regula rulează imediat; animația doar o pune în scenă.
    const result = game.dispatch({ type: 'hatch', eggId: egg.id }, { quiet: true });
    if (!result?.hatchedId) {
      onClose();
      return;
    }
    const hatched = result.state.dinos.find((d) => d.id === result.hatchedId)!;
    setDino(hatched);
    setName(hatched.nickname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dino) return;
    const timers = [
      setTimeout(() => {
        setPhase('crack');
        sound.crack();
      }, 1100),
      setTimeout(() => sound.crack(), 1500),
      setTimeout(() => setPhase('flash'), 2000),
      setTimeout(() => {
        setPhase('reveal');
        sound.hatch();
      }, 2350),
    ];
    return () => timers.forEach(clearTimeout);
  }, [dino]);

  const finish = () => {
    if (dino && name.trim() && name.trim() !== dino.nickname) game.dispatch({ type: 'rename', dinoId: dino.id, nickname: name }, { quiet: true });
    onClose();
  };

  const species = dino ? SPECIES[dino.speciesId] : null;
  return (
    <Modal onClose={phase === 'reveal' ? finish : undefined} className="hatch-modal">
      <div className={`hatch-stage phase-${phase}`}>
        <div className="rays" />
        {phase !== 'reveal' && (
          <EggSprite egg={egg} size={150} cracks={phase === 'shake' ? 1 : 2} className={phase === 'shake' ? 'wobble-fast' : 'shake-hard'} />
        )}
        {phase === 'flash' && <div className="flash" />}
        {phase === 'reveal' && dino && species && (
          <div className="reveal pop-in">
            <Sparkles count={16} />
            <DinoTurntable speciesId={dino.speciesId} albino={dino.variant === 'albino'} size={170} />
          </div>
        )}
      </div>
      {phase === 'reveal' && dino && species && (
        <div className="hatch-info pop-in">
          <h2>{dino.variant === 'albino' ? `Un ${species.name} ALBINO! 🤍` : `A eclozat un ${species.name}!`}</h2>
          <div className="row center gap-s">
            {species.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            <span className="chip">{TEMPERAMENTS[dino.temperament].name}</span>
            <Stars n={geneStars(dino.genes)} />
          </div>
          <p className="muted">{species.blurb}</p>
          <form
            className="name-form"
            onSubmit={(e) => {
              e.preventDefault();
              finish();
            }}
          >
            <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} aria-label="Numele puiului" />
            <button className="btn primary">Al meu ⚔️</button>
          </form>
        </div>
      )}
    </Modal>
  );
}
