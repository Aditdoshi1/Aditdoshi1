const { calcDropPct } = require('../utils/dealParsing');
const store = require('../db/store');

function classifyDeal(rawDeal, config) {
  const minDropPct = config.deals?.minDropPct ?? 10;
  const minAbsoluteDrop = config.deals?.minAbsoluteDrop ?? 0;
  const normalizedUrl = store.normalizeUrl(rawDeal.url);
  const previous = store.getLatestPriceForUrl(normalizedUrl);
  const price = rawDeal.price ?? null;

  let dealType = 'new';
  let previousPrice = null;
  let dropPct = null;

  if (previous != null && price != null && price < previous) {
    dropPct = calcDropPct(previous, price);
    const absoluteDrop = previous - price;
    if (dropPct >= minDropPct && absoluteDrop >= minAbsoluteDrop) {
      dealType = 'drop';
      previousPrice = previous;
    }
  }

  const detectedAt = new Date().toISOString();
  const externalKey = store.makeExternalKey(rawDeal.source, normalizedUrl, rawDeal.dealUrl);

  return {
    externalKey,
    title: rawDeal.title,
    retailer: rawDeal.retailer,
    url: normalizedUrl,
    dealUrl: rawDeal.dealUrl || null,
    price,
    previousPrice,
    dropPct,
    dealType,
    source: rawDeal.source,
    feedName: rawDeal.feedName || null,
    postedAt: rawDeal.postedAt || detectedAt,
    detectedAt,
  };
}

module.exports = {
  classifyDeal,
};
