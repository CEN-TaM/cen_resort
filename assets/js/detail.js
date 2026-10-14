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

// 즐겨찾기는 assets/js/favorites.js 로 옮겼다 (사람별 · 휴양소 id 별, 서버 저장)

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

// 휴양소 정보 전체보기 — 소개 · 기본 정보 표 · 편의시설 칩 · 주변 관광지 · 이용 수칙 (있는 것만)
function resortInfoHtml(r) {
  const parts = [];
  if (r.facilityName || r.summary) {
    parts.push(`<div class="ri-intro">${r.facilityName ? `<div class="ri-name">${escapeHtml(r.facilityName)}</div>` : ''}${r.summary ? `<div class="ri-sum">${escapeHtml(r.summary)}</div>` : ''}</div>`);
  }
  const rows = [];
  if (r.address) rows.push(['주소', escapeHtml(r.address)]);
  if (r.roomType) rows.push(['객실', escapeHtml(r.roomType)]);
  if (typeof capacityText === 'function' && capacityText(r)) rows.push(['인원', escapeHtml(capacityText(r))]);
  (r.details || []).forEach(d => rows.push([escapeHtml(d.label), escapeHtml(d.value)]));
  if (r.phone) rows.push(['문의처', `<a href="tel:${escapeHtml(r.phone.replace(/[^0-9+]/g, ''))}">${escapeHtml(r.phone)}</a>`]);
  if (r.website) rows.push(['홈페이지', `<a href="${escapeHtml(r.website)}" target="_blank" rel="noopener">${escapeHtml(r.website.replace(/^https?:\/\//, ''))}</a>`]);
  if (rows.length) {
    parts.push(`<div class="ri-sec"><div class="ri-title">기본 정보</div><dl class="ri-table">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`);
  }
  if (r.features && Object.keys(r.features).length) {
    parts.push(`<div class="ri-sec"><div class="ri-title">편의시설</div>${featureSectionsHtml(r.features)}</div>`);
  }
  if (r.nearby && r.nearby.length) {
    parts.push(`<div class="ri-sec"><div class="ri-title">주변 관광지</div><div class="ri-chips">${r.nearby.map(n => `<span>${escapeHtml(n)}</span>`).join('')}</div></div>`);
  }
  if (r.notices && r.notices.length) {
    parts.push(`<div class="ri-sec"><div class="ri-title">이용 수칙</div><ul class="ri-notices">${r.notices.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`);
  }
  return parts.join('') || '<div class="tip-empty">등록된 정보가 없어요.</div>';
}

function openFeatureModal() {
  const r = resolveResort(currentResortName);
  const out = document.getElementById('feature-modal-body');
  if (out) out.innerHTML = r ? resortInfoHtml(r) : '<div class="tip-empty">등록된 정보가 없어요.</div>';
  const m = document.getElementById('feature-modal');
  if (m) m.classList.add('show');
}

// ===== 길찾기 =====
// 휴양소 주소를 카카오맵 · 네이버 지도 검색으로 연다. 폰에 앱이 있으면 앱으로, 없으면 웹 지도로 열린다.
const NAV_URL = {
  kakao: q => 'https://map.kakao.com/link/search/' + encodeURIComponent(q),
  naver: q => 'https://map.naver.com/p/search/' + encodeURIComponent(q),
};
function navAddress() {
  const r = resolveResort(currentResortName);
  return r && r.address ? r.address : '';
}
function openNavSheet() {
  const addr = navAddress();
  if (!addr) return;
  const el = document.getElementById('nav-addr');
  if (el) el.textContent = addr;
  const m = document.getElementById('nav-modal');
  if (m) m.classList.add('show');
}
function closeNavSheet(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  const m = document.getElementById('nav-modal');
  if (m) m.classList.remove('show');
}
function openNavApp(kind) {
  const addr = navAddress();
  if (!addr || !NAV_URL[kind]) return;
  window.open(NAV_URL[kind](addr), '_blank', 'noopener');
  closeNavSheet();
}
async function copyNavAddress() {
  const addr = navAddress();
  if (!addr) return;
  try {
    await navigator.clipboard.writeText(addr);
    if (typeof showToast === 'function') showToast('주소를 복사했어요');
  } catch (e) {
    if (typeof showToast === 'function') showToast('복사하지 못했어요. 주소를 길게 눌러 복사해 주세요');
  }
}

function closeFeatureModal(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  const m = document.getElementById('feature-modal');
  if (m) m.classList.remove('show');
}
