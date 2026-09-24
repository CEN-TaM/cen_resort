// 서버 후기 렌더링 · 홈 실시간 리뷰 · 내가 쓴 리뷰
// ===== 서버 후기 렌더링 =====
// 로그인한 본인이 쓴 후기인지(사번 일치) 판별
function isMyReview(rv) {
  try {
    const p = (typeof getProfile === 'function') && getProfile();
    return !!(p && p.empno && rv && rv.empno && String(p.empno) === String(rv.empno));
  } catch (e) { return false; }
}
// 후기 카드용 배지 HTML (내 리뷰 / NEW)
function reviewBadge(rv) {
  return isMyReview(rv)
    ? '<span class="badge" style="background:#1F4FE0;color:#fff">내 리뷰</span>'
    : '<span class="badge" style="background:#DCFCE7;color:#047857">NEW</span>';
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
// 부서 · 회사 표시줄 (있을 때만)
function orgLine(rv) {
  const org = [rv.department, rv.company].filter(Boolean).map(escapeHtml).join(' · ');
  return org ? `<div class="meta" style="color:#94A3B8;font-size:11px">${org}</div>` : '';
}

// 상대 시간 표기 (방금 전 / N분 전 / N시간 전 / N일 전 / 날짜)
function timeAgo(iso) {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return (typeof fmtDate === 'function') ? fmtDate(iso) : '';
}

// 서버에 사진이 없을 때 쓰는 기본 이미지 (보령 실제 추출 사진 6종)
const FALLBACK_REVIEW_PHOTOS = [
  'assets/images/reviews/rv4a.jpg',
  'assets/images/reviews/rv1b.jpg',
  'assets/images/reviews/rv3b.jpg',
  'assets/images/reviews/rv5b.jpg',
  'assets/images/reviews/rv4c.jpg',
  'assets/images/reviews/rv5c.jpg'
];
// 카드마다 다른 사진이 나오도록 seed 기반으로 n장 선택
function fallbackPhotos(seed, n) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const len = FALLBACK_REVIEW_PHOTOS.length;
  const start = len ? h % len : 0;
  const out = [];
  for (let i = 0; i < n; i++) out.push(FALLBACK_REVIEW_PHOTOS[(start + i) % len]);
  return out;
}

