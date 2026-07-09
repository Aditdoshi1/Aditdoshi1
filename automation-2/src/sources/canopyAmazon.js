const { BaseSource } = require('./baseSource');
const { extractAmazonAsin } = require('../utils/dealParsing');

class CanopyAmazonSource extends BaseSource {
  constructor({ apiKey, maxWatchlistItems = 5 } = {}) {
    super('canopy');
    this.apiKey = apiKey || process.env.CANOPY_API_KEY || '';
    this.maxWatchlistItems = maxWatchlistItems;
    this.enabled = Boolean(this.apiKey);
  }

  isEnabled() {
    return this.enabled;
  }

  async lookupAsin(asin) {
    if (!this.enabled) {
      throw new Error('Canopy API key not configured');
    }

    const response = await fetch(`https://rest.canopyapi.co/api/amazon/product?asin=${encodeURIComponent(asin)}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Canopy API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const product = data?.data || data?.product || data;
    const price = product?.price?.value
      ?? product?.buybox_winner?.price?.value
      ?? product?.price
      ?? null;

    return {
      asin,
      title: product?.title || product?.name || `Amazon ${asin}`,
      price: typeof price === 'number' ? price : Number(price) || null,
      url: product?.url || `https://www.amazon.com/dp/${asin}`,
      imageUrl: product?.image || product?.main_image?.link || null,
      source: this.name,
    };
  }

  async refreshWatchlist(items) {
    if (!this.enabled) {
      return { products: [], errors: ['Canopy API key not configured'] };
    }

    const slice = items.slice(0, this.maxWatchlistItems);
    const products = [];
    const errors = [];

    for (const item of slice) {
      const asin = item.external_id || extractAmazonAsin(item.url);
      if (!asin) {
        errors.push(`No ASIN for ${item.url}`);
        continue;
      }

      try {
        const product = await this.lookupAsin(asin);
        products.push({
          ...product,
          watchlistId: item.id,
          label: item.label,
        });
      } catch (error) {
        errors.push(`${asin}: ${error.message}`);
      }
    }

    return { products, errors };
  }

  async fetchDeals() {
    return { deals: [], errors: [] };
  }
}

module.exports = {
  CanopyAmazonSource,
};
