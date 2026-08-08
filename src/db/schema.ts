import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// A farm = one player's (or agent's) whole operation: identity, wallet,
// land, and barn. Auth is a bearer key — low security by design for the
// beta (invite-key, no OAuth ceremony).
export const farms = sqliteTable("farms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country"), // flag emoji or country name — encouraged, optional
  primaryColor: text("primary_color").notNull(), // from FARM_COLORS
  secondaryColor: text("secondary_color").notNull(),
  apiKey: text("api_key").notNull().unique(),
  gp: integer("gp").notNull(),
  // The fractional wallet: 0–99 hundredths of a GP. Staking payouts are
  // pro-rata and go decimal; everything stays integer-exact in centi-GP.
  gpCents: integer("gp_cents").notNull().default(0),
  // ⚠ HUNDREDTHS OF A TOKEN since round 36 (673 = 6.73 LT), the same
  // convention as every other `…Cents` column. Whole tokens made `ceil`
  // load-bearing in the land curve and inverted the "fighting up pays extra"
  // ruling in round 34 without anything being able to see it; see
  // config.landForFight.
  landTokensCents: integer("land_tokens_cents").notNull().default(0),
  // Land staked into THE pool (single pool for now) — earns the breed-fee
  // staker cut daily, pro-rata. Unstake freely; land itself never sells.
  stakedLandCents: integer("staked_land_cents").notNull().default(0), // hundredths, as above
  // Daily check-in: grants the GP drip + free gacha pulls, once per game-day.
  lastCheckInDay: integer("last_check_in_day"),
  freePulls: integer("free_pulls").notNull().default(0),
  // The person behind the barn (round 23) — a handler's name shown beside
  // the farm's, so a table of ten stables reads as PEOPLE. Null for farms
  // that never named one.
  handler: text("handler"),
  // Daily land-purchase cap bookkeeping.
  landBoughtDay: integer("land_bought_day"),
  landBoughtToday: integer("land_bought_today").notNull().default(0),
  createdDay: integer("created_day").notNull().default(0),
  // House-run bot stables (see engine/bot-config.ts) — rivals, not the house.
  isBot: integer("is_bot").notNull().default(0),
  // The FARM's career record (real + hardcore), stamped at fight time —
  // it can't be derived from owned birds later, because birds transfer
  // (claims, future sales) and take their own records with them.
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  // Barn expansions bought (round 43) — the COUNT, not the capacity, so the
  // two can never disagree: capacity is always derived as
  // BARN.CAPACITY + barnExpansions × BARN.EXPANSION_SLOTS (see barnCapacity).
  // Each one is an escalating LT burn; see BARN.EXPANSION_BASE_LT.
  barnExpansions: integer("barn_expansions").notNull().default(0),
});

