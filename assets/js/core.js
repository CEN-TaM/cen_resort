// 아이콘 변환 적용 · 화면 전환
function tiToMs(el) {
  const tiClass = Array.from(el.classList).find(c => c.startsWith('ti-'));
  if (!tiClass || !TI_TO_MS[tiClass]) return;
  const other = Array.from(el.classList).filter(c => c !== 'ti' && !c.startsWith('ti-'));
  const OUTLINE_DEFAULT = new Set(['ti-star', 'ti-heart', 'ti-message-circle', 'ti-bell', 'ti-bookmark', 'ti-bulb']);
  const outline = tiClass.endsWith('-filled') ? false : OUTLINE_DEFAULT.has(tiClass);
  el.className = ['ms', ...other, outline ? 'outline' : ''].filter(Boolean).join(' ');
  el.textContent = TI_TO_MS[tiClass];
}
document.querySelectorAll('i.ti, span.ti').forEach(tiToMs);

// 화면별 스크롤 위치 저장소 (뒤로가기 시 보던 위치 복원용)
const scrollPos = {};
function saveScreenScroll(screenEl) {
  if (!screenEl) return;
  const name = screenEl.getAttribute('data-screen');
  const sb = screenEl.querySelector('.scroll-body');
  scrollPos[name] = { top: screenEl.scrollTop || 0, body: sb ? sb.scrollTop : 0 };
}
function showScreen(deviceId, screenName, opts) {
  const device = document.getElementById(deviceId);
  // 떠나는 화면의 스크롤 위치 저장
  saveScreenScroll(device.querySelector('.screen.active'));
  const screens = device.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));
  const target = device.querySelector(`[data-screen="${screenName}"]`);
  if (target) {
    target.classList.add('active');
    const sh = target.querySelector('.sticky-header');
    const sb = target.querySelector('.scroll-body');
    const saved = scrollPos[screenName];
    if (saved && !(opts && opts.reset)) {
      // 뒤로가기 등 재진입: 보던 위치 복원
      const apply = () => { target.scrollTop = saved.top; if (sb) sb.scrollTop = saved.body; };
      apply();
      requestAnimationFrame(apply); // 레이아웃 이후 한 번 더 (안전)
      if (sh) sh.classList.toggle('scrolled', (saved.top || saved.body) > 4);
    } else {
      // 새로 여는 화면: 맨 위로
      target.scrollTop = 0;
      if (sh) sh.classList.remove('scrolled');
      if (sb) sb.scrollTop = 0;
    }
  }
  // '내가 쓴 리뷰' 진입 시 서버에서 내 후기 로드
  if (screenName === 'my-reviews' && typeof loadMyReviews === 'function') loadMyReviews();
  // 나의페이지 진입 시 리뷰 개수 갱신
  if (screenName === 'my' && typeof updateMyReviewsCount === 'function') updateMyReviewsCount();
}
