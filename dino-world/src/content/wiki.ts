// Conținutul Wikipedia (screens/WikiScreen.tsx): categoriile, articolele și căutarea.
// Cifrele (costuri, timpi, șanse) se citesc din regulile jocului (@shared/game), ca ghidul să nu rămână în urmă
// când se schimbă echilibrarea. Articolele scrise de mână sunt în `basics`; clădirile, lumile, speciile și
// obiectele se generează din catalog. Id-urile articolelor sunt folosite și din joc („Du-mă acolo”): nu le
// redenumi ('first-steps', 'saving', `building-${kind}`, `world-${element}` …).

import {
  SPECIES,
  ELEMENTS,
  ELEMENT_IDS,
  RARITIES,
  BUILDINGS,
  BUILD_UNLOCKS,
  CROPS,
  FARM_PLOTS,
  WORLD_UNLOCK_COST,
  HABITAT_CAPACITY,
  HABITAT_UPGRADE_COST,
  HABITAT_GOLD_CAP,
  HATCHERY_SLOTS,
  EVOLUTION_STAGES,
  MAX_LEVEL,
  BREED_LEVEL,
  FEED_COST,
  DEN_RECIPES,
  DEN_RARE_CHANCE,
  DEN_ADULT_BONUS,
  DEN_REST_MS,
  HABITAT_EGG_PRICE,
  EGG_SPECIES,
  FINAL_LEVEL_FRAGMENTS,
  ITEMS,
  MATERIALS,
  GEAR_SLOTS,
  buildingUpgradeParts,
  incomeAt,
  ATLAS_REWARD,
  ARENA_RECOVERY_MS,
  ARENA_TRAINING_COST,
  arenaAbility,
  EXPEDITION_TRAINING_COST,
  EXPEDITION_CHEST_TARGET,
  EXPEDITION_SWAP_COST,
  type BuildingKind,
  type MaterialId,
} from '@shared/game';

// ---------- categorii și tipuri ----------

export const WIKI_CATEGORIES = [
  { id: 'start', name: 'Primii pași', icon: '🧭', description: 'Cum începi și cum explorezi lumea' },
  { id: 'resources', name: 'Resurse', icon: '🪙', description: 'Aur, hrană, nestemate și materiale' },
  { id: 'worlds', name: 'Lumi și habitate', icon: '🏝️', description: 'Cele șase lumi și locuitorii lor' },
  { id: 'buildings', name: 'Clădiri', icon: '🏛️', description: 'Construcții, producție și îmbunătățiri' },
  { id: 'dinos', name: 'Dinozauri', icon: '🦖', description: 'Fiecare specie, nivelurile și evoluția' },
  { id: 'breeding', name: 'Ouă și împerechere', icon: '🥚', description: 'Incubare, părinți și rețete de specii' },
  { id: 'adventures', name: 'Arena și expedițiile', icon: '⚔️', description: 'Echipe, lupte și recompense' },
  { id: 'items', name: 'Forjă și obiecte', icon: '⚒️', description: 'Rețete, echipament și consumabile' },
  { id: 'help', name: 'Întrebări frecvente', icon: '💡', description: 'Ce faci când ceva nu merge' },
] as const;
export type WikiCategory = (typeof WIKI_CATEGORIES)[number]['id'];

export interface WikiSection {
  title: string;
  paragraphs?: string[];
  steps?: string[];
  table?: { headers: string[]; rows: string[][] };
}

export interface WikiArticle {
  id: string;
  category: WikiCategory;
  title: string;
  icon: string;
  summary: string;
  sections: WikiSection[];
  related?: string[];
  image?: string;
}

// ---------- unelte de text ----------

const n = (v: number) => v.toLocaleString('ro-RO');
const time = (seconds: number) =>
  seconds === 1
    ? 'o secundă'
    : seconds === 60
      ? 'un minut'
      : seconds === 3600
        ? 'o oră'
        : seconds < 60
          ? `${seconds} secunde`
          : seconds < 3600
            ? `${n(seconds / 60)} minute`
            : `${n(seconds / 3600)} ore`;
const speciesName = (id: string) => SPECIES.find((s) => s.id === id)?.name ?? id;
const section = (title: string, ...paragraphs: string[]): WikiSection => ({ title, paragraphs });
const table = (title: string, headers: string[], rows: string[][]): WikiSection => ({
  title,
  table: { headers, rows },
});
// ---------- clădiri: iconițe și explicații (folosite de articolele generate) ----------

const buildingIcons: Record<BuildingKind, string> = {
  farm: '🌾',
  hatchery: '🥚',
  den: '💕',
  arena: '⚔️',
  outpost: '🧭',
  forge: '⚒️',
  habitat: '🏝️',
};

