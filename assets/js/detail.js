// 상세 화면 탭 · 즐겨찾기(찜)
// ===== 상세 화면 탭 (리뷰 / 꿀팁 / Q&A) =====
function showDetailTab(trigger, name) {
  const navParent = trigger.parentElement;
  navParent.querySelectorAll('.tnav').forEach(t => t.classList.remove('active'));
  trigger.classList.add('active');
  const detail = trigger.closest('[data-screen="detail"]');
  detail.querySelectorAll('.dtab-pane').forEach(p => p.classList.remove('active'));
  const target = detail.querySelector(`.dtab-pane[data-dtab="${name}"]`);
  if (target) target.classList.add('active');
  const screen = trigger.closest('.screen');
  if (screen) screen.scrollTop = 0;
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
