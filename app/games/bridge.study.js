// Bridge study: leveled. SAYC per the ACBL yellow card; leads and play per
// standard teaching material (Grant/Root school). Plain data, no imports.

export const STUDY = [
  {
    title: 'Level 1 · The game',
    body: [
      'Four players, two partnerships. 13 cards each, 13 tricks. An auction names a contract: how many tricks over six your side will take, in a trump suit or notrump.',
      'High-card points (HCP): Ace 4, King 3, Queen 2, Jack 1. 40 in the deck; 25-26 between two hands usually makes game in notrump or a major.',
      'The declarer plays both their own hand and the dummy (partner\'s hand, face up after the opening lead).',
      'Game contracts: 3NT (9 tricks), 4♥/4♠ (10), 5♣/5♦ (11). Below that is a partscore; 6-level is a small slam, 7 a grand slam.',
    ],
  },
  {
    title: 'Level 1 · Opening bids (SAYC)',
    body: [
      'Open 1NT with 15-17 HCP and balanced shape (no singleton or void, at most one doubleton). The most descriptive bid in the system.',
      'Open 1♥ or 1♠ with 13+ points and FIVE cards in the suit. No 5-card major: open the longer minor (1♦ with 4+, else 1♣ on 3).',
      'Open 2♣ with 22+: artificial, forcing, says nothing about clubs.',
      'Open 2NT with 20-21 balanced.',
      'Weak twos (2♦/2♥/2♠): 5-11 points, a decent SIX-card suit. Preempts at the 3-level show seven.',
      'Rule of 20 for borderline hands: open when HCP plus the lengths of your two longest suits reach 20.',
      'Under 13 with no preempt shape: pass. The auction rewards patience.',
    ],
  },
  {
    title: 'Level 2 · Responding',
    body: [
      'Support with support: raise partner\'s major with 3+ trumps. 6-9 points: raise one level. 10-12: limit raise (jump). 13+: drive to game.',
      'A new suit at the one level shows 6+ points and 4+ cards. A new suit at the TWO level promises 10+.',
      '1NT response: 6-10, no fit, no biddable suit at the one level. It keeps the auction alive, it is not a place to play.',
      'Responding to 1NT: with a 5-card major, TRANSFER (2♦ shows hearts, 2♥ shows spades) at any strength. With 8+ and a 4-card major, STAYMAN (2♣ asks). 8-9 balanced: raise to 2NT invite. 10-15: bid 3NT.',
      'Responding to a minor: bid a 4-card major before raising the minor. The 8-card major fit is the holy grail.',
    ],
  },
  {
    title: 'Level 2 · The conventions',
    body: [
      'Stayman (1NT-2♣): asks opener for a 4-card major. Replies: 2♦ none, 2♥ four hearts, 2♠ four spades (hearts first with both).',
      'Jacoby transfer (1NT-2♦/2♥): responder shows a 5-card major, opener MUST complete. The strong hand stays hidden as declarer.',
      'Blackwood (4NT): asks for aces. 5♣ = 0 or 4, 5♦ = 1, 5♥ = 2, 5♠ = 3. Then 5NT asks kings the same way. Never Blackwood with a void or two fast losers in an unbid suit.',
      'Gerber (4♣ directly over notrump): the ace-ask when notrump is the frame. 4♦ = 0 or 4, 4♥ = 1, 4♠ = 2, 4NT = 3.',
      'Takeout double: opponents open, you double with opening values and support for the unbid suits. Partner MUST bid.',
      'Overcall: 8-16 with a good 5-card suit at the one level; sound values for the two level.',
    ],
  },
  {
    title: 'Level 3 · Opening leads',
    body: [
      'Vs NOTRUMP: fourth from your longest and strongest. Length is the weapon; you are building tricks for later.',
      'Top of a sequence (KQJ, QJT) against anything: safe and constructive.',
      'Vs a SUIT contract: ace from ace-king is the classic; a singleton hunting a ruff; top of a sequence.',
      'NEVER underlead an ace against a suit contract. Vs notrump it is routine.',
      'Do not lead away from tenaces (AQ, KJ) into declarer; lead through strength, not into it.',
      'Rule of 11 (fourth-best leads): eleven minus the pip led = higher cards outside leader\'s hand. Partner can count declarer\'s stoppers from one card.',
      'From AK: lead the KING by agreement (it promises the ace). From interior sequences (KJ109): the top of the touching run.',
    ],
  },
  {
    title: 'Level 3 · Declarer play',
    body: [
      'Before playing to trick one: COUNT. Winners in notrump, losers in a suit contract. Make the plan before touching dummy.',
      'In a suit contract, draw trumps early unless you need dummy\'s trumps for ruffs.',
      'The finesse: lead TOWARD the honor you hope will win (AQ in dummy: lead low to the queen). A 50% shot beats no shot.',
      'Establish your long suit early in notrump, even at the cost of losing the lead: the hold-up and the duck are investments.',
      'Watch entries: a winner you cannot reach is not a winner.',
    ],
  },
  {
    title: 'Level 3 · Defense',
    body: [
      'Second hand low, third hand high. The oldest rules in whist still pay.',
      'Cover an honor with an honor when it can promote something in your side\'s hands.',
      'Signal: a high spot card thrown on partner\'s lead says "I like this suit"; a low one discourages.',
      'Return partner\'s suit unless you have a clearly better plan. Defense is a partnership.',
      'Count declarer\'s points from the auction: 1NT told you 15-17; use arithmetic, not hope.',
    ],
  },
  {
    title: 'Common mistakes',
    body: [
      'Passing a Jacoby transfer: transfers work at ZERO points, and opener must complete.',
      'Underleading an ace against a suit contract.',
      'Playing to trick one before counting winners or losers: no plan, no contract.',
      'Drawing trumps on autopilot when dummy\'s ruffs were the whole plan.',
      'Covering an honor reflexively when it promotes nothing.',
      'Blackwood with a void: the answer cannot tell you WHICH aces.',
      'Treating SAYC\'s 2-over-1 as game-forcing: it forces one round only.',
    ],
  },
];
