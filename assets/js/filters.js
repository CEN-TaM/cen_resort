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
let noticeSearching = false;   // 검색 모드 — 분류 칩이 숨고, 전체 분류에서 찾는다

function applyNoticeFilter() {
  const q = noticeQuery.trim().toLowerCase();
  const cards = document.querySelectorAll('.screen[data-screen="tips"] .notice-card');
  let shown = 0;
  cards.forEach(card => {
    const catOk = noticeSearching || noticeCat === '전체' || card.dataset.category === noticeCat;
    // 카드에는 제목만 보이지만 검색은 본문 앞부분(data-summary)까지 찾는다
    const titleEl = card.querySelector('.notice-title');
    const text = ((titleEl ? titleEl.textContent : '') + ' ' + (card.dataset.summary || '')).toLowerCase();
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
    if (filteredOut) empty.textContent = q ? '검색 결과가 없습니다.' : `'${noticeCat}' 공지사항이 없어요.`;
  }
  // 검색 중이고 검색어가 있으면 '검색결과 N 건'
  const result = document.getElementById('notice-result');
  if (result) {
    result.hidden = !(noticeSearching && q);
    const cnt = document.getElementById('notice-result-count');
    if (cnt) cnt.textContent = shown;
  }
}

function selectNoticeCat(el) {
  el.parentElement.querySelectorAll('.notice-cat').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  noticeCat = el.textContent.trim();
  applyNoticeFilter();
}

// 공지 탭을 그 분류가 골라진 채로 연다 (홈 배너 '이용가이드' 등)
function openNoticeCategory(cat) {
  const chip = [...document.querySelectorAll('.screen[data-screen="tips"] .notice-cat')].find(c => c.textContent.trim() === cat);
  if (chip) selectNoticeCat(chip);
  showScreen('device1', 'tips');
}

// 글자를 칠 때마다 거른다. 검색창을 누르기만 해서는 바뀌지 않는다.
// 검색 모드: 헤더 뒤로가기 · '취소' 가 보이고 분류 칩 대신 '검색결과 N 건' (notice-list.css .notice-searching)
function searchNotices(q) {
  noticeQuery = String(q || '').trim();
  noticeSearching = !!noticeQuery;          // 글자를 다 지우면 원래 목록 (골라 둔 분류)
  const screen = document.querySelector('.screen[data-screen="tips"]');
  if (screen) screen.classList.toggle('notice-searching', noticeSearching);
  applyNoticeFilter();
}

// 엔터(키보드 '검색')는 휴대폰 키보드만 내린다 — 결과는 이미 걸러져 있다
function submitNoticeSearch(event) {
  if (event) event.preventDefault();
  const inp = document.getElementById('notice-search-input');
  if (inp) inp.blur();
}

// 뒤로가기 · 취소 → 검색어를 지우고 원래 목록(골라 둔 분류)으로
function exitNoticeSearch() {
  const screen = document.querySelector('.screen[data-screen="tips"]');
  const inp = document.getElementById('notice-search-input');
  if (inp) { inp.value = ''; inp.blur(); }
  noticeQuery = '';
  noticeSearching = false;
  if (screen) screen.classList.remove('notice-searching');
  applyNoticeFilter();
}
