// SAYC convention reference + quiz bank. Sources: ACBL SAYC booklet;
// Audrey Grant, "Bidding" (ACBL Bridge Series). Plain data, no imports.
// Each entry: bid (the auction shape), when (trigger), schedule (the replies),
// trap (the classic mistake). quiz: choices are display text, a = index of the
// right one. drill: true when the dealt convention drill covers it.
// hook: a one-line memory encoding (the bonmot pattern: every fact gets a
// hook), repeated on every graded practice answer so it sticks.
// numbers: bidding-box tiles, the few figures worth memorizing cold.

// The spine: the landmark numbers the whole system hangs on.
export const SPINE = [
  { big: '15-17', small: '1NT opening', hook: 'a 16, give or take 1' },
  { big: '20-21', small: '2NT opening', hook: 'the bid spells itself' },
  { big: '22+', small: '2♣ opening', hook: 'two clubs, two 2s' },
  { big: '25', small: 'game', hook: '25 between two hands' },
  { big: '33', small: 'small slam', hook: 'game plus 8' },
  { big: '37', small: 'grand slam', hook: 'slam plus 4' },
];

export const CONVENTIONS = [
  {
    id: 'stayman', name: 'Stayman', bid: '1NT – 2♣', drill: true,
    hook: 'The 8-ball asks: 8+ points and a 4-card major buy the 2♣ question. Replies climb the ladder: ♦ none, ♥ hearts, ♠ spades.',
    numbers: [
      { big: '8+', small: 'points to ask' },
      { big: '4', small: 'card major exactly' },
      { big: '♦♥♠', small: 'no · hearts · spades' },
    ],
    when: 'Partner opens 1NT, you hold 8+ points and at least one 4-card major. 2♣ says nothing about clubs: it asks opener for a 4-card major.',
    schedule: [
      'Opener replies 2♦ = no 4-card major.',
      'Opener replies 2♥ = four hearts (bid hearts first even holding four spades too).',
      'Opener replies 2♠ = four spades, not four hearts.',
      'Fit found: responder raises the major (invite with 8-9, game with 10+).',
      'No fit: responder returns to notrump at the level their points buy (2NT invite, 3NT game).',
    ],
    trap: 'Stayman with a 5-card major is wrong: transfer instead. And never Stayman without a 4-card major just to "ask".',
    quiz: [
      { q: 'Partner opens 1NT. You hold 9 HCP with 4 hearts and 4 spades. Your call?', choices: ['2♣ Stayman', '2♦ transfer', '2NT invite', 'Pass'], a: 0, why: 'A 4-card major and 8+ points is exactly the Stayman hand. Both majors makes it stronger, not weaker.' },
      { q: 'You open 1NT holding four hearts AND four spades. Partner bids 2♣. Your reply?', choices: ['2♦', '2♥', '2♠', '2NT'], a: 1, why: 'With both majors, bid hearts first: 2♥. If responder has spades instead, they can still find them.' },
      { q: 'After 1NT – 2♣ – 2♦, what did opener deny?', choices: ['A club stopper', 'A 4-card major', 'A maximum hand', 'Balanced shape'], a: 1, why: '2♦ is pure denial: no 4-card major. It says nothing about diamonds or strength.' },
    ],
  },
  {
    id: 'transfer', name: 'Jacoby Transfers', bid: '1NT – 2♦/2♥', drill: true,
    hook: 'Point from the door below: bid the suit UNDER your major, opener steps up one. Works broke or loaded: zero points is enough.',
    numbers: [
      { big: '5+', small: 'card major' },
      { big: '0+', small: 'points, any hand' },
      { big: '+1', small: 'opener steps up' },
    ],
    when: 'Partner opens 1NT and you hold a 5+ card major, at ANY point count. Bid the suit below your major; opener must complete the transfer.',
    schedule: [
      '2♦ commands 2♥ (you hold 5+ hearts).',
      '2♥ commands 2♠ (you hold 5+ spades).',
      'Weak hand: pass the completion and play the 2-level fit.',
      'Invitational (8-9): raise to 3 of the major, or 2NT with only five.',
      'Game values (10+): bid game in the major with 6+, or 3NT with five and let opener choose.',
    ],
    trap: 'Opener NEVER passes a transfer. The whole point is that the strong hand stays hidden as declarer.',
    quiz: [
      { q: 'Partner opens 1NT. You hold 2 HCP and six hearts. Your call?', choices: ['Pass', '2♦ transfer', '2♥ natural', '3♥ preempt'], a: 1, why: 'Transfers work at zero points: 2♦, then pass 2♥. Six trumps opposite a doubleton beats 1NT on a bad hand.' },
      { q: 'After 1NT – 2♥ (transfer), opener holds a hand that hates spades. Opener must bid?', choices: ['Pass', '2♠', '2NT', '3♣'], a: 1, why: 'The transfer is a command. 2♠, no judgment involved.' },
      { q: 'Why transfer instead of bidding the major directly?', choices: ['It shows more points', 'The 1NT hand declares, staying hidden', 'It is forcing to game', 'It asks for aces'], a: 1, why: 'The lead comes up to the strong hand instead of through it, and its honors stay concealed.' },
    ],
  },
  {
    id: 'jacoby2n', name: 'Jacoby 2NT', bid: '1♥/1♠ – 2NT', drill: false,
    hook: 'The strong raise hides LOW: 13+ with 4 trumps whispers 2NT. Jumping straight to game is the weak bluff, not the strong hand.',
    numbers: [
      { big: '13+', small: 'points' },
      { big: '4+', small: 'trumps' },
      { big: '3-lvl', small: 'opener shows shortness' },
    ],
    when: 'Partner opens a major, you hold 4+ trumps and 13+ points. The game-forcing raise: 2NT is artificial, agreeing the major.',
    schedule: [
      'Opener shows a singleton or void by bidding that suit at the 3 level.',
      'With no shortness: 4 of the major (minimum), 3NT (extra values), 3 of the major (slam interest).',
      'The direct jump to game (1♠ – 4♠) is the WEAK raise: five trumps, shape, few points.',
    ],
    trap: 'Do not raise to game with 13+: the jump to 4 is preemptive. Strong hands go through 2NT.',
    quiz: [
      { q: 'Partner opens 1♠. You hold 14 points and four spades. Your call?', choices: ['4♠', '3♠', '2NT Jacoby', '2♠'], a: 2, why: '13+ with 4-card support is Jacoby 2NT, forcing to game. 4♠ directly would show a weak shapely raise.' },
      { q: 'After 1♥ – 2NT, opener bids 3♣. What does that show?', choices: ['A second suit', 'Club shortness (singleton/void)', 'Minimum hand', 'Slam veto'], a: 1, why: 'Openers replies to Jacoby 2NT show shortness first: 3♣ = singleton or void in clubs, helping responder judge slam.' },
    ],
  },
  {
    id: 'limitraise', name: 'The Raise Ladder', bid: '1♥/1♠ – 2/3/4♥/♠', drill: false,
    hook: 'The raise thermometer: 6-9 whisper one level, 10-12 shout a jump, 13 drive to game. Three bands, one degree each.',
    numbers: [
      { big: '6-9', small: 'raise one' },
      { big: '10-12', small: 'jump: limit' },
      { big: '13+', small: 'force to game' },
    ],
    when: 'Partner opens a major and you hold 3+ card support. Points decide the level; support decides everything else.',
    schedule: [
      '6-9 support points, 3+ trumps: simple raise to 2.',
      '10-12, 4 trumps: limit raise to 3 (invitational; opener passes a minimum).',
      '13+, 4 trumps: Jacoby 2NT, forcing to game.',
      '10+ with only 3 trumps: bid a new suit first, support next turn.',
      'Weak with 5 trumps and shape: jump straight to game as a preempt.',
    ],
    trap: 'Counting only HCP: with a fit, add shortness (void 5, singleton 3, doubleton 1 with 4 trumps). A flat 10 and a shapely 8 are the same raise.',
    quiz: [
      { q: 'Partner opens 1♥. You hold 11 support points and four hearts. Your call?', choices: ['2♥', '3♥', '4♥', '2NT'], a: 1, why: '10-12 with four trumps is the limit raise: 3♥ invites, opener carries on with sound values.' },
      { q: 'Partner opens 1♠, you raise to 2♠. What did you promise?', choices: ['6-9 points, 3+ spades', '10-12 points', 'Exactly 2 spades', 'Nothing yet'], a: 0, why: 'The single raise is a limited, precise bid: 6-9 support points and 3+ trumps. Partner does the arithmetic from there.' },
    ],
  },
  {
    id: 'weaktwo', name: 'Weak Twos', bid: '2♦/2♥/2♠', drill: false,
    hook: 'Cards = level + 4: a 2-bid shows 6 cards, a 3-bid shows 7. Points stay under an opening: 5-11, honors living in the long suit.',
    numbers: [
      { big: '6', small: 'cards: level+4' },
      { big: '5-11', small: 'points' },
      { big: '2/3', small: 'top honors in suit' },
    ],
    when: 'A decent 6-card suit, 5-11 points, first or second seat. A preempt: you expect to lose the auction and want their side starting a level higher.',
    schedule: [
      'Partner raises to 3 as a FURTHER preempt, not an invitation. Opener always passes it.',
      'Partner bids game with an opening hand and a fit: part preempt, part hope.',
      '2NT by partner (14-16 with a fit) asks for a feature: opener shows an outside ace or king with a maximum, rebids the suit with a minimum. The bots ask and answer it.',
      'A new suit by partner is forcing one round.',
    ],
    trap: 'A weak two with a side 4-card major, or on a 5-card suit, backfires: partner cannot judge. Six cards, most honors inside the suit.',
    quiz: [
      { q: 'You hold 8 HCP and KQJ987 of hearts, nothing outside. First seat. Your call?', choices: ['Pass', '1♥', '2♥', '3♥'], a: 2, why: '5-11 with a good six-card suit is the textbook weak two. 3♥ would promise seven cards.' },
      { q: 'Partner opens a weak 2♠, you hold 9 points and three spades. Your call?', choices: ['Pass', '3♠', '4♠', '2NT'], a: 1, why: 'Raise the barrage: 3♠ steals another level and partner will not bid again. Game needs opening values, not nine.' },
    ],
  },
  {
    id: 'strong2c', name: 'Strong 2♣', bid: '2♣ – 2♦', drill: false,
    hook: 'Two clubs, two 2s: 22+. The one opening partner may NEVER pass; broke hands answer 2♦, which just means "waiting".',
    numbers: [
      { big: '22+', small: 'points: two 2s' },
      { big: '2♦', small: 'waiting reply' },
      { big: '0', small: 'times you may pass it' },
    ],
    when: '22+ points, or a hand within one trick of game. Artificial and forcing: says nothing about clubs. Every other opening can be passed; this one cannot.',
    schedule: [
      'Responder bids 2♦ as the waiting response with almost every hand: it says "tell me more".',
      'Opener then bids naturally: 2NT shows 22-24 balanced (systems on: Stayman, transfers).',
      'A suit rebid by opener is forcing; the auction cannot die below game after 2♣ unless opener rebids 2NT and responder is broke.',
      'A positive response (2♥/2♠/3♣/3♦) shows a decent 5-card suit and 8+ points: rare, slam-hunting.',
    ],
    trap: 'Opening 2♣ on a long-suit 18-count "to be safe": strength, not length. And responder must NOT pass 2♣, ever.',
    quiz: [
      { q: 'Partner opens 2♣. You hold 0 HCP and junk. Your call?', choices: ['Pass', '2♦ waiting', '2NT', '3♣'], a: 1, why: '2♣ is forcing: 2♦ waits with any bust. Passing is the one unforgivable response.' },
      { q: 'What does 2♣ promise about clubs?', choices: ['5+ clubs', '3+ clubs', 'Nothing at all', 'A club stopper'], a: 2, why: 'Fully artificial. The hand may hold a void in clubs; the bid only announces 22+ or near-game strength.' },
    ],
  },
  {
    id: 'blackwood', name: 'Blackwood', bid: '4NT', drill: true,
    hook: 'Suits count from zero, alphabetically: ♣0 ♦1 ♥2 ♠3 (club doubles as "all 4"). The 0314 ladder. Then 5NT asks kings the same way.',
    numbers: [
      { big: '4NT', small: 'asks aces' },
      { big: '0·1·2·3', small: '♣ ♦ ♥ ♠ in order' },
      { big: '5NT', small: 'asks kings' },
    ],
    when: 'A trump fit is set and your side is slam-hunting: 4NT asks how many aces partner holds. Use it to STAY OUT of slams missing two aces.',
    schedule: [
      '5♣ = 0 or 4 aces.',
      '5♦ = 1 ace.',
      '5♥ = 2 aces.',
      '5♠ = 3 aces.',
      'Then 5NT asks kings the same way (and promises all four aces are held).',
    ],
    trap: 'Blackwood with a void or with two fast losers in an unbid suit: the answer counts aces but cannot say WHICH, and 5-level safety is gone.',
    quiz: [
      { q: 'Partner bids 4NT Blackwood. You hold two aces. Your reply?', choices: ['5♣', '5♦', '5♥', '5♠'], a: 2, why: 'The ladder: 5♣ 0/4, 5♦ 1, 5♥ 2, 5♠ 3. Two aces = 5♥.' },
      { q: 'Partner answers 5♦ to your 4NT; an ace is missing. The small slam needs 12 tricks. You should…', choices: ['Bid 6 anyway', 'Sign off at the 5 level in trumps', 'Bid 5NT for kings', 'Pass 5♦'], a: 1, why: 'Missing two aces, slam is dead: sign off. 5NT would promise all four aces. Passing 5♦ plays the wrong strain.' },
      { q: 'When is 4NT NOT Blackwood?', choices: ['Directly over partner\'s 1NT/2NT (quantitative invite)', 'After a major fit is agreed', 'When you hold 20 HCP', 'It always is'], a: 0, why: 'Raising notrump to 4NT is a quantitative slam invite, no aces asked. Blackwood needs a suit agreed (or use Gerber over NT).' },
    ],
  },
  {
    id: 'gerber', name: 'Gerber', bid: '1NT/2NT – 4♣', drill: false,
    hook: 'When notrump talks, CLUBS ask: same 0314 ladder, one floor down. Because 4NT over notrump is a raise invite, not a question.',
    numbers: [
      { big: '4♣', small: 'over 1NT/2NT' },
      { big: '0·1·2·3', small: '♦ ♥ ♠ NT in order' },
      { big: '-1', small: 'floor below Blackwood' },
    ],
    when: 'The ace-ask when notrump is the frame: a JUMP to 4♣ directly over partner\'s 1NT or 2NT opening. Keeps the answers a level lower than Blackwood.',
    schedule: [
      '4♦ = 0 or 4 aces.',
      '4♥ = 1 ace.',
      '4♠ = 2 aces.',
      '4NT = 3 aces.',
      'Then 5♣ asks kings the same way.',
    ],
    trap: 'Confusing the two asks: 4NT over a notrump opening is a quantitative raise, NOT Blackwood. Over notrump, clubs ask the aces.',
    quiz: [
      { q: 'Partner opens 2NT. You want an ace count. Your call?', choices: ['4NT', '4♣ Gerber', '3♣ Stayman', '5NT'], a: 1, why: 'Over a notrump opening the ace-ask is 4♣. 4NT here would be a quantitative invite partner may pass.' },
      { q: 'After 1NT – 4♣ – 4♠, how many aces did opener show?', choices: ['0 or 4', '1', '2', '3'], a: 2, why: 'Gerber steps mirror Blackwood one level down: 4♦ 0/4, 4♥ 1, 4♠ 2, 4NT 3.' },
    ],
  },
  {
    id: 'takeout', name: 'Takeout Double', bid: '(1x) – Dbl', drill: false,
    hook: 'Short in THEIRS, help for the REST, opening count: the double says "partner, pick a suit". And partner must answer, even broke.',
    numbers: [
      { big: '13±', small: 'opening values' },
      { big: '≤2', small: 'cards in their suit' },
      { big: '3+', small: 'in each unbid suit' },
    ],
    when: 'An opponent opens, you hold opening values, shortness in their suit, and support for the three unbid suits. The double says "pick a suit, partner". The bots play it, and the tables score doubled contracts in full.',
    schedule: [
      'Partner MUST bid their best suit, even with zero points: passing converts it to penalty.',
      'Partner jumps a level with 10-12; 1NT with 8-11 and their suit stopped.',
      'Doubler bidding a new suit afterwards shows 17+, too strong for a simple overcall.',
      'Double is for takeout when partner has not bid and the doubler acts at their first turn over a suit bid.',
      'The price of being wrong: doubled contracts score double trick values plus a 50 insult; doubled undertricks climb 100/300/500 (200/500/800 vulnerable), and a redouble doubles it all again.',
      'House bot reading: a double of a SUIT bid is takeout (or negative when partner opened); a double of NOTRUMP is penalty and the partner bot sits for it. The bots never redouble, and never double a low suit contract for penalty.',
    ],
    trap: 'Doubling with a flat hand and length in their suit: that is a penalty pass shape, not takeout. And never pass partner\'s takeout double for lack of points.',
    quiz: [
      { q: 'Right-hand opponent opens 1♥. You hold 13 HCP, singleton heart, 4 cards in each other suit. Your call?', choices: ['Pass', '1NT', 'Double', '2♣'], a: 2, why: 'The perfect takeout double: opening values, shortness in theirs, support everywhere else.' },
      { q: 'Partner doubles their 1♦ opening for takeout. You hold 2 HCP. Your call?', choices: ['Pass', 'Your cheapest 4-card suit', '1NT', 'Redouble'], a: 1, why: 'The double commands a bid: pass turns it into penalty with your side outgunned. Scrape up the cheapest suit.' },
    ],
  },
  {
    id: 'negdbl', name: 'Negative Double', bid: '1x – (1y) – Dbl', drill: false,
    hook: 'They stole your bid? Double bids it for you: X = the unbid major, exactly FOUR cards. With five, bid the suit itself.',
    numbers: [
      { big: '4', small: 'cards, unbid major' },
      { big: '6/8', small: 'pts: 1-lvl / 2-lvl' },
      { big: '2♠', small: 'negative through here' },
    ],
    when: 'Partner opens one of a suit and RHO overcalls (through 2♠). Your double is NOT penalty: it shows the unbid major(s) — the hand that wanted to bid a 4-card major and had the bid stolen.',
    schedule: [
      'After 1♣/1♦ – (1♥): double shows EXACTLY four spades. With five, bid 1♠ yourself.',
      'After 1x – (1♠): double shows 4+ hearts, without the 10 points a 2♥ bid would promise.',
      'After 1♣ – (1♦): double shows 4-4 in both majors; opener picks.',
      'Points: 6+ when the implied bid sits at the one level, 8+ at the two level.',
      'Opener answers like a takeout double: bids the shown major cheaply, jumps with 16+, or shows a stopper in notrump.',
    ],
    trap: 'Doubling with five spades after 1m – (1♥): partner reads exactly four and may pass a 4-3 game. And passing with the perfect negative-double hand sells out the whole major suit.',
    quiz: [
      { q: 'Partner opens 1♦, RHO overcalls 1♠. You hold 8 HCP and four hearts. Your call?', choices: ['Pass', '2♥', 'Double', '1NT'], a: 2, why: '2♥ would promise 10+ points. The negative double IS the heart bid on this hand: 4+ hearts, 8+ at the two level.' },
      { q: 'After 1♣ – (1♥) – Dbl, how many spades did the doubler promise?', choices: ['3+', 'Exactly 4', '5+', 'Any number'], a: 1, why: 'Exactly four: with five spades the doubler bids 1♠ instead. That precision is the whole convention.' },
      { q: 'Partner opens 1♥, RHO overcalls 2♣, you double. What is opener expected to do?', choices: ['Pass for penalty', 'Bid spades (your shown major)', 'Rebid hearts always', 'Redouble'], a: 1, why: 'The negative double shows the unbid major, spades here. Opener bids them cheaply, jumping with extras, exactly like advancing a takeout double.' },
    ],
  },
  {
    id: 'overcall', name: 'Overcalls', bid: '(1x) – 1y/2y', drill: false,
    hook: 'Suit first, points second: two of the top three honors buys the overcall. 8-16 at the one level; sound opening values at the two.',
    numbers: [
      { big: '5+', small: 'card suit, good' },
      { big: '8-16', small: 'one level' },
      { big: '2/3', small: 'top honors' },
    ],
    when: 'They open, you hold a good 5+ card suit. At the one level: 8-16 points. At the two level: sound opening values and a strong suit.',
    schedule: [
      'The suit quality matters more than the count: two of the top three honors is the standard.',
      'Partner raises with 3-card support on the same ladder as an opening (simple 6-9, jump 10-12).',
      'A 1NT overcall shows 15-18 balanced WITH a stopper in their suit.',
      'With opening values but no 5-card suit: that is the takeout double\'s job.',
    ],
    trap: 'Overcalling on a bad suit "to compete": the opening lead comes through you and partner leads your suit. Bad suit, bad result.',
    quiz: [
      { q: 'They open 1♦. You hold 10 HCP and AKJ92 of spades. Your call?', choices: ['Pass', '1♠', 'Double', '2♠'], a: 1, why: 'A textbook one-level overcall: 8-16 with a good five-card suit. Double denies a clear 5-card suit to show.' },
      { q: 'A 1NT overcall over their 1♥ shows?', choices: ['12-14 balanced', '15-18 with a heart stopper', 'Any 1NT opening hand', 'A weak notrump'], a: 1, why: 'Stronger than an opening 1NT and it promises their suit stopped: 15-18 with hearts held.' },
    ],
  },
  {
    id: 'rule20', name: 'Rule of 20', bid: 'the borderline opening', drill: false,
    hook: 'HCP plus your two longest suit lengths: at 20, open. Shape is tricks that points cannot see; 4-3-3-3 never qualifies.',
    numbers: [
      { big: '20', small: 'HCP + 2 longest' },
      { big: '11+5+4', small: 'the classic light open' },
      { big: '4333', small: 'never counts' },
    ],
    when: 'A hand short of full opening count: add your HCP to the lengths of your two longest suits. At 20 or more, open in first or second seat.',
    schedule: [
      '11 HCP with 5-4 shape: 11 + 5 + 4 = 20, open.',
      '11 HCP flat (4-3-3-3): 11 + 4 + 3 = 18, pass.',
      'The honors should live in the long suits: a shapely hand with stray queens is a trap.',
    ],
    trap: 'Applying it in third seat after two passes, where light openings are already routine, or counting a 4-3-3-3 12 as shapely. Shape opens light hands, not wishes.',
    quiz: [
      { q: '11 HCP, five spades, four diamonds, honors in both. Rule of 20 says?', choices: ['Pass', 'Open 1♠', 'Open 1♦', 'Open 1NT'], a: 1, why: '11 + 5 + 4 = 20: open, and majors need five, so 1♠.' },
      { q: 'Why does the Rule of 20 reward shape?', choices: ['Long suits mean more tricks once trumps agree', 'Shapely hands have more HCP', 'It punishes passing', 'It does not'], a: 0, why: 'Length is tricks: a 5-4 hand plays a full trick better than a flat one on the same count. The rule prices that in.' },
    ],
  },
];

// Flat quiz bank for the drill.
export const QUIZ = CONVENTIONS.flatMap(cv => cv.quiz.map(q => ({ ...q, conv: cv.name })));
