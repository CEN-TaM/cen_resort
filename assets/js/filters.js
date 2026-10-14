// 지역 칩 · 후기 필터 칩 · 공지사항 카테고리/검색
// ===== 지역 칩 선택 =====
function selectRegion(el) {
  el.parentElement.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ===== 후기 필터 칩 토글 (다중 선택) =====
// ===== 공지사항 카테고리 + 검색 필터 =====
let noticeCat = '전체';
let noticeQuery = '';

function applyNoticeFilter() {
  const q = noticeQuery.trim().toLowerCase();
  const cards = document.querySelectorAll('.screen[data-screen="tips"] .notice-card');
  let shown = 0;
  cards.forEach(card => {
    const catOk = noticeCat === '전체' || card.dataset.category === noticeCat;
    const titleEl = card.querySelector('.notice-title');
    const bodyEl = card.querySelector('.notice-body');
    const text = ((titleEl ? titleEl.textContent : '') + ' ' + (bodyEl ? bodyEl.textContent : '')).toLowerCase();
    const qOk = !q || text.includes(q);
    const show = catOk && qOk;
    card.style.display = show ? '' : 'none';
    if (show) shown++;
  });
  // 공지가 아예 없을 때는 notice.js 의 '등록된 공지사항이 없어요' 만 보인다 — 이 문구는 공지가 있는데 걸러져 0건일 때만
  const empty = document.getElementById('notice-empty');
  if (empty) {
    const filteredOut = cards.length > 0 && shown === 0;
    empty.style.display = filteredOut ? '' : 'none';
    if (filteredOut) empty.textContent = q ? '🔍 검색 결과가 없습니다.' : `'${noticeCat}' 공지사항이 없어요.`;
  }
}

function selectNoticeCat(el) {
  el.parentElement.querySelectorAll('.notice-cat').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  noticeCat = el.textContent.trim();
  applyNoticeFilter();
}

function searchNotices(q) {
  noticeQuery = q || '';
  applyNoticeFilter();
}

function toggleNoticeSearch() {
  const box = document.getElementById('notice-search');
  if (!box) return;
  box.classList.toggle('open');
  if (box.classList.contains('open')) {
    const inp = document.getElementById('notice-search-input');
    if (inp) setTimeout(() => inp.focus(), 50);
  } else {
    clearNoticeSearch();
  }
}

function clearNoticeSearch() {
  const inp = document.getElementById('notice-search-input');
  if (inp) inp.value = '';
  noticeQuery = '';
  applyNoticeFilter();
}
