// In-app rules + strategy reference. Sources: pagat.com/schafkopf/shep.html,
// sheepshead.org, playsheepshead.org, sheepsheadrules.com (Wergin-school guidelines).
// Plain data, no imports.

export const STUDY = [
  {
    title: 'The deck and trump',
    body: [
      '32 cards: A 10 K Q J 9 8 7 in each suit. 120 points in the deck.',
      'All queens, all jacks, and all diamonds are trump: 14 trump cards.',
      'Trump order, high to low: Q♣ Q♠ Q♥ Q♦ J♣ J♠ J♥ J♦ A♦ 10♦ K♦ 9♦ 8♦ 7♦.',
      'Fail suits (clubs, spades, hearts) rank A 10 K 9 8 7. Note the 10 outranks the king.',
      'Card points: Ace 11, Ten 10, King 4, Queen 3, Jack 2. Nines, eights, sevens are zero.',
    ],
  },
  {
    title: 'The deal and the pick (5-handed)',
    body: [
      'Six cards each, two to the blind. Starting left of the dealer, each player may pick the blind or pass.',
      'The picker takes the blind and buries two cards face down. Buried points count for the picker.',
      'The picker calls a fail ace: its holder is the secret partner. The picker must keep at least one card of the called suit and cannot call an ace he holds.',
      'The partner must play the called ace when the suit is first led and may not throw it on another suit.',
      'Picker plus partner need 61 of the 120 points. Defenders win a 60-60 tie.',
    ],
  },
  {
    title: 'Play of the hand',
    body: [
      'Left of dealer leads trick one. Follow the led suit if you can: trump is its own suit.',
      'Cannot follow? Play anything: trump in, or throw points to a winning teammate ("schmear").',
      'Highest trump wins the trick. No trump: highest card of the led suit wins.',
      'Trick winner leads next.',
    ],
  },
  {
    title: 'When to pick',
    body: [
      'Any 5 trump: pick.',
      'Two queens plus another trump, with some points to bury: pick.',
      'One queen plus three more trump: pick.',
      'The two black queens, if you lead or sit on the end: pick.',
      'Position matters: stretch a notch on the end (a pass may force a leaster or doubler), tighten up early.',
      'Quality beats quantity: Q♣ Q♠ J♣ J♠ controls a hand better than six low diamonds.',
    ],
  },
  {
    title: 'Burying',
    body: [
      'Bury fat: fail aces and tens go straight into your count.',
      'Bury toward voids: eliminating a fail suit lets you trump its first lead.',
      'Never bury your hold card in the called suit, and bury trump only when nearly solid.',
    ],
  },
  {
    title: 'Leading: picker and partner',
    body: [
      'Picker leads trump, almost always. Q♣ first: a certain trick that pulls two more trump.',
      'Never hand the defense the lead cheaply: spend a high queen to keep control.',
      'Partner also leads trump, and never leads the called ace: preserve its walk.',
      'Partner with no trump: lead a fail ace, else your short suit.',
    ],
  },
  {
    title: 'Leading: defenders',
    body: [
      'Lead the called suit early: force the ace out while the defense still holds trump.',
      'No called-suit card? Lead your long suit through the picker: a teammate behind may trump in.',
      'Do not lead trump into the picker: that is the picker\'s job, not yours.',
      'Second and third to a trump lead: play low trump, save the queens.',
    ],
  },
  {
    title: 'Table wisdom',
    body: [
      'Points before power: give up a 10 or ace to a teammate if trump in your hand still takes tricks.',
      'When in doubt, schmear: right about 60% of the time.',
      'Count trump as they fall: 14 exist, and knowing when the boss is gone wins endgames.',
      'The picker wins roughly 70% of hands: pick to the book and the odds ride with you.',
      'Keep a running point count. The last tricks decide most close hands.',
    ],
  },
  {
    title: 'Scoring the game',
    body: [
      'Picker side wins: picker +2, partner +1, each defender -1 (stakes, not card points).',
      'Defenders under 31 (schneider): doubled. Defenders take no trick: tripled.',
      'Picker side loses: same ladder in reverse, and the picker pays double share.',
      'Going alone: picker takes all four shares.',
    ],
  },
];
