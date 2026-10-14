// 검색 및 알림
// ===== 검색 및 알림 기능 =====
// 검색 화면을 열 때마다 새로 시작한다 (예전 검색어가 입력창에 남은 채 기본 화면이 뜨지 않게)
function openSearch() {
  showScreen('device1', 'search');
  const inp = document.getElementById('global-search-input');
  if (inp) {
    inp.value = '';
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

// 검색 확정 — 검색 버튼 · 엔터. 글자를 칠 때마다 검색되므로 치는 도중의 글자는 저장하지 않고, 이때만 최근 검색어에 남긴다
function commitSearch(q) {
  addRecentSearch(q);
  renderSearchResults(q);
}

// ===== 최근 검색어 =====
// 각자의 브라우저에만 저장한다 (서버로 보내지 않는다). 같은 PC 를 여러 명이 써도 섞이지 않게 사번별로 나눈다.
const RECENT_SEARCH_MAX = 8;
function recentSearchKey() {
  const p = (typeof getProfile === 'function' ? getProfile() : null) || {};
  return 'centam_recent_search:' + (p.empno || 'guest');
}
function getRecentSearches() {
  try {
    const list = JSON.parse(localStorage.getItem(recentSearchKey()) || '[]');
    return Array.isArray(list) ? list.filter(k => typeof k === 'string') : [];
  } catch (e) { return []; }
}
function saveRecentSearches(list) {
  try { localStorage.setItem(recentSearchKey(), JSON.stringify(list.slice(0, RECENT_SEARCH_MAX))); } catch (e) { /* 저장 못 해도 검색은 된다 */ }
}
// 맨 앞에 넣고, 같은 검색어(띄어쓰기·대소문자 무시)는 하나만 남긴다
function addRecentSearch(q) {
  const k = String(q || '').trim();
  if (!k) return;
  const key = k.toLowerCase().replace(/\s+/g, '');
  saveRecentSearches([k, ...getRecentSearches().filter(x => x.toLowerCase().replace(/\s+/g, '') !== key)]);
}
function removeRecentSearch(k) {
  saveRecentSearches(getRecentSearches().filter(x => x !== k));
  renderSearchResults('');
}
function clearRecentSearches() {
  saveRecentSearches([]);
  renderSearchResults('');
}

// 검색 결과 · 최근 검색어 클릭 (한 곳에서 받는다 — 검색어를 onclick 문자열에 넣지 않으려고)
(function bindSearchResults() {
  const box = document.getElementById('search-results');
  if (!box) return;
  box.addEventListener('click', e => {
    const del = e.target.closest('[data-recent-del]');
    if (del) { e.stopPropagation(); removeRecentSearch(del.dataset.recentDel); return; }
    if (e.target.closest('[data-recent-clear]')) { clearRecentSearches(); return; }
    const kw = e.target.closest('[data-recent-kw]');
    if (kw) { applySearchKeyword(kw.dataset.recentKw); return; }
    // 검색 결과에서 휴양소를 누르면 그 검색어를 남긴다 (이동은 카드의 openResortEl 이 한다)
    if (e.target.closest('.place-card')) {
      const inp = document.getElementById('global-search-input');
      if (inp && inp.value.trim()) addRecentSearch(inp.value);
    }
  }, true);
})();

// 검색 대상 휴양소 — 휴양소 데이터(resort-data.js ResortAPI)를 그대로 쓴다. 지도·목록과 같은 데이터
// 정식명 · 지역 · 옛 표기 어느 것으로 쳐도 찾는다
function getSearchPool() {
  return ResortAPI.list.map(r => ({ r, terms: [r.name, r.loc, ...(r.aliases || [])].filter(Boolean) }));
}

// 최근 검색어 클릭 → 입력창 채우고 검색 (맨 앞으로 올린다)
function applySearchKeyword(k) {
  const inp = document.getElementById('global-search-input');
  if (inp) inp.value = k;
  commitSearch(k);
}

// 입력 전 기본 화면: 최근 검색어 + 인기 휴양소
function defaultSearchStateHtml() {
  const recent = getRecentSearches();
  const chips = recent.map(k => {
    const v = escapeHtml(k);
    return `<span class="search-kw recent">` +
      `<button type="button" class="kw" data-recent-kw="${v}">${v}</button>` +
      `<button type="button" class="del" data-recent-del="${v}" aria-label="${v} 지우기"><i class="ti ti-x"></i></button>` +
      `</span>`;
  }).join('');
  const recentHtml = recent.length
    ? `<div class="search-kw-row">${chips}</div>`
    : '<div class="search-empty-note">최근 검색어가 없어요.</div>';
  // 인기 휴양소 — 홈 · 인기 휴양소 화면과 같은 기준 (후기 많은 순, resort-data.js ResortAPI.popular)
  const popular = ResortAPI.popular(5).map(r => resortCardHtml(r, { showType: true })).join('');
  return `
    <div class="search-section">
      <div class="search-sec-head">
        <div class="search-sec-title">최근 검색어</div>
        ${recent.length ? '<button type="button" class="search-clear" data-recent-clear>전체 삭제</button>' : ''}
      </div>
      ${recentHtml}
    </div>
    <div class="search-section">
      <div class="search-sec-title">인기 휴양소</div>
      <div class="search-reco">${popular}</div>
    </div>`;
}

function renderSearchResults(q) {
  const results = document.getElementById('search-results');
  if (!results) return;
  q = (q || '').trim().toLowerCase();
  // 입력 전에는 최근 검색어 + 인기 휴양소
  if (!q) {
    results.innerHTML = defaultSearchStateHtml();
    hydrateResortCards(results);
    return;
  }
  // 띄어쓰기 무시: '경주 휴양소' 로 쳐도 '경주휴양소' 가 나온다
  const norm = s => String(s).toLowerCase().replace(/\s+/g, '');
  const nq = norm(q);
  const matched = getSearchPool()
    .filter(p => p.terms.some(t => norm(t).includes(nq)))
    .map(p => p.r);
  if (matched.length === 0) {
    results.innerHTML = '<div class="empty" style="padding:20px; color:var(--text-3)">검색 결과가 없습니다.</div>';
    return;
  }
  results.innerHTML = '<div class="search-reco">' + matched.map(r => resortCardHtml(r, { showType: true })).join('') + '</div>';
  hydrateResortCards(results);
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
