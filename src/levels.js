// Nivoi, imena i dosetke. Sve na srpskoj latinici.
import { C } from './palette.js';

export const LEVELS = [
  {
    name: 'Ponedeljak ujutru',
    briefing: [
      'Đuro, sine, imamo dojavu.',
      'Sitni lopovi beže preko aerodroma. Hapsi sve sumnjive...',
      '...ali ne diraj babe! Tri žalbe građana i ideš u penziju.',
    ],
    criminals: 6, types: { sitan: 1 }, interval: 4.5, concurrent: 3,
    civilians: 7, maxEscapes: 3, speed: 1,
  },
  {
    name: 'Sezona godišnjih odmora',
    briefing: [
      'Počela je sezona, Đuro.',
      'Pola Srbije ide u Grčku, druga polovina beži od poreznika.',
      'Pazi na one u trenerkama. Brzi su, ali nisu pametni.',
    ],
    criminals: 9, types: { sitan: 2, trenerka: 2 }, interval: 3.8, concurrent: 4,
    civilians: 10, maxEscapes: 3, speed: 1.05,
  },
  {
    name: 'Kum {kum}',
    boss: 'ofsor',
    briefing: [
      'ĐURO! Kum {kum} je krenuo ka aerodromu sa tri kofera para!',
      'Ne možeš ga uhapsiti dok je aerodrom otvoren. Ima on veze.',
      'Stani na crvene, žute i plave prekidače da spustiš rampe.',
      'Đuro... BLOKIRAJ AERODROM!',
    ],
    civilians: 6, maxEscapes: 2, speed: 1,
  },
  {
    name: 'Maskenbal',
    briefing: [
      'Lopovi su se maskirali u obične turiste.',
      'Prati ko ispušta pare iz džepa. Ono, to je sumnjivo...',
      '...u Srbiji niko nema višak para.',
      'I čuvaj se šverceru. Debeo je, ali ne pušta lako.',
    ],
    criminals: 10, types: { sitan: 1, maskiran: 3, debeli: 1 }, interval: 3.6, concurrent: 4,
    civilians: 12, maxEscapes: 3, speed: 1.08,
  },
  {
    name: 'Petak, trinaesti',
    briefing: [
      'Petak je, trinaesti. Svi beže.',
      'Čak i oni koji nisu ništa uradili...',
      '...to jest, naročito oni.',
    ],
    criminals: 14, types: { sitan: 2, trenerka: 2, maskiran: 2, debeli: 1 }, interval: 2.9, concurrent: 5,
    civilians: 12, maxEscapes: 4, speed: 1.15,
  },
  {
    name: 'Balkanski špijun',
    boss: 'spijun',
    briefing: [
      'Đuro, ovo je ozbiljno. Strani špijun!',
      'Vratio se iz Pariza, iznajmio sobu kod poštenog čoveka...',
      '...a sad beži sa mikrofilmom i povukao je svoje ljude.',
      'Znaš šta treba. BLOKIRAJ AERODROM!',
    ],
    civilians: 8, maxEscapes: 2, speed: 1.1,
  },
];

