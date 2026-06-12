/**
 * Quest dialogue — npc-scoped topics with conds + effects. The Game executor
 * supplies the TopicFx surface; conds gate visibility so quest progression is
 * data-driven. Defs with the same id must keep their conds DISJOINT.
 */

import type { TopicDef } from './topics';

const seer = { npc: 'quest:seer' } as const;
const dren = { npc: 'quest:dren' } as const;
const cindral = { npc: 'quest:cindral' } as const;
const skarn = { npc: 'quest:skarn' } as const;

/** Stage helper: between [a, b). */
const between = (g: { questStage: (id: string) => number }, q: string, a: number, b: number): boolean => {
  const s = g.questStage(q);
  return s >= a && s < b;
};

export const QUEST_TOPICS: readonly TopicDef[] = [
  // ===== Sela Veth, the Seer ====================================================
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: seer,
    text: [
      'So. The tide finally washes you in. I have dreamt this doorway a hundred times, writ-bearer — you are always late, and the wax is always the color of a bruise. Hand over [the summons] and let us pretend either of us has time.',
    ],
  },
  {
    id: 'the summons',
    keyword: 'the summons',
    core: true,
    scope: seer,
    cond: (g) => between(g, 'main', 10, 20),
    text: [
      'A pardon, they told you? Child, nobody pardons an exile back INTO Vethmoor. The writ was a hook and you were always the fish. The dreams are curdling — you have felt it, the dark hall, the chair that is not empty. Before I am dead I need proof old enough to trust: the [vargen tablets], buried with their dreamer in the Weeping Barrow, north-east among the fungal pillars. Bring them, and bring yourself back.',
    ],
    effect: (fx) => {
      fx.take('sealed-writ', 1);
      fx.setStage('main', 20);
    },
  },
  {
    id: 'vargen tablets',
    keyword: 'vargen tablets',
    core: true,
    scope: seer,
    cond: (g) => between(g, 'main', 20, 30) && !g.hasItem('vargen-tablets'),
    text: [
      'Old Vargen dreamt true, four centuries before either of us was a regret. His household pressed his dreams into three clay leaves and buried the lot in the Weeping Barrow. The dead there are diligent. Go armed, go rested, and do not read the tablets yourself — that is what I am for.',
    ],
  },
  {
    id: 'vargen tablets',
    keyword: 'vargen tablets',
    core: true,
    scope: seer,
    cond: (g) => between(g, 'main', 20, 40) && g.hasItem('vargen-tablets'),
    text: [
      'Warm, aren’t they. Give them here… yes. Yes. It is as the Choir sings: the King dreams the March alive, and the dream has TORN. I cannot mend a god, writ-bearer, and neither can you — not alone. Carry the question to the three powers: [captain dren] of the Vigil in Vornstead, [magister cindral] of the Conclave in Veskar, [factor skarn] in Kraghold. Hear all three. Then we choose.',
    ],
    effect: (fx) => {
      fx.take('vargen-tablets', 1);
      fx.setStage('main', 40);
    },
  },
  {
    id: 'the undertooth',
    keyword: 'the undertooth',
    core: true,
    scope: seer,
    cond: (g) => g.questStage('main') >= 50,
    text: [
      'A throat of black rock in the volcano’s western flank — the only way down that the dream cannot close. The Herald stands the door: the King’s sleep, given teeth. Past it, the hall we have all slept in. What you do at the throne is yours to do. I only ever saw the doorway.',
    ],
  },
  {
    id: 'the drowned king',
    keyword: 'the drowned king',
    core: true,
    scope: seer,
    text: [
      'Not a god the way the temples mean it. A weather, with a name. He settled under the Tooth before the first net was cast and the March grew up inside his sleep like moss in a sleeping man’s boot. Now the sleep sours, and moss does not get a vote. Except — you might. That is the joke the writ played on you.',
    ],
  },

  // Directions to the three powers (any NPC will point the way).
  {
    id: 'captain dren',
    keyword: 'captain dren',
    text: [
      'Brakka Dren? Runs the Iron Vigil out of Vornstead, where the roads cross. Grey braid, grey eyes, counts everything twice. You will find her near the plaza, standing like the weather owes her money.',
    ],
  },
  {
    id: 'magister cindral',
    keyword: 'magister cindral',
    text: [
      'The old Magister keeps the Conclave’s field hall at Veskar, up in the ash. Sixty years of staring at the volcano and still surprised by it daily — that kind of scholar. Near the plaza, usually arguing with an instrument.',
    ],
  },
  {
    id: 'factor skarn',
    keyword: 'factor skarn',
    text: [
      'Ruvek Skarn, Factor of the House, holds court in Kraghold — mining money, old blood, newer manners than the rest of his family. If coin moves in that town, he heard it drop. By the plaza, dressed better than the town deserves.',
    ],
  },

  // ===== Captain Brakka Dren — Iron Vigil =======================================
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: dren,
    text: [
      'You stand like someone who has been hit before and learned from it. Good. I am Dren; the roads are mine to keep. Speak — about the [iron vigil], or [work] if your spine reaches all the way down.',
    ],
  },
  {
    id: 'iron vigil',
    keyword: 'iron vigil',
    core: true,
    scope: dren,
    cond: (g) => !g.factionJoined('vigil'),
    text: [
      'Walls keep towns; the Vigil keeps everything between them. We are paid in town coin and dead bandits. If you want in: say so plainly — [join the vigil] — and understand that recruits earn rank with their hands, not their histories.',
    ],
  },
  {
    id: 'join the vigil',
    keyword: 'join the vigil',
    core: true,
    scope: dren,
    cond: (g) => !g.factionJoined('vigil'),
    text: ['Then it is done. Recruit. The word is smaller than the job. Ask me for [work] when you are ready to be useful, and for [duties] when you want the board’s small coin.'],
    effect: (fx) => fx.join('vigil'),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => g.factionJoined('vigil') && g.questStage('vigil-1') === 0,
    text: [
      'Proving work. Bandits den in Gullcliff Hollow, up the coast road — they have been taxing fisherfolk with knives. Three of them stop breathing, you stop being a recruit on paper. Go.',
    ],
    effect: (fx) => fx.setStage('vigil-1', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => between(g, 'vigil-1', 10, 20),
    text: ['Gullcliff Hollow. Three bandits. The coast road remembers you either way.'],
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => between(g, 'vigil-1', 20, 30),
    text: ['Three, confirmed — the fisherfolk already sent word ahead of you. Bounty’s yours, Warden. Wash your hands.'],
    effect: (fx) => {
      fx.setStage('vigil-1', 30);
      fx.addRep('vigil', 6);
      fx.addGold(40);
      fx.line('— 40 gold. Reputation with the Iron Vigil grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => g.questStage('vigil-1') >= 30 && g.questStage('vigil-2') === 0,
    text: [
      'The Sunken Watch — our old marsh garrison, south-east of Saltmere — has gone quiet. The signal bell has not rung in a season. Something holds it. Clear the ruin and bring me the shape of what it was.',
    ],
    effect: (fx) => fx.setStage('vigil-2', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => between(g, 'vigil-2', 20, 30),
    text: ['The Watch stands quiet again — the right kind of quiet. Good work, Warden.'],
    effect: (fx) => {
      fx.setStage('vigil-2', 30);
      fx.addRep('vigil', 6);
      fx.addGold(60);
      fx.line('— 60 gold. Reputation with the Iron Vigil grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => g.questStage('vigil-2') >= 30 && g.questStage('vigil-3') === 0 && g.factionRank('vigil') >= 2,
    text: [
      'A pay-wagon went into the Graverold Barrows with its escort three storms back. The dead do not spend coin; it is still down there in the hoard. All of it comes back. I am precise about "all".',
    ],
    effect: (fx) => fx.setStage('vigil-3', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => between(g, 'vigil-3', 20, 30) && g.hasItem('vigil-paychest-gold'),
    text: ['Counted to the coin. The escort’s families get paid first; you get paid second. That is the right order.'],
    effect: (fx) => {
      fx.take('vigil-paychest-gold', 1);
      fx.setStage('vigil-3', 30);
      fx.addRep('vigil', 6);
      fx.addGold(80);
      fx.line('— 80 gold. Reputation with the Iron Vigil grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => g.questStage('vigil-3') >= 30 && g.questStage('vigil-4') === 0 && g.factionRank('vigil') >= 3,
    text: [
      'Quiet word, Sergeant. People go missing on the ash road and I think the Hollow of Teeth is where the Deep Choir takes them. Whatever sings down there stops singing. The Vigil was never here.',
    ],
    effect: (fx) => fx.setStage('vigil-4', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => between(g, 'vigil-4', 20, 30),
    text: ['…Nodded once. Orders burned. You were never there, and you are trusted now — fully.'],
    effect: (fx) => {
      fx.setStage('vigil-4', 30);
      fx.addRep('vigil', 8);
      fx.addGold(120);
      fx.line('— 120 gold, off the books. Reputation with the Iron Vigil grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: dren,
    cond: (g) => g.questStage('vigil-4') >= 30,
    text: ['No authored work left worth your rank — the [duties] board always pays, though, and the roads always need keeping.'],
  },

  // ===== Magister Vael Cindral — Cindral Conclave ================================
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: cindral,
    text: [
      'Hm? Oh. A visitor with intact boots — you walked the road, sensible. I am Cindral. I measure the volcano’s dreaming, which makes me either the most important person in Vethmoor or a fool with instruments. Ask about the [cindral conclave], or about [work] if you can carry a sample without licking it.',
    ],
  },
  {
    id: 'cindral conclave',
    keyword: 'cindral conclave',
    core: true,
    scope: cindral,
    cond: (g) => !g.factionJoined('conclave'),
    text: [
      'The others pray at the Tooth or mine it. We MEASURE it: the ash lattice, the dream census, the slow arithmetic of a sleeping god. If you can read, fight, and follow a sampling protocol, you may [join the conclave]. Two of those three would also be accepted, frankly. We are short-handed.',
    ],
  },
  {
    id: 'join the conclave',
    keyword: 'join the conclave',
    core: true,
    scope: cindral,
    cond: (g) => !g.factionJoined('conclave'),
    text: ['Splendid. You are now a Listener, which means precisely what it says: listen, fetch, survive. [work] when you want sponsorship toward robes; [duties] for the survey’s endless small errands. Members in good standing may use the [portal].'],
    effect: (fx) => fx.join('conclave'),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => g.factionJoined('conclave') && g.questStage('conclave-1') === 0,
    text: [
      'Sponsorship work: the dream-census reagents want ashcap fungus — four good caps, no bruising. They grow where the ashfall lies thick, east and south of the Tooth. Mind the wisps; they also like ashcaps, in their way.',
    ],
    effect: (fx) => fx.setStage('conclave-1', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => between(g, 'conclave-1', 10, 30) && g.hasItem('ingredient-ashcap', 4),
    text: ['Four caps, fairly sampled — see, protocol is not difficult, merely despised. Your name goes in the rolls, Scribe.'],
    effect: (fx) => {
      fx.take('ingredient-ashcap', 4);
      fx.setStage('conclave-1', 20);
      fx.setStage('conclave-1', 30);
      fx.addRep('conclave', 6);
      fx.addGold(40);
      fx.line('— 40 gold stipend. Reputation with the Conclave grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => between(g, 'conclave-1', 10, 30) && !g.hasItem('ingredient-ashcap', 4),
    text: ['Four ashcaps, unbruised. The ashlands east of the Tooth. Counting is part of the protocol.'],
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => g.questStage('conclave-1') >= 30 && g.questStage('conclave-2') === 0,
    text: [
      'A dream-gauge in the Ashfall Vault stopped reporting mid-measurement. The recording crystal must come back — the readings on it matter more than the instrument, or, candidly, than either of us. The Vault has tenants now. Be thorough.',
    ],
    effect: (fx) => fx.setStage('conclave-2', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => between(g, 'conclave-2', 20, 30) && g.hasItem('recording-crystal'),
    text: ['Still warm — that is… hm. "Coarsening." That is all I will say until the arithmetic is done. Well retrieved, Examiner.'],
    effect: (fx) => {
      fx.take('recording-crystal', 1);
      fx.setStage('conclave-2', 30);
      fx.addRep('conclave', 6);
      fx.addGold(60);
      fx.line('— 60 gold. Reputation with the Conclave grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => g.questStage('conclave-2') >= 30 && g.questStage('conclave-3') === 0 && g.factionRank('conclave') >= 2,
    text: [
      'The survey folios travel by trusted hand only. This packet goes to our desk at Greyharbor — the keeper of the inn there minds it for us. Sealed it leaves, sealed it arrives. Walk it or ride the strider; the seal does not care.',
    ],
    effect: (fx) => {
      fx.give('survey-packet', 1);
      fx.setStage('conclave-3', 10);
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => between(g, 'conclave-3', 20, 30),
    text: ['Delivered, seal unbroken — the unbroken part pleases me more than the delivered part. That is the correct instinct to have about seals.'],
    effect: (fx) => {
      fx.setStage('conclave-3', 30);
      fx.addRep('conclave', 6);
      fx.addGold(50);
      fx.line('— 50 gold. Reputation with the Conclave grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => g.questStage('conclave-3') >= 30 && g.questStage('conclave-4') === 0 && g.factionRank('conclave') >= 3,
    text: [
      'Sixty years we have wanted the dream-record the Choir keeps in their Descent, west in the ashlands. They will not sell it, trade it, or discuss it. I am asking you to take it, Senior Examiner, and I am old enough to be honest about what that means.',
    ],
    effect: (fx) => fx.setStage('conclave-4', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => between(g, 'conclave-4', 20, 30) && g.hasItem('choir-relic'),
    text: ['Set it there, beside the tablet rubbings… the patterns match. They MATCH. Nobody in this hall is happy tonight, and that is how we know the work is real.'],
    effect: (fx) => {
      fx.take('choir-relic', 1);
      fx.setStage('conclave-4', 30);
      fx.addRep('conclave', 8);
      fx.addGold(120);
      fx.line('— 120 gold. Reputation with the Conclave grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: cindral,
    cond: (g) => g.questStage('conclave-4') >= 30,
    text: ['The authored survey is yours already — only [duties] remain, and the arithmetic. There is always the arithmetic.'],
  },
  // Conclave portal (members rank 1+): free passage between the three halls.
  {
    id: 'portal',
    keyword: 'portal',
    core: true,
    scope: cindral,
    cond: (g) => g.factionJoined('conclave'),
    text: [
      'The hall portals — our one indulgence. Speak the destination: [portal to greyharbor], [portal to kraghold], or stay and enjoy Veskar’s celebrated wind.',
    ],
  },
  {
    id: 'portal to greyharbor',
    keyword: 'portal to greyharbor',
    core: true,
    scope: cindral,
    cond: (g) => g.factionJoined('conclave'),
    text: ['Mind the step. The sensation passes; the smugness does not.'],
    effect: (fx) => fx.teleport('greyharbor'),
  },
  {
    id: 'portal to kraghold',
    keyword: 'portal to kraghold',
    core: true,
    scope: cindral,
    cond: (g) => g.factionJoined('conclave'),
    text: ['Mind the step. Kraghold smells of hot stone; you grow to like it.'],
    effect: (fx) => fx.teleport('kraghold'),
  },

  // ===== Factor Ruvek Skarn — House Skarn ========================================
  {
    id: 'greeting',
    keyword: 'greeting',
    scope: skarn,
    text: [
      'I know everyone worth knowing in Kraghold, which means I do not know you, which means you are either trouble or opportunity. I am Skarn. Convince me you are the second kind — ask about [house skarn], or about [work].',
    ],
  },
  {
    id: 'house skarn',
    keyword: 'house skarn',
    core: true,
    scope: skarn,
    cond: (g) => !g.factionJoined('skarn'),
    text: [
      'Old blood, older ledgers. Duskglass built this House and pragmatism keeps it standing while prettier houses drown. We hire hands, not names. If yours work, you may [join house skarn]. Useful is family.',
    ],
  },
  {
    id: 'join house skarn',
    keyword: 'join house skarn',
    core: true,
    scope: skarn,
    cond: (g) => !g.factionJoined('skarn'),
    text: ['Witnessed and entered. You are a Hand of House Skarn. [work] earns standing; [duties] earns coin; both earn my attention, which is worth more than either.'],
    effect: (fx) => fx.join('skarn'),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => g.factionJoined('skarn') && g.questStage('skarn-1') === 0,
    text: [
      'Proof of hands: raw duskglass, two good pieces, pulled from the old veins or pried from whoever pried them first. Miners die for less. That is rather the point of the test.',
    ],
    effect: (fx) => fx.setStage('skarn-1', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => between(g, 'skarn-1', 10, 30) && g.hasItem('gem-duskglass', 2),
    text: ['Weighed true, both. Into the ledger you go, Retainer. Useful is family.'],
    effect: (fx) => {
      fx.take('gem-duskglass', 2);
      fx.setStage('skarn-1', 20);
      fx.setStage('skarn-1', 30);
      fx.addRep('skarn', 6);
      fx.addGold(70);
      fx.line('— 70 gold. Standing with House Skarn grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => between(g, 'skarn-1', 10, 30) && !g.hasItem('gem-duskglass', 2),
    text: ['Two pieces of raw duskglass. The mines have it; the miners have it; the things that ate the miners have it. Sourcing is your problem.'],
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => g.questStage('skarn-1') >= 30 && g.questStage('skarn-2') === 0,
    text: [
      'The Old Margrave Mine flooded a generation back with a season of duskglass still in the galleries — and the ledger that proves it is OURS. The strongbox hoard, before the Margrave’s lawyers learn to swim.',
    ],
    effect: (fx) => fx.setStage('skarn-2', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => between(g, 'skarn-2', 20, 30),
    text: ['…Reading it twice, forgive me. I enjoy winning a lawsuit in advance. Well dived, Retainer.'],
    effect: (fx) => {
      fx.setStage('skarn-2', 30);
      fx.addRep('skarn', 6);
      fx.addGold(80);
      fx.line('— 80 gold. Standing with House Skarn grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => g.questStage('skarn-2') >= 30 && g.questStage('skarn-3') === 0 && g.factionRank('skarn') >= 2,
    text: [
      'Family matter. Something out of the Kragdeep Galleries takes miners off the night shift. We do not ask the Vigil; we do not ask twice. Whatever it is — it dies, and the shift goes back to fearing honest collapse.',
    ],
    effect: (fx) => fx.setStage('skarn-3', 10),
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => between(g, 'skarn-3', 20, 30),
    text: ['Dead, and no questions about the state of the body. You begin to understand the House, Oathman.'],
    effect: (fx) => {
      fx.setStage('skarn-3', 30);
      fx.addRep('skarn', 6);
      fx.addGold(90);
      fx.line('— 90 gold. Standing with House Skarn grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => g.questStage('skarn-3') >= 30 && g.questStage('skarn-4') === 0 && g.factionRank('skarn') >= 3,
    text: [
      'Delicate work. This bauble — a token of House gratitude, suspiciously valued — reaches the keeper of the Greyharbor inn quietly, ahead of the spring tariff vote. The harbormaster drinks there. We call this diplomacy.',
    ],
    effect: (fx) => {
      fx.give('skarn-bauble', 1);
      fx.setStage('skarn-4', 10);
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => between(g, 'skarn-4', 20, 30),
    text: ['The vote will go our way and no law anyone can name was broken. Diplomacy, Factor. Yes — Factor. Wear it well.'],
    effect: (fx) => {
      fx.setStage('skarn-4', 30);
      fx.addRep('skarn', 8);
      fx.addGold(130);
      fx.line('— 130 gold. Standing with House Skarn grows.');
    },
  },
  {
    id: 'work',
    keyword: 'work',
    core: true,
    scope: skarn,
    cond: (g) => g.questStage('skarn-4') >= 30,
    text: ['The ledgers are square between us — a rare and beautiful state. [duties] always pay, and the House always watches.'],
  },

  // In-progress reminders so [work] always answers mid-quest.
  ...([
    [dren, 'vigil-2', 'The Sunken Watch, south-east of Saltmere in the drowning marsh. The bell stays silent until you make it safe.'],
    [dren, 'vigil-3', 'Graverold Barrows, east of Vornstead. The pay-gold comes back — all of it, Warden.'],
    [dren, 'vigil-4', 'The Hollow of Teeth, in the volcano’s shadow. Quietly. You were never sent.'],
    [cindral, 'conclave-2', 'The Ashfall Vault, in the southern ash. The crystal matters more than the instrument. Or us.'],
    [cindral, 'conclave-3', 'Greyharbor. The inn keeps our desk. Sealed it leaves, sealed it arrives.'],
    [cindral, 'conclave-4', 'The Choir’s Descent, west in the ashlands. They will not be persuaded. I am sorry for what that means.'],
    [skarn, 'skarn-2', 'The Old Margrave Mine, on the western coast road. The strongbox, before the lawyers learn to swim.'],
    [skarn, 'skarn-3', 'Kragdeep Galleries, east of town. Whatever takes the night shift — it dies.'],
    [skarn, 'skarn-4', 'The Greyharbor inn, quietly, ahead of the tariff vote. We call this diplomacy.'],
  ] as const).map(
    ([who, quest, reminder]): TopicDef => ({
      id: 'work',
      keyword: 'work',
      core: true,
      scope: who,
      cond: (g) => between(g, quest, 10, 20),
      text: [reminder],
    }),
  ),
  // Lost-the-proof fallbacks (stage 20 reached but the take-item went missing).
  ...([
    [dren, 'vigil-3', 'vigil-paychest-gold', 'You HAD the pay-gold. Find it again, Warden, or start explaining to the families.'],
    [cindral, 'conclave-2', 'recording-crystal', 'You had the crystal in hand. Retrace your steps; the readings are irreplaceable.'],
    [cindral, 'conclave-4', 'choir-relic', 'The dream-record was in your pack. Was. Find it.'],
  ] as const).map(
    ([who, quest, item, scold]): TopicDef => ({
      id: 'work',
      keyword: 'work',
      core: true,
      scope: who,
      cond: (g) => between(g, quest, 20, 30) && !g.hasItem(item),
      text: [scold],
    }),
  ),

  // ===== shared faction services: duties + advancement ===========================
  ...(['vigil', 'conclave', 'skarn'] as const).flatMap((f): TopicDef[] => {
    const head = f === 'vigil' ? dren : f === 'conclave' ? cindral : skarn;
    const noun = f === 'vigil' ? 'bounty' : f === 'conclave' ? 'fieldwork' : 'contract';
    return [
      {
        id: 'duties',
        keyword: 'duties',
        core: true,
        scope: head,
        cond: (g) => g.factionJoined(f) && g.duty(f) === null,
        text: [`The board has ${noun} with your name on it. Taken?`],
        effect: (fx) => fx.startDuty(f),
      },
      {
        id: 'duties',
        keyword: 'duties',
        core: true,
        scope: head,
        cond: (g) => {
          const d = g.duty(f);
          return g.factionJoined(f) && d !== null && !d.done;
        },
        text: ['Your current posting stands. Finish it; then we talk coin.'],
        effect: (fx) => fx.turnInDuty(f), // reports progress / completes harvest+deliver checks
      },
      {
        id: 'duties',
        keyword: 'duties',
        core: true,
        scope: head,
        cond: (g) => g.duty(f)?.done === true,
        text: ['Done and witnessed. Coin, and the board will have more when you want it.'],
        effect: (fx) => fx.turnInDuty(f),
      },
      {
        id: 'advancement',
        keyword: 'advancement',
        core: true,
        scope: head,
        cond: (g) => g.factionJoined(f) && g.canPromote(f),
        text: ['Your standing speaks for itself. Kneel — figuratively; we are busy people.'],
        effect: (fx) => fx.promote(f),
      },
      {
        id: 'advancement',
        keyword: 'advancement',
        core: true,
        scope: head,
        cond: (g) => g.factionJoined(f) && !g.canPromote(f),
        text: ['Not yet. Standing is earned in the field, not the asking. [work] and [duties] both count.'],
      },
      // Main-quest consultation (stage 40 → flags → 50).
      {
        id: 'vargen tablets',
        keyword: 'vargen tablets',
        core: true,
        scope: head,
        cond: (g) => g.questStage('main') >= 40 && !g.questFlag(`consult:${f}`),
        text:
          f === 'vigil'
            ? [
                'The seer sent you? Then hear the Vigil’s answer: cut it off at the root. Sever the dream, bury the wonder, and the March will be poorer, smaller — and OURS. Things that live by a god’s mood die by it too. I have buried enough wagon escorts to prefer a small live land to a grand dreaming one.',
              ]
            : f === 'conclave'
              ? [
                  'So the tablets confirm the census. Then the Conclave’s answer is: MEND it. The pattern in the ash is the finest thing either of us will ever stand inside — sever it and Vethmoor becomes mud that remembers being a miracle. Bind the tear. We will spend the next thousand years learning what we saved.',
                ]
              : [
                  'The seer asks the only question that matters and dresses it as philosophy. Here is the House’s answer: what does severance do to the duskglass veins? Nobody knows. Skarn has survived every Margrave and two collapses by never betting the House on an unknown. But it is not my hand on the choice, writ-bearer. It is yours. Choose like someone who must live here after.',
                ],
        effect: (fx) => {
          fx.setFlag(`consult:${f}`);
          if (
            fx.view.questFlag('consult:vigil') &&
            fx.view.questFlag('consult:conclave') &&
            fx.view.questFlag('consult:skarn')
          ) {
            fx.setStage('main', 50);
          }
        },
      },
    ];
  }),

  // ===== deliveries (innkeeper-side) =============================================
  {
    id: 'survey packet',
    keyword: 'survey packet',
    core: true,
    scope: { role: 'innkeep', town: 'greyharbor' as never },
    cond: (g) => between(g, 'conclave-3', 10, 20) && g.hasItem('survey-packet'),
    text: ['For the Conclave desk? Seal’s whole — they check, you know. Consider it minded.'],
    effect: (fx) => {
      fx.take('survey-packet', 1);
      fx.setStage('conclave-3', 20);
    },
  },
  {
    id: 'a quiet gift',
    keyword: 'a quiet gift',
    core: true,
    scope: { role: 'innkeep', town: 'greyharbor' as never },
    cond: (g) => between(g, 'skarn-4', 10, 20) && g.hasItem('skarn-bauble'),
    text: ['…From House Skarn, with no note and no occasion. How thoughtful of nobody in particular. The harbormaster sits by the fire most evenings; things get mentioned.'],
    effect: (fx) => {
      fx.take('skarn-bauble', 1);
      fx.setStage('skarn-4', 20);
    },
  },
  {
    id: 'sealed parcel',
    keyword: 'sealed parcel',
    core: true,
    scope: { role: 'innkeep' },
    cond: (g) => g.hasItem('sealed-parcel'),
    text: ['A House parcel? Let me see the direction on it…'],
    effect: (fx) => fx.deliverParcel(),
  },
];
