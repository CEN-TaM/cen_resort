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

// ===== 홈 '실시간 리뷰' 서버 후기 =====
function homeReviewCard(rv) {
  const name = escapeHtml(rv.authorName || '동료');
  const avatarCh = (rv.authorName || '동').trim()[0] || '동';
  const avg = (rv.ratings && rv.ratings.avg != null) ? Number(rv.ratings.avg).toFixed(1) : '';
  const full = Math.round(rv.ratings?.avg || 0);
  const stars = `<span class="stars">${'★'.repeat(full)}</span>` +
    (full < 5 ? `<span class="stars empty">${'★'.repeat(5 - full)}</span>` : '');
  const photos = (rv.photos || []).slice(0, 3).map(src =>
    `<div class="ph" style="background:#E8EAEE center/cover no-repeat;background-image:url('${API_BASE}${escapeHtml(src)}')"></div>`
  ).join('');
  const photoRow = photos ? `<div class="photo-row">${photos}</div>` : '';
  let text = escapeHtml(rv.content || '');
  if (text.length > 80) text = text.slice(0, 80) + '...';
  const resortAttr = escapeHtml(rv.resortName).replace(/"/g, '&quot;');
  return `
  <div class="review-card server-home-card" onclick="openResort('${resortAttr}','reviews')">
    <div class="review-head">
      <div class="avatar" style="background:#1F4FE0">${escapeHtml(avatarCh)}</div>
      <div class="who">
        <div class="name">${name} ${reviewBadge(rv)}</div>
        <div class="meta">${escapeHtml(rv.resortName)} · 방금 전</div>
        ${orgLine(rv)}
      </div>
    </div>
    <div class="rating-line">${stars}<span class="rating-num">${avg}</span></div>
    ${photoRow}
    <div class="review-text">${text}</div>
  </div>`;
}
async function loadHomeReviews() {
  const home = document.querySelector('.screen[data-screen="home"]');
  if (!home) return;
  // '실시간 리뷰' 섹션 헤드 찾기
  const heads = home.querySelectorAll('.section-head');
  let head = null;
  heads.forEach(h => { if (h.textContent.includes('실시간 리뷰')) head = h; });
  if (!head) return;
  const old = home.querySelector('#home-server-reviews');
  if (old) old.remove();
  try {
    const res = await fetch(API_BASE + '/api/reviews');
    if (!res.ok) return;
    const { reviews } = await res.json();
    if (!reviews || !reviews.length) return;
    const wrap = document.createElement('div');
    wrap.id = 'home-server-reviews';
    wrap.innerHTML = reviews.slice(0, 5).map(homeReviewCard).join('');
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
    <div class="review-head">
      <div class="avatar" style="background:#1F4FE0">${escapeHtml((rv.authorName || '나').trim()[0] || '나')}</div>
      <div class="who">
        <div class="name">${escapeHtml(rv.authorName || '나')} <span class="badge" style="background:#1F4FE0;color:#fff">내 리뷰</span></div>
        <div class="meta">${escapeHtml(rv.resortName)} · ${fmtDate(rv.createdAt)}</div>
        ${orgLine(rv)}
      </div>
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