const buildingHelp: Record<BuildingKind, string[]> = {
  farm: [
    'Produce hrana necesară creșterii dinozaurilor. Fiecare strat cultivă separat: alegi o cultură, plătești aurul și culegi când timpul s-a încheiat.',
    `Poți avea până la ${BUILDINGS.farm.limit} ferme. Nivelurile fermei oferă ${FARM_PLOTS.join(', ')} straturi.`,
  ],
  hatchery: [
    'Aici aștepți să fie gata ouăle, apoi alegi o lume potrivită cu loc liber pentru pui. Incubatorul există de la început.',
    `Poate ține ${HATCHERY_SLOTS.join(' sau ')} ouă simultan, în funcție de nivel. Un ou gata ocupă în continuare un loc până îl eclozezi.`,
  ],
  den: [
    `Alegi doi dinozauri diferiți, fiecare cel puțin la nivelul ${BREED_LEVEL}. Perechile speciale pot produce o specie rară.`,
    `După ce oul este gata, părinții au ${time(DEN_REST_MS / 1000)} de odihnă. Ai nevoie de un loc liber în incubator pentru a prelua oul.`,
  ],
  arena: [
    'Alegi un adversar și un dinozaur disponibil. Nivelul, echipamentul, abilitatea și avantajul elementului influențează duelul.',
    'Deschide Arena pentru lupte, antrenarea abilităților și revendicarea recompenselor.',
  ],
  outpost: [
    'De aici trimiți dinozauri în expediții. Alege o misiune și o echipă care îndeplinește cerințele afișate.',
    `Când echipa revine, revendică recompensa. După ${EXPEDITION_CHEST_TARGET} expediții revendicate într-o zi poți deschide cufărul zilnic.`,
  ],
  forge: [
    'Transformă aurul și materialele în echipament, consumabile și piese pentru clădiri. Forja lucrează la un singur obiect odată.',
    'Nivelul forjei deblochează rețete. Când obiectul este gata, colectează-l; apare în inventar și poate fi folosit în panoul potrivit.',
  ],
  habitat: [
    'Fiecare lume are propriul element și primește dinozauri compatibili. Locuitorii produc aur până se umple depozitul.',
    'Îmbunătățește lumea pentru mai multe locuri și un depozit mai mare. Costurile diferă între elemente; vezi fișa fiecărei lumi.',
  ],
};

// ---------- articole scrise de mână: primii pași, resurse, ajutor ----------

