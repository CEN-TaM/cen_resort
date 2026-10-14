// 휴양소 데이터 창구 — 휴양소를 보여주는 화면은 모두 여기서 받은 데이터로 그린다.
//   서버가 있으면 GET /api/resorts (DB resorts 테이블, 평점·후기 수는 실제 후기로 계산)
//   서버가 없으면(GitHub Pages) data/resorts.js 의 RESORT_SEED + 샘플 후기로 계산한 평점
// 그리는 곳: 홈 인기 휴양소 · 인기 휴양소 화면 · 휴양소 탭(정기/하계/동계) · 지도 마커 · 후기 작성 선택지
// 검색(search-notify.js)과 상세(tips.js openResort)는 RESORT / resolveResort 로 같은 데이터를 본다.
// 휴양소를 추가·수정하려면 DB 만 바꾸면 된다 — 화면 코드나 index.html 은 손대지 않는다.
//
// index.html 의 맨 마지막 스크립트로 둔다 (그려 넣을 때 다른 파일의 함수 — applyBg, syncFavoriteUI,
// renderSeniMap 등 — 이 모두 준비돼 있어야 한다).

const TYPE_ORDER = ['regular', 'summer', 'winter'];

// 샘플 후기로 평점·후기 수 계산 (서버가 없을 때). 상세 화면이 보여주는 샘플과 같은 기준이다:
// 그 휴양소 전용 샘플이 있으면 그것, 없으면 공용 샘플(REVIEW_SEED_GENERIC)
function sampleStats(r) {
  const names = [r.name, ...(r.aliases || [])];
  let rows = (typeof REVIEW_SEED !== 'undefined' ? REVIEW_SEED : []).filter(x => names.includes(x.resortName));
  if (!rows.length && typeof REVIEW_SEED_GENERIC !== 'undefined') rows = REVIEW_SEED_GENERIC;
  const rated = rows.map(x => x.ratings && x.ratings.avg).filter(v => v != null && !isNaN(v)).map(Number);
  return {
    rating: rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length * 10) / 10 : null,
    reviews: rows.length,
  };
}

const ResortAPI = {
  list: [],          // 화면 순서대로 정렬된 휴양소 (정식명 기준 1곳 1줄)
  source: null,      // 'server' | 'sample'
  _loading: null,

  load() {
    if (!this._loading) this._loading = this._load();
    return this._loading;
  },
  async _load() {
    let rows = null;
    if (await hasReviewServer()) {
      try {
        rows = (await apiFetch('/api/resorts')).resorts;
        this.source = 'server';
      } catch (e) {
        console.error('휴양소 목록 로드 실패 — 기본 데이터로 표시합니다:', e);
      }
    }
    if (!rows) {
      rows = RESORT_SEED.map(r => Object.assign({}, r, sampleStats(r)));
      this.source = 'sample';
    }
    this.list = rows.slice().sort((a, b) =>
      (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) || ((a.sort || 0) - (b.sort || 0)));

    // 이름 · 옛 표기 → 휴양소 (검색·상세·지도가 resolveResort 로 찾는다)
    Object.keys(RESORT).forEach(k => delete RESORT[k]);
    this.list.forEach(r => {
      RESORT[r.name] = r;
      RESORT[r.id] = r;   // 즐겨찾기 화면은 id 로 연다
      (r.aliases || []).forEach(a => { if (!RESORT[a]) RESORT[a] = r; });
    });
    return this.list;
  },

  byType(type) { return this.list.filter(r => r.type === type); },

  // 인기 = 후기 많은 순, 같으면 평점 높은 순
  popular(n) {
    return this.list.slice()
      .sort((a, b) => (b.reviews - a.reviews) || ((b.rating || 0) - (a.rating || 0)))
      .slice(0, n);
  },
};

// ===== 카드 =====
// 즐겨찾기 별 — 꺼짐/켜짐 이미지 두 장을 넣고 .favorited 로 하나만 보인다 (favorite.css)
const FAV_ICONS = '<img class="fav-ico fav-ico-off" src="assets/images/ico_star.png" alt=""><img class="fav-ico fav-ico-on" src="assets/images/ico_star_on.png" alt="">';
function ratingText(r) { return r.rating == null ? '-' : Number(r.rating).toFixed(1); }

// 휴양소 종류 표시 — 정기·이벤트가 섞여 나오는 곳(검색 결과 · 인기 휴양소)에서 사진 왼쪽 위에 붙인다
const TYPE_LABEL = { regular: '정기', summer: '하계 이벤트', winter: '동계 이벤트' };
function typeBadgeHtml(r) {
  const label = TYPE_LABEL[r.type];
  return label ? `<span class="type-badge t-${r.type}">${label}</span>` : '';
}

// 목록형 카드 (홈 인기 · 휴양소 탭 · 검색 결과)
// 즐겨찾기 키는 휴양소 id (favorites.js)
// opts.showType: 종류 표시 (휴양소 탭은 탭이 이미 종류라 끈다)
function resortCardHtml(r, opts) {
  const img = escapeHtml(r.img || '');
  const fid = escapeHtml(r.id);
  const badge = opts && opts.showType ? typeBadgeHtml(r) : '';
  return `
    <div class="place-card" onclick="openResortEl(this)">
      <div class="thumb" data-img="${img}" data-photo="${escapeHtml(resortPhotoUrl(r))}">${badge}</div>
      <div class="info">
        <div class="name-row">
          <span class="name">${escapeHtml(r.name)}</span>
          <button type="button" class="fav-btn inline" data-fav="${fid}" onclick="toggleFavorite(event,'${fid}')" aria-label="즐겨찾기">${FAV_ICONS}</button>
        </div>
        <div class="meta">평점 ${ratingText(r)} <span class="sep">|</span> 후기 ${r.reviews || 0}</div>
      </div>
    </div>`;
}

