// Animația de evoluție: silueta pulsează între forma veche și cea nouă, apoi lumină.

import { useEffect, useState } from 'react';
import { SPECIES } from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { Modal } from '../components/ui';
import { sound } from '../utils/sound';

export function EvolveModal({ from, to, albino, onClose }: { from: string; to: string; albino: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<'swap' | 'flash' | 'done'>('swap');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Alternare tot mai rapidă între cele două siluete, ca în jocurile clasice.
    let t = 0;
    [500, 420, 340, 270, 210, 160, 120, 90, 70].forEach((d, i) => {
      t += d;
      timers.push(
        setTimeout(() => {
          setShowNew(i % 2 === 0);
          sound.click();
        }, t),
      );
    });
    timers.push(setTimeout(() => setPhase('flash'), t + 200));
    timers.push(
      setTimeout(() => {
        setPhase('done');
        setShowNew(true);
        sound.levelUp();
      }, t + 550),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <Modal onClose={phase === 'done' ? onClose : undefined} className="hatch-modal">
      <div className={`hatch-stage phase-${phase === 'done' ? 'reveal' : 'shake'}`}>
        <div className="rays" />
        <DinoSprite speciesId={showNew ? to : from} albino={albino} size={180} silhouette={phase === 'swap'} className={phase === 'done' ? 'pop-in bob' : 'glow-white'} />
        {phase === 'flash' && <div className="flash" />}
      </div>
      <div className="hatch-info">
        {phase === 'done' ? (
          <>
            <h2 className="pop-in">
              {SPECIES[from].name} a evoluat în {SPECIES[to].name}! 🎉
            </h2>
            <p className="muted">{SPECIES[to].blurb}</p>
            <button className="btn primary" onClick={onClose}>
              Minunat!
            </button>
          </>
        ) : (
          <h2>Ce se întâmplă?!</h2>
        )}
      </div>
    </Modal>
  );
}