const basics: WikiArticle[] = [
  {
    id: 'medals',
    category: 'resources',
    title: 'Medalii',
    icon: '🏅',
    summary: 'Câștigă dueluri și antrenează abilitatea dinozaurilor.',
    sections: [
      section(
        'Cum le obții',
        'Câștigă un duel în Arenă, apoi revendică recompensa. Medaliile câștigate pot fi cheltuite pe antrenarea abilității unui dinozaur.',
      ),
      table(
        'Antrenarea abilității',
        ['Îmbunătățire', 'Medalii'],
        ARENA_TRAINING_COST.map((cost, i) => [`${i} → ${i + 1}`, n(cost)]),
      ),
    ],
    related: ['arena', 'equipment'],
  },
  {
    id: 'first-steps',
    category: 'start',
    title: 'De unde începi?',
    icon: '🧭',
    summary: 'Primul habitat, primele ouă și creșterea colecției.',
    sections: [
      {
        title: 'Un început simplu',
        steps: [
          'Deschide Extinde → Lumi și deblochează lumea de Foc.',
          'Intră în Incubator și verifică ouăle. Pentru ouă noi, folosește Extinde → Ouă.',
          'Eclozează oul gata într-o lume compatibilă, cu loc liber.',
          'Cultivă hrană la Fermă și hrănește dinozaurii pentru a-i crește.',
          'Strânge aurul și urmărește obiectivul afișat pe ecran. Construiește apoi Avanpostul, Arena, Bârlogul și Forja când devin disponibile.',
        ],
      },
    ],
    related: ['world-fire', 'building-hatchery', 'feeding', 'objectives'],
  },
  {
    id: 'navigation',
    category: 'start',
    title: 'Camera și butoanele jocului',
    icon: '🗺️',
    summary: 'Explorează insulele și găsește fiecare panou.',
    sections: [
      section(
        'Explorează',
        'Trage harta pentru a muta camera. Pe calculator folosește rotița pentru zoom; pe telefon folosește două degete sau butoanele + și −. Atinge o insulă pentru a te apropia, apoi o clădire ori un dinozaur pentru a-l deschide.',
      ),
      section(
        'Meniul de jos',
        'Strânge colectează aurul disponibil. Atlas arată speciile și formele descoperite. Wikipedia explică jocul. Extinde deschide lumile, ouăle și clădirile pe care le poți cumpăra.',
      ),
    ],
    related: ['gold', 'atlas', 'construction'],
  },
  {
    id: 'construction',
    category: 'start',
    title: 'Construiește și îmbunătățește',
    icon: '🏗️',
    summary: 'Așază clădiri pe insula principală și verifică cerințele.',
    sections: [
      {
        title: 'Construirea unei clădiri',
        steps: [
          'Deschide Extinde → Clădiri.',
          'Verifică aurul necesar și condiția de deblocare.',
          'Alege clădirea și o poziție validă pe insula principală.',
          'Pentru mutare, deschide clădirea și folosește Mută. Habitatele au insule dedicate.',
        ],
      },
      section(
        'Niveluri noi',
        'Deschide clădirea și verifică îmbunătățirea. Nivelurile noi pot cere aur, piese făurite și fragmente ancestrale. Mai întâi colectează producția sau termină activitatea dacă panoul îți cere acest lucru.',
      ),
    ],
    related: ['building-forge', 'fragments', 'building-habitat'],
  },
  {
    id: 'objectives',
    category: 'start',
    title: 'Obiective și recompense',
    icon: '🎯',
    summary: 'Cardul de obiectiv îți arată următorul pas.',
    sections: [
      section(
        'Urmărește obiectivul',
        'Pe hartă este afișat obiectivul curent și progresul lui. Acțiunile din joc îl avansează: deblocarea lumilor, eclozarea, hrănirea, colectarea sau construcțiile.',
      ),
      section(
        'Ridică recompensa',
        'După ce ai îndeplinit cerința, revendică recompensa din card. Citește următorul obiectiv pentru a afla ce poți face mai departe.',
      ),
    ],
    related: ['first-steps', 'atlas'],
  },
  {
    id: 'saving',
    category: 'start',
    title: 'Salvarea progresului',
    icon: '💾',
    summary: 'Progresul se salvează automat în browser; din Setări îl poți exporta și importa.',
    sections: [
      section(
        'Salvare automată',
        'Jocul îți salvează progresul local în acest browser. Revino pe același dispozitiv și în același profil de browser pentru a continua.',
      ),
      section(
        'Copie de siguranță și alt dispozitiv',
        'Din ⚙️ Setări → Salvarea poți descărca o copie (fișier .json) sau o poți copia ca text, și o poți încărca înapoi aici sau pe alt dispozitiv.',
      ),
      section(
        'Ai grijă de salvare',
        'Ștergerea datelor site-ului sau folosirea unei ferestre private poate elimina salvarea. Fă din când în când o copie din Setări.',
      ),
    ],
    related: ['first-steps'],
  },
  {
    id: 'gold',
    category: 'resources',
    title: 'Aur',
    icon: '🪙',
    summary: 'Locuitorii lumilor produc aur pentru ouă și construcții.',
    sections: [
      section(
        'Cum îl obții',
        'Dinozaurii care locuiesc în habitate produc aur. Deschide lumea și colectează sau folosește Strânge. Arena, expedițiile și obiectivele pot oferi aur suplimentar.',
      ),
      section(
        'De ce se oprește producția?',
        'Aurul se adună în depozitul lumii până la limita ei. Colectează regulat sau îmbunătățește lumea. O lume fără dinozauri nu are venit de la locuitori.',
      ),
      section('La ce îl folosești', 'Aurul plătește lumi, clădiri, îmbunătățiri, ouă, culturi și rețete de forjă.'),
    ],
    related: ['building-habitat', 'building-farm', 'world-fire'],
  },
  {
    id: 'food',
    category: 'resources',
    title: 'Hrană',
    icon: '🍖',
    summary: 'Crește dinozauri cultivând și culegând la Fermă.',
    sections: [
      section(
        'Cum o obții',
        'Plantează culturi la Fermă, așteaptă timpul afișat și culege fiecare strat. Expedițiile și unele recompense pot oferi hrană.',
      ),
      section(
        'Cum o folosești',
        'Deschide un dinozaur și apasă Hrănește. Fiecare nivel nou consumă hrană; nivelurile mai mari costă mai mult.',
      ),
      table(
        'Culturi disponibile',
        ['Cultură', 'Aur', 'Durată', 'Hrană'],
        CROPS.map((c) => [c.name, n(c.cost), time(c.seconds), n(c.food)]),
      ),
    ],
    related: ['feeding', 'building-farm'],
  },
  {
    id: 'gems',
    category: 'resources',
    title: 'Nestemate',
    icon: '💎',
    summary: 'O resursă rară pentru accelerări și anumite acțiuni.',
    sections: [
      section(
        'Cum le obții',
        'Nestematele pot apărea în recompensele obiectivelor, ale Atlasului și ale expedițiilor.',
      ),
      section(
        'Când le cheltuiești',
        'Anumite temporizatoare pot fi terminate mai repede cu nestemate. Citește prețul afișat înainte să confirmi. Nu sunt necesare pentru a lăsa timpul să se încheie normal.',
      ),
    ],
    related: ['atlas', 'expeditions', 'eggs'],
  },
  {
    id: 'fragments',
    category: 'resources',
    title: 'Fragmente ancestrale',
    icon: '✦',
    summary: 'Ajută la atingerea ultimelor niveluri ale clădirilor.',
    sections: [
      section(
        'De unde vin',
        'Expedițiile oferă fragmente ancestrale. Verifică recompensa misiunii înainte să trimiți echipa.',
      ),
      table(
        'Fragmente pentru ultimul nivel',
        ['Clădire', 'Fragmente'],
        (Object.keys(BUILDINGS) as BuildingKind[])
          .filter((k) => FINAL_LEVEL_FRAGMENTS[k] > 0)
          .map((k) => [BUILDINGS[k].name, n(FINAL_LEVEL_FRAGMENTS[k])]),
      ),
    ],
    related: ['expeditions', 'construction'],
  },
  {
    id: 'materials',
    category: 'resources',
    title: 'Materialele forjei',
    icon: '🦴',
    summary: 'Oase, chihlimbar, cristale și fier de meteorit.',
    sections: [
      section(
        'Găsește materiale',
        'Materialele vin din expediții și din arenă. Înainte de făurire, verifică numărul necesar pentru fiecare material din rețetă.',
      ),
      table(
        'Materiale',
        ['Material', 'Utilizare'],
        Object.values(MATERIALS).map((m) => [`${m.icon} ${m.name}`, 'Rețete de echipament, consumabile sau piese']),
      ),
    ],
    related: ['building-forge', 'expeditions', 'arena'],
  },
  {
    id: 'feeding',
    category: 'dinos',
    title: 'Hrănirea și evoluția',
    icon: '🍖',
    summary: 'Un dinozaur crește de la pui la juvenil și adult.',
    sections: [
      {
        title: 'Cum îl crești',
        steps: [
          'Deschide lumea în care locuiește dinozaurul.',
          'Alege dinozaurul și verifică hrana cerută pentru nivelul următor.',
          'Apasă Hrănește. Nivelul crește și forma se schimbă automat la pragurile de vârstă.',
        ],
      },
      table(
        'Vârste',
        ['Formă', 'Niveluri'],
        EVOLUTION_STAGES.map((s) => [s.name, `${s.minLevel}–${s.maxLevel}`]),
      ),
      table(
        'Costul fiecărui nivel',
        ['Trecere', 'Hrană'],
        FEED_COST.slice(1).map((cost, i) => [`${i + 1} → ${i + 2}`, n(cost)]),
      ),
      section(
        'Venit mai mare',
        `Nivelul maxim este ${MAX_LEVEL}. Venitul de bază crește cu 40% pentru fiecare nivel peste primul, înainte de rotunjire și bonusuri.`,
      ),
    ],
    related: ['food', 'breeding', 'atlas'],
  },
  {
    id: 'atlas',
    category: 'dinos',
    title: 'Atlasul speciilor',
    icon: '📖',
    summary: 'Descoperă cele trei forme ale fiecărei specii.',
    sections: [
      section(
        'Cum descoperi o formă',
        'Eclozarea descoperă puiul. Creșterea la nivelurile de juvenil și adult completează celelalte forme. Atlasul păstrează progresul descoperirilor.',
      ),
      section(
        'Recompensa unei specii',
        'După descoperirea tuturor celor trei forme ale unei specii, revendică recompensa din Atlas. Recompensa se ia o singură dată pentru acea specie.',
      ),
      table(
        'Nestemate pentru completare',
        ['Raritate', 'Nestemate'],
        Object.entries(ATLAS_REWARD).map(([r, v]) => [RARITIES[r as keyof typeof RARITIES].name, n(v)]),
      ),
    ],
    related: ['feeding', 'breeding'],
  },
  {
    id: 'eggs',
    category: 'breeding',
    title: 'Ouă și eclozare',
    icon: '🥚',
    summary: 'Cumpără un ou, așteaptă și alege un habitat.',
    sections: [
      {
        title: 'Din magazin până la pui',
        steps: [
          'Deblochează lumea dorită din Extinde → Lumi.',
          'Cumpără oul ei din Extinde → Ouă. Incubatorul trebuie să aibă loc.',
          'Așteaptă să fie gata oul.',
          'Deschide Incubatorul și alege o lume compatibilă cu loc liber pentru eclozare.',
        ],
      },
      section(
        'Ce specie iese?',
        'Oul unei lumi produce specia ei de bază. Celelalte specii ale lumii se obțin prin rețetele Bârlogului.',
      ),
      table(
        'Ouăle lumilor',
        ['Lume', 'Specie', 'Aur'],
        ELEMENT_IDS.map((e) => [ELEMENTS[e].name, speciesName(EGG_SPECIES[e]), n(HABITAT_EGG_PRICE[e])]),
      ),
    ],
    related: ['building-hatchery', 'breeding', 'help-egg'],
  },
  {
    id: 'breeding',
    category: 'breeding',
    title: 'Împerecherea în Bârlog',
    icon: '💕',
    summary: 'Combină părinți pentru a obține specii rare.',
    sections: [
      section(
        'Condițiile părinților',
        `Ai nevoie de doi dinozauri diferiți, fiecare cel puțin la nivelul ${BREED_LEVEL}, și de un Bârlog liber. Părinții în recuperare nu pot începe o nouă încercare.`,
      ),
      section(
        'Șansele',
        `Perechea corectă are ${DEN_RARE_CHANCE}% șansă să producă specia rară. Dacă ambii părinți sunt adulți, șansa crește la ${DEN_RARE_CHANCE + DEN_ADULT_BONUS}%. În celelalte cazuri, oul poate conține specia unuia dintre părinți.`,
      ),
      table(
        'Rețete de specii rare',
        ['Specie obținută', 'Părinte 1', 'Părinte 2'],
        Object.entries(DEN_RECIPES).map(([id, p]) => [speciesName(id), speciesName(p[0]), speciesName(p[1])]),
      ),
      section(
        'Preluarea oului',
        `Când oul este gata, preia-l în Incubator, unde trebuie să fie un loc liber. Părinții au apoi o perioadă de odihnă de ${time(DEN_REST_MS / 1000)}.`,
      ),
    ],
    related: ['building-den', 'eggs', 'feeding', 'help-busy'],
  },
  {
    id: 'arena',
    category: 'adventures',
    title: 'Duelurile din Arenă',
    icon: '⚔️',
    summary: 'Pregătește un luptător și profită de avantajul elementului.',
    sections: [
      section(
        'Înainte de duel',
        'Arena se deblochează pentru construcție când ai un dinozaur de nivel 3. Alege un luptător disponibil, verifică adversarul și costul. Nivelul, echipamentul și abilitatea contează.',
      ),
      section(
        'Avantajele elementelor',
        'Foc bate Junglă; Junglă bate Pământ; Pământ bate Furtună; Furtună bate Apă; Apă bate Gheață; Gheață bate Foc. Un avantaj favorabil multiplică forța cu 1,25; unul nefavorabil cu 0,8.',
      ),
      section(
        'După luptă',
        `Revendică recompensa unui duel câștigat. Recuperarea este de ${time(ARENA_RECOVERY_MS.win / 1000)} după victorie și ${time(ARENA_RECOVERY_MS.loss / 1000)} după înfrângere. Provocările se schimbă zilnic.`,
      ),
      section(
        'Abilități',
        'Fiecare specie are o abilitate de arenă. Panoul Arenei arată efectul și permite antrenarea ei cu medaliile câștigate în dueluri.',
      ),
    ],
    related: ['medals', 'expeditions', 'building-forge', 'help-busy'],
  },
  {
    id: 'expeditions',
    category: 'adventures',
    title: 'Expediții și cufărul zilnic',
    icon: '🧭',
    summary: 'Trimite echipe pentru aur, hrană, materiale și fragmente.',
    sections: [
      {
        title: 'Trimite o echipă',
        steps: [
          'Deschide Avanpostul expedițiilor.',
          'Alege o misiune și citește cerințele echipei, durata și recompensa.',
          'Selectează dinozauri disponibili care îndeplinesc cerințele.',
          'Pornește expediția, așteaptă revenirea și revendică recompensa.',
        ],
      },
      section(
        'Recuperare și antrenament',
        'Dinozaurii trimiși sunt ocupați, apoi intră în recuperare. Verifică timpul din fișa lor. Îmbunătățirea echipamentului Avanpostului adaugă 10% pe nivel la aurul, hrana și fragmentele primite. Talismanul de cristal crește materialele găsite.',
      ),
      table(
        'Îmbunătățirea Avanpostului',
        ['Îmbunătățire echipament', 'Fragmente'],
        EXPEDITION_TRAINING_COST.map((cost, i) => [`${i} → ${i + 1}`, n(cost)]),
      ),
      section(
        'Panoul zilnic',
        `Misiunile se reînnoiesc la începutul zilei, după ora României. O schimbare de misiune costă ${EXPEDITION_SWAP_COST} nestemate. După ${EXPEDITION_CHEST_TARGET} expediții revendicate în aceeași zi, poți revendica și cufărul zilnic.`,
      ),
    ],
    related: ['building-outpost', 'materials', 'fragments', 'help-busy'],
  },
  {
    id: 'equipment',
    category: 'items',
    title: 'Echipament și consumabile',
    icon: '🛡️',
    summary: 'Folosește obiectele făurite în panoul potrivit.',
    sections: [
      section(
        'Echipament',
        'Dinozaurii au locuri pentru cap, corp și talisman. Un obiect purtat poate crește puterea, venitul sau materialele din expediții. Obiectul trebuie să existe în inventar; același exemplar nu se echipează pe doi dinozauri.',
      ),
      section(
        'Consumabile',
        'Se consumă la folosire. Alege ținta potrivită: un ou în incubare, o cultură în creștere, un dinozaur în recuperare ori un habitat, în funcție de obiect.',
      ),
      section(
        'Piese pentru clădiri',
        'Unele îmbunătățiri cer piese făurite. Obiectele necesare sunt afișate lângă aur și fragmente. Făurește-le și colectează-le înainte să încerci îmbunătățirea.',
      ),
    ],
    related: ['building-forge', 'materials', 'construction'],
  },
  {
    id: 'help-egg',
    category: 'help',
    title: 'De ce nu pot ecloza oul?',
    icon: '🥚',
    summary: 'Verifică timpul, elementul și locurile libere.',
    sections: [
      section(
        'Verifică aceste lucruri',
        'Oul trebuie să fie gata. Lumea aleasă trebuie să fie deblocată, compatibilă cu elementul speciei și să aibă loc liber. Ignisaur locuiește doar în lumea de Foc.',
      ),
      section(
        'Cum eliberezi un loc',
        'Îmbunătățește lumea pentru mai multe locuri sau mută un locuitor într-un alt habitat compatibil, dacă există. Nu poți vinde ultimul dinozaur din joc.',
      ),
    ],
    related: ['eggs', 'world-fire', 'building-habitat'],
  },
  {
    id: 'help-busy',
    category: 'help',
    title: 'De ce este dinozaurul ocupat?',
    icon: '💤',
    summary: 'Luptele, expedițiile și împerecherea au timpi de recuperare.',
    sections: [
      section(
        'Vezi unde se află',
        'Deschide fișa dinozaurului și clădirea activității. Poate fi plecat în expediție, implicat într-un duel, în Bârlog sau în recuperare.',
      ),
      section(
        'Ce poți face',
        'Așteaptă timpul afișat și colectează rezultatul activității când este gata. Pentru recuperare, un elixir făurit poate ajuta dacă este disponibil în inventar.',
      ),
    ],
    related: ['arena', 'expeditions', 'breeding', 'equipment'],
  },
  {
    id: 'help-upgrade',
    category: 'help',
    title: 'De ce nu pot îmbunătăți clădirea?',
    icon: '🏗️',
    summary: 'Aurul, piesele, fragmentele și activitatea curentă pot conta.',
    sections: [
      section(
        'Citește cerințele',
        'Verifică dacă ai ajuns la nivelul maxim, dacă ai suficient aur, toate piesele cerute și fragmentele ancestrale necesare.',
      ),
      section(
        'Pregătește clădirea',
        'Dacă panoul cere să închei activitatea curentă, colectează culturile, obiectul sau recompensa înainte de îmbunătățire. Piesele provin din Forjă, iar fragmentele din expediții.',
      ),
    ],
    related: ['construction', 'building-forge', 'fragments'],
  },
  {
    id: 'help-gold',
    category: 'help',
    title: 'De ce nu mai primesc aur?',
    icon: '🪙',
    summary: 'Verifică locuitorii și depozitul lumii.',
    sections: [
      section(
        'Depozitul poate fi plin',
        'Deschide lumea și strânge aurul. Producția de la locuitori nu mai crește depozitul după atingerea limitei.',
      ),
      section(
        'Lumea trebuie să aibă locuitori',
        'Dinozaurii din habitate produc aur. Crește-i și îmbunătățește lumea pentru un venit și o capacitate mai mari.',
      ),
    ],
    related: ['gold', 'feeding', 'building-habitat'],
  },
];

