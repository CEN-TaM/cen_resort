// 상세 화면 탭 · 즐겨찾기(찜)

// ===== 상세 화면 탭 =====
// 영역을 갈아끼우지 않는다. 한 페이지에 이어 두고 탭은 그 자리로 보내는 앵커다.
// 탭 줄은 스크롤이 올라가면 화면 위에 붙는다(CSS position: sticky).
function detailScroller(el) {
  const screen = el.closest('.screen');
  return screen ? (screen.querySelector(':scope > .scroll-body') || screen) : null;
}

// app-header 높이를 재서 탭이 그 바로 아래 붙도록 알려 준다.
// 글자 크기 설정이나 기기 폭에 따라 헤더 높이가 달라질 수 있어 값을 고정하지 않는다.
function syncDetailStickyTop() {
  const detail = document.querySelector('[data-screen="detail"]');
  const header = detail && detail.querySelector('.app-header');
  if (!detail || !header) return 0;
  const h = header.offsetHeight;
  if (h) detail.style.setProperty('--detail-header-h', h + 'px');
  return h;
}

function showDetailTab(trigger, name) {
  const detail = trigger.closest('[data-screen="detail"]');
  const target = detail && detail.querySelector(`.dtab-pane[data-dtab="${name}"]`);
  const scroller = detailScroller(trigger);
  if (!target || !scroller) return;

  markDetailTab(detail, name);
  const headH = syncDetailStickyTop();
  const navH = (detail.querySelector('.tab-nav') || {}).offsetHeight || 0;
  const top = target.getBoundingClientRect().top
    - scroller.getBoundingClientRect().top
    + scroller.scrollTop - headH - navH;
  scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function markDetailTab(detail, name) {
  detail.querySelectorAll('.tab-nav .tnav').forEach(t => {
    t.classList.toggle('active', (t.getAttribute('onclick') || '').includes(`'${name}'`));
  });
}

// 스크롤 위치에 맞춰 어떤 탭이 켜질지 정한다
function syncDetailTabByScroll(detail) {
  const scroller = detailScroller(detail);
  if (!scroller) return;
  const header = detail.querySelector('.app-header');
  const headH = header ? header.offsetHeight : 0;
  const navH = (detail.querySelector('.tab-nav') || {}).offsetHeight || 0;
  const base = scroller.getBoundingClientRect().top + headH + navH + 4;
  let current = null;
  detail.querySelectorAll('.dtab-pane').forEach(pane => {
    if (pane.getBoundingClientRect().top <= base) current = pane.getAttribute('data-dtab');
  });
  if (current) markDetailTab(detail, current);
}

// 스크롤을 따라 탭 표시를 바꾼다.
// .scroll-body 는 scroll-pattern.js 가 이 파일보다 늦게 만든다. 그래서 바로 붙이지 않고
// 문서가 준비된 뒤에, 그리고 상세를 열 때 한 번 더 시도한다(이미 붙었으면 그냥 돌아온다).
function bindDetailScroll() {
  const detail = document.querySelector('[data-screen="detail"]');
  const scroller = detail && detailScroller(detail);
  if (!scroller || scroller.dataset.detailScrollBound) return;
  scroller.dataset.detailScrollBound = '1';
  let ticking = false;
  scroller.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { syncDetailTabByScroll(detail); ticking = false; });
  }, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindDetailScroll);
} else {
  bindDetailScroll();
}

// ===== 즐겨찾기 (찜) 기능 =====
const favoriteState = {
  sokcho: true,
  aewol: true,
  yeosu: true,
  jocheon: true,
  gwacheon: false
};

function toggleFavorite(event, id) {
  if (event) event.stopPropagation();
  favoriteState[id] = !favoriteState[id];
  syncFavoriteUI(id);
  renderFavoriteList();
  if (typeof showToast === 'function') {
    showToast(favoriteState[id] ? '즐겨찾기에 추가되었습니다' : '즐겨찾기에서 해제되었습니다');
  }
}

function syncFavoriteUI(id) {
  const on = !!favoriteState[id];
  document.querySelectorAll(`[data-fav="${id}"]`).forEach(el => {
    el.classList.toggle('favorited', on);
    const ico = el.querySelector('i.ms, i.ti');
    if (ico) {
      const sizeStyle = ico.getAttribute('style') || '';
      ico.className = on ? 'ms' : 'ms outline';
      ico.textContent = 'star';
      if (sizeStyle) ico.setAttribute('style', sizeStyle);
    }
  });
}

function renderFavoriteList() {
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  const countEl = document.getElementById('fav-count');
  if (!grid) return;
  let visible = 0;
  grid.querySelectorAll('[data-fav-card]').forEach(card => {
    const id = card.getAttribute('data-fav-card');
    if (favoriteState[id]) {
      card.style.display = '';
      visible++;
    } else {
      card.style.display = 'none';
    }
  });
  if (countEl) countEl.textContent = visible;
  if (empty) {
    empty.style.display = visible === 0 ? 'block' : 'none';
    grid.style.display = visible === 0 ? 'none' : '';
  }
}

// 초기 상태 반영
Object.keys(favoriteState).forEach(syncFavoriteUI);
renderFavoriteList();

// 배너 슬라이드 초기화
goToBannerSlide(0);

// ===== 휴양소 특징 전체보기 =====
// 상세에는 '숙소 유형'과 '편의시설'만 보이고(CSS), 나머지 분류는 이 팝업에서 본다.
// 본문 목록을 그대로 복제하므로 나중에 데이터로 빼도 한 곳만 그리면 된다.
function openFeatureModal() {
  const src = document.getElementById('feature-list');
  const out = document.getElementById('feature-modal-body');
  if (src && out) out.innerHTML = src.innerHTML;
  const m = document.getElementById('feature-modal');
  if (m) m.classList.add('show');
}

function closeFeatureModal(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  const m = document.getElementById('feature-modal');
  if (m) m.classList.remove('show');
}
