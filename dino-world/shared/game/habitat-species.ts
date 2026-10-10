import type { ElementId, Species } from './types';

const families: [ElementId, [string, string, string], [string, string, string]][] = [
  [
    'fire',
    ['pyroceratops', 'Pyroceratops', 'Ceratopsian vulcanic cu trei coarne și guler de bazalt.'],
    ['cineraptor', 'Cineraptor', 'Raptor agil cu pene de cenușă și gheare-seceră.'],
  ],
  [
    'water',
    ['pelagisaur', 'Pelagisaur', 'Înotător cu gât lung și patru înotătoare articulate.'],
    ['fluviovenator', 'Fluviovenator', 'Vânător de pești cu bot alungit și velă coral.'],
  ],
  [
    'earth',
    ['ferrankyl', 'Ferrankyl', 'Dinozaur blindat cu o măciucă grea la capătul cozii.'],
    ['terratitan', 'Terratitan', 'Sauropod înalt cu gât lung și coadă ca un bici.'],
  ],
  [
    'plant',
    ['silvosteg', 'Silvosteg', 'Stegozaur cu plăci verzi și spini pe coadă.'],
    ['frondonychus', 'Frondonychus', 'Dinozaur cu mantie de pene și trei gheare lungi.'],
  ],
  [
    'ice',
    ['cryolophus', 'Cryolophus', 'Prădător robust cu o creastă de gheață.'],
    ['tundraceratops', 'Tundraceratops', 'Ceratopsian polar cu guler lat și două coarne.'],
  ],
  [
    'storm',
    ['tempestopteryx', 'Tempestopteryx', 'Zburător cu cioc lung și aripi străbătute de fulgere.'],
    ['fulgurodrome', 'Fulgurodrome', 'Alergător rapid cu pene albastre și coadă în evantai.'],
  ],
];

/** Singura specie care iese din oul unei lumi (magazin). Restul speciilor lumii vin doar din Bârlog. */
export const EGG_SPECIES: Record<ElementId, string> = {
  fire: 'ignisaur',
  water: 'pelagisaur',
  earth: 'ferrankyl',
  plant: 'silvosteg',
  ice: 'cryolophus',
  storm: 'fulgurodrome',
};
const fromEgg = new Set(Object.values(EGG_SPECIES));

/**
 * Rețetele Bârlogului: specia rară și perechea de părinți (în orice ordine) care o poate da. Toți părinții vin din
 * ouă, de pe elemente diferite, ca să ai nevoie de mai multe lumi.
 */
export const DEN_RECIPES: Record<string, [string, string]> = {
  pyroceratops: ['ignisaur', 'ferrankyl'],
  cineraptor: ['ignisaur', 'fulgurodrome'],
  fluviovenator: ['pelagisaur', 'silvosteg'],
  terratitan: ['ferrankyl', 'silvosteg'],
  frondonychus: ['silvosteg', 'cryolophus'],
  tundraceratops: ['cryolophus', 'ferrankyl'],
  tempestopteryx: ['fulgurodrome', 'pelagisaur'],
};

export const HABITAT_SPECIES: Species[] = families.flatMap(([element, ...members], habitatIndex) =>
  members.map(([id, name, description], index) => ({
    // Scheletele vin din studio, câte unul pe vârstă (src/dino-lab/recipes.ts).
    id,
    name,
    description,
    elements: [element],
    rig: `${id}-adult`,
    rarity: fromEgg.has(id) ? 'common' : 'rare',
    income: 7 + habitatIndex + index * 3,
    hatchSeconds: 45 + habitatIndex * 15 + index * 30,
    breedSeconds: 60 + habitatIndex * 30 + index * 30,
    // doar speciile din ouă se cumpără; cele rare vin din Bârlog
    shopPrice: fromEgg.has(id) ? 200 + habitatIndex * 100 + index * 150 : undefined,
  })),
);
