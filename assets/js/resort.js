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
function starStr(r) { const full = Math.round(r); return '★'.repeat(full) + '☆'.repeat(5 - full); }
function setScoreItem(item, v) {
  if (!item) return;
  const bn = item.querySelector('.bn'); if (bn) bn.textContent = v.toFixed(1);
  const bar = item.querySelector('.bbar > span'); if (bar) bar.style.width = Math.round(v / 5 * 100) + '%';
}

// 꿀팁 카드 좌우 화살표 스크롤 (.tip-head 바로 다음의 .swipe-row 대상)
function scrollSwipe(btn, dir) {
  const head = btn.closest('.tip-head');
  const row = head ? head.nextElementSibling : null;
  if (!row || !row.classList.contains('swipe-row')) return;
  const first = row.querySelector(':scope > *');
  const step = first ? first.offsetWidth + 12 : row.clientWidth * 0.85;
  row.scrollBy({ left: dir * step, behavior: 'smooth' });
}
