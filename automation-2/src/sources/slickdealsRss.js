const Parser = require('rss-parser');
const { BaseSource } = require('./baseSource');
const { pickBestPrice, detectRetailer } = require('../utils/dealParsing');

const FEED_URLS = {
  popdeals: 'https://api-web.slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',
  frontpage: 'https://api-web.slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
};

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'DealScout/1.0 (personal automation)',
  },
});

class SlickdealsRssSource extends BaseSource {
  constructor({ feeds = ['popdeals'], keywords = [] } = {}) {
    super('slickdeals');
    this.feeds = feeds;
    this.keywords = keywords;
  }

  buildSearchFeedUrl(keyword) {
    const query = encodeURIComponent(keyword.trim());
    return `https://api-web.slickdeals.net/newsearch.php?mode=recent&searcharea=deals&searchin=first&rss=1&q=${query}`;
  }

  normalizeItem(item, feedName) {
    const title = (item.title || '').replace(/\s+/g, ' ').trim();
    const content = `${item.contentSnippet || ''} ${item.content || ''}`;
    const dealUrl = item.link || item.guid || '';
    const price = pickBestPrice(`${title} ${content}`);
    const retailer = detectRetailer(title, content, dealUrl);

    let productUrl = dealUrl;
    const amazonMatch = content.match(/https?:\/\/(?:www\.)?amazon\.com[^\s\]"')]+/i);
    const walmartMatch = content.match(/https?:\/\/(?:www\.)?walmart\.com[^\s\]"')]+/i);
    if (amazonMatch) {
      productUrl = amazonMatch[0];
    } else if (walmartMatch) {
      productUrl = walmartMatch[0];
    }

    return {
      title,
      retailer,
      url: productUrl,
      dealUrl,
      price,
      postedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      source: this.name,
      feedName,
    };
  }

  async fetchFeed(url, feedName) {
    const feed = await parser.parseURL(url);
    return (feed.items || []).map((item) => this.normalizeItem(item, feedName));
  }

  async fetchDealsFromConfiguredFeeds() {
    const batches = [];

    for (const feedName of this.feeds) {
      const url = FEED_URLS[feedName] || FEED_URLS.popdeals;
      try {
        const items = await this.fetchFeed(url, feedName);
        batches.push(...items);
      } catch (error) {
        batches.push({
          error: `${feedName}: ${error.message}`,
        });
      }
    }

    return batches;
  }

  async fetchKeywordFeeds() {
    const batches = [];

    for (const keyword of this.keywords) {
      try {
        const items = await this.fetchFeed(this.buildSearchFeedUrl(keyword), `search:${keyword}`);
        batches.push(...items);
      } catch (error) {
        batches.push({ error: `search:${keyword}: ${error.message}` });
      }
    }

    return batches;
  }

  async fetchDeals() {
    const configured = await this.fetchDealsFromConfiguredFeeds();
    const keywordItems = await this.fetchKeywordFeeds();
    const errors = [];
    const deals = [];

    for (const entry of [...configured, ...keywordItems]) {
      if (entry.error) {
        errors.push(entry.error);
        continue;
      }
      deals.push(entry);
    }

    return { deals, errors };
  }
}

module.exports = {
  SlickdealsRssSource,
  FEED_URLS,
};
