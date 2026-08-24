// 후기 작성 — 백엔드 연동 · 폼 · 사진 첨부
// ===== 후기 백엔드 연동 =====
// 서버에서 열면(''=같은 출처), 파일로 열면(file://) 로컬 서버로 요청
const API_BASE = (location.protocol === 'file:') ? 'http://localhost:8999' : '';

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

  // 4) 동행 (active 칩)
  const companions = Array.from(form.querySelectorAll('.companion-chip.active'))
    .map(c => c.textContent.trim());

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
    // 등록 완료 모달 표시 (+300P)
    document.getElementById('modal-' + deviceId).classList.add('show');
    // 폼 초기화
    resetReviewForm();
    // 홈 '실시간 리뷰' 즉시 갱신
    if (typeof loadHomeReviews === 'function') loadHomeReviews();
    // 나의페이지 리뷰 개수 갱신
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
  showScreen(deviceId, 'home');
}

// 리뷰 작성: 휴양소 구분 → 휴양소 선택 (2단계)
const REVIEW_RESORTS = {
  regular: ['부산휴양소(해운대)', '부산휴양소(기장)', '속초(힐스) 휴양소', '속초(서희) 휴양소', '경주휴양소', '조천 휴양소', '애월 1호점', '애월 2호점', '보령 휴양소', '여수휴양소', '과천휴양소(1001호)', '과천휴양소(504호)'],
  summer: ['제주(서귀포)', '부산(송도)', '여수(금오도)', '인천(영흥도)', '인천(강화)', '경기(포천)', '경기(가평)', '충남(태안)'],
  winter: ['무주', '고성', '평창', '가평', '홍천', '충남']
};
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

// 동행 선택 칩 토글 (복수 선택)
function toggleChip(el) {
  el.classList.toggle('active');
}

// ===== 사진 첨부 =====
const PHOTO_MAX = 10;
function addPhotos(input) {
  const grid = document.getElementById('photo-grid');
  const addCell = document.getElementById('photo-add');
  if (!grid || !addCell) return;
  const used = grid.querySelectorAll('.photo-thumb').length;
  let remaining = PHOTO_MAX - used;
  const files = Array.from(input.files || []).filter(f => f.type.startsWith('image/'));
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
