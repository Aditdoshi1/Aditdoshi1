(function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) {
    return;
  }

  const pinBtn = document.getElementById('sidebarPin');
  const toggleBtn = document.getElementById('sidebarToggle');
  const PIN_KEY = 'hub-sidebar-pinned';
  const COLLAPSED_KEY = 'hub-sidebar-collapsed';

  let pinned = localStorage.getItem(PIN_KEY) === 'true';
  let collapsed = localStorage.getItem(COLLAPSED_KEY) !== 'false';

  sidebar.querySelectorAll('.sidebar-link').forEach((link) => {
    const label = link.querySelector('.sidebar-label');
    if (label) {
      link.title = label.textContent.trim();
    }
  });

  function isExpanded() {
    return pinned && !collapsed;
  }

  function applyState() {
    sidebar.classList.toggle('pinned', pinned);
    sidebar.classList.toggle('collapsed', pinned && collapsed);

    if (pinBtn) {
      pinBtn.classList.toggle('active', pinned);
      pinBtn.title = pinned ? 'Unpin sidebar' : 'Pin sidebar';
    }

    if (toggleBtn) {
      const expanded = isExpanded();
      toggleBtn.title = expanded ? 'Collapse sidebar' : 'Expand sidebar';
      toggleBtn.setAttribute('aria-expanded', String(expanded));
    }
  }

  if (pinBtn) {
    pinBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      pinned = !pinned;
      if (pinned && collapsed) {
        collapsed = false;
      }
      localStorage.setItem(PIN_KEY, String(pinned));
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
      applyState();
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      pinned = true;
      collapsed = !collapsed;
      localStorage.setItem(PIN_KEY, String(pinned));
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
      applyState();
    });
  }

  applyState();
})();
