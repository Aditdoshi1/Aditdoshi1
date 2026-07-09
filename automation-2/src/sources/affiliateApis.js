/**
 * Placeholder for future affiliate retailer APIs.
 * Amazon PA-API and Walmart.io Affiliate are intentionally deferred.
 */

const DEFERRED = {
  amazonPaapi: {
    status: 'deferred',
    reason: 'Requires Amazon Associates account and qualifying sales history.',
    docs: 'https://webservices.amazon.com/paapi5/documentation/',
  },
  walmartAffiliate: {
    status: 'deferred',
    reason: 'Requires Walmart.io developer account and RSA-signed requests.',
    docs: 'https://walmart.io/apidocs/affiliates/introduction',
  },
};

function getDeferredSources() {
  return DEFERRED;
}

module.exports = {
  getDeferredSources,
};
