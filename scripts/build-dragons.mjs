// Reface lista „library” din public/dragons/manifest.json pe baza arhivelor Dragon City din public/dragons/library.
// Modelele generate („models”) sunt scrise de mână și rămân neatinse.
//   node scripts/build-dragons.mjs [localization.json]   (numele vin din localizare, din manifestul vechi sau din numele arhivei)

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../public/dragons/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'));

const names = new Map(manifest.library?.map((e) => [e.id, e.name]));
const forms = new Map(manifest.library?.flatMap((e) => e.forms.map((f) => [f.file, f.label])));
if (process.argv[2]) {
  for (const entry of JSON.parse(readFileSync(process.argv[2], 'utf8'))) {
    const [key, value] = Object.entries(entry)[0];
    const m = /^tid_unit_(\d+)_name$/.exec(key);
    if (m) names.set(m[1], value);
  }
}

const AGE = { 1: 'Pui', 2: 'Juvenil', 3: 'Adult' };
const title = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const groups = new Map();
for (const file of readdirSync(new URL('library/', ROOT))
  .filter((f) => f.endsWith('.zip'))
  .sort()) {
  const stem = file.replace(/^basic_/, '').replace(/_HD_spine.*$/, '');
  // 2725_dragon_polargeneral_1 · 2818_dragon_unspeakable_b_3 · 3109_dragon_highredemptionnorn_skin1_3 · 2809_dragon_highsacredwing_3_skin_3
  const d = /^(\d+)_dragon_([a-z0-9]+)(_b)?(?:_skin(\d+))?_([123])(?:_skin_(\d+))?$/.exec(stem);
  let id, name, kind, label;
  if (d) {
    const [, num, slug, black, skin, age, skin2] = d;
    id = num;
    name = names.get(num) ?? title(slug) + ' Dragon';
    kind = 'dragon';
    label = AGE[age] + (black ? ' (aură neagră)' : '') + (skin || skin2 ? ` · skin ${skin || skin2}` : '');
  } else {
    const fatality = /^fx_(\d+)_fatality/.exec(stem);
    id = stem;
    name = names.get(stem) ?? (fatality ? `${names.get(fatality[1]) ?? fatality[1]} · fatality` : title(stem));
    kind = 'efect';
    label = 'Animație';
  }
  if (!groups.has(id)) groups.set(id, { id, name, kind, forms: [] });
  groups.get(id).forms.push({ label: forms.get(file) ?? label, file });
}

manifest.library = [...groups.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
writeFileSync(new URL('manifest.json', ROOT), JSON.stringify(manifest, null, 1) + '\n');
console.log(`${manifest.models.length} modele generate, ${manifest.library.length} intrări în bibliotecă.`);
