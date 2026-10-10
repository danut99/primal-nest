# Wikipedia din joc

Butonul din meniul de jos deschide ghidul, între Atlas și Extinde. Are categorii, căutare fără diacritice, pași de urmat, tabele de costuri și legături între fișe.

Textele sunt în `src/content/wiki.ts`; ecranul în `src/screens/WikiScreen.tsx`, iar aspectul în `src/styles/wiki.css`. Fișele speciilor, lumilor, clădirilor și obiectelor folosesc cataloagele din `shared/game`, astfel încât numele, prețurile, capacitățile și rețetele se actualizează odată cu jocul. Pentru o mecanică nouă, adaugă explicația în lista `basics` și leag-o de articolele relevante prin `related`.

Verificare: `npx vitest run src/content/wiki.test.ts`, `npm run build` și `node scripts/review-wiki.mjs`. Ultimul verifică acoperirea catalogului, imaginile, legăturile, căutarea, închiderea și afișarea la 320/390 px; capturile sunt în `output/wiki/`.
