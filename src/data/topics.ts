/**
 * The topic database — Morrowind-style keyword dialogue. Words in [brackets]
 * render as hyperlinks; clicking one teaches the topic and navigates to it.
 * Resolution order: role+town > role > town > generic. Text variants are
 * picked by a seeded hash of (npc, topic) so a given NPC always says the
 * same thing.
 */

import type { TownId } from './ids';
import type { NpcRole } from '@/gen/models/humanoid';

export interface TopicScope {
  town?: TownId | undefined;
  role?: NpcRole | undefined;
}

export interface GameView {
  day: number;
  hour: number;
  /** Quest stage lookup — wired in P7; always 0 before. */
  questStage: (id: string) => number;
}

export interface TopicDef {
  id: string;
  keyword: string;
  scope?: TopicScope;
  cond?: (g: GameView) => boolean;
  /** Variants — seeded pick per NPC. */
  text: readonly string[];
  /** Always in the topic list (core knowledge). */
  core?: boolean;
}

export const CORE_TOPICS = [
  'the ashen march',
  'latest rumors',
  'little advice',
  'ash storms',
  'the drowned king',
] as const;

export const TOPICS: readonly TopicDef[] = [
  // ----- core / generic -------------------------------------------------------
  {
    id: 'greeting',
    keyword: 'greeting',
    text: [
      'Another stranger off the salt road. Keep your hands where the gulls can see them, and ask what you will — about [the ashen march], or the [latest rumors], if you must.',
      'You have the look of someone carrying a writ. We get your kind. Ask your questions — [the ashen march] keeps few secrets, only bad ones.',
      'Well met, traveler. Mind the [ash storms] if you walk east, and mind your purse everywhere else. Care for the [latest rumors]?',
    ],
  },
  {
    id: 'the ashen march',
    keyword: 'the ashen march',
    core: true,
    text: [
      'Vethmoor. The Ashen March. Grey steppe, bitter marsh, fungus tall as towers, and over it all the [Ember Tooth] breathing its grey breath. The ash makes the land strange and the strange things grow. We endure. It is what we are for.',
      'They call it a march because it borders nothing — only the sea, the mountains, and [the drowned king]\'s sleep. Everything here lives off the ash, and the ash comes from his dreaming, if you believe the [Deep Choir].',
    ],
  },
  {
    id: 'ember tooth',
    keyword: 'ember tooth',
    text: [
      'The volcano at the heart of the March. It has never erupted, not properly — it exhales. Ash, warmth, bad dreams. The [Cindral Conclave] keeps instruments on its flanks and secrets in its halls.',
      'Climb high enough and the fog thins and you see it: a tooth of black rock, smoking. The old folk say it is hollow. The older folk say it is full.',
    ],
  },
  {
    id: 'the drowned king',
    keyword: 'the drowned king',
    core: true,
    text: [
      'Ulmoth, the stories name him. A king or a god or something too large for either word, asleep under the [Ember Tooth] since before the first net was cast. His dreams exhale the ash; the ash feeds the March. Lately the dreams turn. Everyone feels it.',
      'Hush. Some names are nets — say them and you catch what listens. But yes: the sleeper below. Ask the [Deep Choir], if you can find one who will speak, or ask the [Cindral Conclave], who will not stop speaking.',
    ],
  },
  {
    id: 'ash storms',
    keyword: 'ash storms',
    core: true,
    text: [
      'Worse every season. The east roads choke with grey wind for days. A storm took the Veskar caravan two months back — striders, drivers, all of it. The [Ember Tooth] is restless, or what sleeps beneath it is.',
      'When the storm comes, get low, get indoors, get behind stone. The ash scours flesh and fouls water. And things walk in it — [ash-risen], they say, dead folk moved like puppets by the wind.',
    ],
  },
  {
    id: 'ash-risen',
    keyword: 'ash-risen',
    text: [
      'Corpses the ash will not let rest. They walk the badlands and the storm-edges, grey and patient. Burn them or break them — they do not tire, and they do not bargain.',
    ],
  },
  {
    id: 'latest rumors',
    keyword: 'latest rumors',
    core: true,
    text: [
      'They say a seer in [Greyharbor] has stopped sleeping entirely. Sits in her tower writing the same dream over and over. The Margrave posts guards at her door — to keep her in or others out, none agree.',
      'Bandits on the Vornstead road again — the [Iron Vigil] pays bounty coin for ears, if that is your trade. And a fisherman at the dock swears his nets came up full of black weed that was not there when he cast them.',
      'A Kraghold mine broke into a gallery nobody dug. House Skarn sealed it within the day and pays triple for silence, which is how everyone knows.',
      'The same dream, friend. Half the town has had it: a throne under dark water, and something on it opening one eye. The temple burns votives day and night.',
    ],
  },
  {
    id: 'little advice',
    keyword: 'little advice',
    core: true,
    text: [
      'Walk the roads. The wilds eat the clever and the brave at the same rate. If you must cross country, carry a blade and travel by noon light.',
      'The fungus forests are gentler than they look, and the marshes are crueller. Reeds mean crabs. Crabs mean pinching. You understand.',
      'Coin opens doors in Greyharbor, faith opens them in Thornmoor, and in Kraghold nothing opens them — Skarn folk keep their own counsel. In Saltmere? Just knock. We are friendly enough.',
    ],
  },
  {
    id: 'deep choir',
    keyword: 'deep choir',
    text: [
      'Cultists of the sleeper. They sing to him in drowned grottoes — keep him dreaming, they claim, and the March alive with him. Mad, perhaps. But the storms got worse when the Margrave burned their fane at Thornmoor, and everyone noticed.',
      'They are not evil, whatever the temple says. My cousin sang with them a season. Came back quiet and kind and would not eat fish again to her dying day.',
    ],
  },
  {
    id: 'iron vigil',
    keyword: 'iron vigil',
    text: [
      'Road-wardens. Mercenaries with a charter, if we are being honest, but they keep the bandits thin and the caravans moving. Their chapterhouse in [Greyharbor] takes new blades — pay is fair, funerals are free.',
      'Rust-red tabards, iron tempers. If you can swing a sword and follow an order, they will feed you. If you can do only one of those, choose carefully which.',
    ],
  },
  {
    id: 'cindral conclave',
    keyword: 'cindral conclave',
    text: [
      'Scholars of the Tooth. They measure the ash, chart the dreams, and teach spellcraft to those with coin or talent. Halls in Greyharbor, Vornstead and Kraghold — they step between them in a blink, the lucky devils.',
      'Clever folk. Too clever to be trusted entirely, clever enough that we need them. They pay honest gold for ashland samples, if you have the stomach for collecting.',
    ],
  },
  {
    id: 'house skarn',
    keyword: 'house skarn',
    text: [
      'Old blood. They mined the badlands before the Margrave\'s grandmother was born, and they will mine it after his line is done. Duskglass made them rich; silence keeps them so.',
      'Grey-faced lords in a grey-stone hold. Honest in trade, ruthless in everything else. If a Skarn offers you work, count your fingers after you shake on it.',
    ],
  },
  {
    id: 'greyharbor',
    keyword: 'greyharbor',
    text: [
      'The Margrave\'s city — stone walls, deep harbor, deeper purses. Everything in the March flows through it eventually: fish, ash-glass, rumor, trouble.',
    ],
  },
  {
    id: 'dune-striders',
    keyword: 'dune-striders',
    text: [
      'Great beetles, tall as houses, gentle as oxen. The Sutherai breed them for the roads — a strider crosses the March in a day where a cart takes four and loses a wheel. The fare is honest. The smell, you stop noticing.',
    ],
  },

  // ----- role-flavored ---------------------------------------------------------
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: { role: 'trader' },
    text: [
      'Welcome, welcome. Goods bought, goods sold, no questions asked that cost extra to answer. Browse freely — or ask after the [latest rumors]; gossip is the one thing I give away.',
    ],
  },
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: { role: 'innkeep' },
    text: [
      'Sit anywhere that holds you. We have beds, stew, and the driest roof in town. You look like someone with questions — start with [the ashen march], everyone does.',
    ],
  },
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: { role: 'priest' },
    text: [
      'The Tide keep you, traveler. You stand in a house of the drowned liturgy — we pray for the sleeper\'s peace and ours. Ask of [the drowned king], if your heart is steady.',
    ],
  },
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: { role: 'guard' },
    text: [
      'Move along or state your business. Walls are for keeping the wild out and the peace in — see you stay on the right side of both.',
    ],
  },

  // ----- town-flavored ---------------------------------------------------------
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: { town: 'saltmere' as TownId },
    text: [
      'New off the boat? Thought so — you still smell of elsewhere. Saltmere is small but honest. The [latest rumors] cost nothing, and the eel stew almost nothing.',
    ],
  },
  {
    id: 'saltmere',
    keyword: 'saltmere',
    text: [
      'A fishing village with ambitions of staying one. Brine, gulls, good people. The smugglers use the caves north of the dock and everyone politely fails to notice.',
    ],
  },
  {
    id: 'vornstead',
    keyword: 'vornstead',
    text: [
      'Crossroads of the March — every road meets there, so every trouble does too. Best market east of Greyharbor, and the dune-strider yards besides.',
    ],
  },
  {
    id: 'thornmoor',
    keyword: 'thornmoor',
    text: [
      'Stilt-houses over bitter water. Thornmoor folk are quiet and devout and know the marsh like a sibling. The Choir had a fane near there, before the burning.',
    ],
  },
  {
    id: 'kraghold',
    keyword: 'kraghold',
    text: [
      'Skarn country. Mine shafts, duskglass, and doors that close politely in your face. Good wages if you can swing a pick and keep your questions in your pocket.',
    ],
  },
  {
    id: 'veskar',
    keyword: 'veskar',
    text: [
      'The ash-nomad post — bone lodges and patient folk. They read the storms like fishermen read tide. If a Veskar elder tells you not to travel, do not travel.',
    ],
  },
];
