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

// 검색 대상 휴양소 카드 풀 (이름 중복 제거, 검색결과 영역 클론은 제외)
function getSearchPool() {
  const all = Array.from(document.querySelectorAll('.place-card'))
    .filter(c => !c.closest('#search-results'));
  const seen = new Set();
  const pool = [];
  all.forEach(c => {
    const nameEl = c.querySelector('.name');
    const n = nameEl ? nameEl.textContent.trim() : '';
    if (!n || seen.has(n)) return;
    seen.add(n);
    pool.push(c);
  });
  return pool;
}

// 검색어 칩 클릭 → 입력창 채우고 검색
function applySearchKeyword(k) {
  const inp = document.getElementById('global-search-input');
  if (inp) inp.value = k;
  renderSearchResults(k);
}

// 입력 전 기본 화면: 인기 검색어 + 추천 휴양소
function defaultSearchStateHtml() {
  const keywords = ['애월', '여수', '조천', '보령', '속초', '부산'];
  const chips = keywords.map(k =>
    `<button class="search-kw" onclick="applySearchKeyword('${k}')">${k}</button>`
  ).join('');
  const reco = getSearchPool().slice(0, 6).map(c => c.outerHTML).join('');
  return `
    <div class="search-section">
      <div class="search-sec-title">인기 검색어</div>
      <div class="search-kw-row">${chips}</div>
    </div>
    <div class="search-section">
      <div class="search-sec-title">추천 휴양소</div>
      <div class="search-reco">${reco}</div>
    </div>`;
}

function renderSearchResults(q) {
  const results = document.getElementById('search-results');
  if (!results) return;
  q = (q || '').trim().toLowerCase();
  // 입력 전에는 인기 검색어 + 추천 휴양소
  if (!q) {
    results.innerHTML = defaultSearchStateHtml();
    return;
  }
  const matched = getSearchPool().filter(c => {
    const nameEl = c.querySelector('.name');
    return nameEl && nameEl.textContent.toLowerCase().includes(q);
  });
  if (matched.length === 0) {
    results.innerHTML = '<div class="empty" style="padding:20px; color:var(--text-3)">검색 결과가 없습니다.</div>';
    return;
  }
  results.innerHTML = '<div class="search-reco">' + matched.map(m => m.outerHTML).join('') + '</div>';
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
