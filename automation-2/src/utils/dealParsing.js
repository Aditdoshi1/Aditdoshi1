const RETAILER_PATTERNS = [
  { name: 'Amazon', pattern: /\bamazon(?:\.com)?\b/i },
  { name: 'Walmart', pattern: /\bwalmart(?:\.com)?\b/i },
  { name: 'Target', pattern: /\btarget(?:\.com)?\b/i },
  { name: 'Best Buy', pattern: /\bbest buy(?:\.com)?\b/i },
  { name: 'Costco', pattern: /\bcostco(?:\.com)?\b/i },
  { name: 'Home Depot', pattern: /\bhome depot(?:\.com)?\b/i },
  { name: 'Lowe\'s', pattern: /\blowe'?s(?:\.com)?\b/i },
  { name: 'Newegg', pattern: /\bnewegg(?:\.com)?\b/i },
  { name: 'eBay', pattern: /\bebay(?:\.com)?\b/i },
];

function extractPrices(text) {
  if (!text) {
    return [];
  }

  const matches = [...text.matchAll(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g)];
  return matches
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function pickBestPrice(text) {
  const prices = extractPrices(text);
  if (!prices.length) {
    return null;
  }
  return Math.min(...prices);
}

function detectRetailer(title, content, link) {
  const haystack = `${title || ''} ${content || ''} ${link || ''}`;

  for (const entry of RETAILER_PATTERNS) {
    if (entry.pattern.test(haystack)) {
      return entry.name;
    }
  }

  const viaMatch = haystack.match(/\bvia\s+([A-Za-z0-9&' .-]+?)(?:\s*\[|\s+has\b|\s+on sale\b|$)/i);
  if (viaMatch) {
    return viaMatch[1].trim();
  }

  const atMatch = (title || '').match(/\bat\s+([A-Za-z0-9&' .-]+)\s*$/i);
  if (atMatch) {
    return atMatch[1].trim();
  }

  return 'Other';
}

function extractAmazonAsin(url) {
  if (!url) {
    return null;
  }

  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

function calcDropPct(previousPrice, newPrice) {
  if (!previousPrice || !newPrice || newPrice >= previousPrice) {
    return null;
  }
  return Math.round(((previousPrice - newPrice) / previousPrice) * 1000) / 10;
}

module.exports = {
  extractPrices,
  pickBestPrice,
  detectRetailer,
  extractAmazonAsin,
  calcDropPct,
};