// ---------- articole generate din catalog: clădiri, lumi, specii, obiecte ----------

const buildings: WikiArticle[] = (Object.keys(BUILDINGS) as BuildingKind[]).map((kind) => ({
  id: `building-${kind}`,
  category: 'buildings',
  title: BUILDINGS[kind].name,
  icon: buildingIcons[kind],
  summary: buildingHelp[kind][0],
  // imagini mici: apar pe carduri și în antetul articolului (HD-ul ar încărca degeaba sute de KB)
  image: kind === 'habitat' ? 'world/fire-island-thumb.webp' : `world/${kind}-building.webp`,
  sections: [
    section('Cum funcționează', ...buildingHelp[kind]),
    section(
      'Cum o deblochezi',
      BUILD_UNLOCKS[kind]?.label ??
        (kind === 'hatchery'
          ? 'Este disponibil de la început.'
          : kind === 'habitat'
            ? 'Deschide Extinde → Lumi și alege elementul.'
            : 'Deschide Extinde → Clădiri.'),
    ),
    ...(kind === 'habitat'
      ? []
      : [
          table(
            'Niveluri și costuri',
            ['Nivel', 'Aur', 'Piese', 'Fragmente'],
            BUILDINGS[kind].cost.map((cost, i) => {
              const parts = i ? buildingUpgradeParts({ kind, level: i }) : {};
              return [
                String(i + 1),
                cost ? n(cost) : 'De la început',
                Object.entries(parts)
                  .map(([id, qty]) => `${qty} × ${ITEMS[id].name}`)
                  .join(', ') || '—',
                i === BUILDINGS[kind].cost.length - 1 && i > 0 ? n(FINAL_LEVEL_FRAGMENTS[kind]) : '—',
              ];
            }),
          ),
        ]),
  ],
  related:
    kind === 'habitat'
      ? ['world-fire', 'gold']
      : kind === 'farm'
        ? ['food', 'feeding']
        : kind === 'den'
          ? ['breeding', 'eggs']
          : kind === 'hatchery'
            ? ['eggs', 'help-egg']
            : kind === 'forge'
              ? ['equipment', 'materials']
              : [kind === 'arena' ? 'arena' : 'expeditions', 'help-busy'],
}));

