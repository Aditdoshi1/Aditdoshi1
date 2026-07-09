const params = new URLSearchParams(window.location.search);
if (params.get('embed') === '1') {
  document.body.classList.add('embedded');
}

let statusData = null;
let scanBusy = false;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function showFeedback(message, type = 'info') {
  const el = document.getElementById('pageFeedback');
  if (!el) {
    return;
  }
  el.textContent = message;
  el.className = `page-feedback visible ${type}`;
  clearTimeout(showFeedback.timer);
  showFeedback.timer = setTimeout(() => {
    el.classList.remove('visible');
  }, 2800);
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  return `$${Number(value).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderStatus(data) {
  statusData = data;
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const meta = document.getElementById('statusMeta');
  const pauseBtn = document.getElementById('pauseBtn');

  dot.classList.remove('ready', 'paused');
  if (data.paused) {
    dot.classList.add('paused');
    text.textContent = 'Scheduler paused';
  } else if (data.scheduler?.running) {
    text.textContent = 'Scanning…';
  } else {
    dot.classList.add('ready');
    text.textContent = `${data.stats?.totalDeals || 0} deals tracked`;
  }

  const lastRun = data.recentRuns?.[0];
  const nextMin = Math.round((data.scheduler?.intervalMs || 0) / 60000);
  let metaText = `Every ${nextMin || data.scheduler?.intervalMinutes || 120} min`;
  if (lastRun) {
    metaText += ` · Last: ${lastRun.item_count || 0} items`;
    if (lastRun.error) {
      metaText += ' (errors)';
    }
  }
  meta.textContent = metaText;

  if (pauseBtn) {
    const paused = Boolean(data.paused);
    pauseBtn.title = paused ? 'Resume scheduler' : 'Pause scheduler';
    pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    pauseBtn.innerHTML = paused
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>';
  }
}

function renderDealCard(deal) {
  const card = document.createElement('article');
  card.className = `deal-card ${deal.deal_type === 'drop' ? 'drop' : ''}`;

  const link = deal.deal_url || deal.url;
  const badges = [];
  if (deal.deal_type === 'drop') {
    badges.push(`<span class="badge drop">${deal.drop_pct}% drop</span>`);
  } else {
    badges.push('<span class="badge new">New</span>');
  }
  if (deal.retailer) {
    badges.push(`<span class="badge retailer">${escapeHtml(deal.retailer)}</span>`);
  }

  card.innerHTML = `
    <div class="deal-top">
      <div class="deal-title">
        <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(deal.title)}</a>
      </div>
      <div class="deal-badges">${badges.join('')}</div>
    </div>
    <div class="deal-meta">
      <span>${formatPrice(deal.price)}</span>
      ${deal.previous_price != null ? `<span>was ${formatPrice(deal.previous_price)}</span>` : ''}
      <span>${escapeHtml(deal.source || '')}${deal.feed_name ? ` · ${escapeHtml(deal.feed_name)}` : ''}</span>
      <span>${formatDate(deal.detected_at)}</span>
    </div>
  `;

  return card;
}

async function loadRetailers() {
  const select = document.getElementById('retailerFilter');
  if (!select) {
    return;
  }

  const current = select.value;
  const { retailers } = await fetchJson('/api/retailers');
  select.innerHTML = '<option value="">All retailers</option>';
  for (const entry of retailers) {
    const option = document.createElement('option');
    option.value = entry.retailer;
    option.textContent = `${entry.retailer} (${entry.count})`;
    select.appendChild(option);
  }
  select.value = current;
}

async function loadDeals() {
  const retailer = document.getElementById('retailerFilter')?.value || '';
  const keyword = document.getElementById('keywordFilter')?.value?.trim() || '';
  const minDrop = document.getElementById('minDropFilter')?.value;

  const query = new URLSearchParams();
  if (retailer) {
    query.set('retailer', retailer);
  }
  if (keyword) {
    query.set('keyword', keyword);
  }
  if (minDrop) {
    query.set('minDrop', minDrop);
  }

  const { deals } = await fetchJson(`/api/deals?${query.toString()}`);
  const list = document.getElementById('dealsList');
  const empty = document.getElementById('dealsEmpty');

  list.innerHTML = '';
  if (!deals.length) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  for (const deal of deals) {
    list.appendChild(renderDealCard(deal));
  }
}

function renderWatchlist(items) {
  const container = document.getElementById('watchlistItems');
  container.innerHTML = '';

  if (!items.length) {
    container.innerHTML = '<p class="panel-help">No watchlist items yet.</p>';
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label || item.url)}</a>
        ${item.retailer ? `<div class="panel-help">${escapeHtml(item.retailer)}</div>` : ''}
      </div>
      <button type="button" class="btn small danger" data-id="${item.id}">Remove</button>
    `;
    row.querySelector('button').addEventListener('click', async () => {
      await fetchJson(`/api/watchlist/${item.id}`, { method: 'DELETE' });
      showFeedback('Removed from watchlist', 'success');
      await refreshWatchlist();
    });
    container.appendChild(row);
  }
}

