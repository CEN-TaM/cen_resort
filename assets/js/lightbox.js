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
function fmtDate(iso) {
  // 2026-08-12T... → 2026.08.12
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[1]}.${m[2]}.${m[3]}` : '';
}
function serverReviewCard(rv) {
  const name = escapeHtml(rv.authorName || '동료');
  const avatarCh = (rv.authorName || '동').trim()[0] || '동';
  const srvAc = (typeof avatarColor === 'function') ? avatarColor(rv.authorName || rv.id) : { bg: '#DCE9FB', fg: '#1F4FE0' };
  const comp = (rv.companions && rv.companions.length) ? ' · ' + escapeHtml(rv.companions.join(', ')) + '와 함께' : '';
  const avg = (rv.ratings && rv.ratings.avg != null) ? Number(rv.ratings.avg).toFixed(1) : '';
  const starFull = Math.round(rv.ratings?.avg || 0);
  const stars = '★'.repeat(starFull) + '☆'.repeat(5 - starFull);
  const photos = (rv.photos || []).slice(0, 4).map(src =>
    `<div class="rv-photo" data-full="${API_BASE}${escapeHtml(src)}" onclick="openReviewLightbox(this,event)" style="aspect-ratio:1;border-radius:8px;cursor:pointer;background:#E8EAEE center/cover no-repeat;background-image:url('${API_BASE}${escapeHtml(src)}')"></div>`
  ).join('');
  const photoGrid = photos ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:10px 0 12px">${photos}</div>` : '';
  const content = rv.content ? `<div style="font-size:13px;color:#0F172A;line-height:1.7">${escapeHtml(rv.content)}</div>` : '';
  return `
  <div class="review-head rt-head" id="rev-srv-${rv.id}">
    <div class="rt-avatar" style="background:${srvAc.bg};color:${srvAc.fg}">${escapeHtml(avatarCh)}</div>
    <div class="rt-who">
      <div class="rt-name-row"><span class="rt-name">${name}</span>${reviewBadge(rv)}<span class="rt-date">· ${fmtDate(rv.createdAt)}${comp}</span></div>
      ${rtOrgRow(rv)}
    </div>
  </div>
  <div class="rating-line" style="margin-top:10px"><span class="stars">${stars}</span><span class="rating-num">${avg}</span></div>
  <div style="background:#F1F3F6;padding:12px 14px;border-radius:12px;margin:10px 0">
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;color:#475569"><span>위치</span><span style="color:#0F172A;font-weight:700">${rv.ratings?.location ?? '-'}.0</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;color:#475569"><span>시설</span><span style="color:#0F172A;font-weight:700">${rv.ratings?.facility ?? '-'}.0</span></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569"><span>청결도</span><span style="color:#0F172A;font-weight:700">${rv.ratings?.clean ?? '-'}.0</span></div>
  </div>
  ${photoGrid}
  ${content}
  ${typeof reviewCommentsHtml === 'function' ? reviewCommentsHtml(rv) : ''}
  <div style="height:1px;background:#E8EAEE;margin:20px 0"></div>`;
}
// 상세페이지 총계(리뷰 수·평균·항목별 점수)를 실제 후기로 동기화
function syncDetailStats(reviews) {
  const d = document.querySelector('.screen[data-screen="detail"]');
  if (!d) return;
  const n = reviews.length;
  const mean = arr => arr.length ? arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length : 0;
  const avg = Math.round(mean(reviews.map(r => r.ratings?.avg)) * 10) / 10;
  const avgLoc = mean(reviews.map(r => r.ratings?.location));
  const avgFac = mean(reviews.map(r => r.ratings?.facility));
  const avgCln = mean(reviews.map(r => r.ratings?.clean));

  const tnavs = d.querySelectorAll('.tab-nav .tnav'); if (tnavs[1]) tnavs[1].textContent = `리뷰 ${n}`;
  const revCount = d.querySelector('.rev-count'); if (revCount) revCount.textContent = n;
  const big = d.querySelector('.score-main .big-num'); if (big) big.textContent = avg.toFixed(1);
  const stars = d.querySelector('.score-main .stars'); if (stars) stars.textContent = starStr(avg);
  const rc = d.querySelector('.score-main .review-count'); if (rc) rc.innerHTML = `전체 <b>${n}개</b> 리뷰의 평균`;
  const items = d.querySelectorAll('.score-breakdown .score-item');
  setScoreItem(items[0], clampScore(avgLoc));
  setScoreItem(items[1], clampScore(avgFac));
  setScoreItem(items[2], clampScore(avgCln));
}

async function loadServerReviews(resortName) {
  const pane = document.querySelector('.screen[data-screen="detail"] .dtab-pane[data-dtab="reviews"]');
  if (!pane) return;
  const samples = pane.querySelector('#sample-reviews');
  // 이전에 주입한 서버 후기 제거
  const old = pane.querySelector('#server-reviews');
  if (old) old.remove();
  try {
    const res = await fetch(API_BASE + '/api/reviews?resort=' + encodeURIComponent(resortName));
    if (!res.ok) return;
    const { reviews } = await res.json();
    if (!reviews || !reviews.length) {
      // 서버 후기 없음 → 샘플 리뷰 노출(더미 총계 유지)
      if (samples) samples.style.display = '';
      return;
    }
    // 서버 후기 있음 → 샘플 숨기고 총계를 실제 값으로 동기화
    if (samples) samples.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.id = 'server-reviews';
    wrap.innerHTML = reviews.map(serverReviewCard).join('');
    // 구분선(.rev-divider) 바로 다음에 최신 후기를 먼저 노출
    const divider = pane.querySelector('.rev-divider');
    if (divider && divider.nextSibling) pane.insertBefore(wrap, divider.nextSibling);
    else pane.appendChild(wrap);
    syncDetailStats(reviews);
  } catch (e) {
    console.error('서버 후기 로드 실패:', e);
  }
}
