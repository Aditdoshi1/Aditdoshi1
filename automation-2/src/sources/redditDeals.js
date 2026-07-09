const { BaseSource } = require('./baseSource');
const { pickBestPrice, detectRetailer } = require('../utils/dealParsing');

class RedditDealsSource extends BaseSource {
  constructor({ subreddits = ['deals', 'buildapcsales'], keywords = [] } = {}) {
    super('reddit');
    this.subreddits = subreddits;
    this.keywords = keywords;
    this.clientId = process.env.REDDIT_CLIENT_ID || '';
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
    this.userAgent = process.env.REDDIT_USER_AGENT || 'DealScout/1.0';
  }

  isEnabled() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async getToken() {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials' });

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Reddit auth failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async fetchSubreddit(token, subreddit, query) {
    const params = new URLSearchParams({ limit: '25', sort: 'new' });
    if (query) {
      params.set('q', query);
      params.set('restrict_sr', '1');
    }

    const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/search?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit fetch failed for r/${subreddit}: ${response.status}`);
    }

    const data = await response.json();
    return (data?.data?.children || []).map((child) => child.data);
  }

  normalizePost(post, feedName) {
    const title = post.title || '';
    const content = post.selftext || '';
    const dealUrl = post.url || `https://reddit.com${post.permalink}`;
    const price = pickBestPrice(`${title} ${content}`);

    return {
      title,
      retailer: detectRetailer(title, content, dealUrl),
      url: dealUrl,
      dealUrl: `https://reddit.com${post.permalink}`,
      price,
      postedAt: new Date((post.created_utc || 0) * 1000).toISOString(),
      source: this.name,
      feedName,
    };
  }

  async fetchDeals() {
    if (!this.isEnabled()) {
      return { deals: [], errors: ['Reddit API credentials not configured'] };
    }

    const token = await this.getToken();
    const deals = [];
    const errors = [];

    for (const subreddit of this.subreddits) {
      const queries = this.keywords.length ? this.keywords : [''];
      for (const query of queries) {
        try {
          const posts = await this.fetchSubreddit(token, subreddit, query);
          deals.push(...posts.map((post) => this.normalizePost(post, query ? `${subreddit}:${query}` : subreddit)));
        } catch (error) {
          errors.push(error.message);
        }
      }
    }

    return { deals, errors };
  }
}

module.exports = {
  RedditDealsSource,
};
