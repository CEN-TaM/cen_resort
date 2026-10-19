// 후기 사진 라이트박스 (크게 보기 + 좌우 이동)
// ===== 후기 사진 라이트박스 (크게 보기 + 좌우 이동) =====
let lbImages = [], lbIdx = 0;
function ensureLightbox() {
  if (document.getElementById('rv-lightbox')) return;
  const host = document.getElementById('device1') || document.body;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const lb = document.createElement('div');
  lb.id = 'rv-lightbox';
  lb.style.cssText = 'position:absolute;inset:0;z-index:9999;display:none;background:rgba(0,0,0,.92);align-items:center;justify-content:center;';
  lb.innerHTML =
    '<button id="lb-close" aria-label="닫기" style="position:absolute;top:12px;right:14px;background:rgba(255,255,255,.18);color:#fff;border:none;width:36px;height:36px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer">×</button>' +
    '<button id="lb-prev" aria-label="이전" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.18);color:#fff;border:none;width:40px;height:40px;border-radius:50%;font-size:24px;line-height:1;cursor:pointer">‹</button>' +
    '<img id="lb-img" alt="후기 사진" style="max-width:88%;max-height:80%;object-fit:contain;border-radius:8px;user-select:none" />' +
    '<button id="lb-next" aria-label="다음" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.18);color:#fff;border:none;width:40px;height:40px;border-radius:50%;font-size:24px;line-height:1;cursor:pointer">›</button>' +
    '<div id="lb-count" style="position:absolute;bottom:16px;color:#fff;font-size:13px;background:rgba(0,0,0,.45);padding:4px 12px;border-radius:20px"></div>';
  host.appendChild(lb);
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  lb.querySelector('#lb-close').onclick = e => { e.stopPropagation(); closeLightbox(); };
  lb.querySelector('#lb-prev').onclick = e => { e.stopPropagation(); lbMove(-1); };
  lb.querySelector('#lb-next').onclick = e => { e.stopPropagation(); lbMove(1); };
  // 키보드 좌우/ESC
  document.addEventListener('keydown', e => {
    const el = document.getElementById('rv-lightbox');
    if (!el || el.style.display === 'none') return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbMove(-1);
    else if (e.key === 'ArrowRight') lbMove(1);
  });
  // 터치 스와이프
  let sx = 0;
  const img = lb.querySelector('#lb-img');
  img.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; }, { passive: true });
  img.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) lbMove(dx < 0 ? 1 : -1);
  }, { passive: true });
}
function renderLightbox() {
  if (!lbImages.length) return;
  if (lbIdx < 0) lbIdx = lbImages.length - 1;
  if (lbIdx >= lbImages.length) lbIdx = 0;
  document.getElementById('lb-img').src = lbImages[lbIdx];
  document.getElementById('lb-count').textContent = (lbIdx + 1) + ' / ' + lbImages.length;
  const one = lbImages.length <= 1;
  document.getElementById('lb-prev').style.display = one ? 'none' : '';
  document.getElementById('lb-next').style.display = one ? 'none' : '';
}
function lbMove(d) { lbIdx += d; renderLightbox(); }
function closeLightbox() { const lb = document.getElementById('rv-lightbox'); if (lb) lb.style.display = 'none'; }
function openReviewLightbox(el, ev) {
  if (ev) ev.stopPropagation();
  ensureLightbox();
  const nodes = Array.from(el.parentNode.querySelectorAll('[data-full]'));
  lbImages = nodes.map(n => n.dataset.full);
  lbIdx = Math.max(0, nodes.indexOf(el));
  renderLightbox();
  document.getElementById('rv-lightbox').style.display = 'flex';
}
// 휴양소 사진 크게 보기 — 주소 목록과 시작 번호 (tips.js renderResortGallery)
function openPhotoLightbox(urls, idx) {
  ensureLightbox();
  lbImages = urls.slice();
  lbIdx = idx || 0;
  renderLightbox();
  document.getElementById('rv-lightbox').style.display = 'flex';
}
function fmtDate(iso) {
  // 2026-08-12T... → 2026.08.12
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[1]}.${m[2]}.${m[3]}` : '';
}
// 지금 상세에 떠 있는 후기 (좋아요·댓글이 이 객체를 고친다)
let detailReviews = [];
function findReview(id) { return detailReviews.find(r => String(r.id) === String(id)); }

// 후기 카드 하나 — 서버 후기와 샘플 후기를 같은 모양으로 그린다.
// 좋아요·댓글 버튼은 둘 다에 있고, 댓글은 카드 아래가 아니라 바텀시트(social.js openComments)로 연다.
function serverReviewCard(rv) {
  const name = escapeHtml(rv.authorName || '동료');
  const r = rv.ratings || {};
  const avg = r.avg != null ? Number(r.avg).toFixed(1) : '';
  const sc = v => (v == null ? '-' : Number(v).toFixed(1));
  const photos = (rv.photos || []).map(src => rv._source === 'server' ? `${API_BASE}${escapeHtml(src)}` : escapeHtml(src));
  const n = (rv.comments || []).length;
  const idArg = escapeHtml(String(rv.id));
  return `
  <article class="rv-item" id="rev-srv-${idArg}">
    <div class="review-head rt-head">
      ${seniAvatarHtml(rv.id || rv.authorName, rv.authorName || rv.id)}
      <div class="rt-who">
        <div class="rt-name-row"><span class="rt-name">${name}</span>${reviewBadge(rv)}<span class="rt-date">· ${fmtDate(rv.createdAt)}</span></div>
        ${rtOrgRow(rv)}
      </div>
      ${isMyReview(rv) ? `<button type="button" class="rev-del-btn" onclick="askDeleteReview('${idArg}')" aria-label="내 후기 삭제"><i class="ms outline">delete</i></button>` : ''}
    </div>
    <div class="rating-line"><span class="stars" aria-label="5점 만점에 ${avg}점">${starsHtml(r.avg)}</span><span class="rating-num">${avg}</span></div>
    <div class="rv-scores">
      <div><span>위치</span><b>${sc(r.location)}</b></div>
      <div><span>시설</span><b>${sc(r.facility)}</b></div>
      <div><span>청결도</span><b>${sc(r.clean)}</b></div>
    </div>
    ${reviewPhotosHtml(photos, 'rv-photo-grid')}
    ${reviewTextHtml(rv.content, 'rv-content')}
    <div class="rv-actions">
      <button type="button" class="detail-action${rv.liked ? ' liked' : ''}" data-like="${idArg}" aria-pressed="${!!rv.liked}"
        onclick="toggleLike(event,'${idArg}')"><i class="ms${rv.liked ? '' : ' outline'}" aria-hidden="true">favorite</i> 좋아요 <b class="like-count">${rv.likes || 0}</b></button>
      <button type="button" class="detail-action" data-comment="${idArg}"
        onclick="openComments(event,'${idArg}')"><i class="ms outline" aria-hidden="true">chat_bubble</i> 댓글 <b class="comment-count">${n}</b></button>
    </div>
  </article>`;
}
// 상세페이지 총계(후기 수·평균·항목별 점수)를 실제 후기로 동기화
function syncDetailStats(reviews) {
  const d = document.querySelector('.screen[data-screen="detail"]');
  if (!d) return;
  const n = reviews.length;
  // 점수가 없는 후기는 빼고 평균. 하나도 없으면 null → 화면엔 '-'
  const mean = arr => {
    const v = arr.filter(x => x != null && !isNaN(x)).map(Number);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const avgRaw = mean(reviews.map(r => r.ratings?.avg));
  const avg = avgRaw == null ? null : Math.round(avgRaw * 10) / 10;
  const part = key => { const m = mean(reviews.map(r => r.ratings?.[key])); return m == null ? null : clampScore(m); };

  const tnav = d.querySelector('.tab-nav .tnav[data-dtab-target="reviews"]'); if (tnav) tnav.textContent = `후기 ${n}`;
  const revCount = d.querySelector('.rev-count'); if (revCount) revCount.textContent = n;
  const big = d.querySelector('.score-main .big-num'); if (big) big.textContent = avg == null ? '-' : avg.toFixed(1);
  const stars = d.querySelector('.score-main .stars'); if (stars) stars.innerHTML = starsHtml(avg || 0);
  const rc = d.querySelector('.score-main .review-count'); if (rc) rc.textContent = `· 후기 ${n}`;
  const items = d.querySelectorAll('.score-breakdown .score-item');
  setScoreItem(items[0], part('location'));
  setScoreItem(items[1], part('facility'));
  setScoreItem(items[2], part('clean'));
}

// 상세 후기 목록 — ReviewAPI 가 서버/샘플을 골라 준다.
// 서버 후기나 그 휴양소 전용 샘플이면 총계(평점·후기 수)를 그 값으로 맞추고,
// 공용 샘플(자기 샘플이 없는 휴양소)이면 openResort() 가 넣은 총계를 그대로 둔다 (예전 동작).
async function loadServerReviews(resortName) {
  // 다른 휴양소로 바뀌면 필터를 비운다 (삭제 후 같은 휴양소를 다시 읽을 때는 그대로)
  if (window._detailResort !== resortName) {
    const po = document.getElementById('rev-photo-only'); if (po) po.checked = false;
  }
  window._detailResort = resortName; // 삭제 후 상세 새로고침용
  let real = false;
  try {
    const res = await ReviewAPI.list(resortName);
    detailReviews = res.reviews;
    real = res.real;
  } catch (e) {
    console.error('후기 로드 실패:', e);
    detailReviews = [];
    if (typeof showToast === 'function') showToast('후기를 불러오지 못했어요');
  }
  if (window._detailResort !== resortName) return;   // 그사이 다른 휴양소를 열었다
  if (real) syncDetailStats(detailReviews);
  renderReviewFilters();
  renderReviewList();
}

// 후기 필터 — 사진 있는 후기만 (동행 칩 필터는 없앴다)
// 사진 후기 수 — 0건이면 토글을 숨긴다 (눌러도 빈 목록뿐이라)
function renderReviewFilters() {
  const photoN = detailReviews.filter(r => (r.photos || []).length).length;
  const po = document.getElementById('rev-photo-only');
  const pc = document.getElementById('rev-photo-count');
  if (pc) pc.textContent = photoN;
  if (po) { po.closest('label').hidden = !photoN; if (!photoN) po.checked = false; }
}

function renderReviewList() {
  const box = document.getElementById('server-reviews');
  if (!box) return;
  const photoOnly = !!(document.getElementById('rev-photo-only') || {}).checked;
  const list = detailReviews.filter(r => !photoOnly || (r.photos || []).length);
  box.innerHTML = list.length
    ? list.map(serverReviewCard).join('')
    : detailReviews.length
      ? '<div class="rv-empty">조건에 맞는 후기가 없어요.</div>'
      : '<div class="rv-empty">아직 등록된 후기가 없어요.<br>다녀오셨다면 첫 후기를 남겨 주세요!</div>';
}
