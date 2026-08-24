// 스크롤 안내 툴팁
// ===== 스크롤 안내 툴팁 =====
function showScrollTooltip() {
  const el = document.getElementById('scroll-tooltip');
  if (!el) return;
  // 이미 보이는 중이면 타이머만 리셋
  clearTimeout(el._hideTimer);
  el.classList.add('show');
  el._hideTimer = setTimeout(() => hideScrollTooltip(), 3500);
}
function hideScrollTooltip() {
  const el = document.getElementById('scroll-tooltip');
  if (!el) return;
  el.classList.remove('show');
}