// 아바타 색상 팔레트 (이름 기반으로 카드마다 다르게)
const AVATAR_COLORS = [
  { bg: '#DCE9FB', fg: '#1F4FE0' },
  { bg: '#D8F3E3', fg: '#0F9D58' },
  { bg: '#FDE7CE', fg: '#D97706' },
  { bg: '#FCE0EC', fg: '#DB2777' },
  { bg: '#EBE4FB', fg: '#7C3AED' },
  { bg: '#D5F1F2', fg: '#0E8A93' }
];
function avatarColor(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// 휴양소 배지(.rt-resort) 색상 팔레트 (휴양소마다 다르게)
const RESORT_COLORS = [
  { bg: '#EDEBFB', fg: '#6D5FE0' },
  { bg: '#DCE9FB', fg: '#1F4FE0' },
  { bg: '#D8F3E3', fg: '#0F9D58' },
  { bg: '#FDE7CE', fg: '#D97706' },
  { bg: '#FCE0EC', fg: '#DB2777' },
  { bg: '#D5F1F2', fg: '#0E8A93' },
  { bg: '#FDE2E2', fg: '#DC2626' },
  { bg: '#E7EAF0', fg: '#475569' }
];
function resortColor(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return RESORT_COLORS[h % RESORT_COLORS.length];
}
// 정적 카드 등 인라인 색이 없는 .rt-resort 배지를 텍스트 기준으로 색칠
function paintResortBadges(root) {
  (root || document).querySelectorAll('.rt-resort').forEach(el => {
    if (el.dataset.painted) return;
    const c = resortColor(el.textContent.trim());
    el.style.background = c.bg;
    el.style.color = c.fg;
    el.dataset.painted = '1';
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => paintResortBadges(document));
} else {
  paintResortBadges(document);
}

// 회사명 표기 정규화 (예: '주식회사 아이티센엔텍' → '아이티센 엔텍')
function cleanCompany(c) {
  let s = String(c || '').replace(/^\(?주\)?\s*/, '').replace(/^주식회사\s*/, '').trim();
  if (s === '아이티센엔텍') s = '아이티센 엔텍';
  return s;
}

// rt-head 회사/부서 라인 (방패 + 회사 + 부서) — 서버 후기 공통
function rtOrgRow(rv) {
  const company = escapeHtml(cleanCompany(rv.company));
  const dept = escapeHtml(rv.department || '');
  if (!company && !dept) return '';
  return `<div class="rt-org">${company ? `<i class="ti ti-shield-check-filled rt-verify"></i><span class="rt-company">${company}</span>` : ''}${dept ? `<span class="rt-dept">${dept}</span>` : ''}</div>`;
}

// ===== 홈 '휴양소 최근 후기' 서버 후기 =====
function homeReviewCard(rv) {
  const name = escapeHtml(rv.authorName || '동료');
  const avatarCh = (rv.authorName || '동').trim()[0] || '동';
  const ac = avatarColor(rv.authorName || rv.id || rv.resortName);
  const rc = resortColor(rv.resortName);
  const real = (rv.photos || []).slice(0, 3);
  const photoSrcs = real.length
    ? real.map(src => `${API_BASE}${escapeHtml(src)}`)
    : fallbackPhotos(rv.id || rv.authorName || rv.resortName, 3);
  const photos = photoSrcs.map(u =>
    `<div class="ph" style="background:#E8EAEE center/cover no-repeat;background-image:url('${u}')"></div>`
  ).join('');
  const photoRow = photos ? `<div class="photo-row rt-photos">${photos}</div>` : '';
  const text = escapeHtml(rv.content || '');
  const company = escapeHtml(cleanCompany(rv.company));
  const dept = escapeHtml(rv.department || '');
  const orgRow = (company || dept) ? `
      <div class="rt-org">
        ${company ? `<i class="ti ti-shield-check-filled rt-verify"></i><span class="rt-company">${company}</span>` : ''}
        ${dept ? `<span class="rt-dept">${dept}</span>` : ''}
      </div>` : '';
  const dateTxt = timeAgo(rv.createdAt) || '방금 전';
  const myBadge = isMyReview(rv) ? '<span class="badge" style="background:#1F4FE0;color:#fff">내 리뷰</span>' : '';
  const resortAttr = escapeHtml(rv.resortName).replace(/"/g, '&quot;');
  return `
  <div class="review-card rt-review server-home-card" onclick="openResort('${resortAttr}','reviews')">
    <div class="rt-head">
      <div class="rt-avatar" style="background:${ac.bg};color:${ac.fg}">${escapeHtml(avatarCh)}</div>
      <div class="rt-who">
        <div class="rt-name-row"><span class="rt-name">${name}</span>${myBadge}<span class="rt-date">· ${dateTxt}</span></div>
        ${orgRow}
      </div>
      <span class="rt-resort" data-painted="1" style="background:${rc.bg};color:${rc.fg}">${escapeHtml(rv.resortName)}</span>
    </div>
    <div class="rt-text">${text}</div>
    ${photoRow}
    <div class="rt-actions">
      <span class="rt-act"><i class="ti ti-heart"></i> 좋아요 ${rv.likes || 0}</span>
      <span class="rt-act"><i class="ti ti-message-circle"></i> 댓글 ${(rv.comments || []).length}</span>
    </div>
  </div>`;
}
async function loadHomeReviews() {
  const home = document.querySelector('.screen[data-screen="home"]');
  if (!home) return;
  // '휴양소 최근 후기' 섹션 헤드 찾기
  const heads = home.querySelectorAll('.section-head');
  let head = null;
  heads.forEach(h => { if (h.textContent.includes('휴양소 최근 후기')) head = h; });
  if (!head) return;
  const staticWrap = home.querySelector('#home-static-reviews');
  const old = home.querySelector('#home-server-reviews');
  if (old) old.remove();
  try {
    const res = await fetch(API_BASE + '/api/reviews');
    if (!res.ok) return;
    const { reviews } = await res.json();
    if (!reviews || !reviews.length) return;
    // 최신순 정렬 후 가장 최근 5건만 (서버도 DESC로 주지만 안전장치)
    const recent = reviews.slice().sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    ).slice(0, 5);
    // 서버 후기가 있으면 예시(정적) 후기는 숨김
    if (staticWrap) staticWrap.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.id = 'home-server-reviews';
    wrap.innerHTML = recent.map(homeReviewCard).join('');
    head.parentNode.insertBefore(wrap, head.nextSibling);
  } catch (e) {
    console.error('홈 리뷰 로드 실패:', e);
  }
}
// 최초 진입 시 홈 실시간 리뷰 로드
loadHomeReviews();

// ===== '내가 쓴 리뷰' 페이지 (서버 연동) =====
// 내 후기 카드: 클릭 시 해당 휴양소 상세 리뷰로 이동
function myReviewCard(rv) {
  const myAc = avatarColor(rv.authorName || rv.id || '나');
  const myRc = resortColor(rv.resortName);
  const avg = (rv.ratings && rv.ratings.avg != null) ? Number(rv.ratings.avg).toFixed(1) : '';
  const full = Math.round(rv.ratings?.avg || 0);
  const stars = `<span class="stars">${'★'.repeat(full)}</span>` +
    (full < 5 ? `<span class="stars empty">${'★'.repeat(5 - full)}</span>` : '');
  const photos = (rv.photos || []).slice(0, 3).map(src =>
    `<div class="ph" style="background:#E8EAEE center/cover no-repeat;background-image:url('${API_BASE}${escapeHtml(src)}')"></div>`
  ).join('');
  const photoRow = photos ? `<div class="photo-row">${photos}</div>` : '';
  let text = escapeHtml(rv.content || '');
  if (text.length > 90) text = text.slice(0, 90) + '...';
  const resortAttr = escapeHtml(rv.resortName).replace(/"/g, '&quot;');
  return `
  <div class="review-card" onclick="openResort('${resortAttr}','reviews')">
    <div class="review-head rt-head">
      <div class="rt-avatar" style="background:${myAc.bg};color:${myAc.fg}">${escapeHtml((rv.authorName || '나').trim()[0] || '나')}</div>
      <div class="rt-who">
        <div class="rt-name-row"><span class="rt-name">${escapeHtml(rv.authorName || '나')}</span><span class="badge" style="background:#1F4FE0;color:#fff">내 리뷰</span><span class="rt-date">· ${fmtDate(rv.createdAt)}</span></div>
        ${rtOrgRow(rv)}
      </div>
      <span class="rt-resort" data-painted="1" style="background:${myRc.bg};color:${myRc.fg}">${escapeHtml(rv.resortName)}</span>
      <button class="rev-del-btn" onclick="deleteMyReview(event, ${rv.id})" aria-label="리뷰 삭제"><i class="ti ti-trash"></i></button>
    </div>
    <div class="rating-line">${stars}<span class="rating-num">${avg}</span></div>
    ${photoRow}
    <div class="review-text">${text}</div>
    <div class="review-actions">
      <span class="action-btn"><i class="ti ti-heart"></i> 좋아요 <b>${rv.likes || 0}</b></span>
      <span class="action-btn"><i class="ti ti-message-circle"></i> 댓글 <b>${(rv.comments || []).length}</b></span>
    </div>
  </div>`;
}

// ===== 내 리뷰 삭제 (모달 확인 → DELETE) =====
let _pendingDeleteReviewId = null;

// 삭제 확인 모달 열기 (상세·내리뷰 공용)
function askDeleteReview(id) {
  _pendingDeleteReviewId = id;
  const m = document.getElementById('delete-review-modal');
  if (m) m.classList.add('show');
}
// 내리뷰 카드 삭제 버튼: 카드 클릭(상세 이동) 막고 모달 열기
function deleteMyReview(e, id) {
  if (e) e.stopPropagation();
  askDeleteReview(id);
}
function closeDeleteReviewModal(e) {
  // 배경 클릭 또는 버튼(인자 없음)일 때만 닫기
  if (e && e.target && !e.target.classList.contains('modal-backdrop')) return;
  const m = document.getElementById('delete-review-modal');
  if (m) m.classList.remove('show');
  _pendingDeleteReviewId = null;
}
// 모달의 '삭제' 버튼 → 실제 서버 삭제
async function confirmDeleteReview() {
  const id = _pendingDeleteReviewId;
  if (id == null) return;
  const p = (typeof getProfile === 'function' && getProfile()) || {};
  if (!p.empno) {
    if (typeof showToast === 'function') showToast('로그인이 필요합니다');
    closeDeleteReviewModal();
    return;
  }
  try {
    const res = await fetch(API_BASE + '/api/reviews/' + id + '?empno=' + encodeURIComponent(p.empno), { method: 'DELETE' });
    if (!res.ok) {
      if (typeof showToast === 'function') showToast('삭제에 실패했습니다');
      closeDeleteReviewModal();
      return;
    }
    if (typeof showToast === 'function') showToast('리뷰를 삭제했어요');
    // 관련 화면 새로고침
    if (typeof loadMyReviews === 'function') loadMyReviews();
    if (typeof loadHomeReviews === 'function') loadHomeReviews();
    if (typeof loadServerReviews === 'function' && window._detailResort) loadServerReviews(window._detailResort);
  } catch (err) {
    console.error('리뷰 삭제 실패:', err);
    if (typeof showToast === 'function') showToast('삭제 중 오류가 발생했습니다');
  } finally {
    closeDeleteReviewModal();
  }
}
async function loadMyReviews() {
  const list = document.getElementById('my-review-list');
  const head = document.getElementById('my-reviews-head');
  if (!list) return;
  const p = (typeof getProfile === 'function' && getProfile()) || {};
  if (!p.empno) {
    list.innerHTML = '';
    if (head) head.textContent = '로그인 후 내 리뷰를 확인할 수 있어요';
    return;
  }
  list.innerHTML = '';
  if (head) head.textContent = '작성한 리뷰를 불러오는 중...';
  try {
    const res = await fetch(API_BASE + '/api/reviews/mine?empno=' + encodeURIComponent(p.empno));
    const { reviews } = res.ok ? await res.json() : { reviews: [] };
    if (!reviews || !reviews.length) {
      if (head) head.textContent = '아직 작성한 리뷰가 없어요';
      list.innerHTML = '<div style="text-align:center;color:#94A3B8;font-size:13px;padding:40px 0">첫 후기를 남겨보세요! ✍️</div>';
      return;
    }
    if (head) head.innerHTML = `총 <b>${reviews.length}건</b>의 리뷰를 작성했어요`;
    list.innerHTML = reviews.map(myReviewCard).join('');
  } catch (e) {
    console.error('내 리뷰 로드 실패:', e);
    if (head) head.textContent = '리뷰를 불러오지 못했어요';
  }
}

// 나의페이지 '내가 쓴 리뷰' 개수 배지 갱신
async function updateMyReviewsCount() {
  const el = document.getElementById('my-reviews-count');
  if (!el) return;
  const p = (typeof getProfile === 'function' && getProfile()) || {};
  if (!p.empno) { el.textContent = '0건'; return; }
  try {
    const res = await fetch(API_BASE + '/api/reviews/mine?empno=' + encodeURIComponent(p.empno));
    const { reviews } = res.ok ? await res.json() : { reviews: [] };
    el.textContent = (reviews ? reviews.length : 0) + '건';
  } catch (e) {
    console.error('내 리뷰 개수 조회 실패:', e);
  }
}
// 최초 로드 시 개수 반영
updateMyReviewsCount();

// banner characters removed
