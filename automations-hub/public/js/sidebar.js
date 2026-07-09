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
  let collapsed = localStorage.getItem(COLLAPSED_KEY) === 'true';

  function applyState() {
    sidebar.classList.toggle('pinned', pinned);
    sidebar.classList.toggle('collapsed', pinned && collapsed);
    if (pinBtn) {
      pinBtn.classList.toggle('active', pinned);
      pinBtn.title = pinned ? 'Unpin sidebar' : 'Pin sidebar';
    }
    if (toggleBtn) {
      toggleBtn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
      toggleBtn.style.display = pinned ? 'grid' : 'none';
    }
  }

  if (pinBtn) {
    pinBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      pinned = !pinned;
      if (pinned) {
        collapsed = false;
      }
      localStorage.setItem(PIN_KEY, String(pinned));
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
      applyState();
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (!pinned) {
        return;
      }
      collapsed = !collapsed;
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
      applyState();
    });
  }

  applyState();
})();
