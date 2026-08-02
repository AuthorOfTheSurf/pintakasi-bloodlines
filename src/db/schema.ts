import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const birds = sqliteTable("birds", {
  id: text("id").primaryKey(),
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

export const gameState = sqliteTable("game_state", {
  id: integer("id").primaryKey(), // single row, id = 1
  dayIndex: integer("day_index").notNull().default(0),
  gp: integer("gp").notNull(),
});

export const gachaTokens = sqliteTable("gacha_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token", { enum: ["White", "Green", "Blue", "Purple", "Gold"] }).notNull(),
  rolledDay: integer("rolled_day").notNull(),
});

export const battleLog = sqliteTable("battle_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayIndex: integer("day_index").notNull(),
  birdId: text("bird_id").notNull(),
  mode: text("mode", { enum: ["practice", "real", "hardcore"] }).notNull(),
  // The weapon format — the "distance" this fight was run at.
  format: text("format", { enum: ["longKnife", "shortKnife", "longGaff", "shortGaff"] }).notNull(),
  opponentName: text("opponent_name").notNull(),
  result: text("result", { enum: ["win", "loss"] }).notNull(),
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
