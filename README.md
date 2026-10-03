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

- **Regiunile** (fundalurile expedițiilor și ale arenei) vin din `art/scenes`; `npm run scenes` le comprimă în `src/assets/scenes`.
- Alte scene de test (ecranul de start, povestea) stau în `src/local-art/scenes/`, exclus din git (vezi `src/local-art/CITESTE.md`).
- **Creaturile** sunt dragonii animați din `public/dragons` (vezi `src/content/dragons.ts`): liniile sauropod/raptor/ankylo/ptero folosesc Nerion/Pyron/Crystalis/Solarys (pui, juvenil, cele două ramuri de adult = adult/subadult). Alfa regiunilor sunt boșii Umbraxis, Auralis, Vortexion, Kronazar.
- În Haită, la eclozare și în Atlas apar animați (atinge-i ca să zboare/atace); în liste, imagini statice din `public/dragons/stills` (`npm run stills`, cu `npm run dev` pornit).
- **Lupta** (`src/battle/Arena.ts`) folosește animațiile lor: mers/zbor până la țintă și `attack` pentru atacul de bază, `special1` pentru ultimată, `levelup` la victorie. Puii nu luptă: intră în haită după prima evoluție.
- **Dragonii animați** (Spine 3.8, preluați din DCAT) stau în `public/dragons`: cei 4 dragoni generați (Solarys, Pyron, Nerion, Crystalis, câte 4 evoluții) + Auralis în `models/`, iar arhivele Dragon City în `library/` (DDS-ul se convertește în browser, fără server). Codul e în `src/dragons` (`<DragonPlayer source={{ model: 'nerion', stage: 'adult' }} />`); ecranul „Dragoni” din meniu sau direct `/#dragoni`. După ce adaugi arhive noi: `npm run dragons`.

## Verificări

```sh
npm test
npm run build
```
