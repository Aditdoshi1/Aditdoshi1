const CACHE_TTL_MS = 60_000;

let cache = {
  groups: [],
  fetchedAt: 0,
  error: null,
};

function getCachedGroups() {
  if (!cache.fetchedAt) {
    return null;
  }

  return {
    groups: cache.groups,
    fetchedAt: cache.fetchedAt,
    stale: Date.now() - cache.fetchedAt > CACHE_TTL_MS,
    error: cache.error,
  };
}

function setCachedGroups(groups, error = null) {
  cache = {
    groups,
    fetchedAt: Date.now(),
    error,
  };
}

function clearGroupCache() {
  cache = {
    groups: [],
    fetchedAt: 0,
    error: null,
  };
}

module.exports = {
  getCachedGroups,
  setCachedGroups,
  clearGroupCache,
  CACHE_TTL_MS,
};
