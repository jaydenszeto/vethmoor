/** Authored book texts. Skill books teach +1 to a skill on first reading. */

export interface BookText {
  id: string;
  title: string;
  text: string;
}

export const BOOK_TEXTS: readonly BookText[] = [
  {
    id: 'ninefold-tide',
    title: 'The Ninefold Tide',
    text: `Being a faithful rendering of the Choir's teaching, set down by a hand that has since stopped writing.

The sea gives nine tides. Eight you have seen: the two of the day, the two of the moon, the four of the season. The ninth tide moves in no water you can stand beside. It moves in sleep.

When the Drowned King settled beneath the Tooth — and he was not always beneath it, the deep songs are clear on this — his breathing became the ninth tide. In: the dreams of every sleeper in the March drift toward the dark throne. Out: the ash. You have tasted it on the wind. That is the flavor of a god's exhalation, and you should be grateful, for nothing in this March grows without it.

The Choir does not worship. Worship is for things that want. We TEND. A fire wants nothing, yet untended it dies or devours. So we sing the descents, we count the storm-years, we keep the old measure: nine voices, nine notes, the ninth held until the singer's sight goes grey.

They burned the fane at Thornmoor and called it mercy. Count the storms since, brother or sister, and tell me who was merciful.

The ninth tide is turning. The dreams come up black now, all of them. What the sleeping feel, the waking will. If the song is not sung, he will be SUNG TO by what we have all, in our smallness, dreamed at him.

Tend the fire. Tend the sleeper.

The tide does not forgive twice.`,
  },
  {
    id: 'pattern-of-ash',
    title: 'A Pattern of Ash',
    text: `From the third folio of Senior Examiner Vael Cindral's natural philosophy, as taught in the Conclave halls.

Consider the question every child of the March eventually asks: why does anything grow here at all?

Strip away the wonder and observe. The ash of the Ember Tooth is not the ash of a wood fire. Under the lens it is a lattice — regular, repeating, almost WRITTEN. Burned matter does not organize so. Sown across a field, it does not smother as common cinder would; the steppe grass grows three-fold, the fungus forests rise like cathedral pillars, and the marsh reeds fatten on it. The March is not fertile despite the volcano. The March is fertile because of it, and only because of it.

Now the uncomfortable arithmetic. We have measured the Tooth's exhalations for sixty years. They correlate with no season, no deep tremor, no tide — they correlate, colleagues have whispered and I will now write plainly, with the DREAM CENSUS. When the towns dream sweetly, the ash falls light and the lattice is fine. When the dreams run dark, the ash coarsens. This year the lattice has begun to fracture into forms I have no category for, and I have catalogued ash for sixty years.

I offer no theology. I observe a system: something below converts dream into substance, and substance into life, and the conversion is degrading.

A pattern that beautiful does not simply stop. It is stopped. Or it is mended.

The Conclave's task is to learn which of those we are capable of, before someone less careful chooses for us.`,
  },
  {
    id: 'letters-saltmere',
    title: 'Letters from Saltmere',
    text: `Found bundled in oilcloth in an attic on the dock row. The replies, if there were any, are lost.

My dear Edra,

You ask what the March is like. I will tell you and you will not believe me, so first know that I have been six months sober of everything but eel stew.

The mushrooms here are taller than the chapel at home. One does not pick them; one LOGS them. In the marsh there are reeds that lean toward you when you speak kindly, and crabs the size of dogs that do not. The sun rises out of mountains and sets into the sea and in between everything is grey and silver and the exact green of old bronze — I have stopped finding it bleak. I have started finding everything else gaudy.

Advice, should you follow me out (do): walk the roads, even when the shortcut looks gentle. Buy from Hildefrid on the square — her scales are honest and her gossip is better. Bow to the temple, nod to the Vigil, and if a scholar in a grey robe offers to buy your dreams, name a high price; they will pay it.

And Edra — this you must keep from mother — sometimes the whole town dreams the same dream. We compare notes at the well, casual as weather. A dark hall. A chair that is not empty. It frightened me the first season. Now it is only Tuesday.

The tide gives back what it takes, they say here. It took me from you; perhaps it pays you this letter.

Your loving sister,
Mara`,
  },
  // ----- skill books ------------------------------------------------------------
  {
    id: 'skill-blade',
    title: 'The Sellsword’s Primer',
    text: `Rule one: the sword is a tax on people who plan poorly. Collect it rarely.

Rule two, for when rule one fails: the edge does the work, you do the placing. A drawn cut with the last third of the blade beats a hero's hack with the middle. Strike from where your feet already are — the lunge they teach in duelling yards is a gift to anyone holding a spear.

Rule three: watch the shoulder, never the eyes. Eyes lie for a living. The shoulder cannot start a blow without confessing first.

Rule four: charge your swing when their blow is spent and not before. Patience is a weapon you cannot drop.

Rule five: be paid in advance.`,
  },
  {
    id: 'skill-block',
    title: 'Ward and Shield',
    text: `A shield is not a wall. A wall stands where it was built; a shield ARRIVES.

Meet the blow at an angle and it slides off spent, leaving you whole and them open. Meet it square and you have merely chosen which arm aches tonight.

Keep the rim between your eye and their edge. Press when they recover — a shield in the teeth ends more fights than any sword. And mind your feet: a perfect ward on crossed ankles is a gravestone with good reviews.`,
  },
  {
    id: 'skill-alchemy',
    title: 'Ash and Alembic',
    text: `Every ingredient of the March holds four virtues, and the March holds nothing politely. The same spore that knits a wound will, in a careless dose, stop a heart.

The craft is agreement: combine matter that shares a virtue and the virtue speaks. Combine matter at war and you have soup, or worse.

Learn your reagents by tongue-tip and lamplight before you trust them to a stomach. The novice tastes everything once. The master tastes everything once, too — but writes it down.`,
  },
  {
    id: 'skill-destruction',
    title: 'The Veiled Flame',
    text: `Fire is not summoned. It is REMINDED. Every speck of ash in the March remembers the Tooth, and your will is merely the argument that it should burn again here, now, in the shape of your need.

Argue briefly. A long cast is a beautiful way to die.

Shape the heat away from your own hand first — the body keeps no grudge like a burned palm. And never throw flame at what the fog hides. The fog hides things that remember fire better than you do.`,
  },
  {
    id: 'skill-sneak',
    title: 'The Quiet Foot',
    text: `Noise is laziness leaving the body.

Walk on the outside edge of the foot, heel to toe, knees soft. Move when the wind moves; stand when it stands. A watcher's eye loves motion and forgives shape — be a barrel, a shadow, a hanging net, anything that holds still with conviction.

Carry less. Everything you own has an opinion and expresses it at the worst moment. The quiet ones die rich, of old age, elsewhere.`,
  },
  {
    id: 'skill-security',
    title: 'Locks of Greyharbor',
    text: `A lock is a conversation with someone who is not there. Be polite: listen more than you speak.

Three pins or five, the grammar is the same — tension light as a held breath, lift each pin to the shear and let the cylinder confess. Force is a question asked so loudly the answer breaks.

The harbor smiths set a false notch in their better work; feel for the give that gives too easily. And remember the first law of the trade: the finest lock in the March tells everyone where the valuables are.`,
  },
  {
    id: 'skill-athletics',
    title: 'Roadsong of the Striders',
    text: `The Sutherai say: the road is eaten in mouthfuls, not swallowed whole.

Breathe in for four strides, out for four. Downhill is a gift — spend it; uphill is a debt — pay it slowly. Drink before thirst, eat before hunger, rest before the stumble, and you will arrive before the clever ones who sprinted.

The body is a strider: feed it, pace it, and it will cross the March. Whip it, and it will lie down in the ash and be philosophical about your schedule.`,
  },
];

export const BOOK_BY_TEXT_ID: ReadonlyMap<string, BookText> = new Map(
  BOOK_TEXTS.map((b) => [b.id, b]),
);