export const birds = sqliteTable("birds", {
  id: text("id").primaryKey(),
  // The owning farm — "house" for birds claimed away by the house.
  farmId: text("farm_id").notNull(),
  name: text("name").notNull(),
  // Stored as male/female; "rooster"/"hen" are display labels layered on top.
  // Decided 50-50 at breeding and HIDDEN while the bird is an egg.
  sex: text("sex", { enum: ["male", "female"] }).notNull(),
  status: text("status", { enum: ["egg", "active", "retired"] }).notNull(),
  // Six stats on the 0–2000 PFL scale — all visible in the MVP (letter-grade
  // display and hiding come later; the raw number is stored forever).
  // Phase quartet: agility (the break) · sight (open exchange) · stamina
  // (wind + decay resistance) · gameness (the deep fight). Behavioral
  // anchors: station (clutch vs. superior builds) · condition (consistency).
  agility: integer("agility").notNull(),
  sight: integer("sight").notNull(),
  stamina: integer("stamina").notNull(),
  gameness: integer("gameness").notNull(),
  station: integer("station").notNull(),
  condition: integer("condition").notNull(),
  // Element stars: typed 0–5 in half-steps, stored as half-stars 0–10.
  // 0★ still resolves to a type.
  element: text("element", { enum: ["Fire", "Metal", "Wood", "Earth", "Water"] }).notNull(),
  halfStars: integer("half_stars").notNull(),
  // CARRIAGE — the second preference axis (round 23): Ground (the shuffler,
  // works low) vs. Air (the flyer, comes over the top), with its own star
  // magnitude. Deliberately the same shape as element + halfStars, so it
  // inherits, rolls and displays down the same paths. NOT yet read by the
  // fight engine — see CARRIAGES in config.ts for the intended hook.
  carriage: text("carriage", { enum: ["Ground", "Air"] })
    .notNull()
    .default("Ground"),
  carriageHalfStars: integer("carriage_half_stars").notNull().default(0),
  // THE GENERATION MARKER (round 30, Zane's ruling): starters and gacha pulls
  // are generation 0 — they enter the world from outside any bloodline. A
  // chick takes its MOTHER's generation + 1. Traced through the DAM alone, not
  // max(dam, sire): a single parent keeps the number monotone down one line
  // and makes it read as "how many nests deep is this hen's family", which is
  // the question the doctor's per-generation report is asking. It exists to
  // measure whether the flock is actually improving nest over nest — nothing
  // in the fight engine or any gate reads it.
  generation: integer("generation").notNull().default(0),
  // Birth moment, not age — age in bird-years = currentWeek - birthWeek
  // (birds age one year per game-week; the derivation is Zane's ruling).
  birthWeek: integer("birth_week").notNull(),
  birthDay: integer("birth_day").notNull(), // day index, for flavor/history
  // The CAREER record — real + hardcore fights. (It does NOT drive stud
  // price — that's player price-setting + supply/demand, ruled 2026-08-03.)
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  // The STAKES wins (round 19) — real + hardcore only. The class LADDER
  // (maiden / nw3) reads THIS line, not the lifetime one: the
  // discovery year is practice, so a chick that won juvenile fights is
  // still a maiden the day real stakes open at age 2. The displayed record
  // stays ONE lifetime line (ruled round 15) — this is eligibility only.
  stakesWins: integer("stakes_wins").notNull().default(0),
  // Round 22 kept QUALIFICATION POINTS here — a second scoreboard, banked on
  // the daily card, that gated the Pintakasi. Round 37 deleted the concept:
  // Thursday is open to any age-FORK bird and the Selection Committee seats
  // the field on CAREER EARNINGS instead, which the battle log already
  // records. See PINTAKASI in config.ts for why a rank beat a threshold.
  // How the career ended (null while egg/active).
  retiredBy: text("retired_by", { enum: ["manual", "age", "hardcore"] }),
  retiredWeek: integer("retired_week"),
  // The breeding barn: a retired rooster LISTED here is open for covers
  // from any farm's hens (14/week public + 2 owner-reserved).
  listedStud: integer("listed_stud").notNull().default(0),
  motherId: text("mother_id"),
  fatherId: text("father_id"),
  // The naming law (round 14): a bird must be given a real name before its
  // first fight. Auto-names ("Egg of Dalisay", "Mystery Egg (Blue)") leave
  // this 0; rename() flips it. Seeded starters arrive named.
  named: integer("named").notNull().default(0),
  // Appearance v0 (round 14): base coat + element-tinted trim, assigned at
  // creation. Proper coat genetics are a later redo.
  baseCoat: text("base_coat").notNull().default("Brown"),
  trimColor: text("trim_color").notNull().default("Red"),
});

// The WORLD clock — one row, shared by every farm. Wallets live on farms.
// Also carries the world POOLS (centi-GP, integer-exact): the staker pool
// (breed-fee cut, distributed daily pro-rata to staked land — undistributed
// dust carries) and the juice pool (future tournament/fight subsidy — only
// accrues for now).
export const gameState = sqliteTable("game_state", {
  id: integer("id").primaryKey(), // single row, id = 1
  dayIndex: integer("day_index").notNull().default(0),
  stakerPoolCents: integer("staker_pool_cents").notNull().default(0),
  juicePoolCents: integer("juice_pool_cents").notNull().default(0),
});

export const gachaTokens = sqliteTable("gacha_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: text("farm_id").notNull(),
  token: text("token", { enum: ["White", "Green", "Blue", "Purple", "Gold"] }).notNull(),
  rolledDay: integer("rolled_day").notNull(),
});

