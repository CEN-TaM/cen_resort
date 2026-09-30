// 글자 크기 설정
//
// CSS 가 px 로 고정돼 있어 폰트 크기만 바꾸면 일부 글자만 커진다.
// 그래서 화면(.screen) 단위 배율(zoom)로 키운다 — 글자·여백·아이콘이 함께 커져
// 모바일 OS 의 글자 크기 설정과 비슷하게 동작한다.
const FONT_SIZE_KEY = 'cen_font_scale';
const FONT_SIZES = [
  { id: 'small', label: '작게', scale: 0.9 },
  { id: 'normal', label: '보통', scale: 1 },
  { id: 'large', label: '크게', scale: 1.1 },
  { id: 'xlarge', label: '아주 크게', scale: 1.2 },
];

function getFontSizeId() {
  let saved = null;
  try { saved = localStorage.getItem(FONT_SIZE_KEY); } catch (e) { /* 저장소 차단 환경 */ }
  return FONT_SIZES.some(f => f.id === saved) ? saved : 'normal';
}

function renderFontSizeOptions() {
  const out = document.getElementById('fs-options');
  if (!out) return;
  const cur = getFontSizeId();
  out.innerHTML = FONT_SIZES.map(f => `
    <button type="button" class="fs-option${f.id === cur ? ' active' : ''}"
      onclick="setFontSize('${f.id}')" aria-pressed="${f.id === cur}">
      <span class="fs-sample" style="font-size:${Math.round(16 * f.scale)}px">가</span>
      <span class="fs-label">${f.label}</span>
      <span class="fs-check"><i class="ms">check</i></span>
    </button>`).join('');
}

function applyFontSize(id) {
  const f = FONT_SIZES.find(x => x.id === id) || FONT_SIZES[1];
  const device = document.getElementById('device1');
  if (device) device.style.setProperty('--ui-scale', f.scale);
  const cur = document.getElementById('font-size-current');
  if (cur) cur.textContent = f.label;          // 나의 페이지 메뉴의 현재 값
  renderFontSizeOptions();
}

function setFontSize(id) {
  try { localStorage.setItem(FONT_SIZE_KEY, id); } catch (e) { /* 저장 못 해도 이번 세션엔 적용된다 */ }
  applyFontSize(id);
}

// 저장해 둔 크기로 시작한다
applyFontSize(getFontSizeId());
