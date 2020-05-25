/* Significantly based on https://www.codeproject.com/Articles/569271/A-Poker-hand-analyzer-in-JavaScript-using-bit-math */
/* but written with variable names to be more readable. */

type u16 = number;
type float = number;
interface HandAnalysis {
  handRank: number;
  english: string;
  btRanks: number;
  btCount: number;
}
enum HandRank {
  highCard = 0,
  pair = 1,
  twoPair = 2,
  trips = 3,
  straight = 4,
  flush = 5,
  fullHouse = 6,
  quads = 7,
  straightFlush = 8,
  royalFlush = 9,
}

export const Rank: Record<string, number> = {
  A: 14, // in binary: 0100 0000 0000 0000
  K: 13, // 0100 0000 0000 0000
  Q: 12,
  J: 11,
  T: 10,
  "9": 9,
  "8": 8,
  "7": 7,
  "6": 6,
  "5": 5,
  "4": 4,
  "3": 3,
  "2": 2,
};
export const Suit: Record<string, number> = {
  s: 1,
  c: 2,
  h: 4,
  d: 8,
};
const WHEEL_HASH = 0x403c; // 0100 0000 0011 1100
const BROADWAY_HASH = 0x7c00; // 0111 1100 0000 0000
const { A, K, Q, J, T } = Rank;
const Rs: number[] = [A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2];
const displayBits = (bits = 16) => (x: number): string =>
  x
    .toString(2)
    .split("")
    .join("")
    .padStart(bits, "0")
    .replace(/(\d{4})/g, "$1 ")
    .replace(/(^\s+|\s+$)/, "");

export const displayIntAs16Bit = displayBits(16);
export const displayFloatAs64Bit = displayBits(64);

export const parseHandFromString = (
  handNotation: string
): [number[], number[]] => {
  const cards = handNotation.trim().split(" ");
  const ranks = cards.map((c) => Rank[c.charAt(0)]);
  const suits = cards.map((c) => Suit[c.charAt(1).toLowerCase()]);
  return [ranks, suits];
};

/**
 * The purpose of this is to record a 1 bit for each rank – duplicates are lost.
 */
export const countRanksBitwise = (handRanks: number[]): u16 => {
  let bitValue: u16 = 0;
  for (let card = 0; card < 5; card++) {
    const cardValue: u16 = 1 << handRanks[card];
    bitValue = bitValue | cardValue;
  }
  return bitValue;
};
/**
 * Okay - this is where JS gets freaky. Javascript uses only 32 bit integers,
 * but 64 bits to store floats.  Of them, 1 (Most significant bit) is used
 * to store the sign, 11 are used to store exponentiation, and that leaves
 * exactly 52 bits left...
 * Now, the problem is that you can't use bitwise operators on floats in JS.
 * Doing so would immediately convert it to an integer.
 * You CAN however, use normal math including % and Math.pow()
 *
 * So it's possible to set a nibble for each of the 13 ranks...
 * and assign a bit for each time one occurs.  Kings full of jacks, for example,
 * can be represented as the number 123351460741120, or
 * 0000 0111 0000 0011 0000 0000 0000 0000 0000 0000 0000 0000 0000
 *   A    K    Q    J    T    9    8    7    6    5    4    3    2
 * to so so, we set an "offset" to the nibble of the rank,
 */
export const countDuplicatesBitwise = (handRanks: number[]): float => {
  let offset: float = 0;
  let value: float = 0;
  /*  A note on this for-loop. 
      offest will be 0 during the i === 0 phase. The left side then evaluates as
      value = 0 * (NaN & 15) + 1;
      but all NaNs are converted to 0 before any bitwise operation in JS ES5. -- According to the ES5 spec:
      // https://es5.github.io/
  */
  for (
    let i = -1, l = handRanks.length;
    i < l;
    i++,
      // offsets for the correct rank. Equal to 1 << handRanks[i]*4, but we can't use bitwise operators on floats.
      offset = Math.pow(2, handRanks[i] * 4)
  ) {
    // though value is a float, it's bits can still be manipulated via addition.
    // (value/offset) bit shifts the desired nibble to the least significant bits (LSBs)
    // & 15 (or (0xF)) "masks" the other bits so that they're not affected,
    value += offset * (((value / offset) & 15) + 1);
  }
  return value;
};

/**
 * (btCount % 15) sums all the nibbles in the btCount.
 * regardless of *which* cards you have, the operation returns the *same* value based on the
 * unique count of card ranks.
 * high card is 0001 + 0001 + 0001 + 0001 + 0001 (+ 7x0000) = 5;
 * one pair will always be 0011 + 0001 + 0001 + 0001 = 6
 * two pair will always be 0011 + 0011 + 0001 = 7
 * three of a kind will always be 0111 + 0001 + 0001 = 9,
 * a full house will be 0111 + 0011 = 10,
 * and four of a kind will be 1111 + 0001 = 16... but modulo 15, that becomes a 1.
 * lets ignore straights and flushes for now.
 * what's really cool about this is that with a little tweaking, this will also work with 7-card hands.
 */

