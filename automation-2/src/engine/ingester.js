const store = require('../db/store');
const { classifyDeal } = require('./dealDetector');
const { MockSource } = require('../sources/mockSource');
const { SlickdealsRssSource } = require('../sources/slickdealsRss');
const { CanopyAmazonSource } = require('../sources/canopyAmazon');
const { RedditDealsSource } = require('../sources/redditDeals');
const { extractAmazonAsin, detectRetailer } = require('../utils/dealParsing');

function buildSources(config) {
  const sources = [];

  if (config.sources?.mock?.enabled) {
    sources.push(new MockSource());
  }

  if (config.sources?.slickdeals?.enabled !== false) {
    const keywords = [
      ...(config.keywords || []),
      ...store.listKeywords().map((row) => row.term),
    ];
    sources.push(new SlickdealsRssSource({
      feeds: config.sources?.slickdeals?.feeds || ['popdeals', 'frontpage'],
      keywords,
    }));
  }

  const reddit = new RedditDealsSource({
    keywords: [
      ...(config.keywords || []),
      ...store.listKeywords().map((row) => row.term),
    ],
  });
  if (reddit.isEnabled()) {
    sources.push(reddit);
  }

  return sources;
}

function buildCanopy(config) {
  return new CanopyAmazonSource({
    apiKey: process.env.CANOPY_API_KEY,
    maxWatchlistItems: config.sources?.canopy?.maxWatchlistItems || 5,
  });
}

async function ingestRawDeals(rawDeals, config) {
  let newCount = 0;
  let dropCount = 0;

  for (const rawDeal of rawDeals) {
    const deal = classifyDeal(rawDeal, config);
    const existing = store.getDealByUrl(deal.url);

    if (!existing) {
      newCount += 1;
    } else if (deal.dealType === 'drop') {
      dropCount += 1;
    }

    store.insertDeal({
      externalKey: deal.externalKey,
      title: deal.title,
      retailer: deal.retailer,
      url: deal.url,
      dealUrl: deal.dealUrl,
      price: deal.price,
      previousPrice: deal.previousPrice,
      dropPct: deal.dropPct,
      dealType: deal.dealType,
      source: deal.source,
      feedName: deal.feedName,
      postedAt: deal.postedAt,
      detectedAt: deal.detectedAt,
    });
  }

  return { newCount, dropCount };
}

async function refreshWatchlist(config) {
  const canopy = buildCanopy(config);
  if (!config.sources?.canopy?.enabled || !canopy.isEnabled()) {
    return { refreshed: 0, errors: [] };
  }

  const items = store.listWatchlist();
  const { products, errors } = await canopy.refreshWatchlist(items);
  let refreshed = 0;

  for (const product of products) {
    const capturedAt = new Date().toISOString();
    const row = store.upsertProduct({
      retailer: 'Amazon',
      externalId: product.asin,
      title: product.title,
      url: store.normalizeUrl(product.url),
      imageUrl: product.imageUrl,
      lastPrice: product.price,
      lastCheckedAt: capturedAt,
      createdAt: capturedAt,
    });

    if (product.price != null) {
      store.addPriceSnapshot({
        productId: row.id,
        price: product.price,
        capturedAt,
        source: 'canopy',
      });

      await ingestRawDeals([
        {
          title: product.title,
          retailer: 'Amazon',
          url: row.url,
          dealUrl: row.url,
          price: product.price,
          postedAt: capturedAt,
          source: 'canopy',
          feedName: 'watchlist',
        },
      ], config);
      refreshed += 1;
    }
  }

  return { refreshed, errors };
}

async function runIngestion(config) {
  const sources = buildSources(config);
  const startedAt = new Date().toISOString();
  let totalItems = 0;
  let totalNew = 0;
  let totalDrops = 0;
  const errors = [];

  for (const source of sources) {
    const feedStarted = new Date().toISOString();
    try {
      const result = await source.fetchDeals();
      const deals = result.deals || result;
      const sourceErrors = result.errors || [];
      errors.push(...sourceErrors);

      const { newCount, dropCount } = await ingestRawDeals(deals, config);
      totalItems += deals.length;
      totalNew += newCount;
      totalDrops += dropCount;

      store.recordFeedRun({
        source: source.name,
        feedName: source.feeds?.join(',') || source.name,
        startedAt: feedStarted,
        finishedAt: new Date().toISOString(),
        itemCount: deals.length,
        newCount,
        dropCount,
        error: sourceErrors.join('; ') || null,
      });
    } catch (error) {
      errors.push(`${source.name}: ${error.message}`);
      store.recordFeedRun({
        source: source.name,
        feedName: source.name,
        startedAt: feedStarted,
        finishedAt: new Date().toISOString(),
        itemCount: 0,
        newCount: 0,
        dropCount: 0,
        error: error.message,
      });
    }
  }

  const watchlistResult = await refreshWatchlist(config);
  if (watchlistResult.errors?.length) {
    errors.push(...watchlistResult.errors);
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    totalItems,
    totalNew,
    totalDrops,
    watchlistRefreshed: watchlistResult.refreshed,
    errors,
  };
}

function addWatchlistUrl(url, label) {
  const retailer = detectRetailer('', '', url);
  const externalId = extractAmazonAsin(url);
  return store.addWatchlistItem({
    url: store.normalizeUrl(url),
    retailer,
    externalId,
    label: label || null,
    createdAt: new Date().toISOString(),
  });
}

module.exports = {
  runIngestion,
  addWatchlistUrl,
  buildCanopy,
  buildSources,
};
