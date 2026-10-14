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

// 즐겨찾기 정렬은 assets/js/favorites.js (sortFav)

// ===== 홈 상단 햄버거 메뉴 (지도 · 알림) =====
function toggleHomeMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('homeMenu');
  if (m) m.classList.toggle('show');
}
function closeHomeMenu() {
  const m = document.getElementById('homeMenu');
  if (m) m.classList.remove('show');
}
// 바깥 클릭 시 닫기
document.addEventListener('click', function (e) {
  const inside = e.target.closest && e.target.closest('.top-menu-wrap');
  if (!inside) closeHomeMenu();
});

// ===== 휴양소 화면: 정기 / 이벤트 탭 전환 =====
function switchResortTab(el, idx) {
  const screen = document.querySelector('.screen[data-screen="resorts"]');
  if (!screen) return;
  screen.querySelectorAll('.main-tab .mtab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  screen.querySelectorAll('.mtab-pane').forEach(p => p.classList.remove('active'));
  const pane = screen.querySelector('.mtab-pane[data-mtab-pane="' + idx + '"]');
  if (pane) pane.classList.add('active');
  const content = screen.querySelector('.content');
  if (content) content.scrollTop = 0;
}

// 홈 배너 → 휴양소 탭의 이벤트 휴양소 (summer | winter)
function openEventResorts(group) {
  showScreen('device1', 'resorts');
  const screen = document.querySelector('.screen[data-screen="resorts"]');
  if (!screen) return;
  const tab = screen.querySelectorAll('.main-tab .mtab')[1];
  if (tab) switchResortTab(tab, 2);
  const seg = [...screen.querySelectorAll('.event-seg-btn')].find(b => (b.getAttribute('onclick') || '').includes(`'${group}'`));
  if (seg) selectEventSeg(seg, group);
}
