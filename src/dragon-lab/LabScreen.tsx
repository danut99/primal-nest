// Laboratorul de dragoni (/#laborator): editor vizual pentru rețete. În dev, „Salvează” scrie recipes.json.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadCatalog, sourceKey, type DragonCatalog, type DragonSource } from '../dragons/runtime';
import { LabDragon } from './LabDragon';
import {
  animationLabel,
  groupsOf,
  type AnimationSettings,
  type ColorAdjust,
  type DragonRecipe,
  type LabController,
  type MotionSettings,
  type PartSettings,
} from './engine';
import presets from './recipes.json';
import './lab.css';

// ---------- editorul ----------

const BACKGROUNDS = ['#101e30', '#1d2b1a', '#2a1a14', '#f2efe8', '#00000000'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clean = (o: object): any => {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== false));
  return Object.keys(out).length ? out : undefined;
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'dragon';

export function LabScreen() {
  const [recipes, setRecipes] = useState<DragonRecipe[]>(presets as unknown as DragonRecipe[]);
  const [id, setId] = useState(recipes[0]?.id ?? '');
  const [catalog, setCatalog] = useState<DragonCatalog | null>(null);
  const [dragon, setDragon] = useState<LabController | null>(null);
  const [animation, setAnimation] = useState('breathe');
  const [paused, setPaused] = useState(false);
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [group, setGroup] = useState('aripi');
  const [compare, setCompare] = useState(false);
  const [message, setMessage] = useState('');
  const [json, setJson] = useState('');

  useEffect(() => void loadCatalog().then(setCatalog), []);
  const recipe = recipes.find((r) => r.id === id) ?? recipes[0];
  const original = useMemo<DragonRecipe>(
    () => ({ id: 'original', name: 'original', base: recipe.base }),
    [recipe.base],
  );

  const update = (fn: (r: DragonRecipe) => DragonRecipe) =>
    setRecipes((all) => all.map((r) => (r.id === recipe.id ? fn(r) : r)));
  const setColor = (patch: ColorAdjust) => update((r) => ({ ...r, color: clean({ ...r.color, ...patch }) }));
  const setMotion = (patch: MotionSettings) => update((r) => ({ ...r, motion: clean({ ...r.motion, ...patch }) }));
  const setPart = (g: string, patch: PartSettings) =>
    update((r) => ({ ...r, parts: clean({ ...r.parts, [g]: clean({ ...r.parts?.[g], ...patch }) }) }));
  const setAnim = (name: string, patch: AnimationSettings) =>
    update((r) => ({
      ...r,
      animations: clean({ ...r.animations, [name]: clean({ ...r.animations?.[name], ...patch }) }),
    }));

  const ready = (d: LabController) => {
    setDragon(d);
    if (!d.animations.includes(animation)) setAnimation(d.animations.includes('breathe') ? 'breathe' : d.animations[0]);
  };

  const create = (from: DragonRecipe | null) => {
    const name = from ? from.name + ' 2' : 'Dragon nou';
    const r: DragonRecipe = from ? { ...structuredClone(from), name } : { id: '', name, base: recipe.base };
    r.id = `${slug(name)}-${Date.now().toString(36)}`;
    setRecipes((all) => [...all, r]);
    setId(r.id);
  };
  const remove = () => {
    if (recipes.length < 2) return;
    const rest = recipes.filter((r) => r.id !== recipe.id);
    setRecipes(rest);
    setId(rest[0].id);
  };
  const save = async () => {
    const res = await fetch('/__dragon-lab/save', { method: 'POST', body: JSON.stringify(recipes, null, 1) });
    setMessage(
      res.ok
        ? `Salvat în src/dragon-lab/recipes.json (${recipes.length} rețete).`
        : 'Salvarea a eșuat: ' + (await res.text()),
    );
  };
  const exportRecipe = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(recipe, null, 1)], { type: 'application/json' }));
    a.download = recipe.id + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const snapshot = async () => {
    const blob = await dragon?.snapshot();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${recipe.id}-${animation}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const applyJson = () => {
    try {
      const r = JSON.parse(json) as DragonRecipe;
      if (!r.base) throw new Error('lipsește „base”');
      update(() => ({ ...r, id: recipe.id }));
      setMessage('Rețeta a fost aplicată.');
    } catch (e) {
      setMessage('JSON invalid: ' + (e as Error).message);
    }
  };

  const groups = useMemo(
    () => groupsOf(recipe).filter((g) => !dragon || dragon.usedGroups.has(g.id)),
    [recipe, dragon],
  );
  const part = recipe.parts?.[group] ?? {};
  const motion = recipe.motion ?? {};
  const color = recipe.color ?? {};
  const baseValue =
    'archive' in recipe.base ? 'a:' + recipe.base.archive : `m:${recipe.base.model}/${recipe.base.stage}`;
  const setBase = (v: string) => {
    const base: DragonSource = v.startsWith('a:')
      ? { archive: v.slice(2) }
      : { model: v.slice(2).split('/')[0], stage: v.slice(2).split('/')[1] };
    setDragon(null);
    update((r) => ({ ...r, base }));
  };

  return (
    <div className="lab">
      <div className="lab-stage">
        <div className="lab-view">
          <LabDragon recipe={recipe} animation={animation} paused={paused} background={background} onReady={ready} />
          {compare && (
            <LabDragon
              recipe={original}
              animation={animation}
              paused={paused}
              background={background}
              className="lab-compare"
            />
          )}
        </div>
        <div className="row gap-s wrap lab-row">
          {dragon?.animations.map((a) => (
            <button key={a} className={`btn small${a === animation ? ' primary' : ''}`} onClick={() => setAnimation(a)}>
              {animationLabel(recipe, a)}
            </button>
          ))}
        </div>
        <div className="row gap-s wrap lab-row">
          <button className="btn small" onClick={() => setPaused(!paused)}>
            {paused ? '▶' : '⏸'}
          </button>
          <button className="btn small" onClick={() => dragon?.reframe()} title="Reîncadrează camera">
            ⛶
          </button>
          <button className={`btn small${compare ? ' primary' : ''}`} onClick={() => setCompare(!compare)}>
            Compară cu originalul
          </button>
          <button className="btn small ghost" onClick={snapshot}>
            📷 PNG
          </button>
          {BACKGROUNDS.map((b) => (
            <button
              key={b}
              className={`lab-swatch${b === background ? ' active' : ''}`}
              style={{ background: b }}
              onClick={() => setBackground(b)}
              aria-label={'Fundal ' + b}
            />
          ))}
        </div>
      </div>

      <div className="lab-editor">
        <Section title="Rețetă" open>
          <div className="row gap-s wrap">
            <select value={recipe.id} onChange={(e) => setId(e.target.value)}>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button className="btn tiny" onClick={() => create(null)}>
              + Nou
            </button>
            <button className="btn tiny" onClick={() => create(recipe)}>
              Duplică
            </button>
            <button className="btn tiny danger" onClick={remove} disabled={recipes.length < 2}>
              Șterge
            </button>
          </div>
          <label className="lab-field">
            Nume
            <input value={recipe.name} onChange={(e) => update((r) => ({ ...r, name: e.target.value }))} />
          </label>
          <label className="lab-field">
            Descriere
            <input
              value={recipe.description ?? ''}
              onChange={(e) => update((r) => ({ ...r, description: e.target.value || undefined }))}
            />
          </label>
          <label className="lab-field">
            Schelet de bază
            <select value={baseValue} onChange={(e) => setBase(e.target.value)}>
              <optgroup label="Generați">
                {catalog?.models.flatMap((m) =>
                  m.stages.map((s) => (
                    <option key={m.id + s.id} value={`m:${m.id}/${s.id}`}>
                      {m.name} · {s.label}
                    </option>
                  )),
                )}
              </optgroup>
              <optgroup label="Bibliotecă">
                {catalog?.library
                  .filter((e) => e.kind === 'dragon')
                  .flatMap((e) =>
                    e.forms.map((f) => (
                      <option key={f.file} value={'a:' + f.file}>
                        {e.name} · {f.label}
                      </option>
                    )),
                  )}
              </optgroup>
            </select>
          </label>
        </Section>

        <Section title="Culoare (tot corpul)">
          <ColorControls value={color} onChange={setColor} />
        </Section>

        <Section title="Părți" open>
          <div className="lab-chips">
            {groups.map((g) => (
              <button
                key={g.id}
                className={`chip${g.id === group ? ' active' : ''}${recipe.parts?.[g.id] ? ' changed' : ''}`}
                onClick={() => setGroup(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <label className="lab-check">
            <input
              type="checkbox"
              checked={!!part.hidden}
              onChange={(e) => setPart(group, { hidden: e.target.checked })}
            />{' '}
            Ascunde partea
          </label>
          <h4>Formă</h4>
          <Range
            label="Mărime"
            value={part.scale}
            def={1}
            min={0.3}
            max={2.5}
            step={0.01}
            onChange={(v) => setPart(group, { scale: v })}
          />
          <Range
            label="Lungime"
            value={part.length}
            def={1}
            min={0.3}
            max={2.5}
            step={0.01}
            onChange={(v) => setPart(group, { length: v })}
          />
          <Range
            label="Grosime"
            value={part.width}
            def={1}
            min={0.3}
            max={2.5}
            step={0.01}
            onChange={(v) => setPart(group, { width: v })}
          />
          <Range
            label="Rotire"
            value={part.rotate}
            def={0}
            min={-90}
            max={90}
            step={1}
            onChange={(v) => setPart(group, { rotate: v })}
          />
          <Range
            label="Îndoire"
            value={part.curl}
            def={0}
            min={-30}
            max={30}
            step={0.5}
            onChange={(v) => setPart(group, { curl: v })}
          />
          <h4>Mișcare</h4>
          <Range
            label="Amplitudine"
            value={part.amplify}
            def={1}
            min={0}
            max={3}
            step={0.05}
            onChange={(v) => setPart(group, { amplify: v })}
          />
          <Range
            label="Val (grade)"
            value={part.wave}
            def={0}
            min={0}
            max={40}
            step={0.5}
            onChange={(v) => setPart(group, { wave: v })}
          />
          <Range
            label="Viteză val"
            value={part.waveSpeed}
            def={1}
            min={0.1}
            max={4}
            step={0.05}
            onChange={(v) => setPart(group, { waveSpeed: v })}
          />
          <Range
            label="Defazaj val"
            value={part.waveLag}
            def={0.6}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => setPart(group, { waveLag: v })}
          />
          <Range
            label="Inerție"
            value={part.inertia}
            def={0}
            min={0}
            max={0.95}
            step={0.01}
            onChange={(v) => setPart(group, { inertia: v })}
          />
          <h4>Culoare</h4>
          <ColorControls value={part} onChange={(p) => setPart(group, p)} />
          <button
            className="btn tiny ghost"
            onClick={() => update((r) => ({ ...r, parts: clean({ ...r.parts, [group]: undefined }) }))}
          >
            Resetează partea
          </button>
        </Section>

        <Section title="Mișcare (tot corpul)" open>
          <Range
            label="Viteză"
            value={motion.speed}
            def={1}
            min={0.2}
            max={2.5}
            step={0.05}
            onChange={(v) => setMotion({ speed: v })}
          />
          <Range
            label="Ritm neregulat"
            value={motion.warp}
            def={0}
            min={0}
            max={0.9}
            step={0.01}
            onChange={(v) => setMotion({ warp: v })}
          />
          <Range
            label="Plutire"
            value={motion.bob}
            def={0}
            min={0}
            max={60}
            step={1}
            onChange={(v) => setMotion({ bob: v })}
          />
          <Range
            label="Viteză plutire"
            value={motion.bobSpeed}
            def={0.5}
            min={0.1}
            max={3}
            step={0.05}
            onChange={(v) => setMotion({ bobSpeed: v })}
          />
          <Range
            label="Legănare"
            value={motion.sway}
            def={0}
            min={0}
            max={20}
            step={0.5}
            onChange={(v) => setMotion({ sway: v })}
          />
          <Range
            label="Viteză legănare"
            value={motion.swaySpeed}
            def={0.3}
            min={0.1}
            max={3}
            step={0.05}
            onChange={(v) => setMotion({ swaySpeed: v })}
          />
          <label className="lab-field">
            Animație suprapusă
            <select value={motion.overlay ?? ''} onChange={(e) => setMotion({ overlay: e.target.value || undefined })}>
              <option value="">—</option>
              {dragon?.allAnimations.map((a) => (
                <option key={a} value={a}>
                  {animationLabel(recipe, a)}
                </option>
              ))}
            </select>
          </label>
          {motion.overlay && (
            <Range
              label="Cât de mult"
              value={motion.overlayAlpha}
              def={0.5}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setMotion({ overlayAlpha: v })}
            />
          )}
          <Range
            label="Zoom"
            value={motion.zoom}
            def={1}
            min={0.4}
            max={2.5}
            step={0.05}
            onChange={(v) => setMotion({ zoom: v })}
          />
          <label className="lab-check">
            <input type="checkbox" checked={!!motion.flip} onChange={(e) => setMotion({ flip: e.target.checked })} />{' '}
            Oglindit
          </label>
        </Section>

        <Section title="Animații">
          {dragon?.allAnimations.map((a) => {
            const s = recipe.animations?.[a] ?? {};
            return (
              <div key={a} className="lab-anim">
                <code>{a}</code>
                <input
                  placeholder={animationLabel({ ...recipe, animations: undefined }, a)}
                  value={s.label ?? ''}
                  onChange={(e) => setAnim(a, { label: e.target.value || undefined })}
                />
                <input
                  type="number"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={s.speed ?? 1}
                  onChange={(e) => setAnim(a, { speed: +e.target.value === 1 ? undefined : +e.target.value })}
                  title="Viteză"
                />
                <label className="lab-check">
                  <input
                    type="checkbox"
                    checked={!!s.hidden}
                    onChange={(e) => setAnim(a, { hidden: e.target.checked })}
                  />{' '}
                  ascunsă
                </label>
              </div>
            );
          })}
        </Section>

        <Section title="JSON">
          <textarea
            className="lab-json"
            value={json || JSON.stringify(recipe, null, 1)}
            onChange={(e) => setJson(e.target.value)}
            onBlur={() => !json && setJson('')}
          />
          <div className="row gap-s wrap">
            <button className="btn tiny" onClick={applyJson} disabled={!json}>
              Aplică JSON
            </button>
            <button className="btn tiny ghost" onClick={() => setJson('')}>
              Reîmprospătează
            </button>
            <button className="btn tiny ghost" onClick={exportRecipe}>
              Descarcă rețeta
            </button>
          </div>
        </Section>

        <div className="row gap-s wrap lab-row">
          {import.meta.env.DEV && (
            <button className="btn primary" onClick={save}>
              💾 Salvează toate rețetele
            </button>
          )}
          {message && <small className="muted">{message}</small>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="lab-section" open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

function Range({
  label,
  value,
  def,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value?: number;
  def: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number | undefined) => void;
}) {
  const v = value ?? def;
  return (
    <label
      className={`lab-range${value !== undefined ? ' changed' : ''}`}
      onDoubleClick={() => onChange(undefined)}
      title="Dublu-clic: valoarea implicită"
    >
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(+e.target.value === def ? undefined : +e.target.value)}
      />
      <output>{Math.round(v * 100) / 100}</output>
    </label>
  );
}

function ColorControls({ value, onChange }: { value: ColorAdjust; onChange: (p: ColorAdjust) => void }) {
  return (
    <>
      <Range
        label="Nuanță"
        value={value.hue}
        def={0}
        min={-180}
        max={180}
        step={1}
        onChange={(v) => onChange({ hue: v })}
      />
      <Range
        label="Saturație"
        value={value.saturation}
        def={1}
        min={0}
        max={3}
        step={0.05}
        onChange={(v) => onChange({ saturation: v })}
      />
      <Range
        label="Luminozitate"
        value={value.lightness}
        def={0}
        min={-1}
        max={1}
        step={0.02}
        onChange={(v) => onChange({ lightness: v })}
      />
      <label className="lab-range">
        <span>Colorează</span>
        <input
          type="color"
          value={value.colorize ?? '#ffffff'}
          onChange={(e) => onChange({ colorize: e.target.value, colorizeAmount: value.colorizeAmount ?? 1 })}
        />
        <button
          className="btn tiny ghost"
          onClick={() => onChange({ colorize: undefined, colorizeAmount: undefined })}
          disabled={!value.colorize}
        >
          ✕
        </button>
      </label>
      {value.colorize && (
        <Range
          label="Intensitate"
          value={value.colorizeAmount}
          def={1}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onChange({ colorizeAmount: v ?? 1 })}
        />
      )}
    </>
  );
}