const worlds: WikiArticle[] = ELEMENT_IDS.map((e) => ({
  id: `world-${e}`,
  category: 'worlds',
  title: `Lumea de ${ELEMENTS[e].name}`,
  icon: ELEMENTS[e].icon,
  summary: `Deblochează cu ${n(WORLD_UNLOCK_COST[e])} aur. Aici locuiesc speciile de ${ELEMENTS[e].name.toLowerCase()}.`,
  image: `world/${e === 'plant' ? 'jungle' : e}-island-thumb.webp`,
  sections: [
    section(
      'Locuitori',
      SPECIES.filter((s) => s.elements.includes(e))
        .map((s) => s.name)
        .join(', ') + '.',
      `Oul lumii produce ${speciesName(EGG_SPECIES[e])} și costă ${n(HABITAT_EGG_PRICE[e])} aur.`,
    ),
    table(
      'Îmbunătățiri',
      ['Nivel', 'Aur', 'Locuri', 'Depozit aur', 'Piesă'],
      HABITAT_CAPACITY[e].map((cap, i) => [
        String(i + 1),
        n(HABITAT_UPGRADE_COST[e][i]),
        n(cap),
        n(HABITAT_GOLD_CAP[i]),
        i > 1
          ? Object.entries(buildingUpgradeParts({ kind: 'habitat', level: i }))
              .map(([id, qty]) => `${qty} × ${ITEMS[id].name}`)
              .join(', ') || '—'
          : '—',
      ]),
    ),
    section(
      'Ultimul nivel',
      `Nivelul 5 cere și ${FINAL_LEVEL_FRAGMENTS.habitat} fragmente ancestrale. Colectează aurul și verifică toate cerințele în panoul lumii.`,
    ),
  ],
  related: SPECIES.filter((s) => s.elements.includes(e))
    .map((s) => `species-${s.id}`)
    .concat(['gold', 'eggs']),
}));

