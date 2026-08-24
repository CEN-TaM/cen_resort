// 검색 및 알림
// ===== 검색 및 알림 기능 =====
function openSearch() {
  showScreen('device1', 'search');
  const inp = document.getElementById('global-search-input');
  if (inp) {
    inp.focus({ preventScroll: true });
    inp.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  setTimeout(() => {
    const delayed = document.getElementById('global-search-input');
    if (delayed) delayed.focus({ preventScroll: true });
  }, 120);
  renderSearchResults('');
}

function performSearch(q) {
  renderSearchResults(q);
}

function renderSearchResults(q) {
  const results = document.getElementById('search-results');
  if (!results) return;
  q = (q || '').trim().toLowerCase();
  const cards = Array.from(document.querySelectorAll('.place-card'));
  const matched = cards.filter(c => {
    const nameEl = c.querySelector('.name');
    return nameEl && nameEl.textContent.toLowerCase().includes(q);
  });
  if (matched.length === 0) {
    results.innerHTML = '<div class="empty" style="padding:20px; color:var(--text-3)">검색 결과가 없습니다.</div>';
    return;
  }
  results.innerHTML = matched.map(m => m.outerHTML).join('');
}

function openNotifications() {
  renderNotifications();
  showScreen('device1', 'notifications');
}

function renderNotifications() {
  const out = document.getElementById('notifications-list');
  if (!out) return;
  out.innerHTML = Object.entries(NOTICES).map(([id, n]) => {
    return `
    <div class="notice-row" style="padding:12px 8px; border-bottom:1px solid var(--border); cursor:pointer" onclick="openNoticeDetail('${id}')">
      <div style="font-weight:700">${n.title}</div>
      <div style="font-size:12px; color:var(--text-3); margin-top:6px">${n.date} · ${n.views}</div>
    </div>
  `;
  }).join('');
}

// 스티키 헤더 스크롤 시 반투명 효과 (region-chips 포함)
document.querySelectorAll('.screen').forEach(screen => {
  const sh = screen.querySelector('.sticky-header');
  if (!sh) return;
  screen.addEventListener('scroll', () => {
    sh.classList.toggle('scrolled', screen.scrollTop > 4);
  }, { passive: true });
});
