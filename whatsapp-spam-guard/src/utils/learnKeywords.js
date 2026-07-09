const { extractUrls } = require('./urlDetector');

function normalizeKeyword(value) {
  return String(value || '').trim();
}

function keywordExists(keyword, existingKeywords) {
  const normalized = normalizeKeyword(keyword).toLowerCase();
  return (existingKeywords || []).some(
    (entry) => normalizeKeyword(entry).toLowerCase() === normalized,
  );
}

function extractLearnableKeywords(messageText, existingKeywords = []) {
  const text = normalizeKeyword(messageText);
  const learned = [];

  if (!text) {
    return learned;
  }

  if (text.length >= 3 && text.length <= 120 && !keywordExists(text, existingKeywords)) {
    learned.push(text);
  }

  for (const url of extractUrls(text)) {
    const cleaned = normalizeKeyword(url);
    if (cleaned.length >= 4 && !keywordExists(cleaned, [...existingKeywords, ...learned])) {
      learned.push(cleaned);
    }

    try {
      const hostname = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`).hostname;
      if (hostname && !keywordExists(hostname, [...existingKeywords, ...learned])) {
        learned.push(hostname);
      }
    } catch {
      // Ignore invalid URL parsing.
    }
  }

  return learned;
}

module.exports = {
  extractLearnableKeywords,
  keywordExists,
};
