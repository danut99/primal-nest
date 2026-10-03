# Primal Nest — Ultimul Cuib

Idle MMO cu dinozauri: bucla de joc din MilkyWay Idle, colecția și evoluțiile din Pokémon, tonul dark fantasy din Dinoblade.

Acum 66 de milioane de ani, cerul a ars. Ultimele ouă au supraviețuit în chihlimbar. Acum Umbra corupe dinozaurii, iar fiecare regiune e stăpânită de un Alfa. Clocești ouă, crești o haită, câștigi relicve străvechi și îi înfrunți pe Alfa.

Conceptul complet: [docs/CONCEPT_V0_1.md](docs/CONCEPT_V0_1.md).

## Pornire

Node.js 22+ și npm:

```sh
npm install
npm run dev
```

Deschide http://127.0.0.1:5173. Salvarea e locală, în browser. În modul de dezvoltare, butonul ⏩ din stânga jos avansează timpul (+1 min … +8 h) și poate începe un joc nou. Tot de acolo se vede galeria cu toate creaturile: `/#galerie`.

## Ce conține primul MVP

- **Cuib**: ouă cu timer real, temperatura cuibului dă temperamentul, rotirea grăbește eclozarea, lumânarea arată un indiciu despre gene.
- **Haită**: 5 linii (20 de forme), gene, albino 1/512, hrănire și atașament, evoluție pe timp (Năpârlire). Ramura de adult depinde de dietă.
- **Activități** (stil MilkyWay): Cules, Săpături, Bucătărie; o activitate odată, continuă offline până la 8 h.
- **Expediții**: lupte pe ture animate sau expediții idle (offline până la 10 h). 3 regiuni, fiecare păzită de un Alfa care deschide drumul mai departe și lasă o relicvă.
- **Tabără**: construcții, forja lui Saurok (vânzare), skill-uri. **Atlasul Speciilor**.
- Efectele de sânge din luptă se pot opri (🩸), la fel și sunetul (🔊).

## Structura

```text
shared/game/      Regulile jocului, pure și testabile (viitor comune cu serverul)
  catalog.ts      Specii, tipuri, obiecte, ouă, skill-uri, regiuni, Alfa, relicve: echilibrarea
  nest.ts         Incubare, rotire, lumânare, eclozare
  creatures.ts    Statistici, nivel, hrănire, evoluție, relicve
  battle.ts       Luptă deterministă (seed), inamici, Alfa
  activities.ts   Cules/săpături, bucătărie, expediții, revendicare
  commands.ts     runCommand: o comandă pe o copie a stării
  game.test.ts    Teste de reguli și echilibrare
src/
  app/App.tsx     Cadrul: bara de sus, navigare, activitate, notificări
  screens/        Cuib, Haită, Activități, Expediții, Luptă, Tabără, Atlas, Început
  components/     DinoSprite, EggSprite (SVG desenat în cod), Saurok, cerul, piese UI
  styles/app.css  Tema vizuală
```

Arhitectura urmează Hearth & Crown (`../proiect nou`): reguli fără React în `shared/game`, comenzi tranzacționale, RNG determinist. Mutarea pe server (Node + SQLite) e etapa următoare.

## Artă

- **Dinozaurii** sunt modele 3D gratuite (Quaternius CC0; Hoai Nguyen și Poly by Google CC-BY), aflate în `public/models`. Autorii și licențele sunt în [public/models/CREDITS.md](public/models/CREDITS.md).
- În lupte, modelele se mișcă în 3D (three.js). În restul jocului apar ca imagini randate din aceleași modele.
- Modelul, culoarea și poza fiecărei specii sunt în `src/content/dinoModels.ts`.
- Pentru o nouă randare a imaginilor (cu `npm run dev` pornit): `node scripts/render-dinos.mjs`. Planșa de verificare: `node scripts/render-dinos.mjs --preview=plansa.png`.
- Randările ajung în `src/local-art/dinos/`, iar scenele de test în `src/local-art/scenes/`. Folderul e exclus din git (detalii în `src/local-art/CITESTE.md`). Dacă o imagine lipsește, jocul folosește desenul din cod.

## Verificări

```sh
npm test
npm run build
```