// One SIDE of a PvP fight — every fight writes two mirrored rows (same seed
// and play-by-play, per-side figure and gpDelta), so per-farm and per-bird
// history reads stay simple.
export const battleLog = sqliteTable("battle_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayIndex: integer("day_index").notNull(), // the day the card was posted
  // Exactly one of these two is set: a daily-card fight has a lobby, a
  // Pintakasi fight has a tournament (round 18).
  lobbyId: integer("lobby_id"),
  tournamentId: integer("tournament_id"),
  farmId: text("farm_id").notNull(),
  birdId: text("bird_id").notNull(),
  mode: text("mode", { enum: ["juvenile", "real", "hardcore"] }).notNull(),
  // The weapon format — the "distance" this fight was run at.
  format: text("format", { enum: ["b1", "b2", "b3", "b4", "b5"] }).notNull(),
  // The lobby class — open / maiden / nw3 / claimer (nw2 merged into nw3 in
  // round 31). battleLog.mode above KEEPS "hardcore": the daily card stopped
  // running it, but the Pintakasi Majors are hardcore throughout and this is
  // where those fights are recorded.
  lobby: text("lobby", { enum: ["open", "maiden", "nw3", "claimer"] })
    .notNull()
    .default("open"),
  claimPrice: integer("claim_price"), // claimers only
  // The other barn's bird — a real bird, not a snapshot (pure PvP).
  opponentBirdId: text("opponent_bird_id").notNull(),
  opponentFarmId: text("opponent_farm_id").notNull(),
  opponentName: text("opponent_name").notNull(),
  // Public-card grade snapshots keep scout normalization historical even
  // after retirement reveals a sheet or a later ruleset changes the ladder.
  selfGrade: text("self_grade").notNull().default("B+"),
  opponentGrade: text("opponent_grade").notNull().default("B+"),
  // WHICH ARGUMENT THIS BIRD WAS to simulatePair — 0 or 1 (round 39).
  // The two combatants SHARE ONE RNG, so argument order decides who gets which
  // roll: replay the pair swapped and you get a different fight, not a mirrored
  // one. Round 38's replay recovered the order by assuming the LOWER id was
  // side 0, which was true only because both engines happen to insert inside a
  // `for (const [i, side] of sides.entries())` loop. Batching those two inserts
  // into one `.values([a, b])` — a pure-looking tidy-up — would have broken
  // every replay in the game while compiling clean, and the drift guard would
  // have blamed the fight engine. So the order is STORED now, not inferred.
  // NOT NULL with no default on purpose: a new insert site must state a side or
  // fail to compile, which a default would let it skip.
  side: integer("side").notNull(),
  result: text("result", { enum: ["win", "loss"] }).notNull(),
  // The Pit Figure — banded performance rating, format-normalized. The
  // discovery signal: compare figures ACROSS formats to type the bird.
  pitFigure: integer("pit_figure").notNull(),
  // In CENTI-GP since round 22: the winner's take is the pot less the 2%
  // staker rake, which doesn't land on a whole GP (a 40 GP card pays
  // +38.40). Whole-GP deltas would have quietly rounded the rake away.
  gpDeltaCents: integer("gp_delta_cents").notNull(),
  // ⚠ THIS IS THE WHOLE FIGHT, and it is the last column here for a reason.
  // Round 38 deleted `play_by_play` — 1.8 KB of narration a row, 51 MB of a
  // 90 MB database, written 28,710 times a sim and read back exactly never.
  // The transcript is REGENERATED from this seed instead (see engine/replay.ts),
  // which works only because stats are fixed at birth and the weather is a
  // pure function of the day. Do not add a derived column back beside it
  // without asking what actually reads it.
  seed: integer("seed").notNull(),
});

// THE SCOUT'S RUNNING BOOK (round 44) — per-(bird, blade) sums of battle_log,
// updated in the same transaction as every log insert (engine/scout.ts
// recordFight, the ONLY door battle_log rows may enter through). This exists
// for speed, not truth: the scout used to re-read a bird's whole career for
// every carding decision, every day, and careers only get longer — the
// superlinear half of the sim's cost curve. Everything here is derivable from
// battle_log, and the doctor proves the two agree every run (checkScoutBook),
// so a second insert site that forgets the book fails loudly instead of
// quietly serving stale form.
//
// FOG-SAFE BY CONSTRUCTION: every column is a sum over battle_log rows, which
// are already public-card facts (figures, results, grade snapshots). Nothing
// hidden is cached here. norm_sum accumulates normalizedScoutFigure in row
// order — the same order the old per-career scan summed in, so the scout's
// scores are bit-identical to what re-deriving would produce.
export const birdForm = sqliteTable(
  "bird_form",
  {
    birdId: text("bird_id").notNull(),
    format: text("format", { enum: ["b1", "b2", "b3", "b4", "b5"] }).notNull(),
    fights: integer("fights").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    // Integer sum of pit figures — avgFigure is derived as
    // Math.round(figureSum / fights) AT READ TIME, exactly as the old scan did.
    figureSum: integer("figure_sum").notNull().default(0),
    bestFigure: integer("best_figure").notNull().default(0),
    // Float sum of normalized scout figures (grade steps make it fractional).
    normSum: real("norm_sum").notNull().default(0),
    // Sum of the POSITIVE gp deltas (cents) — daily-card winnings, the fight
    // half of the Selection Committee's career-earnings book. Purse money
    // stays on tournament_entries; the committee adds the two at read time.
    earnCents: integer("earn_cents").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.birdId, t.format] })]
);