const POKER_HASH: Record<number | string, [string, HandRank]> = {
  RF: ["Royal Flush", HandRank.royalFlush],
  SF: ["Straight Flush", HandRank.straightFlush],
  1: ["Four of a Kind", HandRank.quads],
  10: ["Full House", HandRank.fullHouse],
  F: ["Flush", HandRank.flush],
  S: ["Straight", HandRank.straight],
  9: ["Three of a Kind", HandRank.trips],
  7: ["Two Pair", HandRank.twoPair],
  6: ["Pair", HandRank.pair],
  HC: ["High Card", HandRank.highCard],
};

export const rankPokerHand = (
  ranks: number[],
  suits: number[]
): HandAnalysis => {
  const btRanks = countRanksBitwise(ranks);
  const btCount = countDuplicatesBitwise(ranks) % 15;
  if (btCount !== 5) {
    return {
      handRank: POKER_HASH[btCount][1],
      english: POKER_HASH[btCount][0],
      btRanks,
      btCount,
    };
  }
  // if btCount === 5, there are no duplicates, so it's either a high card, straight, flush, or straight flush.
  const isStraight =
    btRanks / (btRanks & -btRanks) == 31 || btRanks === WHEEL_HASH; // checks if there are 5 consecutive 1s
  const isFlush = suits[0] === (suits[1] | suits[2] | suits[3] | suits[4]); // are all the same.
  if (isFlush && btRanks === BROADWAY_HASH) {
    return {
      handRank: POKER_HASH.RF[1],
      english: POKER_HASH.RF[0],
      btRanks,
      btCount,
    };
  }
  if (isStraight && isFlush) {
    return {
      handRank: POKER_HASH.SF[1],
      english: POKER_HASH.SF[0],
      btRanks,
      btCount,
    };
  }
  if (isFlush) {
    return {
      handRank: POKER_HASH.F[1],
      english: POKER_HASH.F[0],
      btRanks,
      btCount,
    };
  }
  if (isStraight) {
    return {
      handRank: POKER_HASH.S[1],
      english: POKER_HASH.S[0],
      btRanks,
      btCount,
    };
  }
  return {
    handRank: POKER_HASH.HC[1],
    english: POKER_HASH.HC[0],
    btRanks,
    btCount,
  };
};

/**
 * returns a positive value if A is higher, a negative value if B is higher,
 * and zero if they are the same.
 */
interface PairUps {
  quads: number[];
  trips: number[];
  pairs: number[];
  kickers: number[];
  [key: string]: number[];
}
const PAIR_TYPES: string[] = ["kickers", "pairs", "trips", "quads"];
export const btCountToAnalysis = (handRanks: number[]): PairUps => {
  const workspace: PairUps = { quads: [], trips: [], pairs: [], kickers: [] };
  handRanks.sort((a, b) => b - a); //descending order
  const queue = { rank: handRanks[0], count: 1 };
  console.log(handRanks);
  for (let rank of handRanks.slice(1)) {
    console.log(JSON.stringify(queue), JSON.stringify(workspace));
    if (queue.rank === rank) {
      queue.count += 1;
    } else {
      workspace[PAIR_TYPES[queue.count - 1]].push(queue.rank);
      queue.rank = rank;
      queue.count = 1;
    }
  }
  workspace[PAIR_TYPES[queue.count - 1]].push(queue.rank);
  console.log(JSON.stringify(workspace));
  return workspace;
};

const analyzeQuads = (btCount: number): number[] => {
  let quads: number = 0;
  let kicker: number = 0;
  let position = 0;
  const stringRep: string = displayFloatAs64Bit(btCount);
  const l = stringRep.length;
  while ((quads === 0 || kicker === 0) && position < l) {
    position += 5; // skips the first one.
    if (stringRep.charAt(position) === "1") {
      quads = 14 - position / 5;
    } else if (stringRep.charAt(position + 3) === "1") {
      kicker = 14 - position / 5;
    }
  }
  console.log(displayFloatAs64Bit(btCount));
  console.log([quads, kicker]);
  return [quads, kicker];
};
const analyzeBoat = (btCount: number): number[] => {
  let trips: number = 0;
  let pair: number = 0;
  let position = 0;
  const stringRep: string = displayFloatAs64Bit(btCount);
  const l = stringRep.length;
  while ((trips === 0 || pair === 0) && position < l) {
    position += 5; // skips the first one.
    if (stringRep.charAt(position + 1) === "1") {
      trips = 14 - position / 5;
    } else if (stringRep.charAt(position + 2) === "1") {
      pair = 14 - position / 5;
    }
  }
  return [trips, pair];
};

