// 꿀팁 작성
// ===== 꿀팁 작성 =====
function openTipModal() {
  const m = document.getElementById('tip-modal');
  if (!m) return;
  m.classList.add('show');
  setTimeout(() => { const t = document.getElementById('tip-title-input'); if (t) t.focus(); }, 300);
}
function closeTipModal(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  document.getElementById('tip-modal').classList.remove('show');
}
// ===== 꿀팁 저장소 =====
// 서버 API 가 아직 없어 내가 쓴 꿀팁은 브라우저에 담아 둔다.
// 목록은 TIP_SEED(표본) + 저장분을 합쳐 보여준다.
const MY_TIPS_KEY = 'cen_my_tips';
let currentTipResort = '조천 휴양소';   // 지금 열려 있는 휴양소 (꿀팁 작성 대상)

function loadMyTips() {
  try {
    const raw = localStorage.getItem(MY_TIPS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function saveMyTips(list) {
  try { localStorage.setItem(MY_TIPS_KEY, JSON.stringify(list)); } catch (e) { /* 저장 못 해도 이번 세션엔 보인다 */ }
}

function tipAuthorName() {
  const p = (typeof getProfile === 'function' ? getProfile() : null) || {};
  return p.name ? `${p.name} (나)` : '나';
}

// 시드는 daysAgo, 내가 쓴 건 createdAt 을 쓴다
function tipWhen(t) {
  if (t.createdAt) {
    const min = Math.floor((Date.now() - new Date(t.createdAt)) / 60000);
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
    const d = Math.floor(min / 1440);
    return d < 7 ? `${d}일 전` : `${Math.floor(d / 7)}주 전`;
  }
  const d = t.daysAgo || 0;
  if (d < 7) return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

// ===== 꿀팁 좋아요 =====
// 서버에 꿀팁 API 가 없어 '내가 누른 것'만 브라우저에 담는다.
// 그래서 수는 0 또는 1 이다. 서버로 옮기면 모두의 합계가 된다.
const TIP_LIKES_KEY = 'cen_tip_likes';

function loadTipLikes() {
  try {
    const raw = localStorage.getItem(TIP_LIKES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) { return new Set(); }
}

function isTipLiked(id) {
  return loadTipLikes().has(id);
}

function tipLikeCount(t) {
  return (t.likes || 0) + (isTipLiked(t.id) ? 1 : 0);
}

function toggleTipLike(id, event) {
  if (event) event.stopPropagation();      // 카드 전체 클릭(상세 열기)과 겹치지 않게
  const set = loadTipLikes();
  set.has(id) ? set.delete(id) : set.add(id);
  try { localStorage.setItem(TIP_LIKES_KEY, JSON.stringify([...set])); } catch (e) { }
  renderResortTips(currentTipResort);
  renderMyTips();
  const open = document.getElementById('tip-detail-modal');
  if (open && open.classList.contains('show')) openTipDetail(id);   // 상세가 열려 있으면 거기도
}

// 하트 버튼 한 조각
function tipLikeBtn(t) {
  const on = isTipLiked(t.id);
  return `<button type="button" class="tip-like${on ? ' on' : ''}" onclick="toggleTipLike('${t.id}',event)"
    aria-label="좋아요"><i class="ti ti-heart${on ? '-filled' : ''}"></i>${tipLikeCount(t)}</button>`;
}

// 휴양소 하나의 꿀팁 (최신순)
function getResortTips(resortName) {
  const seed = (typeof TIP_SEED !== 'undefined' ? TIP_SEED : []).filter(t => t.resort === resortName);
  const mine = loadMyTips().filter(t => t.resort === resortName);
  return [...mine, ...seed];
}

// 나의 페이지에서 쓰는 "내가 쓴 꿀팁" — 표본 중 mine 표시된 것도 포함한다
function getMyTips() {
  const seed = (typeof TIP_SEED !== 'undefined' ? TIP_SEED : []).filter(t => t.mine);
  return [...loadMyTips(), ...seed];
}

// 태그는 글 아래 해시태그로 붙인다
function tipTagHtml(t) {
  return t.tag ? `<div class="tip-tags">#${escapeHtml(t.tag)}</div>` : '';
}

// NEW / HOT 은 상태 표시라 제목 위에 둔다
function tipBadgeHtml(t) {
  const b = t.isNew ? 'NEW' : (t.hot ? 'HOT' : '');
  return b ? `<div class="tag-row"><span class="tag tone-coral">${b}</span></div>` : '';
}

function tipCardHtml(t) {
  const who = t.mine || t.createdAt ? tipAuthorName() : escapeHtml(t.author || '동료');
  return `<div class="tip-card" onclick="openTipDetail('${t.id}')">
    ${tipBadgeHtml(t)}
    <div class="ttitle">${escapeHtml(t.title)}</div>
    <div class="tcontent">${escapeHtml(t.content).replace(/\n/g, '<br>')}</div>
    ${tipTagHtml(t)}
    <div class="tfoot">
      <span>${who} · ${tipWhen(t)}</span>
      ${tipLikeBtn(t)}
    </div>
  </div>`;
}

// 휴양소 상세의 꿀팁 목록을 다시 그린다
function renderResortTips(resortName) {
  currentTipResort = resortName || currentTipResort;
  const row = document.getElementById('tip-row');
  if (!row) return;
  const list = getResortTips(currentTipResort);
  row.innerHTML = list.length
    ? list.map(tipCardHtml).join('')
    : '<div class="tip-empty">아직 등록된 꿀팁이 없어요. 첫 꿀팁을 남겨보세요!</div>';
}

function submitTip() {
  const tagEl = document.getElementById('tip-tag-input');
  const titleEl = document.getElementById('tip-title-input');
  const contentEl = document.getElementById('tip-content-input');
  const title = (titleEl.value || '').trim();
  const content = (contentEl.value || '').trim();
  if (!title || !content) {
    if (typeof showToast === 'function') showToast('제목과 내용을 입력해주세요');
    return;
  }

  const p = (typeof getProfile === 'function' ? getProfile() : null) || {};
  const tip = {
    id: 'my-' + Date.now().toString(36),
    resort: currentTipResort,
    tag: (tagEl.value || '').trim(),
    title, content,
    empno: p.empno || null,
    createdAt: new Date().toISOString(),
    isNew: true, mine: true,
  };
  const list = loadMyTips();
  list.unshift(tip);
  saveMyTips(list);

  renderResortTips(currentTipResort);
  updateMyTipsCount();
  const row = document.getElementById('tip-row');
  if (row) row.scrollTo({ left: 0, behavior: 'smooth' });

  tagEl.value = ''; titleEl.value = ''; contentEl.value = '';
  document.getElementById('tip-modal').classList.remove('show');
  if (typeof showToast === 'function') showToast('꿀팁이 공유되었어요! 💡');
}

// ===== 내가 쓴 꿀팁 (나의 페이지) =====
function updateMyTipsCount() {
  const el = document.getElementById('my-tips-count');
  if (el) el.textContent = getMyTips().length + '건';
}

function renderMyTips() {
  const out = document.getElementById('my-tips-list');
  const head = document.getElementById('my-tips-head');
  if (!out) return;
  const list = getMyTips();
  if (head) head.textContent = list.length ? `내가 남긴 꿀팁 ${list.length}건` : '';
  if (list.length === 0) {
    out.innerHTML = '<div class="tip-empty">아직 남긴 꿀팁이 없어요.<br>휴양소 상세에서 “나도 꿀팁 공유하기”를 눌러 보세요.</div>';
    return;
  }
  out.innerHTML = list.map(t => {
    // 저장된 꿀팁만 지울 수 있다 (표본은 예시라 그대로 둔다)
    const del = t.id.startsWith('my-')
      ? `<button class="mytip-del" onclick="deleteMyTip('${t.id}',event)" aria-label="삭제"><i class="ms">delete</i></button>`
      : '';
    return `<div class="mytip-card" onclick="openTipDetail('${t.id}')">
      <div class="mytip-top">
        <span class="mytip-resort" onclick="event.stopPropagation();openResort('${escapeHtml(t.resort)}')">${escapeHtml(t.resort)}</span>
        ${del}
      </div>
      <div class="ttitle">${escapeHtml(t.title)}</div>
      <div class="tcontent">${escapeHtml(t.content).replace(/\n/g, '<br>')}</div>
      ${tipTagHtml(t)}
      <div class="tfoot"><span>${tipWhen(t)}</span>${tipLikeBtn(t)}</div>
    </div>`;
  }).join('');
}

function deleteMyTip(id, event) {
  if (event) event.stopPropagation();
  saveMyTips(loadMyTips().filter(t => t.id !== id));
  renderMyTips();
  updateMyTipsCount();
  renderResortTips(currentTipResort);
  if (typeof showToast === 'function') showToast('꿀팁을 삭제했어요');
}

updateMyTipsCount();

// 후기 탭에서 특정 후기로 스크롤 (없으면 첫 후기로)
function scrollToReview(reviewId) {
  const pane = document.querySelector('.screen[data-screen="detail"] .dtab-pane[data-dtab="reviews"]');
  if (!pane) return;
  const target = (reviewId && pane.querySelector('#rev-' + reviewId)) || pane.querySelector('.review-head');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 클릭한 요소(카드/칩)에서 휴양소 이름을 추출해 상세 열기
function openResortEl(el) {
  let name = '';
  const nameEl = el && el.querySelector ? el.querySelector('.name, .fname') : null;
  name = nameEl ? nameEl.textContent.trim() : (el && el.textContent ? el.textContent.trim() : '');
  openResort(name);
}

function openResort(name, tab, reviewId) {
  showScreen('device1', 'detail', { reset: true });
  // 상세 탭 지정 (기본: 편의시설)
  const dt = document.querySelector('.screen[data-screen="detail"]');
  if (dt) {
    const wantTab = tab || 'tips';
    const nav = dt.querySelector(`.tab-nav .tnav[onclick*="'${wantTab}'"]`);
    if (nav) showDetailTab(nav, wantTab);
    if (wantTab === 'reviews') setTimeout(() => scrollToReview(reviewId), 80);
  }
  const r = RESORT[name];
  const d = document.querySelector('.screen[data-screen="detail"]');
  if (!r || !d) return;
  const tag = r.type === 'winter' ? '동계 이벤트 휴양소'
    : r.type === 'summer' ? '하계 이벤트 휴양소'
      : '정기 휴양소';
  // 휴양소 이름은 사진 위에 올라가 있어 헤더에는 넣지 않는다
  const h2 = d.querySelector('#detail-resort-name'); if (h2) h2.textContent = r.name;
  const locEl = d.querySelector('.place-detail-head .loc');
  if (locEl) locEl.innerHTML = `<i class="ti ti-map-pin"></i> ${r.loc} · 4인실 · 정원 4명`;
  const hero = d.querySelector('.hero'); if (hero) applyBg(hero, r.img);
  const heroTag = d.querySelector('.hero .hero-tag'); if (heroTag) heroTag.textContent = tag;
  const big = d.querySelector('.score-main .big-num'); if (big) big.textContent = r.rating.toFixed(1);
  const stars = d.querySelector('.score-main .stars'); if (stars) stars.textContent = starStr(r.rating);
  const rc = d.querySelector('.score-main .review-count'); if (rc) rc.innerHTML = `후기 <b>${r.reviews}개</b>`;
  const items = d.querySelectorAll('.score-breakdown .score-item');
  setScoreItem(items[0], clampScore(r.rating - 0.1)); // 위치
  setScoreItem(items[1], clampScore(r.rating + 0.1)); // 시설
  setScoreItem(items[2], clampScore(r.rating));        // 청결
  const tnavs = d.querySelectorAll('.tab-nav .tnav'); if (tnavs[1]) tnavs[1].textContent = `후기 ${r.reviews}`;
  const revCount = d.querySelector('.rev-count'); if (revCount) revCount.textContent = r.reviews;

  // 이 휴양소의 꿀팁으로 갈아끼운다 (작성도 이 휴양소 기준이 된다)
  renderResortTips(r.name);

  // 서버에 저장된 최신 후기 로드
  loadServerReviews(name);
}

// ===== 꿀팁 상세 =====
// 카드에는 3줄까지만 보이므로(CSS) 전체 글은 이 바텀시트에서 본다.
function findTip(id) {
  const seed = (typeof TIP_SEED !== 'undefined' ? TIP_SEED : []);
  return [...loadMyTips(), ...seed].find(t => t.id === id);
}

function openTipDetail(id) {
  const t = findTip(id);
  const out = document.getElementById('tip-detail-body');
  if (!t || !out) return;
  const who = t.mine || t.createdAt ? tipAuthorName() : escapeHtml(t.author || '동료');
  out.innerHTML = `
    <div class="td-top">
      <span class="td-resort">${escapeHtml(t.resort || '')}</span>
    </div>
    <div class="td-title">${escapeHtml(t.title)}</div>
    <div class="td-content">${escapeHtml(t.content).replace(/\n/g, '<br>')}</div>
    ${t.tag ? `<div class="tip-tags">#${escapeHtml(t.tag)}</div>` : ''}
    <div class="td-foot">
      <span>${who} · ${tipWhen(t)}</span>
      ${tipLikeBtn(t)}
    </div>`;
  const m = document.getElementById('tip-detail-modal');
  if (m) m.classList.add('show');
}

function closeTipDetail(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  const m = document.getElementById('tip-detail-modal');
  if (m) m.classList.remove('show');
}
