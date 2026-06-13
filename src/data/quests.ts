/**
 * Quest definitions — the main quest (stages 10–70, both endings) and four
 * authored quests per faction. Stage advancement is wired through dialogue
 * topic effects, kill/location triggers and turn-in conditions in Game.
 */

export interface QuestStageDef {
  at: number;
  journal: string;
  /**
   * Short imperative shown on the HUD wayfinding line (the journal text is the
   * long-form version). Omit on stages where the player is meant to decide or
   * read rather than travel.
   */
  objective?: string;
  /**
   * Location ids (town or dungeon) the soft compass tick aims at — the nearest
   * wins, so multi-target stages re-point as you cross the map. Omit to keep
   * the compass quiet and let the player ask around.
   */
  targets?: readonly string[];
}

export interface QuestDef {
  id: string;
  name: string;
  faction?: string;
  stages: readonly QuestStageDef[];
  doneAt: number;
}

export const QUESTS: readonly QuestDef[] = [
  // ===== MAIN QUEST ==============================================================
  {
    id: 'main',
    name: 'The Ninth Tide',
    doneAt: 70,
    stages: [
      {
        at: 10,
        journal:
          'A pardoned exile carries the writ that pardoned them. Mine is sealed with wax the color of a bruise, addressed to one Sela Veth — a seer in the fishing village of Saltmere, said to be dying faster than the March around her. I should deliver it.',
        objective: 'Find the seer Sela Veth, here in Saltmere',
        targets: ['saltmere'],
      },
      {
        at: 20,
        journal:
          'The seer broke my seal, read nothing, and laughed until she coughed. The writ was always for me, she says: a summons dressed as a pardon. The dreams everyone shares — the dark hall, the chair that is not empty — flow from beneath the Ember Tooth, and they are curdling. She wants proof old enough to trust: the Vargen Tablets, three dream-records buried with their dreamer in the Weeping Barrow, north-east of Saltmere among the fungal pillars.',
        objective: 'Recover the Vargen Tablets from the Weeping Barrow',
        targets: ['weeping-barrow'],
      },
      {
        at: 30,
        journal:
          'The tablets were exactly where four centuries of grave-quiet left them, under a sanctum guarded by what the barrow grew to keep them. They are heavier than stone should be, and warm. Sela Veth will want to read them before whatever is left of her goes wherever seers go.',
        objective: 'Carry the tablets back to Sela Veth, in Saltmere',
        targets: ['saltmere'],
      },
      {
        at: 40,
        journal:
          'Sela read the tablets with her thumbs, like a woman reading rain. It is as the Choir always sang: Ulmoth, the Drowned King, dreams the March alive — and something in his sleep has torn. The seer cannot mend a god. She bids me carry the question to the three powers of Vethmoor: Captain Dren of the Iron Vigil in Vornstead, Magister Cindral of the Conclave in Veskar, and Factor Skarn of House Skarn in Kraghold. Each will want the March saved their own way.',
        objective: 'Consult the three powers — Vornstead, Veskar, Kraghold',
        targets: ['vornstead', 'veskar', 'kraghold'],
      },
      {
        at: 50,
        journal:
          'Three powers, three answers. The Vigil would cut the dream off at the root and count the cost later. The Conclave would mend the pattern and keep the wonder, whatever it keeps dreaming at us. House Skarn asked what severance does to the duskglass veins, and I did not have an answer. Sela Veth says the choosing was never theirs. The way down is the Undertooth — a throat of black rock in the volcano’s western flank. The Herald of the Drowned King stands the door.',
        objective: 'Find the Undertooth in the volcano’s western flank',
        targets: ['undertooth'],
      },
      {
        at: 60,
        journal:
          'The Undertooth swallows sound. Somewhere below, the Herald is waiting — the dream given teeth so that no waking thing reaches the throne.',
        objective: 'Descend the Undertooth and destroy the Herald',
        targets: ['undertooth'],
      },
      {
        at: 65,
        journal:
          'The Herald is dead, if dead is a thing a dream can be. Past it the dark opens into the hall everyone in the March has slept in: the drowned throne, and the King upon it. The choice the seer promised is mine now. Sever the dream and free the March of its god — or bind the tear and keep the terrible, fertile wonder of it.',
      },
      {
        at: 70,
        journal:
          'It is done. The March will learn what I chose by what the sky does next. I find I am not sorry — only smaller, the way anyone is after standing in a god’s bedroom.',
      },
    ],
  },

  // ===== IRON VIGIL ==============================================================
  {
    id: 'vigil-1',
    name: 'Ears for the Road',
    faction: 'vigil',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'Captain Dren signs my Vigil papers with one condition: prove the roads are safer with me on them. Bandits den in Gullcliff Hollow on the coast road. Three of them stop being a problem, and I stop being a recruit on paper.',
      },
      { at: 20, journal: 'The Gullcliff bandits are dealt with. The captain will want the report.' },
      { at: 30, journal: 'Dren counted the ears, paid the bounty, and told me to wash my hands. Road-warden work.' },
    ],
  },
  {
    id: 'vigil-2',
    name: 'The Sunken Watch',
    faction: 'vigil',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'The Vigil once garrisoned the Sunken Watch, a ruin drowning in the marsh south-east of Saltmere. Something has moved in and the old signal bell has gone quiet. Dren wants the ruin cleared and proof of what held it.',
      },
      { at: 20, journal: 'The thing that silenced the Sunken Watch is dead. I should bring word — and the proof — to Dren.' },
      { at: 30, journal: 'The Watch stands quiet again, the right kind of quiet. Dren has started calling me Warden.' },
    ],
  },
  {
    id: 'vigil-3',
    name: 'Wages of the Dead',
    faction: 'vigil',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'A Vigil pay-wagon went into the Graverold Barrows with its escort three storms ago. The dead do not spend coin. Dren wants the strongbox gold back — all of it — and is precise about what "all" means.',
      },
      { at: 20, journal: 'I have the pay-gold from the Graverold boss-hoard. Dren is waiting in Vornstead.' },
      { at: 30, journal: 'Returned the wages. Dren paid the escort’s families first and me second, which is the right order.' },
    ],
  },
  {
    id: 'vigil-4',
    name: 'The Captain’s Quiet Word',
    faction: 'vigil',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'A quiet one. Dren suspects the Hollow of Teeth — the cave warren in the volcano’s shadow — is where the Deep Choir takes the people who go missing along the ash road. Whatever sings down there is to stop singing. The Vigil was never here.',
      },
      { at: 20, journal: 'The Hollow of Teeth is silent. Time to give the captain her quiet word back.' },
      { at: 30, journal: 'Dren listened, nodded once, and burned her own orders. I believe I am trusted now.' },
    ],
  },

  // ===== CINDRAL CONCLAVE =========================================================
  {
    id: 'conclave-1',
    name: 'A Fair Sample',
    faction: 'conclave',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'Magister Cindral will sponsor my robes if I am useful to the survey. The Conclave needs ashcap fungus — four good caps — for the dream-census reagents. They grow where the ash falls thick.',
      },
      { at: 20, journal: 'Four ashcaps, fairly sampled. The Magister awaits them in Veskar.' },
      { at: 30, journal: 'Cindral pressed the caps, muttered about lattice fracture, and entered my name in the rolls. I am Conclave now.' },
    ],
  },
  {
    id: 'conclave-2',
    name: 'The Quiet Instrument',
    faction: 'conclave',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'A Conclave dream-gauge in the Ashfall Vault stopped reporting. Cindral wants the instrument’s recording crystal back — and is too careful to say what bothers the Vault’s new tenants about it.',
      },
      { at: 20, journal: 'The recording crystal is in my pack, still warm. Back to Veskar.' },
      { at: 30, journal: 'The crystal’s readings made the Magister go quiet for a long time. "Coarsening," was all the explanation I got.' },
    ],
  },
  {
    id: 'conclave-3',
    name: 'Letters Between Halls',
    faction: 'conclave',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'The Conclave trusts no courier with its folios. Cindral hands me a sealed survey packet for the hall scribe at Greyharbor — the innkeeper of the Margrave’s Rest keeps the Conclave’s desk there. Walk it or ride it, but deliver it sealed.',
      },
      { at: 20, journal: 'The packet is delivered, seal unbroken. Cindral will want confirmation.' },
      { at: 30, journal: 'Confirmed. The Magister seems more pleased about the unbroken seal than the delivery.' },
    ],
  },
  {
    id: 'conclave-4',
    name: 'What the Choir Keeps',
    faction: 'conclave',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'The Choir’s Descent — the cult’s oldest fane, sunk in the western ashlands — holds a dream-record the Conclave has wanted for sixty years. Cindral asks me to take it from them. The Choir will not be persuaded, and the Magister knows it.',
      },
      { at: 20, journal: 'The Choir’s relic idol is mine, taken from their deepest sanctum. Veskar, then.' },
      { at: 30, journal: 'Cindral set the idol beside the tablets’ rubbing and the two patterns matched. Nobody in the hall was happy about that.' },
    ],
  },

  // ===== HOUSE SKARN ==============================================================
  {
    id: 'skarn-1',
    name: 'Proof of Hands',
    faction: 'skarn',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'House Skarn hires hands, not names. Factor Skarn wants raw duskglass — two good pieces — pulled from the old veins. Miners die for less; that is rather the point of the test.',
      },
      { at: 20, journal: 'Two pieces of raw duskglass. The Factor’s scales are waiting in Kraghold.' },
      { at: 30, journal: 'Weighed, paid, and written into the House ledgers. Skarn’s motto is apparently "useful is family."' },
    ],
  },
  {
    id: 'skarn-2',
    name: 'The Flooded Ledger',
    faction: 'skarn',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'The Old Margrave Mine flooded a generation ago with a season’s duskglass still in its galleries — and the House ledger that proves Skarn’s claim to them. The Factor wants the ledger-strongbox’s contents before the Margrave’s lawyers learn to swim.',
      },
      { at: 20, journal: 'The flooded mine gave up its strongbox hoard. Kraghold next.' },
      { at: 30, journal: 'The Factor read the recovered papers twice and smiled like a man winning a lawsuit in advance.' },
    ],
  },
  {
    id: 'skarn-3',
    name: 'A Debt in Bone',
    faction: 'skarn',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'Something out of the Kragdeep Galleries has been taking Skarn miners off the night shift. The Factor does not ask the Vigil for help; family matters stay in the family. Whatever it is, it dies.',
      },
      { at: 20, journal: 'The Kragdeep killer is dead. The night shift can go back to fearing ordinary collapse.' },
      { at: 30, journal: 'Skarn paid in full and asked no questions about the state of the body. I am beginning to understand the House.' },
    ],
  },
  {
    id: 'skarn-4',
    name: 'The Margrave’s Price',
    faction: 'skarn',
    doneAt: 30,
    stages: [
      {
        at: 10,
        journal:
          'Delicate work: a token of House gratitude — a seaglass bauble of frankly suspicious value — must reach the harbormaster’s favorite innkeeper in Greyharbor, quietly, ahead of the spring tariff vote. Skarn calls this "diplomacy."',
      },
      { at: 20, journal: 'The bauble is delivered and the innkeeper suddenly remembers loving House Skarn. Report back.' },
      { at: 30, journal: 'The tariff vote will go the House’s way. Nobody broke a law anyone can name. Diplomacy.' },
    ],
  },

  // ===== RADIANT (instanced duties share one journal frame per faction) ==========
  {
    id: 'radiant-vigil',
    name: 'Vigil Duty',
    faction: 'vigil',
    doneAt: 30,
    stages: [
      { at: 10, journal: 'The Vigil duty-board has work for me. Details are posted in my orders.' },
      { at: 20, journal: 'Duty done. Report in for the bounty.' },
      { at: 30, journal: 'Bounty paid. The board will have more when I want it.' },
    ],
  },
  {
    id: 'radiant-conclave',
    name: 'Conclave Fieldwork',
    faction: 'conclave',
    doneAt: 30,
    stages: [
      { at: 10, journal: 'The Conclave survey has fieldwork for me. My sampling orders are noted.' },
      { at: 20, journal: 'Samples secured. The hall pays on receipt.' },
      { at: 30, journal: 'Receipt stamped, stipend paid. The survey is bottomless.' },
    ],
  },
  {
    id: 'radiant-skarn',
    name: 'House Contract',
    faction: 'skarn',
    doneAt: 30,
    stages: [
      { at: 10, journal: 'House Skarn has a contract with my name on it. Terms as posted.' },
      { at: 20, journal: 'Contract fulfilled. The Factor’s clerk owes me coin.' },
      { at: 30, journal: 'Paid in full, ledger squared. There is always another contract.' },
    ],
  },
];

const BY_ID = new Map(QUESTS.map((q) => [q.id, q]));

export function questDef(id: string): QuestDef | undefined {
  return BY_ID.get(id);
}