export const BOSSES = {
  ofsor: {
    name: 'Kum {kum}',
    hp: 3, speed: 2.7, panicSpeed: 3.4, reopen: 18, throwEvery: 3.2,
    errands: ['trafika', 'šalter'], minions: 0,
    look: { shirt: C.grayD, pants: C.grayD, tie: C.red, belly: true, glasses: true, mustache: true, hat: 'fedora', carry: 'moneybag', scale: 1.25 },
    lines: {
      enter: 'Sklanjaj se, ovo je moj aerodrom!',
      shove: 'Znaš li ti ko sam ja?!',
      panic: 'Zovite mog advokata!',
      hit: ['Kupiću ti stan, pusti me!', 'Imam ja ljude!', 'Ovo ćeš mi platiti!'],
      arrested: 'Dobro, dobro... ali bez lisica, imam manikir.',
      escaped: 'Ćao, Đuro! Pozdravi mi načelnika sa Kajmana!',
    },
    switches: [{ x: 14, z: 7 }, { x: -14, z: 0.5 }, { x: 0, z: 11.5 }],
  },
  spijun: {
    name: 'Petit Pjer',
    hp: 4, speed: 3.0, panicSpeed: 3.8, reopen: 14, throwEvery: 2.4,
    errands: ['pekara', 'tabla'], minions: 3,
    look: { shirt: C.brown, pants: C.grayD, glasses: true, hat: 'beret', mustache: true, carry: 'suitcase', carryColor: C.black, scale: 1.15 },
    lines: {
      enter: 'Bonžur! Ja sam samo turista iz Pariza...',
      shove: 'Že ne kompran pa... mislim, ne razumem!',
      panic: 'Sakre ble! Sve je zatvoreno!',
      hit: ['Mikrofilm? Kakav mikrofilm?', 'To je fotografija moje tetke!', 'Oh la la!'],
      arrested: 'Dobro, priznajem. Ali taj čovek što mi je izdao sobu je lud!',
      escaped: 'Orevoar, Đuro! Pariz te pozdravlja!',
    },
    switches: [{ x: -15, z: 7 }, { x: 15, z: 0.5 }, { x: -1, z: -4.5 }],
  },
};

export const CRIMINAL_NAMES = [
  'Žika Džeparoš', 'Mile Švercer', 'Gile Kofer', 'Steva Šibicar', 'Raka Kamatar',
  'Laza Lažni Pasoš', 'Sima Sim-kartica', 'Buca Bitkoin', 'Dule Dizel', 'Kole Kockar',
  'Tika Tiketar', 'Brane Bager', 'Čeda Čekovi', 'Đole Đinđuva', 'Paja Piramida',
  'Zoki Zelena Karta', 'Mića Mito', 'Šone Šema',
];

export const DESTINATIONS = [
  'na Kipar', 'u Dubai', 'u Panamu', 'na Kajmanska ostrva', 'u Bugarsku (ne pitaj)',
  'u Bangkok', 'u Kostariku', 'na Maldive', 'kod tetke u Beč',
];

export const LINES = {
  arrest: ['Stoj! Policija!', 'Pasoš na uvid!', 'Gde si krenuo, burazeru?', 'U ime zakona!', 'Lisice, izvoli!', 'Nema leta danas!'],
  crimArrested: ['Nisam ja, brate!', 'Ma, znam ja tvog načelnika!', 'Samo sam išao do trafike!', 'Ovo je ručni prtljag!', 'Imam alibi! Mama će reći!', 'Pa nisam ni stigao do duty free-a!'],
  civArrested: ['Sine, ja sam baba!', 'Ja samo idem na more!', 'Imam kartu, evo!', 'Žaliću se u novine!', 'Zvaću ombudsmana!', 'Ja sam pevač, bre!'],
  spooked: ['Pandur!', 'Beži!', 'Ajmo, ajmo!', 'Joj!'],
  debeliHit: ['Ne dam šteku!', 'Teško je, Đuro!', 'Još malo!'],
  burek: ['BUREK! Snaga naroda!', 'Sa sirom! Brzina +', 'Burek i jogurt!'],
  whistle: ['FIJUUU!', 'Stoj svi!'],
  missed: ['Promašio!', 'Ništa...'],
};

export const ENDING = [
  'Đura je odbranio državu.',
  'Načelnik je predložio orden.',
  'Država je odobrila bon za burek.',
  'Kum {kum} i dalje tvrdi da "ima ljude".',
  'Špijun piše memoare u zatvoru u Zabeli.',
  'KRAJ... ili možda samo pauza za kafu.',
];

// nadimak kuma se bira jednom po partiji
export const KUM_NAMES = ['Ofšor', 'Saša', 'Ćoška', 'Koferče', 'Acika'];

export function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

export function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}
