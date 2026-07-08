const URL_PATTERNS = [
  /https?:\/\/[^\s]+/i,
  /www\.[^\s]+/i,
  /\b[a-z0-9-]+\.(com|net|org|io|me|co|xyz|link|app|dev|info|biz|shop|store|top|site|online|live|club|vip|pro|tech|cloud|click|work|fun|cc|tk|ml|ga|cf|gq)(?:\/[^\s]*)?\b/i,
  /\b(?:bit\.ly|t\.co|tinyurl\.com|goo\.gl|ow\.ly|is\.gd|buff\.ly|rb\.gy|cutt\.ly|shorturl\.at|rebrand\.ly|t\.me|telegram\.me|wa\.me|chat\.whatsapp\.com)\/[^\s]*/i,
];

function containsUrl(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  return URL_PATTERNS.some((pattern) => pattern.test(text));
}

function extractUrls(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const matches = new Set();

  for (const pattern of URL_PATTERNS) {
    const found = text.match(new RegExp(pattern.source, pattern.flags + 'g'));
    if (found) {
      found.forEach((match) => matches.add(match));
    }
  }

  return [...matches];
}

module.exports = {
  containsUrl,
  extractUrls,
};
