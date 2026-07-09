const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { ROOT } = require('../config');

const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'deal-scout.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  }
  return db;
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

function makeExternalKey(source, url, dealUrl) {
  return `${source}:${dealUrl || url}`;
}

function getDealByUrl(url) {
  const normalized = normalizeUrl(url);
  return getDb().prepare(`
    SELECT * FROM deals
    WHERE url = ? OR deal_url = ?
    ORDER BY detected_at DESC
    LIMIT 1
  `).get(normalized, url);
}

function getLatestPriceForUrl(url) {
  const deal = getDealByUrl(url);
  return deal?.price ?? null;
}

function insertDeal(deal) {
  const stmt = getDb().prepare(`
    INSERT INTO deals (
      external_key, title, retailer, url, deal_url, price, previous_price,
      drop_pct, deal_type, source, feed_name, posted_at, detected_at, is_active
    ) VALUES (
      @externalKey, @title, @retailer, @url, @dealUrl, @price, @previousPrice,
      @dropPct, @dealType, @source, @feedName, @postedAt, @detectedAt, 1
    )
    ON CONFLICT(external_key) DO UPDATE SET
      title = excluded.title,
      retailer = excluded.retailer,
      price = excluded.price,
      previous_price = excluded.previous_price,
      drop_pct = excluded.drop_pct,
      deal_type = excluded.deal_type,
      posted_at = excluded.posted_at,
      detected_at = excluded.detected_at,
      is_active = 1
  `);

  return stmt.run(deal);
}

function listDeals({ retailer, minDrop, keyword, limit = 100 } = {}) {
  const clauses = ['is_active = 1'];
  const params = {};

  if (retailer) {
    clauses.push('LOWER(retailer) = LOWER(@retailer)');
    params.retailer = retailer;
  }

  if (minDrop != null) {
    clauses.push('(drop_pct IS NOT NULL AND drop_pct >= @minDrop)');
    params.minDrop = minDrop;
  }

  if (keyword) {
    clauses.push('LOWER(title) LIKE @keyword');
    params.keyword = `%${keyword.toLowerCase()}%`;
  }

  params.limit = limit;

  return getDb().prepare(`
    SELECT * FROM deals
    WHERE ${clauses.join(' AND ')}
    ORDER BY
      CASE deal_type WHEN 'drop' THEN 0 WHEN 'new' THEN 1 ELSE 2 END,
      COALESCE(drop_pct, 0) DESC,
      detected_at DESC
    LIMIT @limit
  `).all(params);
}

function listRetailers() {
  return getDb().prepare(`
    SELECT retailer, COUNT(*) AS count
    FROM deals
    WHERE is_active = 1 AND retailer IS NOT NULL AND retailer != ''
    GROUP BY retailer
    ORDER BY count DESC
  `).all();
}

function recordFeedRun(run) {
  const stmt = getDb().prepare(`
    INSERT INTO feed_runs (source, feed_name, started_at, finished_at, item_count, new_count, drop_count, error)
    VALUES (@source, @feedName, @startedAt, @finishedAt, @itemCount, @newCount, @dropCount, @error)
  `);
  return stmt.run(run);
}

function getLatestFeedRuns(limit = 10) {
  return getDb().prepare(`
    SELECT * FROM feed_runs
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit);
}

function getStats() {
  const row = getDb().prepare(`
    SELECT
      COUNT(*) AS totalDeals,
      SUM(CASE WHEN deal_type = 'drop' THEN 1 ELSE 0 END) AS dropDeals,
      SUM(CASE WHEN deal_type = 'new' THEN 1 ELSE 0 END) AS newDeals
    FROM deals
    WHERE is_active = 1
  `).get();

  return row;
}

function listWatchlist() {
  return getDb().prepare('SELECT * FROM watchlist ORDER BY created_at DESC').all();
}

function addWatchlistItem(item) {
  return getDb().prepare(`
    INSERT INTO watchlist (url, retailer, external_id, label, created_at)
    VALUES (@url, @retailer, @externalId, @label, @createdAt)
    ON CONFLICT(url) DO UPDATE SET
      retailer = excluded.retailer,
      external_id = excluded.external_id,
      label = excluded.label
  `).run(item);
}

function removeWatchlistItem(id) {
  return getDb().prepare('DELETE FROM watchlist WHERE id = ?').run(id);
}

function upsertProduct(product) {
  const stmt = getDb().prepare(`
    INSERT INTO products (retailer, external_id, title, url, image_url, last_price, last_checked_at, created_at)
    VALUES (@retailer, @externalId, @title, @url, @imageUrl, @lastPrice, @lastCheckedAt, @createdAt)
    ON CONFLICT(url) DO UPDATE SET
      title = COALESCE(excluded.title, products.title),
      image_url = COALESCE(excluded.image_url, products.image_url),
      last_price = excluded.last_price,
      last_checked_at = excluded.last_checked_at
  `);
  const result = stmt.run(product);
  const row = getDb().prepare('SELECT * FROM products WHERE url = ?').get(product.url);
  return row;
}

function addPriceSnapshot(snapshot) {
  return getDb().prepare(`
    INSERT INTO price_snapshots (product_id, price, captured_at, source)
    VALUES (@productId, @price, @capturedAt, @source)
  `).run(snapshot);
}

function listKeywords() {
  return getDb().prepare('SELECT * FROM keywords WHERE enabled = 1 ORDER BY term ASC').all();
}

function addKeyword(term) {
  return getDb().prepare(`
    INSERT INTO keywords (term, enabled, created_at)
    VALUES (?, 1, ?)
    ON CONFLICT(term) DO UPDATE SET enabled = 1
  `).run(term, new Date().toISOString());
}

function removeKeyword(id) {
  return getDb().prepare('DELETE FROM keywords WHERE id = ?').run(id);
}

function seedKeywords(terms) {
  for (const term of terms || []) {
    if (term?.trim()) {
      addKeyword(term.trim());
    }
  }
}

module.exports = {
  getDb,
  normalizeUrl,
  makeExternalKey,
  getDealByUrl,
  getLatestPriceForUrl,
  insertDeal,
  listDeals,
  listRetailers,
  recordFeedRun,
  getLatestFeedRuns,
  getStats,
  listWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
  upsertProduct,
  addPriceSnapshot,
  listKeywords,
  addKeyword,
  removeKeyword,
  seedKeywords,
  DB_PATH,
};
