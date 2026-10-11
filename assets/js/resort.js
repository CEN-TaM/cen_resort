// 이미지 적용 · 휴양소 상세 동적 채우기
function setBg(el, url) {
  el.style.backgroundImage = `url("${url}")`;
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  el.style.backgroundRepeat = 'no-repeat';
}
document.querySelectorAll('[data-img]').forEach(el => {
  const cfg = IMG[el.getAttribute('data-img')];
  if (!cfg) return;
  const probe = new Image();
  probe.onload = () => setBg(el, cfg.local);
  probe.onerror = () => setBg(el, cfg.fallback);
  probe.src = cfg.local;
});


function applyBg(el, key) {
  const cfg = IMG[key];
  if (!cfg || !el) return;
  const probe = new Image();
  probe.onload = () => setBg(el, cfg.local);
  probe.onerror = () => setBg(el, cfg.fallback);
  probe.src = cfg.local;
}
function clampScore(v) { return Math.round(Math.max(0, Math.min(5, v)) * 10) / 10; }
// 별 5칸. 빈 별은 색을 따로 주려고 <span class="empty"> 로 감싼다
function starsHtml(r) {
  const full = Math.max(0, Math.min(5, Math.round(Number(r) || 0)));
  return '★'.repeat(full) + (full < 5 ? `<span class="empty">${'★'.repeat(5 - full)}</span>` : '');
}
// 값을 모르면(후기 없음) '-'
function setScoreItem(item, v) {
  if (!item) return;
  const bn = item.querySelector('.bn');
  if (bn) bn.textContent = (v == null || isNaN(v)) ? '-' : Number(v).toFixed(1);
}

// 꿀팁 카드 좌우 화살표 스크롤 (.tip-head 바로 다음의 .swipe-row 대상)
function scrollSwipe(btn, dir) {
  const head = btn.closest('.tip-head');
  const row = head ? head.nextElementSibling : null;
  if (!row || !row.classList.contains('swipe-row')) return;
  const first = row.querySelector(':scope > *');
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const step = first ? first.offsetWidth + gap : row.clientWidth * 0.85;
  row.scrollBy({ left: dir * step, behavior: 'smooth' });
}

// 처음·끝에서 화살표를 끈다 (.swipe-row 바로 앞의 .tip-head 안 화살표 2개)
function syncSwipeArrows(row) {
  const head = row && row.previousElementSibling;
  if (!head || !head.classList.contains('tip-head')) return;
  const [prev, next] = head.querySelectorAll('.tip-arrow');
  const max = row.scrollWidth - row.clientWidth;
  if (prev) prev.disabled = row.scrollLeft <= 2;
  if (next) next.disabled = row.scrollLeft >= max - 2;
}
