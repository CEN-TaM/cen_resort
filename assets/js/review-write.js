// 후기 작성 — 백엔드 연동 · 폼 · 사진 첨부
// ===== 후기 백엔드 연동 =====
// 서버에서 열면(''=같은 출처), 파일로 열면(file://) 개발서버(VPN)로 요청
const API_BASE = (location.protocol === 'file:') ? 'http://192.168.64.57:8999' : '';

// 작성 폼에서 값들을 모아 서버 전송용 객체로 만든다
function collectReviewForm() {
  const form = document.querySelector('#device1 [data-screen="write"]');
  if (!form) return null;

  // 1) 휴양소 구분 (active 버튼)
  const typeBtn = form.querySelector('.resort-type-seg .rts-btn.active');
  const typeMap = { '정기 휴양소': 'regular', '하계 휴양소': 'summer', '동계 휴양소': 'winter' };
  const resortType = typeBtn ? (typeMap[typeBtn.textContent.trim()] || 'regular') : 'regular';

  // 2) 휴양소 이름
  const resortName = (form.querySelector('#rv-resort-select')?.value || '').trim();

  // 3) 항목별 평점 (위치/시설/청결도 순서)
  const rateEls = form.querySelectorAll('.rate-row .rate-stars');
  const num = el => parseInt(el?.getAttribute('data-score') || '0', 10);
  const ratings = {
    location: num(rateEls[0]),
    facility: num(rateEls[1]),
    clean: num(rateEls[2]),
  };

  // 4) 동행 — 선택 칸을 없앴다. API 모양은 그대로 두려고 빈 배열을 보낸다
  const companions = [];

  // 5) 상세 후기
  const content = (form.querySelector('.textarea')?.value || '').trim();

  // 6) 사진 (photo-thumb 배경 dataURL 추출)
  const photos = Array.from(form.querySelectorAll('#photo-grid .photo-thumb'))
    .map(cell => {
      const m = /url\(["']?(data:[^"')]+)["']?\)/.exec(cell.style.backgroundImage || '');
      return m ? m[1] : null;
    }).filter(Boolean);

  // 7) 작성자 정보
  const p = (typeof getProfile === 'function' && getProfile()) || {};
  const authorName = (typeof composeDisplayName === 'function' && composeDisplayName(p)) || p.name || '';

  return { empno: p.empno || null, authorName, resortName, resortType, ratings, companions, content, photos };
}

let submittingReview = false;
async function submitReview(deviceId) {
  if (submittingReview) return;
  const data = collectReviewForm();
  if (!data) return;

  // 클라이언트 1차 검증
  if (!data.resortName) { if (typeof showToast === 'function') showToast('휴양소를 선택해주세요'); return; }
  if (data.photos.length < 1) { if (typeof showToast === 'function') showToast('사진을 최소 1장 첨부해주세요'); return; }

  submittingReview = true;
  const btn = document.querySelector('#device1 [data-screen="write"] .write-submit');
  const btnText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '등록 중...'; }

  try {
    const res = await fetch(API_BASE + '/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '등록 실패');

    // 방금 등록한 휴양소를 기억 → 상세 진입 시 최신 목록 반영
    lastSubmittedResort = data.resortName;
    // 등록 완료 모달 — 적립된 포인트는 서버가 알려준 값으로
    const gain = document.getElementById('point-gain');
    if (gain && typeof json.pointsAwarded === 'number') gain.textContent = '+' + json.pointsAwarded + 'P';
    const who = document.getElementById('point-modal-name');
    if (who && typeof composeDisplayName === 'function') who.textContent = composeDisplayName(getProfile());
    document.getElementById('modal-' + deviceId).classList.add('show');
    if (typeof refreshMyPoints === 'function') refreshMyPoints();
    // 폼 초기화
    resetReviewForm();
    // 홈 '실시간 후기' 즉시 갱신
    if (typeof loadHomeReviews === 'function') loadHomeReviews();
    // 나의페이지 후기 개수 갱신
    if (typeof updateMyReviewsCount === 'function') updateMyReviewsCount();
  } catch (err) {
    console.error('후기 등록 실패:', err);
    if (typeof showToast === 'function') showToast(err.message || '등록에 실패했어요. 잠시 후 다시 시도해주세요');
  } finally {
    submittingReview = false;
    if (btn) { btn.disabled = false; btn.textContent = btnText; }
  }
}

let lastSubmittedResort = null;
function resetReviewForm() {
  const form = document.querySelector('#device1 [data-screen="write"]');
  if (!form) return;
  const ta = form.querySelector('.textarea'); if (ta) ta.value = '';
  const grid = form.querySelector('#photo-grid');
  if (grid) grid.querySelectorAll('.photo-thumb').forEach(el => el.remove());
  if (typeof updatePhotoCount === 'function') updatePhotoCount();
}
function closeModal(deviceId) {
  document.getElementById('modal-' + deviceId).classList.remove('show');
  const r = writeFixedResort;
  if (!r) { showScreen(deviceId, 'home'); return; }
  // 휴양소 상세에서 왔으면 그 상세로 되돌아가(뒤로가기 기록에 작성 화면이 남지 않게) 후기 탭을 보여 준다
  applyWriteResortLock(null);
  if (navIdx > 0) { openReviewsTabNext = true; history.back(); }
  else openResort(r.name, 'reviews');
}
// closeModal → history.back() 으로 상세가 다시 열릴 때 후기 탭으로 (tips.js openResort 가 읽고 끈다)
let openReviewsTabNext = false;