function renderKeywords(keywords) {
  const container = document.getElementById('keywordItems');
  container.innerHTML = '';

  if (!keywords.length) {
    container.innerHTML = '<p class="panel-help">Add keywords to search Slickdeals RSS.</p>';
    return;
  }

  for (const keyword of keywords) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <span>${escapeHtml(keyword.term)}</span>
      <button type="button" class="btn small danger" data-id="${keyword.id}">Remove</button>
    `;
    row.querySelector('button').addEventListener('click', async () => {
      await fetchJson(`/api/keywords/${keyword.id}`, { method: 'DELETE' });
      showFeedback('Keyword removed', 'success');
      await refreshKeywords();
    });
    container.appendChild(row);
  }
}

async function refreshWatchlist() {
  const { items } = await fetchJson('/api/watchlist');
  renderWatchlist(items);
}

async function refreshKeywords() {
  const { keywords } = await fetchJson('/api/keywords');
  renderKeywords(keywords);
}

async function refreshStatus() {
  const data = await fetchJson('/api/status');
  renderStatus(data);
  return data;
}

async function refreshAll(options = {}) {
  const { quiet = false } = options;
  if (!quiet) {
    showFeedback('Refreshing…', 'loading');
  }

  try {
    await Promise.all([
      refreshStatus(),
      loadRetailers(),
      loadDeals(),
      refreshWatchlist(),
      refreshKeywords(),
    ]);
    if (!quiet) {
      showFeedback('Updated', 'success');
    }
  } catch (error) {
    showFeedback(error.message, 'error');
  }
}

async function runScan() {
  if (scanBusy) {
    return;
  }

  scanBusy = true;
  const scanBtn = document.getElementById('scanBtn');
  scanBtn?.classList.add('loading');
  showFeedback('Scanning feeds…', 'loading');

  try {
    const result = await fetchJson('/api/scan', { method: 'POST' });
    if (result.result?.skipped) {
      showFeedback(result.result.reason || 'Scan skipped', 'error');
    } else {
      const summary = result.result;
      showFeedback(
        `Scan done: ${summary?.totalItems || 0} items, ${summary?.totalNew || 0} new, ${summary?.totalDrops || 0} drops`,
        'success',
      );
    }
    await refreshAll({ quiet: true });
  } catch (error) {
    showFeedback(error.message, 'error');
  } finally {
    scanBusy = false;
    scanBtn?.classList.remove('loading');
  }
}

async function togglePause() {
  const endpoint = statusData?.paused ? '/api/resume' : '/api/pause';
  await fetchJson(endpoint, { method: 'POST' });
  showFeedback(statusData?.paused ? 'Scheduler resumed' : 'Scheduler paused', 'success');
  await refreshStatus();
}

document.getElementById('scanBtn')?.addEventListener('click', runScan);
document.getElementById('pauseBtn')?.addEventListener('click', togglePause);
document.getElementById('refreshDealsBtn')?.addEventListener('click', () => loadDeals());

document.getElementById('retailerFilter')?.addEventListener('change', () => loadDeals());
document.getElementById('keywordFilter')?.addEventListener('input', () => {
  clearTimeout(document.getElementById('keywordFilter').debounce);
  document.getElementById('keywordFilter').debounce = setTimeout(() => loadDeals(), 300);
});
document.getElementById('minDropFilter')?.addEventListener('change', () => loadDeals());

document.getElementById('watchlistForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = document.getElementById('watchlistUrl').value.trim();
  const label = document.getElementById('watchlistLabel').value.trim();
  await fetchJson('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, label: label || undefined }),
  });
  event.target.reset();
  showFeedback('Added to watchlist', 'success');
  await refreshWatchlist();
});

document.getElementById('keywordForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const term = document.getElementById('keywordInput').value.trim();
  await fetchJson('/api/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term }),
  });
  event.target.reset();
  showFeedback('Keyword added — included on next scan', 'success');
  await refreshKeywords();
});

refreshAll({ quiet: true });