const dinos: WikiArticle[] = SPECIES.map((s) => {
  const parents = DEN_RECIPES[s.id],
    egg = ELEMENT_IDS.find((e) => EGG_SPECIES[e] === s.id);
  return {
    id: `species-${s.id}`,
    category: 'dinos',
    title: s.name,
    icon: '🦖',
    summary: s.description,
    sections: [
      section(
        'Specia',
        s.description,
        `Element: ${s.elements.map((e) => ELEMENTS[e].name).join(', ')}. Raritate: ${RARITIES[s.rarity].name}.`,
      ),
      section(
        'Cum o obții',
        parents
          ? `În Bârlog, împerechează ${speciesName(parents[0])} cu ${speciesName(parents[1])}. Șansa speciei rare este ${DEN_RARE_CHANCE}%, sau ${DEN_RARE_CHANCE + DEN_ADULT_BONUS}% când ambii părinți sunt adulți.`
          : egg
            ? `Cumpără oul lumii de ${ELEMENTS[egg].name} pentru ${n(HABITAT_EGG_PRICE[egg])} aur. Această specie este rezultatul oului lumii.`
            : 'Verifică ouăle și rețetele disponibile în joc.',
      ),
      section(
        'Habitat și eclozare',
        `Locuiește în lumea de ${s.elements.map((e) => ELEMENTS[e].name).join(' sau ')}. Incubarea durează ${time(s.hatchSeconds)}. Ai nevoie de loc liber în habitat pentru pui.`,
      ),
      section('Abilitatea de arenă', arenaAbility(s.id).name, arenaAbility(s.id).description),
      table(
        'Creștere și venit de bază',
        ['Formă', 'Niveluri', 'Aur/min la primul nivel al formei'],
        EVOLUTION_STAGES.map((stage) => [
          stage.name,
          `${stage.minLevel}–${stage.maxLevel}`,
          n(incomeAt(s, stage.minLevel)),
        ]),
      ),
    ],
    related: [`world-${s.elements[0]}`, 'feeding', parents ? 'breeding' : 'eggs', 'atlas'],
  };
});

