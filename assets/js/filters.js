// 지역 칩 · 리뷰 필터 칩 · 공지사항 카테고리/검색
// ===== 지역 칩 선택 =====
function selectRegion(el) {
  el.parentElement.querySelectorAll('.region-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ===== 리뷰 필터 칩 토글 (다중 선택) =====
function toggleRevChip(el) {
  el.classList.toggle('active');
}

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
  const empty = document.getElementById('notice-empty');
  if (empty) empty.style.display = shown === 0 ? '' : 'none';
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
