// 즐겨찾기 — 사람별 · 휴양소 id 별
//
// 서버가 있으면 DB favorites 테이블 (GET /api/favorites, PUT /api/favorites/:resortId)
// 서버가 없으면(시연) 이 브라우저에 사번별로 저장한다.
// 별 버튼은 data-fav="휴양소 id" 를 단다 (resort-data.js 카드 · 상세 헤더). 같은 id 의 별은 모두 같이 켜지고 꺼진다.
// 즐겨찾기 화면(#fav-grid)은 휴양소 데이터(ResortAPI)로 그린다.

const favoriteState = {};   // 휴양소 id → 추가한 시각(ISO). 없으면 즐겨찾기 아님

function favLocalKey() {
  const p = getProfile() || {};
  return 'centam_favorites:' + (p.empno || 'guest');
}
function setFavoriteList(list) {
  Object.keys(favoriteState).forEach(k => delete favoriteState[k]);
  (list || []).forEach(f => { favoriteState[f.resortId] = f.createdAt; });
}
function saveLocalFavorites() {
  try {
    const list = Object.entries(favoriteState).map(([resortId, createdAt]) => ({ resortId, createdAt }));
    localStorage.setItem(favLocalKey(), JSON.stringify(list));
  } catch (e) { /* 저장 못 해도 이번 화면에서는 보인다 */ }
}

// 로그인 직후 · 첫 진입 시 내 즐겨찾기를 불러와 별과 즐겨찾기 화면에 반영한다
async function loadFavorites() {
  let list = [];
  if (getProfile()) {
    if (await authMode() === 'server') {
      try { list = (await apiFetch('/api/favorites')).favorites; } catch (e) { list = []; }
    } else {
      try { list = JSON.parse(localStorage.getItem(favLocalKey()) || '[]'); } catch (e) { list = []; }
    }
  }
  setFavoriteList(list);
  syncAllFavorites();
  renderFavoriteList();
}

async function toggleFavorite(event, id) {
  if (event) event.stopPropagation();
  if (!id) return;   // 상세 별 버튼은 openResort() 가 data-fav 를 채우기 전엔 비어 있다
  if (!getProfile()) { if (typeof showToast === 'function') showToast('로그인 후 즐겨찾기할 수 있어요'); return; }
  const on = !favoriteState[id];
  const before = favoriteState[id];
  // 누르는 즉시 바꾸고(기다리지 않게), 실패하면 되돌린다
  if (on) favoriteState[id] = new Date().toISOString(); else delete favoriteState[id];
  syncFavoriteUI(id);
  renderFavoriteList();
  try {
    if (await authMode() === 'server') {
      const res = await apiFetch('/api/favorites/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ on }) });
      setFavoriteList(res.favorites);
    } else {
      saveLocalFavorites();
    }
    if (typeof showToast === 'function') showToast(on ? '즐겨찾기에 추가되었습니다' : '즐겨찾기에서 해제되었습니다');
  } catch (e) {
    if (before) favoriteState[id] = before; else delete favoriteState[id];
    if (typeof showToast === 'function') showToast('즐겨찾기를 저장하지 못했어요');
  }
  syncFavoriteUI(id);
  renderFavoriteList();
}

// 별 모양은 CSS 가 .favorited 로 바꾼다 (ico_star.png / ico_star_on.png)
function syncFavoriteUI(id) {
  const on = !!favoriteState[id];
  document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(el => {
    el.classList.toggle('favorited', on);
    el.setAttribute('aria-pressed', String(on));
  });
}
function syncAllFavorites() {
  new Set(Array.from(document.querySelectorAll('[data-fav]'), el => el.dataset.fav).filter(Boolean)).forEach(syncFavoriteUI);
}

// ===== 즐겨찾기 화면 =====
const FAV_SORT_LABEL = { default: '기본순', name: '이름순', rating: '평점 높은순', region: '지역순' };
let currentFavSort = 'default';

function favCardHtml(r) {
  const id = escapeHtml(r.id);
  const region = escapeHtml(String(r.loc || '').split(' ')[0]);
  return `
    <div class="fav-card" data-fav-card="${id}" onclick="openResort('${id}')">
      <div class="fav-btn absolute favorited" data-fav="${id}" onclick="toggleFavorite(event,'${id}')" aria-label="즐겨찾기">${FAV_ICONS}</div>
      <div class="fthumb" data-img="${escapeHtml(r.img || '')}" data-photo="${escapeHtml(resortPhotoUrl(r))}"></div>
      <div class="finfo">
        <div class="fname">${escapeHtml(r.name)}</div>
        <div class="fmeta">${r.rating == null ? '후기 없음' : '<span style="color:var(--rating)">★</span> ' + ratingText(r)}${region ? ' · ' + region : ''}</div>
      </div>
    </div>`;
}

async function renderFavoriteList() {
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  const countEl = document.getElementById('fav-count');
  if (!grid) return;
  await ResortAPI.load();
  const list = ResortAPI.list.filter(r => favoriteState[r.id]);
  const by = {
    default: (a, b) => String(favoriteState[a.id]).localeCompare(String(favoriteState[b.id])),
    name: (a, b) => a.name.localeCompare(b.name, 'ko'),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    region: (a, b) => String(a.loc || '').localeCompare(String(b.loc || ''), 'ko'),
  };
  list.sort(by[currentFavSort] || by.default);
  grid.innerHTML = list.map(favCardHtml).join('');
  grid.querySelectorAll('.fthumb[data-img]').forEach(paintThumb);
  if (countEl) countEl.textContent = list.length;
  if (empty) empty.style.display = list.length ? 'none' : 'block';
  grid.style.display = list.length ? '' : 'none';
}

function openFavSortSheet() {
  const m = document.getElementById('fav-sort-modal');
  if (!m) return;
  m.querySelectorAll('.sort-opt').forEach(b => b.classList.toggle('active', b.dataset.mode === currentFavSort));
  m.classList.add('show');
}
function closeFavSort(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  document.getElementById('fav-sort-modal').classList.remove('show');
}
function sortFav(mode) {
  currentFavSort = FAV_SORT_LABEL[mode] ? mode : 'default';
  renderFavoriteList();
  closeFavSort();
  if (typeof showToast === 'function') showToast('정렬: ' + FAV_SORT_LABEL[currentFavSort]);
}