// 후기 작성: 휴양소 구분 → 휴양소 선택 (2단계)
// 선택지는 휴양소 데이터에서 채운다 (resort-data.js fillReviewResortOptions)
const REVIEW_RESORTS = { regular: [], summer: [], winter: [] };
function selectReviewType(btn, type) {
  const seg = btn.parentElement;
  seg.querySelectorAll('.rts-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const sel = document.getElementById('rv-resort-select');
  if (!sel) return;
  sel.innerHTML = (REVIEW_RESORTS[type] || []).map(n => `<option value="${n}">${n}</option>`).join('');
}
// 초기: 정기 휴양소 목록 채우기
(function initReviewResortSelect() {
  const sel = document.getElementById('rv-resort-select');
  if (sel) sel.innerHTML = REVIEW_RESORTS.regular.map(n => `<option value="${n}">${n}</option>`).join('');
})();

// 휴양소 상세 후기 탭의 '후기 작성하기' — 보던 휴양소를 골라 둔 채 작성 화면을 연다
// 이렇게 들어오면 휴양소를 바꿀 수 없게 고정하고, 등록 뒤 그 휴양소 후기 탭으로 돌아간다.
// 하단 + 버튼으로 들어오면 고정을 푼다 (core.js showScreen 이 applyWriteResortLock(opts.fixedResort) 를 부른다)
let writeFixedResort = null;
function writeReviewForDetail() {
  const r = RESORT[window._detailResort];
  showScreen('device1', 'write', { fixedResort: r || null });
}
function applyWriteResortLock(r) {
  writeFixedResort = r || null;
  const fixed = document.getElementById('rv-fixed-resort');
  const pick = document.getElementById('rv-resort-pick');
  if (fixed) fixed.hidden = !r;
  if (pick) pick.hidden = !!r;
  if (!r) return;
  // 등록 값은 그대로 구분 버튼 · 선택칸에서 읽으므로(collectReviewForm) 둘 다 맞춰 둔다
  const btn = document.querySelector(`.resort-type-seg .rts-btn[onclick*="'${r.type}'"]`);
  if (btn) selectReviewType(btn, r.type);
  const sel = document.getElementById('rv-resort-select');
  if (sel) sel.value = r.name;
  const t = document.getElementById('rv-fixed-type');
  // 상세 제목 옆 배지와 같은 글자 (예: 정기휴양소 · 2026 하계 이벤트 휴양소)
  const dt = document.getElementById('detail-resort-type');
  if (t) t.textContent = (dt && dt.textContent.trim()) || ((TYPE_LABEL[r.type] || '') + ' 휴양소');
  const n = document.getElementById('rv-fixed-name');
  if (n) n.textContent = r.name;
}

// 동행 선택 칩 토글 (복수 선택)
function toggleChip(el) {
  el.classList.toggle('active');
}

// ===== 사진 첨부 =====
const PHOTO_MAX = 10;
// 서버(server/index.js decodePhoto)와 같은 규칙 — 다른 형식은 서버가 후기 전체를 거절하므로 고를 때 미리 걸러 준다
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
function addPhotos(input) {
  const grid = document.getElementById('photo-grid');
  const addCell = document.getElementById('photo-add');
  if (!grid || !addCell) return;
  const used = grid.querySelectorAll('.photo-thumb').length;
  let remaining = PHOTO_MAX - used;
  const picked = Array.from(input.files || []);
  const files = picked.filter(f => PHOTO_TYPES.includes(f.type) && f.size <= PHOTO_MAX_BYTES);
  if (files.length < picked.length && typeof showToast === 'function') {
    const wrongType = picked.some(f => !PHOTO_TYPES.includes(f.type));
    showToast(wrongType ? '사진은 JPG · PNG · WEBP 만 올릴 수 있어요' : '사진은 한 장에 10MB 까지 올릴 수 있어요');
  }
  if (files.length > remaining && typeof showToast === 'function') {
    showToast(`사진은 최대 ${PHOTO_MAX}장까지 첨부할 수 있어요`);
  }
  files.slice(0, Math.max(0, remaining)).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const cell = document.createElement('div');
      cell.className = 'pcell photo-thumb';
      cell.style.backgroundImage = `url("${e.target.result}")`;
      cell.innerHTML = '<button type="button" class="photo-del" onclick="removePhoto(this)" aria-label="사진 삭제"><i class="ti ti-x"></i></button>';
      grid.insertBefore(cell, addCell);
      updatePhotoCount();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
function removePhoto(btn) {
  const cell = btn.closest('.photo-thumb');
  if (cell) cell.remove();
  updatePhotoCount();
}
function updatePhotoCount() {
  const grid = document.getElementById('photo-grid');
  if (!grid) return;
  const n = grid.querySelectorAll('.photo-thumb').length;
  const cnt = document.getElementById('photo-count');
  if (cnt) cnt.textContent = n + '/' + PHOTO_MAX;
  const addCell = document.getElementById('photo-add');
  if (addCell) addCell.style.display = n >= PHOTO_MAX ? 'none' : '';
}

// 별점 선택 (항목별 평점)
function setRate(star) {
  const wrap = star.parentElement;
  const stars = Array.from(wrap.querySelectorAll('.rstar'));
  const idx = stars.indexOf(star);
  if (idx < 0) return;
  wrap.dataset.score = idx + 1;
  stars.forEach((s, i) => s.classList.toggle('on', i <= idx));
}
