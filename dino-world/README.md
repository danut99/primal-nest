# Dino World

Joc de colecție cu dinozauri, în stilul Dragon City: o insulă cu habitate pe elemente, ferme, incubator,
împerechere și un atlas al speciilor. Aspectul fiecărui dinozaur vine dintr-un generator (elemente + raritate + seed)
aplicat pe schelete Spine animate.

```sh
npm install
npm run dev      # http://127.0.0.1:5173
npm test
npm run build
```

În dev, butonul ⏩ (stânga jos) avansează timpul și pornește un joc nou.

## Bucla de joc

- **Insula** are parcele fixe (`SLOTS`): pe ele construiești habitate (6 elemente) sau ferme.
- **Habitatele** produc aur în timp, până la un plafon; un dinozaur locuiește doar într-un habitat cu un element al lui.
- **Fermele** cresc hrană; hrana crește nivelul dinozaurilor (și aurul pe minut).
- **Incubatorul**: ouă cumpărate sau din împerechere; puiul iese direct într-un habitat potrivit.
- **Bârlogul**: doi dinozauri de nivel 4+ dau un ou dintr-o specie ale cărei elemente le au părinții (hibrizi, epici, legendari).
- **Atlasul**: toate speciile, cele nedescoperite ca siluete.

## Structura

```text
shared/game/        Regulile, fără React (pure, deterministe, testate) — viitor comune cu serverul
  catalog.ts        Elemente, rarități, specii, clădiri, parcele, culturi: echilibrarea
  world.ts          Parcele, construire/mutare/îmbunătățire, aurul habitatelor, fermele
  dinos.ts          Ouă, eclozare, hrănire, mutare, vânzare, împerechere
  commands.ts       runCommand: o comandă pe o copie a stării (la eroare, starea rămâne neschimbată)
src/
  app/App.tsx       Cadrul: lumea pe tot ecranul + HUD (resurse, butoane)
  screens/          WorldScreen (insula, camera, parcele), BuildingPanel, ShopPanel, AtlasScreen
  world/            islands.ts (imaginea insulei + pozițiile parcelelor), BuildingArt (habitatele în SVG)
  dino-lab/         Biblioteca de dinozauri (vezi mai jos)
  hooks/useGame.ts  Starea, salvarea locală, ceasul, notificările
public/
  world/            Insulele pictate (sursele mari în art/)
  dinosaurs/        Scheletele Spine (manifest.json + câte un folder pe schelet) și runtime-ul
```

## Biblioteca de dinozauri (`src/dino-lab`)

- `engine.ts` — aplică o **rețetă** pe un schelet Spine: culori pe părți (cap, corp, coadă, picioare, brațe,
  creastă, efecte), proporții, mișcare (val, inerție, ritm, săltare). Se schimbă live.
- `generator.ts` — `generateDino({ elements, rarity, seed, rig })`: rețetă completă din paleta și temperamentul
  elementelor. Același seed → același dinozaur.
- `recipes.ts` + `recipes.json` — rețeta unei specii: cea salvată în `recipes.json` sau, altfel, cea generată.
- `DinoView.tsx` — componenta React animată; `thumbnails.ts` — PNG-uri statice (un singur context WebGL).

**Schelet nou** (raptor, triceratops, sauropod): folder în `public/dinosaurs/<rig>/` cu `skeleton.json`,
`parts.atlas`, `parts.png`, o intrare în `manifest.json`, apoi `rig: '<rig>'` la specie. Părțile se recunosc
după numele oaselor (`DEFAULT_GROUPS` în `engine.ts`).

**Artă pictată pentru clădiri**: PNG-uri în `public/world/` și o intrare în `SPRITES` din `world/BuildingArt.tsx`;
imaginea înlocuiește desenul vectorial.

## Expediții zilnice

Avanpostul oferă trei locuri de misiune și trei rezerve, schimbate la miezul nopții în `Europe/Bucharest`.
Speciile și nivelurile cerute trebuie îndeplinite de dinozauri diferiți. Un loc neînceput poate fi înlocuit
cu o rezervă pentru 5 diamante; rezerva se consumă și limita rămâne trei misiuni zilnice.

Durata explorării / recuperării: ușoară 20 / 30 minute, specializată 45 / 90 minute, dificilă 90 / 180 minute.
Recuperarea începe la întoarcere, inclusiv offline, independent de revendicare. Blochează arena, alte
expediții și împerecherea; hrănirea și venitul continuă. Timerul este vizibil în card și în scena dinozaurului.

Recompensele includ fragmente ancestrale. Echipamentul de teren are trei îmbunătățiri (25, 60, 100 fragmente),
fiecare cu +10% aur, hrană și fragmente. Recompensa este fixată la plecare. Cele trei misiuni revendicate
în aceeași zi acordă automat un cufăr de 15 fragmente și 2 diamante. Misiunile din ziua precedentă își
păstrează recompensele, fără să completeze locuri din lista nouă. Salvările cu expediții vechi rămân compatibile.
