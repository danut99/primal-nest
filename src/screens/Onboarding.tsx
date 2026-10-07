import { ThemeText } from '../components/ThemeText';
// Începutul: povestea cataclismului (scurtă, cinematică), Saurok, numele, oul de start și căldura cuibului.

import { type ReactNode, useState } from 'react';
import {
  type GameState,
  type Temperature,
  GameError,
  SPECIES,
  STARTERS,
  TEMPERAMENTS,
  TEMPERATURES,
  newGame,
  runCommand,
} from '@shared/game';
import { DinoSprite } from '../components/DinoSprite';
import { EggSprite } from '../components/EggSprite';
import { GameIcon } from '../components/GameIcon';
import { EggIcon } from '../components/AssetIcon';
import { sceneBackground } from '../content/art';
import { Saurok, Sparkles, TypeBadge } from '../components/ui';
import { sound } from '../utils/sound';

type Starter = (typeof STARTERS)[number];

const STORY: { art: ReactNode; text: ReactNode }[] = [
  {
    art: (
      <div className="story-art meteor-scene">
        <span className="meteor" />
        <span className="impact" />
      </div>
    ),
    text: (
      <>
        Acum 66 de milioane de ani, <b>cerul a ars</b>. O stea a căzut și lumea s-a schimbat pentru totdeauna.
      </>
    ),
  },
  {
    art: (
      <div className="story-art amber-scene">
        {(['mugurel', 'scanteius', 'pietroi'] as const).map((id, i) => (
          <span key={id} className="amber" style={{ animationDelay: `${i * 0.4}s` }}>
            <EggSprite egg={{ rarity: i === 1 ? 'legendar' : 'rar', speciesId: id }} size={64} />
          </span>
        ))}
      </div>
    ),
    text: (
      <>
        Cataclismul nu i-a ucis pe toți. I-a <b>schimbat</b>. Ultimele ouă au supraviețuit în chihlimbar, adânc sub
        pământ, hrănite de lumina stelei.
      </>
    ),
  },
  {
    art: (
      <div className="story-art umbra-scene">
        <DinoSprite speciesId="vulcanraptor" size={150} shadowed className="bob" />
      </div>
    ),
    text: (
      <>
        Acum, din craterul stelei se ridică <b className="umbra-text">Umbra</b>. Cei atinși de ea devin prădători fără minte.
        Fiecare regiune e stăpânită de un <b>Alfa</b> corupt. Învinge-i sau specia ta dispare a doua oară.
      </>
    ),
  },
];

