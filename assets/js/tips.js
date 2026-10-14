// 꿀팁 작성
// ===== 꿀팁 작성 =====
// 꿀팁 작성 시트 — 새로 쓰기(꿀팁 작성하기 버튼)와 고치기(editTip)가 같은 시트를 쓴다
let editingTipId = null;
function setTipForm(t) {
  editingTipId = t ? String(t.id) : null;
  document.getElementById('tip-tag-input').value = t ? (t.tag || '') : '';
  document.getElementById('tip-title-input').value = t ? t.title : '';
  document.getElementById('tip-content-input').value = t ? t.content : '';
  document.getElementById('tip-modal-title').textContent = t ? '✏️ 꿀팁 수정하기' : '💡 꿀팁 공유하기';
  document.getElementById('tip-submit-btn').textContent = t ? '수정하기' : '공유하기';
}
function openTipModal(keepForm) {
  const m = document.getElementById('tip-modal');
  if (!m) return;
  if (!keepForm) setTipForm(null);   // '꿀팁 작성하기' 로 열면 늘 빈 새 글
  m.classList.add('show');
  setTimeout(() => { const t = document.getElementById('tip-title-input'); if (t) t.focus(); }, 300);
}
function closeTipModal(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  document.getElementById('tip-modal').classList.remove('show');
}
// ===== 꿀팁 창구 =====
// 서버가 있으면 DB tips 테이블 (GET /api/tips?resort=, /api/tips/mine, POST /api/tips, DELETE, POST /:id/like)
// 서버가 없으면(시연) data/tips-data.js 예시 + 이 브라우저에 저장한 꿀팁
const MY_TIPS_KEY = 'cen_my_tips';
const TIP_LIKES_KEY = 'cen_tip_likes';
let currentTipResort = '';         // 지금 열려 있는 휴양소 정식명 (꿀팁 작성 대상)
const tipCache = new Map();         // id → 화면에 그린 꿀팁 (상세 · 좋아요가 다시 찾는다)

