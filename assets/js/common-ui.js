// 전역 토스트 · 공유하기 · 즐겨찾기 정렬
// ===== 전역 토스트 =====
function showToast(msg) {
  const toast = document.getElementById('app-toast');
  const msgEl = document.getElementById('app-toast-msg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== 공유하기 (레이어팝업 시트) =====
function openShareSheet() {
  const m = document.getElementById('share-modal');
  if (m) m.classList.add('show');
}
function closeShareSheet(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  document.getElementById('share-modal').classList.remove('show');
}
function shareVia(type) {
  if (type === 'link') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(location.href)
        .then(() => showToast('링크가 복사되었습니다'))
        .catch(() => showToast('링크 복사에 실패했습니다'));
    } else {
      showToast('링크가 복사되었습니다');
    }
  } else {
    const label = { kakao: '카카오톡', sms: 'SMS', insta: '인스타그램' }[type] || '';
    showToast(label + '(으)로 공유합니다');
  }
  closeShareSheet();
}

// ===== 즐겨찾기 정렬 =====
const FAV_SORT_LABEL = { default: '기본순', name: '이름순', rating: '평점 높은순', region: '지역순' };
let currentFavSort = 'default';

// 최초 추가 순서 기억
(function stampFavOrder() {
  const grid = document.getElementById('fav-grid');
  if (!grid) return;
  Array.from(grid.querySelectorAll('.fav-card')).forEach((c, i) => { c.dataset.idx = i; });
})();

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
  const grid = document.getElementById('fav-grid');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.fav-card'));
  const getName = c => { const e = c.querySelector('.fname'); return e ? e.textContent.trim() : ''; };
  const getMeta = c => { const e = c.querySelector('.fmeta'); return e ? e.textContent : ''; };
  const getRating = c => { const m = getMeta(c).match(/[\d.]+/); return m ? parseFloat(m[0]) : 0; };
  const getRegion = c => { const p = getMeta(c).split('·'); return p.length > 1 ? p[p.length - 1].trim() : ''; };
  const getIdx = c => parseInt(c.dataset.idx || '0', 10);
  if (mode === 'name') cards.sort((a, b) => getName(a).localeCompare(getName(b), 'ko'));
  else if (mode === 'rating') cards.sort((a, b) => getRating(b) - getRating(a));
  else if (mode === 'region') cards.sort((a, b) => getRegion(a).localeCompare(getRegion(b), 'ko'));
  else cards.sort((a, b) => getIdx(a) - getIdx(b));
  cards.forEach(c => grid.appendChild(c));
  currentFavSort = mode;
  closeFavSort();
  if (typeof showToast === 'function') showToast('정렬: ' + (FAV_SORT_LABEL[mode] || ''));
}