const ITEM_USAGE: Record<string, string> = {
  fertilizer:
    'Deschide Ferma, alege un strat în creștere și folosește fertilizatorul. Cultura devine gata; culege-o apoi.',
  elixir: 'Deschide dinozaurul aflat în recuperare și folosește elixirul pentru a-i încheia odihna.',
  'warm-stone':
    'Deschide Incubatorul și folosește piatra pe un ou care încă se incubează. Oul devine gata; alege apoi habitatul pentru eclozare.',
  'gold-totem':
    'Deschide lumea și activează totemul. Venitul ei se dublează o oră; colectează aurul ca să nu se umple depozitul.',
};

const items: WikiArticle[] = Object.values(ITEMS).map((item) => ({
  id: `item-${item.id}`,
  category: 'items',
  title: item.name,
  icon: item.icon,
  summary: item.effect,
  sections: [
    section(
      'Ce face',
      item.effect,
      item.kind === 'gear'
        ? `Echipament pentru ${item.slot ? GEAR_SLOTS[item.slot].name.toLowerCase() : 'dinozaur'}. Se echipează din fișa dinozaurului.`
        : item.kind === 'part'
          ? 'Piesă pentru îmbunătățiri. Se consumă când îmbunătățești o clădire care o cere.'
          : 'Consumabil: se folosește o singură dată în panoul țintei potrivite.',
    ),
    ...(ITEM_USAGE[item.id] ? [section('Cum îl folosești', ITEM_USAGE[item.id])] : []),
    table(
      'Rețeta',
      ['Cerință', 'Cantitate'],
      [
        ['Nivelul Forjei', String(item.level)],
        ['Aur', n(item.gold)],
        ['Durată', time(item.seconds)],
        ...Object.entries(item.materials).map(([id, qty]) => [MATERIALS[id as MaterialId].name, n(qty ?? 0)]),
      ],
    ),
  ],
  related: ['building-forge', 'equipment', 'materials'],
}));

