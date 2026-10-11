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

// 탭을 눌러 이동하는 동안에는 스크롤 판정이 탭을 되돌리지 않게 잠근다
let detailTabLock = null;

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
  const dest = Math.max(0, Math.min(top, scroller.scrollHeight - scroller.clientHeight));
  if (Math.abs(scroller.scrollTop - dest) < 2) return;
  detailTabLock = name;
  scroller.scrollTo({ top: dest, behavior: 'smooth' });
  releaseTabLock(scroller, detail);
}

// 스크롤이 멈추면(또는 0.9초 뒤) 잠금을 풀고 위치로 다시 맞춘다
function releaseTabLock(scroller, detail) {
  clearTimeout(releaseTabLock._t);
  const done = () => {
    clearTimeout(releaseTabLock._t);
    scroller.removeEventListener('scrollend', done);
    detailTabLock = null;
    syncDetailTabByScroll(detail);
  };
  if ('onscrollend' in window) scroller.addEventListener('scrollend', done, { once: true });
  releaseTabLock._t = setTimeout(done, 900);
}

function markDetailTab(detail, name) {
  detail.querySelectorAll('.tab-nav .tnav').forEach(t => {
    const on = t.dataset.dtabTarget === name;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
  });
}

// 스크롤 위치에 맞춰 어떤 탭이 켜질지 정한다
function syncDetailTabByScroll(detail) {
  if (detailTabLock) return;
  const scroller = detailScroller(detail);
  if (!scroller) return;
  // 끝까지 내렸는데 마지막 영역이 기준선에 못 닿으면(후기가 짧을 때) 마지막 탭을 켠다
  const panes = detail.querySelectorAll('.dtab-pane');
  if (panes.length && scroller.scrollTop > 0
    && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
    markDetailTab(detail, panes[panes.length - 1].getAttribute('data-dtab'));
    return;
  }
  const header = detail.querySelector('.app-header');
  const headH = header ? header.offsetHeight : 0;
  const navH = (detail.querySelector('.tab-nav') || {}).offsetHeight || 0;
  const base = scroller.getBoundingClientRect().top + headH + navH + 4;
  // 첫 영역이 아직 기준선 아래(맨 위 사진·평점을 보는 중)여도 첫 탭을 켠다
  let current = panes.length ? panes[0].getAttribute('data-dtab') : null;
  panes.forEach(pane => {
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
  if (!id) return;   // 상세 별 버튼은 openResort() 가 data-fav 를 채우기 전엔 비어 있다
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
    // 이미지 별(상세 헤더)은 CSS 가 .favorited 로 켜고 끈다
    if (el.querySelector('.fav-ico-off')) return;
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
// 상세에는 정보 3줄만 보이고, 분류별 편의시설은 이 팝업에서 본다.
// 내용은 data/resorts.js 의 features 로 그린다 (FEATURE_META 에 없는 이름은 체크 아이콘)
function featureSectionsHtml(features) {
  return FEATURE_ORDER.filter(g => (features[g] || []).length).map(g => `
    <div class="feature-section" data-group="${escapeHtml(g)}">
      <div class="fs-title">${escapeHtml(g)}</div>
      <div class="fs-chips">${features[g].map(n => {
        const m = FEATURE_META[n] || ['check', 'sky'];
        return `<div class="feat-chip"><div class="fc-icon tone-${m[1]}"><i class="ms" aria-hidden="true">${m[0]}</i></div><div class="fc-name">${escapeHtml(n)}</div></div>`;
      }).join('')}</div>
    </div>`).join('');
}

function openFeatureModal() {
  const r = resolveResort(currentResortName);
  const out = document.getElementById('feature-modal-body');
  if (out) out.innerHTML = (r && r.features) ? featureSectionsHtml(r.features) : '<div class="tip-empty">등록된 정보가 없어요.</div>';
  const m = document.getElementById('feature-modal');
  if (m) m.classList.add('show');
}

function closeFeatureModal(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  const m = document.getElementById('feature-modal');
  if (m) m.classList.remove('show');
}