// A LOBBY — one slot on tonight's card, keyed by (mode, class, format[, tag]).
// Since round 31 there is EXACTLY ONE per key per day and it grows without
// limit: the day's card (config.cardOfDay) posts a small set of keys, and a
// lobby exists for a key only if that key was posted. It used to fill to a
// capacity of 8 and then open a duplicate, which split a hot key back into two
// half-empty rooms — see the LOBBY comment in config for why that had to go.
// Pure PvP — no house. The card runs PFL's three states (ruled 2026-08-03):
//   OPEN      — taking entries; the field is fogged (claimers excepted).
//   CLOSED    — entries locked, matchups drawn AND REVEALED. Claimers close
//               early (6 PM PH) so ~6 hours of informed claiming can happen;
//               normal lobbies close minutes before post. Claims flow until
//               the fight completes — last-second claims either make it or
//               they're too late.
//   COMPLETED — fights concluded, refunds paid, claims settled.
export const lobbies = sqliteTable("lobbies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mode: text("mode", { enum: ["juvenile", "real"] }).notNull(),
  classType: text("class_type", { enum: ["open", "maiden", "nw3", "claimer"] }).notNull(),
  format: text("format", { enum: ["b1", "b2", "b3", "b4", "b5"] }).notNull(),
  price: integer("price"), // claimer tag — null for every other class
  seed: integer("seed").notNull(), // drives the pairing shuffle + fight seeds
  status: text("status", { enum: ["open", "closed", "completed"] }).notNull().default("open"),
  dayOpened: integer("day_opened").notNull(),
});

// One bird on the card — and since round 34, one bird's whole NIGHT. The entry
// fee escrows at entry time; the entry is BINDING and uses the bird's card for
// the day. At close the lobby deals its field into groups (groupNo); at post
// every pair inside a group that isn't two birds of one barn fights, so an
// entry yields up to GROUP.SIZE - 1 battleLog rows. `fights` records how many
// it actually got: the stake is spent a share per fight and the rest refunds.
// `unmatched` = fights 0, the bird alone in its room (whole fee back, no land).
export const lobbyEntries = sqliteTable("lobby_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lobbyId: integer("lobby_id").notNull(),
  birdId: text("bird_id").notNull(),
  farmId: text("farm_id").notNull(), // the ORIGINAL owner — the bird fights for them
  fee: integer("fee").notNull(), // escrowed at entry
  dayEntered: integer("day_entered").notNull(),
  status: text("status", { enum: ["pending", "fought", "unmatched"] })
    .notNull()
    .default("pending"),
  // THE DRAW — set when the lobby CLOSES: which group this bird was dealt
  // into. Null while open. Round 34 replaced a single `opponent_entry_id`
  // with this: the draw is no longer one opponent but a table of up to three,
  // and the group number is the whole of it — everyone sharing a groupNo in
  // this lobby fights everyone else in it (barn-mates excepted).
  groupNo: integer("group_no"),
  // How many fights the bird actually got, filled at resolution. Below
  // GROUP.SIZE - 1 means its group was short, or held a barn-mate; the unused
  // share of the stake refunds. Zero = unmatched. Round 34 replaced a single
  // `battle_log_id` with this — the rows are found by (lobbyId, birdId) in
  // battleLog, which is where they always lived; the pointer only ever held
  // one of what is now several.
  fights: integer("fights").notNull().default(0),
  claimedByFarmId: text("claimed_by_farm_id"), // claimer entries: set if a claim won
});

// A sealed CLAIM against a pending claimer entry — tag escrowed when placed.
// At resolution one claim wins (RNG if several) and the rest refund. Claims
// settle even if the bird went unmatched — the sale doesn't need the fight.
export const claims = sqliteTable("claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryId: integer("entry_id").notNull(), // → lobbyEntries.id
  farmId: text("farm_id").notNull(), // the claimant
  price: integer("price").notNull(), // escrowed
  dayPlaced: integer("day_placed").notNull(),
  status: text("status", { enum: ["pending", "won", "refunded"] }).notNull().default("pending"),
});