export function Onboarding({ onStart, now }: { onStart: (s: GameState) => void; now: () => number }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [starter, setStarter] = useState<Starter | null>(null);
  const [temp, setTemp] = useState<Temperature | null>(null);
  const [error, setError] = useState('');
  const storySteps = STORY.length;

  const next = () => {
    sound.click();
    setStep((s) => s + 1);
  };

  const begin = () => {
    if (!starter || !temp) return;
    try {
      const t = now();
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const fresh = newGame(name, starter, temp, t, seed);
      const placed = runCommand(fresh, { type: 'placeEgg', eggId: fresh.eggs[0].id, temperature: temp }, t).state;
      sound.egg();
      onStart(placed);
    } catch (e) {
      setError(e instanceof GameError ? e.message : 'Ceva n-a mers.');
    }
  };

  if (step < storySteps) {
    const slide = STORY[step];
    return (
      <div className="onboarding story">
        <SceneLayer key={`bg${step}`} name={`poveste-${step + 1}`} />
        <div key={step} className="story-slide">
          <ThemeText>{slide.art}</ThemeText>
          <p className="story-text"><ThemeText>{slide.text}</ThemeText></p>
          <div className="story-nav">
            <div className="dots">
              {STORY.map((_, i) => (
                <span key={i} className={i === step ? 'on' : ''} />
              ))}
            </div>
            <button className="btn primary" onClick={next}><ThemeText>{"\r\n              Continuă ›\r\n            "}</ThemeText></button>
          </div>
          <button className="skip" onClick={() => setStep(storySteps)}>
            Sari peste poveste
          </button>
        </div>
      </div>
    );
  }

  const s = step - storySteps;
  return (
    <div className="onboarding">
      <div className="onb-card">
        <div className="logo big">
          <GameIcon name="logo" size={88} className="brand-mark" /> Primal Nest
        </div>
        <p className="tagline">Ultimul Cuib</p>

        {s === 0 && (
          <div className="onb-step pop-in">
            <div className="speech">
              <Saurok size={78} />
              <p>
                Sunt <b>Saurok</b>, ultimul din neamul Spinosaurilor. Am forjat lame din puterea stelei, dar sunt prea bătrân
                ca să le mai port. Ai nevoie de o haită. Crește-o, călește-o și du-o împotriva Alfa. Cum te cheamă,<ThemeText>{' '}</ThemeText>
                <b>Păzitorule</b>?
              </p>
            </div>
            <form
              className="name-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length >= 2) next();
              }}
            >
              <input autoFocus value={name} maxLength={16} placeholder="Numele tău" onChange={(e) => setName(e.target.value)} aria-label="Numele tău" />
              <button className="btn primary" disabled={name.trim().length < 2}><ThemeText>{"\r\n                Mai departe →\r\n              "}</ThemeText></button>
            </form>
          </div>
        )}

        {s === 1 && (
          <div className="onb-step pop-in">
            <div className="speech">
              <Saurok size={56} />
              <p>
                Am salvat trei ouă din chihlimbar, <ThemeText>{name.trim()}</ThemeText>. Alege unul. <b>Puiul din el va lupta lângă tine până la capăt.</b>
              </p>
            </div>
            <div className="starter-grid">
              {STARTERS.map((id) => {
                const sp = SPECIES[id];
                const selected = starter === id;
                return (
                  <button
                    key={id}
                    className={`starter${selected ? ' selected' : ''}`}
                    onClick={() => {
                      sound.click();
                      setStarter(id);
                    }}
                  >
                    <div className="pedestal">
                      <span className="beam" />
                      {selected && <Sparkles count={8} />}
                      <EggSprite egg={{ rarity: 'neobisnuit', speciesId: id }} size={58} className="wobble-slow pedestal-egg" />
                      <DinoSprite speciesId={id} size={96} className="bob" />
                    </div>
                    <b><ThemeText>{sp.name}</ThemeText></b>
                    <TypeBadge type={sp.types[0]} small />
                    <small><ThemeText>{sp.blurb}</ThemeText></small>
                  </button>
                );
              })}
            </div>
            <div className="onb-actions">
              <button className="btn ghost" onClick={() => setStep(step - 1)}><ThemeText>{"\r\n                ← Înapoi\r\n              "}</ThemeText></button>
              <button className="btn primary" disabled={!starter} onClick={next}>
                Pe ăsta îl aleg!
              </button>
            </div>
          </div>
        )}

        {s === 2 && starter && (
          <div className="onb-step pop-in">
            <div className="speech">
              <Saurok size={56} />
              <p>
                La reptile, <b>temperatura cuibului</b> decide ce fel de prădător iese din ou. Alege cu grijă: asta îi dă
                temperamentul.
              </p>
            </div>
            <div className="temp-grid">
              {(Object.keys(TEMPERATURES) as Temperature[]).map((t) => {
                const info = TEMPERATURES[t];
                const tm = TEMPERAMENTS[info.temperament];
                return (
                  <button key={t} className={`temp-card t-${t}${temp === t ? ' selected' : ''}`} onClick={() => setTemp(t)}>
                    <span className="temp-icon"><ThemeText>{info.icon}</ThemeText></span>
                    <b><ThemeText>{info.name}</ThemeText></b>
                    <span>
                      Pui <b><ThemeText>{tm.name}</ThemeText></b>
                    </span>
                    <small><ThemeText>{tm.text}</ThemeText></small>
                  </button>
                );
              })}
            </div>
            {error && <p className="error-text"><ThemeText>{error}</ThemeText></p>}
            <div className="onb-actions">
              <button className="btn ghost" onClick={() => setStep(step - 1)}><ThemeText>{"\r\n                ← Înapoi\r\n              "}</ThemeText></button>
              <button className="btn primary big" disabled={!temp} onClick={begin}>
                <EggIcon /> Pune oul în cuib
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Imaginea de fundal a unei scene (dacă există în src/local-art), cu zoom lent cinematic. */
function SceneLayer({ name }: { name: string }) {
  const style = sceneBackground(name, 0.35);
  if (!style) return null;
  return <div className="scene-layer" style={style} aria-hidden="true" />;
}
