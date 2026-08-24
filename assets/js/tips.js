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
  const tag = (tagEl.value || '').trim();
  const row = document.querySelector('.screen[data-screen="detail"] .tip-head + .swipe-row');
  if (row) {
    const card = document.createElement('div');
    card.className = 'tip-card';
    const tagHtml = tag ? `<span class="tag tone-mint">${escapeHtml(tag)}</span>` : '';
    card.innerHTML =
      `<div class="tag-row"><span class="tag tone-coral">NEW</span>${tagHtml}</div>` +
      `<div class="ttitle">${escapeHtml(title)}</div>` +
      `<div class="tcontent">${escapeHtml(content)}</div>` +
      `<div class="tfoot"><span>관리자 (나) · 방금 전</span><span>👁 0 · 👍 0</span></div>`;
    row.insertBefore(card, row.firstElementChild);
    row.scrollTo({ left: 0, behavior: 'smooth' });
  }
  tagEl.value = ''; titleEl.value = ''; contentEl.value = '';
  document.getElementById('tip-modal').classList.remove('show');
  if (typeof showToast === 'function') showToast('꿀팁이 공유되었어요! 💡');
}

// 리뷰 탭에서 특정 리뷰로 스크롤 (없으면 첫 리뷰로)
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
  const title = d.querySelector('.app-header .title'); if (title) title.textContent = r.name;
  const h2 = d.querySelector('#detail-resort-name'); if (h2) h2.textContent = r.name;
  const locEl = d.querySelector('.place-detail-head .loc');
  if (locEl) locEl.innerHTML = `<i class="ti ti-map-pin"></i> ${r.loc} · 4인실 · 정원 4명`;
  const hero = d.querySelector('.hero'); if (hero) applyBg(hero, r.img);
  const heroTag = d.querySelector('.hero .hero-tag'); if (heroTag) heroTag.textContent = tag;
  const big = d.querySelector('.score-main .big-num'); if (big) big.textContent = r.rating.toFixed(1);
  const stars = d.querySelector('.score-main .stars'); if (stars) stars.textContent = starStr(r.rating);
  const rc = d.querySelector('.score-main .review-count'); if (rc) rc.innerHTML = `전체 <b>${r.reviews}개</b> 리뷰의 평균`;
  const items = d.querySelectorAll('.score-breakdown .score-item');
  setScoreItem(items[0], clampScore(r.rating - 0.1)); // 위치
  setScoreItem(items[1], clampScore(r.rating + 0.1)); // 시설
  setScoreItem(items[2], clampScore(r.rating));        // 청결
  const tnavs = d.querySelectorAll('.tab-nav .tnav'); if (tnavs[1]) tnavs[1].textContent = `리뷰 ${r.reviews}`;
  const revCount = d.querySelector('.rev-count'); if (revCount) revCount.textContent = r.reviews;

  // 서버에 저장된 최신 후기 로드
  loadServerReviews(name);
}
