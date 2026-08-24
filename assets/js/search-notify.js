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

// 알림센터는 assets/js/notification.js 로 옮겼다 (댓글·답글·공지 3종 + 읽음 처리)

// 스티키 헤더 스크롤 시 반투명 효과 (region-chips 포함)
document.querySelectorAll('.screen').forEach(screen => {
  const sh = screen.querySelector('.sticky-header');
  if (!sh) return;
  screen.addEventListener('scroll', () => {
    sh.classList.toggle('scrolled', screen.scrollTop > 4);
  }, { passive: true });
});