// 인기 휴양소 화면 카드 (별이 사진 위에 뜨는 모양)
function popularCardHtml(r) {
  const img = escapeHtml(r.img || '');
  const fid = escapeHtml(r.id);
  return `
    <div class="place-card" onclick="openResortEl(this)">
      <div class="fav-btn absolute" data-fav="${fid}" onclick="toggleFavorite(event,'${fid}')" aria-label="즐겨찾기">${FAV_ICONS}</div>
      <div class="thumb" data-img="${img}" data-photo="${escapeHtml(resortPhotoUrl(r))}">${typeBadgeHtml(r)}</div>
      <div class="info">
        <div class="name">${escapeHtml(r.name)}</div>
        <div class="meta"><span style="color:var(--rating)">★</span> ${ratingText(r)} · 후기 ${r.reviews || 0}</div>
      </div>
    </div>`;
}

// 그려 넣은 카드에 사진 · 즐겨찾기 별 상태를 입힌다
function hydrateResortCards(root) {
  if (!root) return;
  root.querySelectorAll('.thumb[data-img]').forEach(paintThumb);
  new Set(Array.from(root.querySelectorAll('[data-fav]'), el => el.dataset.fav)).forEach(syncFavoriteUI);
}

function fillList(id, resorts, cardFn) {
  const box = document.getElementById(id);
  if (!box) return;
  box.innerHTML = resorts.length
    ? resorts.map(cardFn || resortCardHtml).join('')
    : '<div class="empty" style="padding:20px;color:var(--text-3)">등록된 휴양소가 없어요.</div>';
  hydrateResortCards(box);
}

// ===== 화면별 그리기 =====
function renderResortScreens() {
  // 휴양소 탭
  fillList('resort-list-regular', ResortAPI.byType('regular'));
  fillList('resort-list-summer', ResortAPI.byType('summer'));
  fillList('resort-list-winter', ResortAPI.byType('winter'));

  // 'N곳' · 하계/동계 숫자 — data-resort-count="regular|event|summer|winter"
  const count = {
    regular: ResortAPI.byType('regular').length,
    summer: ResortAPI.byType('summer').length,
    winter: ResortAPI.byType('winter').length,
  };
  count.event = count.summer + count.winter;
  count.all = count.regular + count.event;
  document.querySelectorAll('[data-resort-count]').forEach(el => {
    const n = count[el.dataset.resortCount] || 0;
    el.textContent = el.tagName === 'B' ? `${n}곳` : String(n);   // <b> 는 'N곳', 나머지는 숫자만
  });

  // 홈 인기 휴양소 · 인기 휴양소 화면 (같은 5곳)
  const top = ResortAPI.popular(5);
  fillList('home-popular', top, r => resortCardHtml(r, { showType: true }));
  fillList('popular-list', top, popularCardHtml);
  const popCount = document.getElementById('popular-count');
  if (popCount) popCount.textContent = `${top.length}곳`;
}

// 지도 마커 — map.label 이 같은 휴양소끼리 한 마커로 묶는다
function buildMapMarkers() {
  const SUFFIX = { summer: ' 하계 휴양소', winter: ' 동계 휴양소' };
  const byLabel = new Map();
  ResortAPI.list.forEach(r => {
    if (!r.map || !r.map.label) return;
    if (!byLabel.has(r.map.label)) byLabel.set(r.map.label, { label: r.map.label, mx: r.map.x, my: r.map.y, places: [], types: new Set() });
    const m = byLabel.get(r.map.label);
    m.places.push(r.name + (SUFFIX[r.type] || ''));
    m.types.add(r.type);
  });
  SENI_MARKERS.length = 0;
  byLabel.forEach(m => {
    const t = m.types;
    // 하계+동계를 함께 하는 곳은 'both' (두 필터 모두에서 보인다)
    const type = t.size === 1 ? (t.has('regular') ? 'basic' : [...t][0])
      : (t.has('summer') && t.has('winter') && !t.has('regular')) ? 'both' : 'basic';
    SENI_MARKERS.push({ type, label: m.label, mx: m.mx, my: m.my, places: m.places });
  });
  if (typeof renderSeniMap === 'function') renderSeniMap();
}

// 후기 작성 — 휴양소 구분별 선택지
function fillReviewResortOptions() {
  TYPE_ORDER.forEach(t => { REVIEW_RESORTS[t] = ResortAPI.byType(t).map(r => r.name); });
  const btn = document.querySelector('.resort-type-seg .rts-btn.active');
  if (btn && typeof selectReviewType === 'function') {
    const m = /selectReviewType\(this,\s*'(\w+)'\)/.exec(btn.getAttribute('onclick') || '');
    selectReviewType(btn, m ? m[1] : 'regular');
  }
}

ResortAPI.load().then(() => {
  renderResortScreens();
  buildMapMarkers();
  fillReviewResortOptions();
  if (typeof renderFavoriteList === 'function') renderFavoriteList();
});
