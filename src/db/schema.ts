import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  landTokens: integer("land_tokens").notNull().default(0),
  // Daily check-in: grants the GP drip + free gacha pulls, once per game-day.
  lastCheckInDay: integer("last_check_in_day"),
  freePulls: integer("free_pulls").notNull().default(0),
  // Daily land-purchase cap bookkeeping.
  landBoughtDay: integer("land_bought_day"),
  landBoughtToday: integer("land_bought_today").notNull().default(0),
  createdDay: integer("created_day").notNull().default(0),
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
  // Birth moment, not age — age in bird-years = currentWeek - birthWeek
  // (birds age one year per game-week; the derivation is Zane's ruling).
  birthWeek: integer("birth_week").notNull(),
  birthDay: integer("birth_day").notNull(), // day index, for flavor/history
  // The CAREER record — real + hardcore fights; drives prizes and stud value.
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  // The AMATEUR record — discovery-year practice fights; small stakes,
  // never touches stud value.
  practiceWins: integer("practice_wins").notNull().default(0),
  practiceLosses: integer("practice_losses").notNull().default(0),
  // How the career ended (null while egg/active).
  retiredBy: text("retired_by", { enum: ["manual", "age", "hardcore"] }),
  retiredWeek: integer("retired_week"),
  motherId: text("mother_id"),
  fatherId: text("father_id"),
});

// The WORLD clock — one row, shared by every farm. Wallets live on farms.
export const gameState = sqliteTable("game_state", {
  id: integer("id").primaryKey(), // single row, id = 1
  dayIndex: integer("day_index").notNull().default(0),
});

export const gachaTokens = sqliteTable("gacha_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  farmId: text("farm_id").notNull(),
  token: text("token", { enum: ["White", "Green", "Blue", "Purple", "Gold"] }).notNull(),
  rolledDay: integer("rolled_day").notNull(),
});

export const battleLog = sqliteTable("battle_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayIndex: integer("day_index").notNull(),
  farmId: text("farm_id").notNull(),
  birdId: text("bird_id").notNull(),
  mode: text("mode", { enum: ["practice", "real", "hardcore"] }).notNull(),
  // The weapon format — the "distance" this fight was run at.
  format: text("format", { enum: ["longKnife", "shortKnife", "longGaff", "shortGaff"] }).notNull(),
  // The lobby (class) — open / maiden / nw2 / nw3 / claimer.
  lobby: text("lobby", { enum: ["open", "maiden", "nw2", "nw3", "claimer"] })
    .notNull()
    .default("open"),
  claimPrice: integer("claim_price"), // claimers only
  opponentName: text("opponent_name").notNull(),
  // Full opponent snapshot (stats/element/stars/age) — what a claim buys.
  opponentJson: text("opponent_json").notNull(),
  result: text("result", { enum: ["win", "loss"] }).notNull(),
  // Set when a won claimer's house bird has been claimed (one claim only).
  claimedBirdId: text("claimed_bird_id"),
  // The Pit Figure — banded performance rating, format-normalized. The
  // discovery signal: compare figures ACROSS formats to type the bird.
  pitFigure: integer("pit_figure").notNull(),
  gpDelta: integer("gp_delta").notNull(),
  seed: integer("seed").notNull(), // replay the fight from this
  playByPlay: text("play_by_play").notNull(),
});

export const trainingLog = sqliteTable("training_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayIndex: integer("day_index").notNull(),
  birdId: text("bird_id").notNull(),
  stat: text("stat", {
    enum: ["agility", "sight", "stamina", "gameness", "station", "condition"],
  }).notNull(),
});

export type BirdRow = typeof birds.$inferSelect;
export type NewBird = typeof birds.$inferInsert;
export type GameStateRow = typeof gameState.$inferSelect;
export type FarmRow = typeof farms.$inferSelect;
