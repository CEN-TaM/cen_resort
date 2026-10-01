// 데스크톱 가로 스크롤(마우스 휠 변환)
// 데스크톱: 가로 스크롤 영역 위에서 마우스 휠(세로)을 가로 스크롤로 변환
const HSCROLL_SELECTOR = '.region-chips, .filter-row, .notice-cats, .hcards, .swipe-row';
(function enableHorizontalWheelScroll() {
  document.addEventListener('wheel', (e) => {
    const row = e.target.closest(HSCROLL_SELECTOR);
    if (!row) return;
    if (row.scrollWidth <= row.clientWidth) return; // 넘칠 내용이 없으면 무시
    // 이미 가로 휠(트랙패드 등)이면 브라우저 기본 동작에 맡김
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    row.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
})();

// 데스크톱: 마우스로 클릭한 채 드래그하면 가로 스크롤
(function enableDragToScroll() {
  let row = null, startX = 0, startScroll = 0, dragged = false;
  const DRAG_THRESHOLD = 5; // 이 이상 움직여야 드래그로 간주(클릭과 구분)

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // 좌클릭만
    const target = e.target.closest(HSCROLL_SELECTOR);
    if (!target || target.scrollWidth <= target.clientWidth) return;
    row = target;
    startX = e.clientX;
    startScroll = row.scrollLeft;
    dragged = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (!row) return;
    const dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) < DRAG_THRESHOLD) return;
    dragged = true;
    row.style.cursor = 'grabbing';
    row.scrollLeft = startScroll - dx;
    e.preventDefault();
  });

  document.addEventListener('mouseup', () => {
    if (row) row.style.cursor = '';
    // 드래그 직후의 클릭(칩/카드 클릭) 한 번 무시
    if (dragged) {
      const blocker = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener('click', blocker, { capture: true, once: true });
    }
    row = null;
  });
})();
