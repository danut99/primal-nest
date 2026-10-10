# Ignisaur — original painted stages

Generated with the imagegen skill's CLI/API workflow, `gpt-image-2`, high quality, native 1536 × 1024. The adult was generated from scratch; its original artwork provided the identity reference for independently painted baby and juvenile variants. All three backgrounds were chroma keyed to transparent PNGs.

Exact prompts: [adult](ignisaur-adult.txt), [baby](ignisaur-pui.txt), [juvenile](ignisaur-juvenil.txt).

Original API outputs: `output/imagegen/ignisaur/{adult,pui,juvenil}-source.png`.
Transparent artwork: `../rig-lab/generated-dinosaurs/ignisaur/{pui,juvenil,adult}/art.png`.
Game assets: `public/dinosaurs/ignisaur-{pui,juvenil,adult}/`.

Each stage has individually measured anatomy, a continuous weighted painted mesh, 23 bones, and four authored animations: idle, walk, attack, ultimate. The skeleton landmarks are in `../rig-lab/data/species-ignisaur.mjs`; the dedicated builder preserves these rigs independently of the general rig-lab build.

Evolution selects baby at levels 1–3, juvenile at 4–6, and adult from level 7. Display zoom is 0.58 for the baby, 0.79 for the juvenile, and 1 for the adult, preserving age size differences in the engine and herd. Ignisaur's only eligible habitat is fire.

Rebuild from the saved transparent art without generating new images:

```sh
node scripts/build-ignisaur.mjs
node scripts/validate-ignisaur.mjs
node scripts/bake-previews.mjs ignisaur
node scripts/review-ignisaur.mjs
```

The dense validator samples all animation poses at 60 Hz, checks mesh winding and normalized weights, and verifies idle/walk loop closure. Browser review renders all stages and actions with the game's engine and creates an isolated saved game containing the three ages in a fire habitat. Reports and screenshots are saved to `output/ignisaur/`.
