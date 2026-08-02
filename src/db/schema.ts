import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const birds = sqliteTable("birds", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sex: text("sex", { enum: ["rooster", "hen"] }).notNull(),
  status: text("status", { enum: ["egg", "active", "retired"] }).notNull(),
  // Six stats — all visible in the MVP (hidden stats deferred, ledger item 25).
  agility: integer("agility").notNull(),
  heart: integer("heart").notNull(),
  avoidance: integer("avoidance").notNull(),
  stamina: integer("stamina").notNull(),
  ruthless: integer("ruthless").notNull(),
  sight: integer("sight").notNull(),
  // Element stars: typed 0–5 in half-steps, stored as half-stars 0–10.
  // 0★ still resolves to a type.
  element: text("element", { enum: ["Fire", "Metal", "Wood", "Earth", "Water"] }).notNull(),
  halfStars: integer("half_stars").notNull(),
  // Birth moment, not age — age in bird-years = currentWeek - birthWeek
  // (birds age one year per game-week; the derivation is Zane's ruling).
  birthWeek: integer("birth_week").notNull(),
  birthDay: integer("birth_day").notNull(), // day index, for flavor/history
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
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
  opponentName: text("opponent_name").notNull(),
  result: text("result", { enum: ["win", "loss"] }).notNull(),
  gpDelta: integer("gp_delta").notNull(),
  seed: integer("seed").notNull(), // replay the fight from this
  playByPlay: text("play_by_play").notNull(),
});

export const trainingLog = sqliteTable("training_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayIndex: integer("day_index").notNull(),
  birdId: text("bird_id").notNull(),
  stat: text("stat", {
    enum: ["agility", "heart", "avoidance", "stamina", "ruthless", "sight"],
  }).notNull(),
});

export type BirdRow = typeof birds.$inferSelect;
export type NewBird = typeof birds.$inferInsert;
export type GameStateRow = typeof gameState.$inferSelect;