// ---------- toate articolele și căutarea ----------

export const WIKI_ARTICLES: WikiArticle[] = [...basics, ...worlds, ...buildings, ...dinos, ...items];
export const WIKI_BY_ID = new Map(WIKI_ARTICLES.map((article) => [article.id, article]));

/** Fără diacritice și cu litere mici: „Împerechere” = „imperechere”. */
export const normalizeWikiText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro-RO');

/** Tot textul fiecărui articol (titlu, rezumat, secțiuni, tabele), normalizat o singură dată. */
const searchable = new Map(
  WIKI_ARTICLES.map((a) => [
    a.id,
    normalizeWikiText(
      [
        a.title,
        a.summary,
        WIKI_CATEGORIES.find((c) => c.id === a.category)?.name,
        ...a.sections.flatMap((s) => [
          s.title,
          ...(s.paragraphs ?? []),
          ...(s.steps ?? []),
          ...(s.table?.rows.flat() ?? []),
        ]),
      ].join(' '),
    ),
  ]),
);

/** Articolele care conțin toate cuvintele căutate; cele cu potriviri în titlu primele. */
export function searchWiki(query: string, category: WikiCategory | 'all' = 'all') {
  const words = normalizeWikiText(query.trim()).split(/\s+/).filter(Boolean);
  const relevance = (article: WikiArticle) => {
    const title = normalizeWikiText(article.title);
    const phrase = words.join(' ');
    return !phrase
      ? 0
      : title === phrase
        ? 3
        : title.includes(phrase)
          ? 2
          : words.every((word) => title.includes(word))
            ? 1
            : 0;
  };
  return WIKI_ARTICLES.filter(
    (a) =>
      (category === 'all' || a.category === category) && words.every((word) => searchable.get(a.id)!.includes(word)),
  ).sort((a, b) => relevance(b) - relevance(a));
}
