CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score_desc
  ON leaderboard_entries(score DESC, achieved_at ASC);