const analyzeTrips = (btCount: number): number[] => {
  let trips: number = 0;
  let kickers: number[] = [];
  let position = 0;
  const stringRep: string = displayFloatAs64Bit(btCount);
  const l = stringRep.length;
  while ((trips === 0 || kickers.length < 2) && position < l) {
    position += 5; // skips the first one.
    if (stringRep.charAt(position + 1) === "1") {
      trips = 14 - position / 5;
    } else if (stringRep.charAt(position + 3) === "1") {
      kickers.push(14 - position / 5);
    }
  }
  return [trips, ...kickers];
};

const analyzeTwoPair = (btCount: number): number[] => {
  let pairs: number[] = [];
  let kicker: number = 0;
  let position = 0;
  const stringRep: string = displayFloatAs64Bit(btCount);
  const l = stringRep.length;
  while (pairs.length < 2 && kicker === 0 && position < l) {
    position += 5; // skips the first one.
    if (stringRep.charAt(position + 2) === "1") {
      pairs.push(14 - position / 5);
    } else if (stringRep.charAt(position + 3) === "1") {
      kicker = 14 - position / 5;
    }
  }
  return [...pairs, kicker];
};

const analyzePair = (btCount: number): number[] => {
  let pair: number = 0;
  let kickers: number[] = [];
  let position = 0;
  const stringRep: string = displayFloatAs64Bit(btCount);
  const l = stringRep.length;
  while ((pair === 0 || kickers.length < 3) && position < l) {
    position += 5; // skips the first one.
    if (stringRep.charAt(position + 2) === "1") {
      pair = 14 - position / 5;
    } else if (stringRep.charAt(position + 3) === "1") {
      kickers.push(14 - position / 5);
    }
  }
  return [pair, ...kickers];
};

// no card has a rank higher than 15 or lower than 0,
// so if we multiply by 16 * the inverse of it's index,
// we get unique values where bigger hands always are larger
// than smaller hands.
const analysisToInt = (handRank: HandRank, bitCount: float): u16 => {
  const analyzers: Record<number, (btCount: number) => number[]> = {
    [HandRank.quads]: analyzeQuads,
    [HandRank.fullHouse]: analyzeBoat,
    [HandRank.trips]: analyzeTrips,
    [HandRank.twoPair]: analyzeTwoPair,
    [HandRank.pair]: analyzePair,
  };
  console.log(handRank, bitCount);
  const analysis: number[] = analyzers[handRank as number](bitCount);
  let count = 0;
  for (let factor = 0, l = analysis.length; factor < l; factor++) {
    count += analysis[factor] * 16 * (l - factor);
  }
  return count;
};

export const compareHands = (handA: string, handB: string): number => {
  /**
   * Returns positive number if hand A is stronger, negative number if hand B is stronger.
   * Returns 0 on a tie.
   */
  const [aRanks, aSuits] = parseHandFromString(handA);
  const [bRanks, bSuits] = parseHandFromString(handB);
  const a = rankPokerHand(aRanks, aSuits);
  const b = rankPokerHand(bRanks, bSuits);
  // easy if the hand ranks don't match.
  if (a.handRank !== b.handRank) {
    return a.handRank - b.handRank;
  }
  // all rfs tie each other.
  if (a.handRank === HandRank.royalFlush) {
    return 0;
  }
  // flushes and high cards will always have a higher bitwise value if they win.
  if (a.handRank === HandRank.flush || a.handRank === HandRank.highCard) {
    return a.btRanks - b.btRanks;
  }
  // so will MOST straight flushes & straights, except wheels/steel wheels.
  if (
    a.handRank === HandRank.straightFlush ||
    a.handRank === HandRank.straight
  ) {
    // Wheels are a special case where the bitwise rank of the ace throws
    // everything off and need to be checked seperately.
    if (a.btRanks === WHEEL_HASH && b.btRanks === WHEEL_HASH) {
      return 0;
    }
    if (a.btRanks === WHEEL_HASH) {
      return -1;
    }
    if (b.btRanks === WHEEL_HASH) {
      return 1;
    }
    return a.btRanks - b.btRanks;
  }

  const hexA: u16 = analysisToInt(a.handRank, a.btCount);
  const hexB: u16 = analysisToInt(b.handRank, b.btCount);
  console.log({ ...a, hexA });
  console.log({ ...b, hexB });
  return hexA - hexB;
};
