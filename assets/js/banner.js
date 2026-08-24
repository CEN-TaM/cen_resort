// 배너 슬라이드 (무한 루프)
// ===== 배너 슬라이드 기능 (무한 루프 지원) =====
(function initBannerLoop() {
  const carousel = document.getElementById('eventCarousel');
  if (!carousel) return;
  const slides = carousel.querySelector('.banner-slides');
  const dots = carousel.querySelectorAll('.banner-dot');
  const items = Array.from(slides.querySelectorAll('.event-banner'));
  const slideCount = items.length;
  if (slideCount === 0) return;

  // 클론을 만들어 앞뒤에 붙여 무한 루프 효과 구현
  const firstClone = items[0].cloneNode(true);
  const lastClone = items[items.length - 1].cloneNode(true);
  slides.appendChild(firstClone);
  slides.insertBefore(lastClone, slides.firstChild);

  let posIndex = 1; // position in DOM including clones (starts at 1)
  const total = slideCount + 2; // including two clones

  function updateDots() {
    const logical = (posIndex - 1 + slideCount) % slideCount;
    dots.forEach((d, i) => d.classList.toggle('active', i === logical));
  }

  let snapTimer = null;
  function setPosition(idx, animate = true) {
    slides.style.transition = animate ? 'transform 0.3s ease' : 'none';
    slides.style.transform = `translateX(-${idx * 100}%)`;
    slides.dataset.pos = idx;
    posIndex = idx;
  }

  // 클론 위치(0=마지막 클론, total-1=첫 클론)면 애니메이션 없이 실제 위치로 정렬
  function snapIfClone() {
    if (posIndex <= 0) setPosition(slideCount, false);
    else if (posIndex >= total - 1) setPosition(1, false);
  }
  // transitionend 누락 대비 타이머 안전장치
  function scheduleSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(snapIfClone, 360);
  }

  function moveBanner(delta) {
    snapIfClone();            // 이동 전 클론이면 먼저 실제 위치로 (빈 배너로 밀려나는 것 방지)
    void slides.offsetWidth;  // reflow: 무애니 점프를 즉시 반영
    setPosition(posIndex + delta, true);
    updateDots();
    scheduleSnap();
  }
  function goToBannerSlide(idx) {
    snapIfClone();
    void slides.offsetWidth;
    setPosition(((idx % slideCount) + slideCount) % slideCount + 1, true);
    updateDots();
    scheduleSnap();
  }
  function nextBannerSlide() { moveBanner(1); }
  function prevBannerSlide() { moveBanner(-1); }

  // 초기 위치: 첫 번째 실제 슬라이드
  setPosition(posIndex, false);
  updateDots();

  // 자동슬라이드 (숨겨져 있으면 건너뜀)
  function autoTick() {
    if (carousel.offsetParent === null) return; // display:none 이면 정지
    nextBannerSlide();
  }
  let bannerAuto = setInterval(autoTick, 5000);

  // 트랜지션 완료 즉시 클론 → 실제 스냅 (transform 전환만 대상)
  slides.addEventListener('transitionend', (e) => {
    if (e.target !== slides || e.propertyName !== 'transform') return;
    snapIfClone();
  });

  // 터치/스와이프 처리
  let startX = 0, deltaX = 0, isDragging = false;
  const threshold = 50;

  function onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;
    clearInterval(bannerAuto);
    isDragging = true;
    startX = e.touches[0].clientX;
    slides.style.transition = 'none';
    deltaX = 0;
  }

  function onTouchMove(e) {
    if (!isDragging || !e.touches || e.touches.length === 0) return;
    const cx = e.touches[0].clientX;
    deltaX = cx - startX;
    slides.style.transform = `translateX(calc(-${posIndex * 100}% + ${deltaX}px))`;
  }

  function onTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    slides.style.transition = 'transform 0.3s ease';
    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0) nextBannerSlide();
      else prevBannerSlide();
    } else {
      setPosition(posIndex, true);
    }
    deltaX = 0;
    bannerAuto = setInterval(autoTick, 5000);
  }

  slides.addEventListener('touchstart', onTouchStart, { passive: true });
  slides.addEventListener('touchmove', onTouchMove, { passive: true });
  slides.addEventListener('touchend', onTouchEnd);

  // 외부에서 사용되는 전역 함수 노출
  window.goToBannerSlide = goToBannerSlide;
  window.nextBannerSlide = nextBannerSlide;
})();
