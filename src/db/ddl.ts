/**
 * Hand-written DDL, kept in sync with schema.ts. Used by createDb() so both
 * the file database and in-memory test databases bootstrap identically —
 * no drizzle-kit migration machinery for a single-player MVP.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS birds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('male','female')),
  status TEXT NOT NULL CHECK (status IN ('egg','active','retired')),
  agility INTEGER NOT NULL,
  sight INTEGER NOT NULL,
  stamina INTEGER NOT NULL,
  gameness INTEGER NOT NULL,
  station INTEGER NOT NULL,
  condition INTEGER NOT NULL,
  element TEXT NOT NULL CHECK (element IN ('Fire','Metal','Wood','Earth','Water')),
  half_stars INTEGER NOT NULL CHECK (half_stars BETWEEN 0 AND 10),
  birth_week INTEGER NOT NULL,
  birth_day INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  practice_wins INTEGER NOT NULL DEFAULT 0,
  practice_losses INTEGER NOT NULL DEFAULT 0,
  retired_by TEXT CHECK (retired_by IN ('manual','age','hardcore')),
  retired_week INTEGER,
  mother_id TEXT,
  father_id TEXT
);

CREATE TABLE IF NOT EXISTS game_state (
  id INTEGER PRIMARY KEY,
  day_index INTEGER NOT NULL DEFAULT 0,
  gp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gacha_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL CHECK (token IN ('White','Green','Blue','Purple','Gold')),
  rolled_day INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS battle_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_index INTEGER NOT NULL,
  bird_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('practice','real','hardcore')),
  format TEXT NOT NULL CHECK (format IN ('longKnife','shortKnife','longGaff','shortGaff')),
  opponent_name TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('win','loss')),
  pit_figure INTEGER NOT NULL,
  gp_delta INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  play_by_play TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_index INTEGER NOT NULL,
  bird_id TEXT NOT NULL,
  stat TEXT NOT NULL CHECK (stat IN ('agility','sight','stamina','gameness','station','condition'))
);
`;
