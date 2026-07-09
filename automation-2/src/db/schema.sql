CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  retailer TEXT,
  url TEXT NOT NULL,
  deal_url TEXT,
  price REAL,
  previous_price REAL,
  drop_pct REAL,
  deal_type TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL,
  feed_name TEXT,
  posted_at TEXT,
  detected_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_deals_detected ON deals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_retailer ON deals(retailer);
CREATE INDEX IF NOT EXISTS idx_deals_type ON deals(deal_type);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retailer TEXT NOT NULL,
  external_id TEXT,
  title TEXT,
  url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  last_price REAL,
  last_checked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  price REAL NOT NULL,
  captured_at TEXT NOT NULL,
  source TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_product ON price_snapshots(product_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  retailer TEXT,
  external_id TEXT,
  label TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  feed_name TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  item_count INTEGER DEFAULT 0,
  new_count INTEGER DEFAULT 0,
  drop_count INTEGER DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_feed_runs_source ON feed_runs(source, started_at DESC);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
