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
  land_tokens_cents INTEGER NOT NULL DEFAULT 0,
  staked_land_cents INTEGER NOT NULL DEFAULT 0,
  last_check_in_day INTEGER,
  free_pulls INTEGER NOT NULL DEFAULT 0,
  land_bought_day INTEGER,
  land_bought_today INTEGER NOT NULL DEFAULT 0,
  handler TEXT,
  created_day INTEGER NOT NULL DEFAULT 0,
  is_bot INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0
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
  carriage TEXT NOT NULL DEFAULT 'Ground' CHECK (carriage IN ('Ground','Air')),
  carriage_half_stars INTEGER NOT NULL DEFAULT 0,
  half_stars INTEGER NOT NULL CHECK (half_stars BETWEEN 0 AND 10),
  -- Round 30: 0 for starters and gacha pulls, dam + 1 for a bred chick.
  generation INTEGER NOT NULL DEFAULT 0,
  birth_week INTEGER NOT NULL,
  birth_day INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  stakes_wins INTEGER NOT NULL DEFAULT 0,
  retired_by TEXT CHECK (retired_by IN ('manual','age','hardcore')),
  retired_week INTEGER,
  listed_stud INTEGER NOT NULL DEFAULT 0,
  mother_id TEXT,
  father_id TEXT,
  named INTEGER NOT NULL DEFAULT 0,
  base_coat TEXT NOT NULL DEFAULT 'Brown',
  trim_color TEXT NOT NULL DEFAULT 'Red'
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
  lobby_id INTEGER,
  tournament_id INTEGER,
  farm_id TEXT NOT NULL,
  bird_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('juvenile','real','hardcore')),
  format TEXT NOT NULL CHECK (format IN ('b1','b2','b3','b4','b5')),
  lobby TEXT NOT NULL DEFAULT 'open' CHECK (lobby IN ('open','maiden','nw3','claimer')),
  claim_price INTEGER,
  opponent_bird_id TEXT NOT NULL,
  opponent_farm_id TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  self_grade TEXT NOT NULL DEFAULT 'B+',
  opponent_grade TEXT NOT NULL DEFAULT 'B+',
  result TEXT NOT NULL CHECK (result IN ('win','loss')),
  pit_figure INTEGER NOT NULL,
  gp_delta_cents INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  play_by_play TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lobbies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL CHECK (mode IN ('juvenile','real')),
  class_type TEXT NOT NULL CHECK (class_type IN ('open','maiden','nw3','claimer')),
  format TEXT NOT NULL CHECK (format IN ('b1','b2','b3','b4','b5')),
  price INTEGER,
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
  group_no INTEGER,
  fights INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_index INTEGER NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('b1','b2','b3','b4','b5')),
  division TEXT NOT NULL DEFAULT 'major' CHECK (division IN ('major','juvenile')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled')),
  seed INTEGER NOT NULL,
  entry_fee INTEGER NOT NULL,
  bracket_size INTEGER,
  purse_cents INTEGER,
  day_resolved INTEGER
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  bird_id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  fee INTEGER NOT NULL,
  day_entered INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','bumped','refunded','eliminated','champion')),
  seed_rank INTEGER,
  eliminated_round INTEGER,
  gp_won_cents INTEGER NOT NULL DEFAULT 0,
  land_granted INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS snapshots (
  day_index INTEGER PRIMARY KEY,
  data TEXT NOT NULL
);

-- ── INDEXES (round 35) ─────────────────────────────────────────────────────
-- There were NONE until now, on any table, and it had quietly become the
-- single biggest cost in the project. Every lookup on a non-key column was a
-- full table scan, so the sim got slower as the square of the world's age: a
-- 91-day run took 13 minutes, and 35 of those 21,450 battle-log rows were
-- being re-read tens of thousands of times.
--
-- The hot path is the SCOUT. Lobbies.scoutReport and formatRecords fetch
-- a bird's whole fight history to work out which blade it reads best at, and
-- the bots call that for every active bird every day — roughly 32,000 scans
-- of a table that ends the run at 21,450 rows. Measured on a real 91-day
-- database, 500 of those lookups took 5.36s unindexed and 0.008s indexed.
--
-- Integer PRIMARY KEY columns are SQLite rowids and need nothing; text
-- primary keys (farms.id, birds.id) already get an automatic unique index.
-- What follows is only the columns we actually filter on and don't own a key
-- for. Composites are ordered so the leading column serves the common
-- single-column query too — battle_log(bird_id, day_index) answers both
-- "this bird's whole career" and "did this bird fight today".
CREATE INDEX IF NOT EXISTS ix_battle_log_bird_day ON battle_log(bird_id, day_index);
CREATE INDEX IF NOT EXISTS ix_battle_log_lobby ON battle_log(lobby_id);
CREATE INDEX IF NOT EXISTS ix_battle_log_tournament ON battle_log(tournament_id);
CREATE INDEX IF NOT EXISTS ix_battle_log_farm ON battle_log(farm_id);
CREATE INDEX IF NOT EXISTS ix_birds_farm_status ON birds(farm_id, status);
CREATE INDEX IF NOT EXISTS ix_birds_status ON birds(status);
CREATE INDEX IF NOT EXISTS ix_birds_mother ON birds(mother_id);
CREATE INDEX IF NOT EXISTS ix_lobby_entries_lobby ON lobby_entries(lobby_id, status);
CREATE INDEX IF NOT EXISTS ix_lobby_entries_bird_day ON lobby_entries(bird_id, day_entered);
CREATE INDEX IF NOT EXISTS ix_lobby_entries_farm ON lobby_entries(farm_id);
CREATE INDEX IF NOT EXISTS ix_lobbies_status_day ON lobbies(status, day_opened);
CREATE INDEX IF NOT EXISTS ix_claims_entry ON claims(entry_id, status);
CREATE INDEX IF NOT EXISTS ix_claims_farm ON claims(farm_id);
CREATE INDEX IF NOT EXISTS ix_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS ix_tournament_entries_bird ON tournament_entries(bird_id, status);
CREATE INDEX IF NOT EXISTS ix_tournaments_week ON tournaments(week_index, division);
CREATE INDEX IF NOT EXISTS ix_events_farm ON events(farm_id);
CREATE INDEX IF NOT EXISTS ix_events_day ON events(day_index);
CREATE INDEX IF NOT EXISTS ix_gacha_tokens_farm ON gacha_tokens(farm_id);

`;
