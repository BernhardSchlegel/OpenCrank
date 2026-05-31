export type PageId = 'home' | 'training' | 'settings';

const ALL_PAGES: PageId[] = ['home', 'training', 'settings'];

function getPageFromHash(): PageId {
  const hash = location.hash.replace('#', '') as PageId;
  return ALL_PAGES.includes(hash) ? hash : 'home';
}

function showPage(id: PageId) {
  ALL_PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.hidden = p !== id;
  });

  document.querySelectorAll<HTMLElement>('.nav-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.page === id);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', () => showPage(getPageFromHash()));
  showPage(getPageFromHash());
}
