// Sheepshead study, leveled. PRIMARY source: Strupp, "How to Play 'Winning'
// 5 Handed Sheepshead" (Milwaukee school; the coach plays by its rules).
// Secondary: sheepshead.org (Advanced Play + Ten Commandments),
// sheepsheadrules.com, playsheepshead.org, pagat.com. Plain data, no imports.

export const STUDY = [
  {
    title: 'The Strupp rules · the house doctrine',
    body: [
      'This table plays by the Milwaukee book. Its core, in one breath: the picker leads trump; the partner leads trump (small, unless holding Q♣); the opposition leads the called suit; nobody plays over a winning teammate.',
      'When in doubt, pick. When in doubt, schmear. Do not mauer (pass a pickable hand).',
      'Schmear fodder is aces, tens, kings. Queens and jacks are power, not points: never throw one onto a won trick.',
      'Hold the called suit until trump has been pulled, then send it through: the ace walks home.',
      'Trumping a fail trick as a defender: trump HIGH ("send a man"). It forces out the picker\'s big trump, which would have beaten your high trump on a trump lead anyway.',
      'On a trump lead, second and third hand duck low; fourth and fifth hand overtrump.',
      'Count the 14 trump and count points as the hand goes: play every hand to its maximum.',
    ],
  },
  {
    title: 'Level 1 · The deck and trump',
    body: [
      '32 cards: A 10 K Q J 9 8 7 in each suit. 120 points in the deck.',
      'All queens, all jacks, and all diamonds are trump: 14 of the 32 cards, more than a third of the deck.',
      'Trump order, high to low: Q♣ Q♠ Q♥ Q♦ J♣ J♠ J♥ J♦ A♦ 10♦ K♦ 9♦ 8♦ 7♦.',
      'Fail suits rank A 10 K 9 8 7: the TEN outranks the king.',
      'Card points: Ace 11, Ten 10, King 4, Queen 3, Jack 2. Picker side needs 61; defenders win ties at 60.',
      '31+ avoids schneider (double stakes); taking no trick at all is a no-tricker (triple).',
    ],
  },
  {
    title: 'Level 1 · The deal and the pick',
    body: [
      'Six cards each, two to the blind. From the dealer\'s left, pick the blind or pass.',
      'The picker buries two: buried points count toward the picker\'s 61.',
      'The picker calls a fail ace: its holder becomes the secret partner, must play the ace when the suit is first led, and may not throw it on another suit.',
      'The picker must keep at least one card of the called suit and cannot call an ace he holds.',
      'All pass: a leaster (fewest points wins) or a doubler, by table rule.',
    ],
  },
  {
    title: 'Level 2 · When to pick',
    body: [
      'The book picks: any 5 trump; two queens plus another trump with points to bury; one queen plus three more trump; the two black queens when you lead or sit on the end.',
      'Marginal 4-trump hands: the tiebreaker is a way to SCORE, buryable aces and tens, not trump count alone.',
      'Position math: seat two is the worst pick seat, no lead advantage and three players behind you. The end seat can stretch a notch below book; a pass there may force a leaster.',
      'Quality beats quantity: Q♣ Q♠ J♣ J♠ controls a hand better than six low diamonds, because high trump PULLS trump.',
      'The numbers: the picker wins about 70% of hands, 75% when holding the high queen, and holds Q♣ about 65% of the time after the blind.',
    ],
  },
  {
    title: 'Level 2 · Burying and calling',
    body: [
      'Bury fat: a buried ace plus ten is 21 points, a third of the way to 61 before a card is played.',
      'Bury toward voids: eliminating a fail suit lets you trump its first lead. Aim to keep ONE fail suit.',
      'Never bury the hold card of the suit you call, and never keep a bare ten in a suit whose ace you gave up: it becomes bait.',
      'Call your shortest callable suit, so the ace walks and you trump the re-lead.',
      'The called ace walks about 80% of the time when the picker\'s side controls when the suit is led, about 50% when the defense leads it first.',
    ],
  },
  {
    title: 'Level 2 · Play by role',
    body: [
      'Picker and partner lead trump: two of theirs for one of yours. Q♣ first is a certain trick.',
      'Defenders lead the called suit early, forcing the ace out while defense still holds trump. No called-suit card: lead your long suit through the picker.',
      'Schmear (throw aces and tens) ONLY onto tricks your side has locked up. Protect your only schmear.',
      'Partner tells before the ace flips: schmearing the picker\'s tricks, refusing to lead the called suit, leading trump as a non-picker.',
      'Second and third to a trump lead: play low trump, save the queens.',
    ],
  },
  {
    title: 'Level 3 · Counting and the endgame',
    body: [
      'Count trump as they fall: 14 exist. Track the BOSS, the highest unplayed trump, so you know when your king of diamonds rules the world.',
      'Run a mental point tally. Past 61, defenders shift to loss-minimizing; behind it, take risks on the fat tricks because safe play locks in the loss.',
      'Points before power: late in the hand, give up a ten or ace rather than burn a trump you need, if your remaining trump still takes tricks.',
      'The skill ladder: track the boss, then the point total, then exact trump remaining, then the specific unplayed cards. Climb one rung at a time.',
    ],
  },
  {
    title: 'Level 3 · Cracking, leasters, and table craft',
    body: [
      'Heads up: this table plays neither cracks nor leasters yet (all-pass hands re-deal; losses always pay the bump). This section is for your real-life games.',
      'Cracking (doubling the hand as a defender): crack when your win chance beats ONE IN THREE. The math: a third of +4 beats two-thirds of -2. Do not wait for sure things.',
      'Re-crack as picker only with 20+ points safely buried or secured.',
      'Leaster play inverts everything: voids become liabilities, high trump you cannot shed is a trap, and the last trick often takes the blind. Dump points onto tricks others must win.',
      'Read the passes: a LATE pass is real weakness (they knew how many passed before them); an early pass is ambiguous.',
      'Mauering, passing a pickable hand, is bad manners and real information: an oddly strong leaster from an aggressive player tells you what happened.',
    ],
  },
  {
    title: 'Common mistakes',
    body: [
      'Picking on fail aces without trump: aces do not give control, trump does.',
      'Revealing the partner early: leading trump as an unknown defender, or dumping the called ace off-suit.',
      'Schmearing a trick that is not yet won.',
      'Playing a leaster like a normal hand.',
      'Cracking only on sure things: the 35-60% zone is profit left on the table.',
      'Ignoring seat position on marginal picks.',
      'Not counting trump, then wasting a queen on a trick a 9♦ would have taken.',
    ],
  },
];
