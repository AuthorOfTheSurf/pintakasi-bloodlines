/**
 * Hand-written DDL, kept in sync with schema.ts. Used by createDb() so both
 * the file database and in-memory test databases bootstrap identically —
 * no drizzle-kit migration machinery for a single-player MVP.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  gp INTEGER NOT NULL,
  gp_cents INTEGER NOT NULL DEFAULT 0,
  land_tokens INTEGER NOT NULL DEFAULT 0,
  staked_land INTEGER NOT NULL DEFAULT 0,
  last_check_in_day INTEGER,
  free_pulls INTEGER NOT NULL DEFAULT 0,
  land_bought_day INTEGER,
  land_bought_today INTEGER NOT NULL DEFAULT 0,
  created_day INTEGER NOT NULL DEFAULT 0,
  is_bot INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS birds (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
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
  listed_stud INTEGER NOT NULL DEFAULT 0,
  mother_id TEXT,
  father_id TEXT
);

CREATE TABLE IF NOT EXISTS game_state (
  id INTEGER PRIMARY KEY,
  day_index INTEGER NOT NULL DEFAULT 0,
  staker_pool_cents INTEGER NOT NULL DEFAULT 0,
  juice_pool_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gacha_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id TEXT NOT NULL,
  token TEXT NOT NULL CHECK (token IN ('White','Green','Blue','Purple','Gold')),
  rolled_day INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS battle_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_index INTEGER NOT NULL,
  lobby_id INTEGER NOT NULL,
  farm_id TEXT NOT NULL,
  bird_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('practice','real','hardcore')),
  format TEXT NOT NULL CHECK (format IN ('longKnife','shortKnife','longGaff','shortGaff')),
  lobby TEXT NOT NULL DEFAULT 'open' CHECK (lobby IN ('open','maiden','nw2','nw3','claimer')),
  claim_price INTEGER,
  opponent_bird_id TEXT NOT NULL,
  opponent_farm_id TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('win','loss')),
  pit_figure INTEGER NOT NULL,
  gp_delta INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  play_by_play TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lobbies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL CHECK (mode IN ('practice','real','hardcore')),
  class_type TEXT NOT NULL CHECK (class_type IN ('open','maiden','nw2','nw3','claimer')),
  format TEXT NOT NULL CHECK (format IN ('longKnife','shortKnife','longGaff','shortGaff')),
  price INTEGER,
  capacity INTEGER NOT NULL DEFAULT 8,
  seed INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','completed')),
  day_opened INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lobby_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lobby_id INTEGER NOT NULL,
  bird_id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  fee INTEGER NOT NULL,
  day_entered INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fought','unmatched')),
  opponent_entry_id INTEGER,
  battle_log_id INTEGER,
  claimed_by_farm_id TEXT
);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  farm_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  day_placed INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','refunded'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_index INTEGER NOT NULL,
  type TEXT NOT NULL,
  farm_id TEXT,
  bird_id TEXT,
  gp_cents INTEGER,
  lt INTEGER,
  message TEXT NOT NULL,
  data TEXT
);

CREATE TABLE IF NOT EXISTS training_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_index INTEGER NOT NULL,
  bird_id TEXT NOT NULL,
  stat TEXT NOT NULL CHECK (stat IN ('agility','sight','stamina','gameness','station','condition'))
);
`;
