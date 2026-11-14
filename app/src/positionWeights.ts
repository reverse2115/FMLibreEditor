// How much each attribute counts for a position, for "Upgrade for a position" (see `PositionUpgradeDialog.tsx`).
//
// These numbers are this fork's own estimate, not the game's: Sports Interactive does not publish how current ability
// is worked out from attributes. A higher number means the attribute matters more there, and an attribute that is not
// listed is left alone by the upgrade. Change the numbers freely: they only steer which attributes are raised first.

/** Attribute key (as in `attribute.<key>`) → how much it counts, 1 (a little) to 10 (most). */
export type Weights = Readonly<Record<string, number>>;

export interface PositionChoice {
  /** The position's key, as in `position.<key>`. */
  key: string;
  name: string;
  weights: Weights;
}

const GOALKEEPER: Weights = {
  handling: 8, reflexes: 8, aerial_reach: 6, command_of_area: 6, communication: 5, kicking: 5, one_on_ones: 4,
  rushing_out: 3, throwing: 3, punching: 3, passing: 3, first_touch: 1,
  decisions: 10, concentration: 6, bravery: 6, positioning: 5, anticipation: 3, composure: 2, leadership: 2,
  teamwork: 2, vision: 1,
  agility: 8, acceleration: 6, strength: 4, pace: 3, balance: 2, jumping_reach: 1, stamina: 1,
};

const CENTRE_BACK: Weights = {
  marking: 8, tackling: 5, heading: 5, passing: 2, first_touch: 2, technique: 1,
  decisions: 10, positioning: 8, anticipation: 5, concentration: 4, composure: 2, bravery: 2, leadership: 2,
  work_rate: 2, teamwork: 1,
  strength: 6, jumping_reach: 6, acceleration: 6, agility: 6, pace: 5, stamina: 3, balance: 2,
};

const FULL_BACK: Weights = {
  tackling: 4, marking: 3, first_touch: 3, crossing: 2, passing: 2, technique: 2, heading: 2, dribbling: 1,
  decisions: 7, positioning: 4, concentration: 4, anticipation: 3, teamwork: 2, work_rate: 2, composure: 2,
  vision: 2, off_the_ball: 1,
  acceleration: 7, stamina: 6, agility: 6, pace: 5, strength: 4, balance: 2, jumping_reach: 2,
};

const DEFENSIVE_MIDFIELDER: Weights = {
  tackling: 7, passing: 4, first_touch: 4, marking: 3, technique: 3, long_shots: 3, dribbling: 2, heading: 1,
  decisions: 8, positioning: 5, anticipation: 5, vision: 4, work_rate: 4, concentration: 3, teamwork: 2,
  composure: 2, off_the_ball: 1,
  acceleration: 6, agility: 6, strength: 5, stamina: 4, pace: 3, balance: 2, jumping_reach: 1,
};

const CENTRAL_MIDFIELDER: Weights = {
  passing: 6, first_touch: 6, technique: 4, tackling: 3, marking: 3, long_shots: 3, dribbling: 2, finishing: 2,
  heading: 1,
  decisions: 7, vision: 6, anticipation: 3, composure: 3, work_rate: 3, off_the_ball: 3, positioning: 3,
  teamwork: 2, concentration: 2,
  acceleration: 6, pace: 6, agility: 6, stamina: 6, strength: 4, balance: 2, jumping_reach: 1,
};

const WINGER: Weights = {
  crossing: 5, dribbling: 5, technique: 4, first_touch: 4, passing: 3, finishing: 2, long_shots: 2,
  decisions: 5, anticipation: 3, composure: 3, vision: 3, flair: 2, off_the_ball: 2, teamwork: 2, work_rate: 2,
  acceleration: 10, pace: 10, stamina: 7, agility: 6, strength: 3, balance: 2,
};

const ATTACKING_MIDFIELDER: Weights = {
  first_touch: 5, technique: 5, passing: 4, dribbling: 3, finishing: 3, long_shots: 3,
  vision: 6, decisions: 6, off_the_ball: 5, anticipation: 3, composure: 3, flair: 2, teamwork: 2, work_rate: 2,
  acceleration: 9, pace: 7, agility: 6, stamina: 6, strength: 3, balance: 2,
};

const STRIKER: Weights = {
  finishing: 8, first_touch: 6, heading: 6, dribbling: 5, technique: 4, long_shots: 2, passing: 2,
  off_the_ball: 6, composure: 6, anticipation: 5, decisions: 5, vision: 2, work_rate: 2, teamwork: 1,
  acceleration: 10, pace: 7, agility: 6, strength: 6, stamina: 6, jumping_reach: 5, balance: 2,
};

/** The positions the upgrade offers, from the back to the front. */
export const POSITIONS: readonly PositionChoice[] = [
  { key: "gk", name: "Goalkeeper", weights: GOALKEEPER },
  { key: "dc", name: "Centre-back", weights: CENTRE_BACK },
  { key: "dl", name: "Left-back", weights: FULL_BACK },
  { key: "dr", name: "Right-back", weights: FULL_BACK },
  { key: "wbl", name: "Left wing-back", weights: FULL_BACK },
  { key: "wbr", name: "Right wing-back", weights: FULL_BACK },
  { key: "dm", name: "Defensive midfielder", weights: DEFENSIVE_MIDFIELDER },
  { key: "mc", name: "Central midfielder", weights: CENTRAL_MIDFIELDER },
  { key: "ml", name: "Left midfielder", weights: WINGER },
  { key: "mr", name: "Right midfielder", weights: WINGER },
  { key: "aml", name: "Left winger", weights: WINGER },
  { key: "amr", name: "Right winger", weights: WINGER },
  { key: "amc", name: "Attacking midfielder", weights: ATTACKING_MIDFIELDER },
  { key: "st", name: "Striker", weights: STRIKER },
];

/**
 * The weighted average (1–20) of a position's attributes that a player of the current ability `ability` is taken to
 * have: about 12 at 100, 16 at 150 and 19 at 200. An estimate, like the weights.
 */
export const levelFor = (ability: number): number => Math.min(20, 5 + ability / 14);
