const { BaseSource } = require('./baseSource');
const { pickBestPrice, detectRetailer } = require('../utils/dealParsing');

class MockSource extends BaseSource {
  constructor() {
    super('mock');
  }

  async fetchDeals() {
    const now = new Date().toISOString();
    return {
      deals: [
        {
          title: 'Mock Amazon Echo Dot (5th Gen) $24.99',
          retailer: 'Amazon',
          url: 'https://www.amazon.com/dp/B09B8V1LZ3',
          dealUrl: 'https://slickdeals.net/f/mock-echo-dot',
          price: 24.99,
          postedAt: now,
          source: this.name,
          feedName: 'mock',
        },
        {
          title: 'Mock Walmart 55" 4K TV $299.00',
          retailer: 'Walmart',
          url: 'https://www.walmart.com/ip/mock-tv',
          dealUrl: 'https://slickdeals.net/f/mock-tv',
          price: 299,
          postedAt: now,
          source: this.name,
          feedName: 'mock',
        },
      ],
      errors: [],
    };
  }
}

module.exports = {
  MockSource,
};
