// Dragonii: modelele generate (4 evoluții fiecare) și biblioteca de animații Dragon City.

import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../components/ui';
import { DragonPlayer } from './DragonPlayer';
import {
  loadCatalog,
  DRAGON_BASE,
  previewUrl,
  sourceKey,
  type DragonCatalog,
  type DragonController,
  type DragonSource,
} from './runtime';

const SPEEDS = [0.5, 1, 1.5, 2];

export function DragonsScreen() {
  const [catalog, setCatalog] = useState<DragonCatalog | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'generati' | 'biblioteca' | 'grandiosi' | 'spectacular'>('spectacular');
  const [source, setSource] = useState<DragonSource>({ model: 'noctyra', stage: 'adult' });
  const [dragon, setDragon] = useState<DragonController | null>(null);
  const [animation, setAnimation] = useState('fly');
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [framing, setFraming] = useState<'animation' | 'scene' | 'body'>('body');

  useEffect(() => {
    loadCatalog().then(setCatalog, (e: Error) => setError(e.message));
  }, []);

  const ready = (d: DragonController) => {
    setDragon(d);
    if (!d.animations.includes(animation)) setAnimation(d.animations.includes('breathe') ? 'breathe' : d.animations[0]);
  };

  const pick = (s: DragonSource) => {
    if (sourceKey(s) === sourceKey(source)) return;
    setDragon(null);
    setSource(s);
  };

  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog?.library ?? []).filter((e) => !q || e.name.toLowerCase().includes(q) || e.id.includes(q));
  }, [catalog, query]);

  const save = async () => {
    const blob = await dragon?.snapshot();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = sourceKey(source).replace(/[/.]/g, '-') + `-${animation}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <div className="screen error-text">{error}</div>;
  if (!catalog) return <div className="screen muted">Se încarcă dragonii…</div>;

  const model = 'model' in source ? catalog.models.find((m) => m.id === source.model) : undefined;
  const entry =
    'archive' in source ? catalog.library.find((e) => e.forms.some((f) => f.file === source.archive)) : undefined;
  const featured = 'archive' in source ? catalog.grandiose?.find((m) => m.archive === source.archive || m.fatalityArchive === source.archive) : undefined;
  const spectacular = model && catalog.spectacular?.includes(model.id);

  return (
    <div className="screen dragons">
      <Panel
        title={model?.name ?? entry?.name}
        icon="🐉"
        right={model && <span className="chip">{model.element}</span>}
      >
        <DragonPlayer source={source} animation={animation} speed={speed} paused={paused} framing={featured || spectacular ? framing : 'animation'} onReady={ready} />
        {model && <p className="muted">{model.description}</p>}
        {featured && <p className="muted">{featured.description} Model original din bibliotecă.</p>}
        {(featured || spectacular) && <div className="row gap-s wrap dragon-controls">
          {(['body', 'scene', 'animation'] as const).map((f) => <button key={f} className={`btn small${framing === f ? ' primary' : ''}`} onClick={() => setFraming(f)}>{f === 'body' ? 'Dragon aproape' : f === 'scene' ? 'Scenă stabilă' : 'Animație întreagă'}</button>)}
          <small className="muted">În vederea apropiată, efectele pot depăși cadrul.</small>
        </div>}
        {featured?.fatalityArchive && <div className="row gap-s wrap dragon-controls">
          <button className="btn small" onClick={() => { setAnimation(featured.recommendedAnimation); pick({ archive: featured.archive }); }}>Dragon / atac</button>
          <button className="btn small" onClick={() => { setAnimation('attack'); pick({ archive: featured.fatalityArchive! }); }}>Fatality nativ</button>
        </div>}
        <div className="row gap-s wrap dragon-controls">
          {(model?.stages ?? entry?.forms ?? []).map((s) => {
            const next: DragonSource = 'file' in s ? { archive: s.file } : { model: model!.id, stage: s.id };
            return (
              <button
                key={s.label}
                className={`btn small${sourceKey(next) === sourceKey(source) ? ' primary' : ''}`}
                onClick={() => pick(next)}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="row gap-s wrap dragon-controls">
          {dragon?.animations.map((a) => (
            <button key={a} className={`chip${a === animation ? ' active' : ''}`} onClick={() => setAnimation(a)}>
              {a}
            </button>
          ))}
        </div>
        <div className="row gap-s wrap dragon-controls">
          <button className="btn small" onClick={() => setPaused(!paused)}>
            {paused ? '▶ Pornește' : '⏸ Pauză'}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} className={`btn tiny${s === speed ? ' primary' : ''}`} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
          <button className="btn small ghost" onClick={save} disabled={!dragon}>
            📷 PNG
          </button>
        </div>
      </Panel>

      <Panel>
        <div className="row gap-s wrap">
          <button className={`btn small${tab === 'spectacular' ? ' primary' : ''}`} onClick={() => setTab('spectacular')}>
            Spectaculoși ({catalog.spectacular?.length ?? 0})
          </button>
          <button className={`btn small${tab === 'grandiosi' ? ' primary' : ''}`} onClick={() => setTab('grandiosi')}>
            Grandioși ({catalog.grandiose?.length ?? 0})
          </button>
          <button className={`btn small${tab === 'generati' ? ' primary' : ''}`} onClick={() => setTab('generati')}>
            Generați ({catalog.models.length})
          </button>
          <button className={`btn small${tab === 'biblioteca' ? ' primary' : ''}`} onClick={() => setTab('biblioteca')}>
            Bibliotecă ({catalog.library.length})
          </button>
          {tab === 'biblioteca' && (
            <input
              className="dragon-search"
              placeholder="Caută…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </div>
        {tab === 'grandiosi' ? (
          <div className="dragon-grid">
            {catalog.grandiose?.map((m) => <button key={m.id} className={`dragon-card${featured?.id === m.id ? ' selected' : ''}`} onClick={() => { setAnimation(m.recommendedAnimation); pick({ archive: m.archive }); }}>
              <img src={`${DRAGON_BASE}/${m.preview}`} alt="" loading="lazy" />
              <b>{m.name}</b><small className="muted">{m.description}</small>
            </button>)}
          </div>
        ) : tab === 'generati' || tab === 'spectacular' ? (
          <div className="dragon-grid">
            {catalog.models.filter((m) => tab !== 'spectacular' || catalog.spectacular?.includes(m.id)).map((m) => {
              const stage = m.stages[m.stages.length - 1].id;
              return (
                <button
                  key={m.id}
                  className={`dragon-card${model?.id === m.id ? ' selected' : ''}`}
                  style={{ borderColor: m.color }}
                  onClick={() => { if (tab === 'spectacular') setAnimation('fly'); pick({ model: m.id, stage }); }}
                >
                  <img src={previewUrl(m.id, stage)} alt="" loading="lazy" />
                  <b>{m.name}</b>
                  <small className="muted">{m.stages.length} evoluții</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="dragon-list">
            {library.map((e) => (
              <button
                key={e.id}
                className={`dragon-row${entry?.id === e.id ? ' selected' : ''}`}
                onClick={() => pick({ archive: e.forms[e.forms.length - 1].file })}
              >
                <span>{e.name}</span>
                <small className="muted">{e.kind === 'efect' ? 'efect' : `${e.forms.length} forme`}</small>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
