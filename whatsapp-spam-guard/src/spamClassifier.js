const { containsUrl, extractUrls } = require('./utils/urlDetector');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(text, keyword, wordBoundary) {
  const normalizedText = text.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase().trim();

  if (!normalizedKeyword) {
    return false;
  }

  if (wordBoundary) {
    const pattern = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i');
    return pattern.test(text);
  }

  return normalizedText.includes(normalizedKeyword);
}

function findMatchingKeywords(text, keywords, wordBoundary) {
  return (keywords || []).filter((keyword) => matchesKeyword(text, keyword, wordBoundary));
}

function classifySpam(text, rules) {
  const hasLink = rules.blockAllLinks ? containsUrl(text) : false;
  const matchedKeywords = findMatchingKeywords(
    text,
    rules.keywords,
    rules.wordBoundaryKeywords,
  );

  const hasKeyword = matchedKeywords.length > 0;
  const matchMode = rules.matchMode === 'all' ? 'all' : 'any';

  let isSpam = false;
  let reasons = [];

  if (matchMode === 'all') {
    isSpam = hasLink && hasKeyword;
    if (isSpam) {
      reasons = ['link', 'keyword'];
    }
  } else {
    isSpam = hasLink || hasKeyword;
    if (hasLink) {
      reasons.push('link');
    }
    if (hasKeyword) {
      reasons.push('keyword');
    }
  }

  return {
    isSpam,
    reasons,
    hasLink,
    matchedKeywords,
    urls: extractUrls(text),
  };
}

module.exports = {
  classifySpam,
  matchesKeyword,
  findMatchingKeywords,
};