// THE PINTAKASI (round 18) — one row per weekly blade championship. Three
// per week (anchors + the rotating middle blade). Field data lives in
// tournament_entries; bracket_size/purse_cents fill in at resolution.
export const tournaments = sqliteTable("tournaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekIndex: integer("week_index").notNull(),
  format: text("format", { enum: ["b1", "b2", "b3", "b4", "b5"] }).notNull(),
  // Which championship this is (round 23): the Thursday Majors, or the
  // Wednesday Juvenile Championship — same bracket machinery, different
  // stakes (the juvenile division is NOT hardcore).
  division: text("division", { enum: ["major", "juvenile"] })
    .notNull()
    .default("major"),
  status: text("status", { enum: ["open", "completed", "cancelled"] }).notNull().default("open"),
  seed: integer("seed").notNull(), // drives every fight in the bracket
  entryFee: integer("entry_fee").notNull(),
  bracketSize: integer("bracket_size"), // set at close: next pow2 ≥ field, ≤ 64
  purseCents: integer("purse_cents"), // set at resolution: entries + juice share
  dayResolved: integer("day_resolved"),
});

// One bird registered for a championship. Fee escrows at entry (binding).
// `bumped` = displaced by a stronger late entrant (Selection Committee,
// refunded); `refunded` = died/retired before crown day, or the field was
// too small to run. eliminated_round: 1 = the bracket's first round;
// equal to the round count = lost the final (the runner-up).
export const tournamentEntries = sqliteTable("tournament_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id").notNull(),
  birdId: text("bird_id").notNull(),
  farmId: text("farm_id").notNull(),
  fee: integer("fee").notNull(),
  dayEntered: integer("day_entered").notNull(),
  status: text("status", { enum: ["pending", "bumped", "refunded", "eliminated", "champion"] })
    .notNull()
    .default("pending"),
  seedRank: integer("seed_rank"), // committee rank, set at close (1 = top seed)
  eliminatedRound: integer("eliminated_round"),
  gpWonCents: integer("gp_won_cents").notNull().default(0),
  landGranted: integer("land_granted").notNull().default(0), // hundredths of an LT (round 36)
});

// The UNIFIED LEDGER (round 11) — every meaningful happening, one
// self-contained row, append-only. farm_id null = a world event (a fight,
// a pool accrual). gp_cents / lt are the farm's signed deltas where they
// apply. See engine/events.ts for the type list and conventions.
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayIndex: integer("day_index").notNull(),
  type: text("type").notNull(),
  farmId: text("farm_id"),
  birdId: text("bird_id"),
  gpCents: integer("gp_cents"),
  lt: integer("lt"),
  message: text("message").notNull(),
  data: text("data"), // JSON — splits, figures, whatever the type carries
});

// (training_log is GONE — stats are fixed at birth, ruled 2026-08-03 rd 13.)

// Topline SNAPSHOTS (round 16) — the office's memory. One row per game-day,
// written at the end of every tick (plus a baseline before the first one),
// holding the top-line metrics as JSON. The admin diffs live values against
// the last snapshot BEFORE today — one tick = one day or one week jump, so
// the deltas naturally span whatever the last tick covered.
export const snapshots = sqliteTable("snapshots", {
  dayIndex: integer("day_index").primaryKey(),
  data: text("data").notNull(), // JSON Topline (engine/snapshots.ts)
});

// How long each simulated day took to run, in wall-clock milliseconds — written
// by scripts/simulate.ts ONLY, never by live play (a live day has no meaningful
// wall clock). Zane's ask (round 43): per-day timing should live IN the sim
// database, not scroll past in the terminal, so a slow run can be graphed after
// the fact with one query:
//   sqlite3 data/sim-….db "SELECT day_index, ms FROM sim_timings ORDER BY 1"
export const simTimings = sqliteTable("sim_timings", {
  dayIndex: integer("day_index").primaryKey(),
  ms: integer("ms").notNull(),
});

export type BirdRow = typeof birds.$inferSelect;
export type NewBird = typeof birds.$inferInsert;
export type GameStateRow = typeof gameState.$inferSelect;
export type FarmRow = typeof farms.$inferSelect;
