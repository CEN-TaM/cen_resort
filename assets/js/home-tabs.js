// 홈 메인 탭 · 하계/동계 전환 · 실시간 후기 정렬
// ===== 홈 메인 탭 (정기 / 이벤트 / 인기) =====
function switchMainTab(el, idx) {
  el.parentElement.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const screen = el.closest('.screen');
  if (!screen) return;
  screen.querySelectorAll('.mtab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.getAttribute('data-mtab-pane') === String(idx));
  });
  // 지역/카테고리 칩은 홈 탭에서만 표시
  const chips = screen.querySelector('.region-chips');
  if (chips) chips.style.display = (idx === 0) ? '' : 'none';
  // 탭 전환 시 스크롤 맨 위로
  const sb = screen.querySelector('.scroll-body');
  if (sb) sb.scrollTop = 0;
  // 홈으로 돌아오면 배너 위치를 정상 슬라이드로 초기화 (빈 배너 방지)
  if (idx === 0 && typeof window.goToBannerSlide === 'function') {
    window.goToBannerSlide(0);
  }
}

// 칩에서 메인 탭으로 이동 (해당 탭 클릭을 트리거)
function goMainTab(idx) {
  const tabs = document.querySelectorAll('.screen[data-screen="home"] .main-tab .mtab');
  if (tabs[idx]) tabs[idx].click();
}

// ===== 이벤트 휴양소 하계/동계 전환 =====
function selectEventSeg(btn, group) {
  const pane = btn.closest('.mtab-pane');
  if (!pane) return;
  pane.querySelectorAll('.event-seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  pane.querySelectorAll('.event-group').forEach(g => {
    g.classList.toggle('active', g.dataset.group === group);
  });
}

// ===== 실시간 후기 정렬 =====
function toggleReviewSort(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('review-sort-menu');
  if (menu) menu.classList.toggle('open');
}
function sortReviews(mode) {
  // 홈 후기를 그 기준으로 다시 골라 그린다 (review-server.js loadHomeReviews)
  homeReviewSort = mode === 'likes' ? 'likes' : 'recent';
  if (typeof loadHomeReviews === 'function') loadHomeReviews();
  const labels = { recent: '최신순', likes: '좋아요순' };
  const lbl = document.getElementById('review-sort-label');
  if (lbl) lbl.textContent = (labels[mode] || '최신순') + ' ▾';
  document.querySelectorAll('#review-sort-menu .sort-menu-item').forEach(it => {
    it.classList.toggle('active', (it.getAttribute('onclick') || '').indexOf("'" + mode + "'") !== -1);
  });
  const menu = document.getElementById('review-sort-menu');
  if (menu) menu.classList.remove('open');
}
// 바깥 클릭 시 정렬 메뉴 닫기
document.addEventListener('click', (e) => {
  const box = document.getElementById('review-sort');
  const menu = document.getElementById('review-sort-menu');
  if (menu && menu.classList.contains('open') && box && !box.contains(e.target)) {
    menu.classList.remove('open');
  }
});