const localTips = {
  load() { try { const a = JSON.parse(localStorage.getItem(MY_TIPS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  save(list) { try { localStorage.setItem(MY_TIPS_KEY, JSON.stringify(list)); } catch (e) { } },
  likes() { try { return new Set(JSON.parse(localStorage.getItem(TIP_LIKES_KEY) || '[]')); } catch (e) { return new Set(); } },
  saveLikes(set) { try { localStorage.setItem(TIP_LIKES_KEY, JSON.stringify([...set])); } catch (e) { } },
  // 예시 + 내 것 → 서버와 같은 모양 (likes · liked)
  all() {
    const me = (getProfile() || {});
    const liked = this.likes();
    const seed = (typeof TIP_SEED !== 'undefined' ? TIP_SEED : []).map(t => ({
      id: t.id, resort: t.resort, tag: t.tag || '', title: t.title, content: t.content,
      author: t.mine ? composeDisplayName(me) : (t.author || '동료'), empno: t.mine ? me.empno : null,
      createdAt: new Date(Date.now() - (t.daysAgo || 0) * 864e5).toISOString(), likes: t.likes || 0,
    }));
    return [...this.load(), ...seed].map(t => Object.assign({}, t, { liked: liked.has(t.id), likes: (t.likes || 0) + (liked.has(t.id) ? 1 : 0) }));
  },
};

const TipAPI = {
  async server() { return (await authMode()) === 'server'; },
  async list(resortName) {
    if (await this.server()) return (await apiFetch('/api/tips?resort=' + encodeURIComponent(resortName))).tips;
    const r = resolveResort(resortName);
    return localTips.all().filter(t => t.resort === (r ? r.name : resortName));
  },
  async mine() {
    if (await this.server()) return (await apiFetch('/api/tips/mine')).tips;
    const me = (getProfile() || {}).empno;
    return localTips.all().filter(t => t.empno && t.empno === me);
  },
  async add(body) {
    if (await this.server()) return (await apiFetch('/api/tips', { method: 'POST', body: JSON.stringify(body) })).tip;
    const me = getProfile() || {};
    const tip = { id: 'my-' + Date.now().toString(36), resort: body.resort, tag: body.tag, title: body.title, content: body.content,
      author: composeDisplayName(me), empno: me.empno, createdAt: new Date().toISOString(), likes: 0 };
    localTips.save([tip, ...localTips.load()]);
    return tip;
  },
  async update(id, body) {
    if (await this.server()) return (await apiFetch('/api/tips/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) })).tip;
    localTips.save(localTips.load().map(t => (t.id === id ? Object.assign({}, t, body) : t)));
    return localTips.all().find(t => t.id === id);
  },
  async remove(id) {
    if (await this.server()) return apiFetch('/api/tips/' + encodeURIComponent(id), { method: 'DELETE' });
    localTips.save(localTips.load().filter(t => t.id !== id));
    return { ok: true };
  },
  async like(id, on) {
    if (await this.server()) return apiFetch(`/api/tips/${encodeURIComponent(id)}/like`, { method: 'POST', body: JSON.stringify({ liked: on }) });
    const set = localTips.likes();
    on ? set.add(id) : set.delete(id);
    localTips.saveLikes(set);
    const t = localTips.all().find(x => x.id === id);
    return { likes: t ? t.likes : 0, liked: on };
  },
};

function isMyTip(t) {
  const me = (getProfile() || {}).empno;
  return !!(me && t.empno && String(t.empno) === String(me));
}
// 고치기 · 지우기는 쓴 사람과 관리자만 (서버가 한 번 더 확인한다)
function canEditTip(t) {
  return isMyTip(t) || (getProfile() || {}).role === 'admin';
}

function tipWhen(t) {
  return (typeof timeAgo === 'function' && timeAgo(t.createdAt)) || '';
}

// ===== 꿀팁 좋아요 (1인 1회 · 서버가 합계를 준다) =====
async function toggleTipLike(id, event) {
  if (event) event.stopPropagation();      // 카드 전체 클릭(상세 열기)과 겹치지 않게
  const t = tipCache.get(String(id));
  if (!t) return;
  try {
    const res = await TipAPI.like(t.id, !t.liked);
    t.liked = res.liked; t.likes = res.likes;
  } catch (e) {
    if (typeof showToast === 'function') showToast('좋아요를 반영하지 못했어요');
  }
  document.querySelectorAll(`[data-tip-like="${CSS.escape(String(id))}"]`).forEach(b => { b.outerHTML = tipLikeBtn(t); });
}

// 하트 버튼 한 조각
function tipLikeBtn(t) {
  const on = !!t.liked;
  return `<button type="button" class="tip-like${on ? ' on' : ''}" data-tip-like="${escapeHtml(t.id)}" onclick="toggleTipLike('${escapeHtml(t.id)}',event)"
    aria-label="좋아요"><i class="ms${on ? '' : ' outline'}">favorite</i>${t.likes || 0}</button>`;
}

// 태그는 글 아래 해시태그로 붙인다
function tipTagHtml(t) {
  return t.tag ? `<div class="tip-tags">#${escapeHtml(t.tag)}</div>` : '';
}

// 카드에는 따옴표로 감싼 본문 2줄만. 제목·태그·작성자·좋아요는 상세 시트(openTipDetail)에 있다
function tipCardHtml(t) {
  tipCache.set(String(t.id), t);
  return `<button type="button" class="tip-card" onclick="openTipDetail('${escapeHtml(t.id)}')" aria-label="${escapeHtml(t.title)}">
    <span class="tcontent"><img class="tq-open" src="assets/images/ico_quote_open.png" alt="">${escapeHtml(t.content)}</span>
    <img class="tq-close" src="assets/images/ico_quote_close.png" alt="">
  </button>`;
}

// 휴양소 상세의 꿀팁 목록을 다시 그린다
async function renderResortTips(resortName) {
  currentTipResort = resortName || currentTipResort;
  const row = document.getElementById('tip-row');
  if (!row || !currentTipResort) return;
  const asked = currentTipResort;
  let list = [];
  try { list = await TipAPI.list(asked); } catch (e) { console.error('꿀팁 로드 실패:', e); }
  if (asked !== currentTipResort) return;   // 그사이 다른 휴양소를 열었다
  row.innerHTML = list.length
    ? list.map(tipCardHtml).join('')
    : '<div class="tip-empty">아직 등록된 꿀팁이 없어요. 첫 꿀팁을 남겨보세요!</div>';
  syncSwipeArrows(row);
}

// 꿀팁 줄을 넘기거나 화면 폭이 바뀌면 화살표 상태를 다시 맞춘다
(function bindTipRow() {
  const row = document.getElementById('tip-row');
  if (!row) return;
  row.addEventListener('scroll', () => syncSwipeArrows(row), { passive: true });
  window.addEventListener('resize', () => syncSwipeArrows(row));
})();

let submittingTip = false;
async function submitTip() {
  const tagEl = document.getElementById('tip-tag-input');
  const titleEl = document.getElementById('tip-title-input');
  const contentEl = document.getElementById('tip-content-input');
  const title = (titleEl.value || '').trim();
  const content = (contentEl.value || '').trim();
  if (!title || !content) {
    if (typeof showToast === 'function') showToast('제목과 내용을 입력해주세요');
    return;
  }
  if (submittingTip) return;
  submittingTip = true;
  const editing = editingTipId;
  try {
    const body = { tag: (tagEl.value || '').trim(), title, content };
    if (editing) {
      const t = await TipAPI.update(editing, body);
      if (t) tipCache.set(String(t.id), t);
    } else {
      await TipAPI.add(Object.assign({ resort: currentTipResort }, body));
    }
  } catch (e) {
    submittingTip = false;
    if (typeof showToast === 'function') showToast(e.message || '꿀팁을 저장하지 못했어요');
    return;
  }
  submittingTip = false;
  await renderResortTips(currentTipResort);
  updateMyTipsCount();
  if (document.querySelector('.screen.active[data-screen="my-tips"]')) renderMyTips();
  const row = document.getElementById('tip-row');
  if (row && !editing) row.scrollTo({ left: 0, behavior: 'smooth' });

  setTipForm(null);
  document.getElementById('tip-modal').classList.remove('show');
  if (typeof showToast === 'function') showToast(editing ? '꿀팁을 수정했어요' : '꿀팁이 공유되었어요! 💡');
}

// ===== 내가 쓴 꿀팁 (나의 페이지) =====
async function updateMyTipsCount() {
  const el = document.getElementById('my-tips-count');
  if (!el || !getProfile()) return;
  try { el.textContent = (await TipAPI.mine()).length + '건'; } catch (e) { el.textContent = '-'; }
}

async function renderMyTips() {
  const out = document.getElementById('my-tips-list');
  const head = document.getElementById('my-tips-head');
  if (!out) return;
  let list = [];
  try { list = await TipAPI.mine(); } catch (e) { console.error('내 꿀팁 로드 실패:', e); }
  if (head) head.textContent = list.length ? `내가 남긴 꿀팁 ${list.length}건` : '';
  if (list.length === 0) {
    out.innerHTML = '<div class="tip-empty">아직 남긴 꿀팁이 없어요.<br>휴양소 상세에서 “꿀팁 작성하기”를 눌러 보세요.</div>';
    return;
  }
  out.innerHTML = list.map(t => {
    tipCache.set(String(t.id), t);
    return `<div class="mytip-card" onclick="openTipDetail('${escapeHtml(t.id)}')">
      <div class="mytip-top">
        <span class="mytip-resort" onclick="event.stopPropagation();openResort('${escapeHtml(t.resort)}')">${escapeHtml(t.resort)}</span>
        <button class="mytip-del" onclick="deleteMyTip('${escapeHtml(t.id)}',event)" aria-label="삭제"><i class="ms">delete</i></button>
      </div>
      <div class="ttitle">${escapeHtml(t.title)}</div>
      <div class="tcontent">${escapeHtml(t.content).replace(/\n/g, '<br>')}</div>
      ${tipTagHtml(t)}
      <div class="tfoot"><span>${tipWhen(t)}</span>${tipLikeBtn(t)}</div>
    </div>`;
  }).join('');
}

async function deleteMyTip(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('이 꿀팁을 삭제할까요?')) return;
  try { await TipAPI.remove(id); } catch (e) { if (typeof showToast === 'function') showToast(e.message || '삭제하지 못했어요'); return; }
  tipCache.delete(String(id));
  closeTipDetail();
  renderMyTips();
  updateMyTipsCount();
  renderResortTips(currentTipResort);
  if (typeof showToast === 'function') showToast('꿀팁을 삭제했어요');
}

// 후기 탭에서 특정 후기로 스크롤 (없으면 첫 후기로)
function scrollToReview(reviewId) {
  const pane = document.querySelector('.screen[data-screen="detail"] .dtab-pane[data-dtab="reviews"]');
  if (!pane) return;
  const target = (reviewId && pane.querySelector('#rev-srv-' + reviewId)) || pane.querySelector('.rv-item');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 클릭한 요소(카드/칩)에서 휴양소 이름을 추출해 상세 열기
function openResortEl(el) {
  let name = '';
  const nameEl = el && el.querySelector ? el.querySelector('.name, .fname') : null;
  name = nameEl ? nameEl.textContent.trim() : (el && el.textContent ? el.textContent.trim() : '');
  openResort(name);
}

let currentResortName = '';   // 지금 열린 휴양소 정식명 (편의시설 팝업이 쓴다)

function openResort(name, tab, reviewId) {
  // 상세에서 쓴 후기를 등록하고 돌아온 경우 (review-write.js closeModal)
  if (typeof openReviewsTabNext !== 'undefined' && openReviewsTabNext) { openReviewsTabNext = false; tab = tab || 'reviews'; }
  const r0 = resolveResort(name);
  showScreen('device1', 'detail', { reset: true, param: r0 && r0.id });   // 주소 #/resort/<id>
  // 한 페이지 스크롤이라 그냥 열면 맨 위부터 본다.
  // 후기를 보러 온 경우에만 그 자리로 내려 준다.
  const dt = document.querySelector('.screen[data-screen="detail"]');
  if (dt) {
    if (typeof syncDetailStickyTop === 'function') syncDetailStickyTop();
    if (typeof bindDetailScroll === 'function') bindDetailScroll();
    if (tab === 'reviews') {
      const nav = dt.querySelector('.tab-nav .tnav[data-dtab-target="reviews"]');
      setTimeout(() => {
        if (nav) showDetailTab(nav, 'reviews');
        scrollToReview(reviewId);
      }, 80);
    } else if (typeof markDetailTab === 'function') {
      markDetailTab(dt, 'tips');
    }
  }
  const r = resolveResort(name);
  const d = document.querySelector('.screen[data-screen="detail"]');
  if (!r || !d) return;
  currentResortName = r.name;
  // 이벤트 휴양소는 운영 시즌을 함께 (예: 2026 하계 이벤트 휴양소)
  const tag = r.type === 'regular' ? '정기휴양소'
    : r.season ? `${r.season} 이벤트 휴양소`
      : (r.type === 'winter' ? '동계 이벤트 휴양소' : '하계 이벤트 휴양소');
  const h2 = d.querySelector('#detail-resort-name'); if (h2) h2.textContent = r.name;
  const typeEl = d.querySelector('#detail-resort-type'); if (typeEl) typeEl.textContent = tag;
  const hero = d.querySelector('.hero');
  if (hero) {
    if (r.photo) setBg(hero, resortPhotoUrl(r)); else applyBg(hero, r.img);
    hero.setAttribute('aria-label', `${r.name} 사진`);
  }
  renderResortInfo(r);

  // 헤더 별 버튼을 이 휴양소로 연결한다 (키는 휴양소 id — favorites.js)
  const fav = d.querySelector('#detail-fav');
  if (fav) { fav.dataset.fav = r.id; syncFavoriteUI(r.id); }

  // 후기를 불러오기 전 임시 값 (서버 후기가 있으면 syncDetailStats 가 실제 평균으로 바꾼다)
  // 평점은 휴양소 데이터의 실제 평균 (후기가 없으면 null → '-')
  const hasRating = r.rating != null;
  const big = d.querySelector('.score-main .big-num'); if (big) big.textContent = hasRating ? r.rating.toFixed(1) : '-';
  const stars = d.querySelector('.score-main .stars'); if (stars) stars.innerHTML = starsHtml(r.rating || 0);
  const rc = d.querySelector('.score-main .review-count'); if (rc) rc.textContent = `· 후기 ${r.reviews}`;
  const items = d.querySelectorAll('.score-breakdown .score-item');
  setScoreItem(items[0], hasRating ? clampScore(r.rating - 0.1) : null); // 위치
  setScoreItem(items[1], hasRating ? clampScore(r.rating + 0.1) : null); // 시설
  setScoreItem(items[2], hasRating ? clampScore(r.rating) : null);        // 청결
  const tnav = d.querySelector('.tab-nav .tnav[data-dtab-target="reviews"]'); if (tnav) tnav.textContent = `후기 ${r.reviews}`;
  const revCount = d.querySelector('.rev-count'); if (revCount) revCount.textContent = r.reviews;

  // 이 휴양소의 꿀팁으로 갈아끼운다 (작성도 이 휴양소 기준이 된다)
  renderResortTips(r.name);

  // 서버에 저장된 최신 후기 로드 — 클릭한 이름(별칭)이 아니라 정식명으로 조회한다.
  // 특정 후기를 보러 왔으면 카드가 그려진 뒤 그 자리로 내린다
  loadServerReviews(r.name).then(() => { if (tab === 'reviews' && reviewId) scrollToReview(reviewId); });
}

// '기준 4명 · 최대 8명' (아는 것만)
function capacityText(r) {
  if (r.capacityBase && r.capacity) return `기준 ${r.capacityBase}명 · 최대 ${r.capacity}명`;
  if (r.capacity) return `최대 ${r.capacity}명`;
  return '';
}

// 휴양소 정보 — 데이터가 없는 줄은 숨긴다
function renderResortInfo(r) {
  const row = (rowId, txtId, text) => {
    const rowEl = document.getElementById(rowId);
    const txt = document.getElementById(txtId);
    if (txt) { txt.textContent = text || ''; txt.title = text || ''; }
    if (rowEl) rowEl.hidden = !text;
  };
  row('detail-address-row', 'detail-address', r.address || r.loc);
  // 소개 (실제 숙소 이름 + 한 줄 소개)
  const intro = document.getElementById('detail-intro');
  if (intro) {
    intro.hidden = !(r.facilityName || r.summary);
    document.getElementById('detail-facility').textContent = r.facilityName || '';
    document.getElementById('detail-summary').textContent = r.summary || '';
  }
  // 상세 표 · 이용 수칙 · 주변 관광지 · 문의처가 있으면 '전체보기' 줄
  const all = document.getElementById('detail-all-row');
  if (all) all.hidden = !((r.details && r.details.length) || (r.notices && r.notices.length) || (r.nearby && r.nearby.length) || r.phone || r.website);
  // 길찾기는 실제 주소가 있을 때만 (지역명 'OO시'만으로는 엉뚱한 곳이 나온다)
  const nav = document.getElementById('detail-nav-btn');
  if (nav) nav.hidden = !r.address;
  row('detail-room-row', 'detail-room', [r.roomType, capacityText(r)].filter(Boolean).join(' · '));
  row('detail-amenities-row', 'detail-amenities', ((r.features && r.features['편의시설']) || []).join(', '));
}

// ===== 꿀팁 상세 =====
// 카드에는 3줄까지만 보이므로(CSS) 전체 글은 이 바텀시트에서 본다.
function openTipDetail(id) {
  const t = tipCache.get(String(id));
  const out = document.getElementById('tip-detail-body');
  if (!t || !out) return;
  out.innerHTML = `
    <div class="td-top">
      <span class="td-resort">${escapeHtml(t.resort || '')}</span>
      ${canEditTip(t) ? `<span class="td-manage">
        <button type="button" onclick="editTip('${escapeHtml(t.id)}')">수정</button>
        <button type="button" class="del" onclick="deleteMyTip('${escapeHtml(t.id)}',event)">삭제</button>
      </span>` : ''}
    </div>
    <div class="td-title">${escapeHtml(t.title)}</div>
    <div class="td-content">${escapeHtml(t.content).replace(/\n/g, '<br>')}</div>
    ${t.tag ? `<div class="tip-tags">#${escapeHtml(t.tag)}</div>` : ''}
    <div class="td-foot">
      <span>${escapeHtml(t.author || '동료')}${isMyTip(t) ? ' (나)' : ''} · ${tipWhen(t)}</span>
      ${tipLikeBtn(t)}
    </div>`;
  const m = document.getElementById('tip-detail-modal');
  if (m) m.classList.add('show');
}

// 상세 시트의 '수정' → 작성 시트를 그 꿀팁 내용으로 연다
function editTip(id) {
  const t = tipCache.get(String(id));
  if (!t) return;
  closeTipDetail();
  setTipForm(t);
  openTipModal(true);
}

function closeTipDetail(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  const m = document.getElementById('tip-detail-modal');
  if (m) m.classList.remove('show');
}
