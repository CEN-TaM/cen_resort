// 내 배지 — 서버(GET /api/me/badges)가 배지 기준(DB badges, 관리자 페이지에서 고친다)과 내 활동으로 계산한다.
// 한 번 받은 배지는 서버에 기록돼(badge_awards) 후기를 지워도 남는다.
// 화면: 나의 페이지 '내 배지 N / M' · 내 배지 화면(screens/badges.html)
// 서버가 없으면(시연) 배지를 보여주지 않는다.

async function fetchMyBadges() {
  if (!getProfile() || (await authMode()) !== 'server') return null;
  try { return await apiFetch('/api/me/badges'); } catch (e) { return null; }
}

let myBadges = [];   // 지금 화면에 그린 배지 (자세히 보기가 다시 찾는다)

// 목록 칸은 아이콘 · 이름만. 받는 기준 · 진행은 누르면 나오는 자세히 보기에서
function badgeItemHtml(b) {
  const got = b.earned;
  return `
    <div class="badge-item${got ? '' : ' locked'}" role="button" tabindex="0" onclick="openBadgeDetail('${escapeHtml(b.id)}')">
      <div class="b-icon${got ? ' tone-' + escapeHtml(b.tone) : ''}"${got ? '' : ' style="background:#E8EAEE"'}><i class="ms${got ? '' : ' outline'}"${got ? '' : ' style="color:#94A3B8"'}>${got ? escapeHtml(b.icon) : 'lock'}</i></div>
      <div class="bname">${escapeHtml(b.name)}</div>
    </div>`;
}

// 방금 기준을 넘어 새로 받은 배지가 있으면 한 번 알려준다
function announceNewBadges(r) {
  if (!r || !r.newly || !r.newly.length || typeof showToast !== 'function') return;
  const names = r.badges.filter(b => r.newly.includes(b.id)).map(b => b.name);
  showToast(`🎉 새 배지를 받았어요: ${names.join(', ')}`);
}

// 나의 페이지 '내 배지 N / M'
async function refreshBadgeCount() {
  const el = document.getElementById('my-badges-count');
  if (!el) return;
  const r = await fetchMyBadges();
  el.textContent = r ? `${r.badges.filter(b => b.earned).length} / ${r.badges.length}` : '-';
  announceNewBadges(r);
}

// 내 배지 화면
async function renderBadges() {
  const r = await fetchMyBadges();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Number(v || 0).toLocaleString('ko-KR'); };
  const grid = document.getElementById('badge-grid');
  if (!r) {
    set('badge-got', 0); set('badge-reviews', 0); set('badge-likes', 0);
    if (grid) grid.innerHTML = '<div class="tip-empty" style="grid-column:1/-1">로그인하면 내 배지를 볼 수 있어요.</div>';
    return;
  }
  const got = r.badges.filter(b => b.earned);
  set('badge-got', got.length);
  set('badge-reviews', r.stats.reviews);
  set('badge-likes', r.stats.likesReceived);
  // 받은 배지 먼저(받은 순서대로), 그다음 아직 못 받은 배지(관리자가 정한 순서)
  got.sort((a, b) => String(a.awardedAt).localeCompare(String(b.awardedAt)));
  myBadges = [...got, ...r.badges.filter(b => !b.earned)];
  if (grid) grid.innerHTML = myBadges.map(badgeItemHtml).join('');
  announceNewBadges(r);
}

// 배지 자세히 보기 — 받는 기준 전체 · 진행 막대 · 받은 날 또는 남은 개수
function openBadgeDetail(id) {
  const b = myBadges.find(x => x.id === id);
  const box = document.getElementById('badge-detail-body');
  if (!b || !box) return;
  const pct = Math.round((Math.min(b.value, b.goal) / b.goal) * 100);
  const when = b.awardedAt && typeof fmtDate === 'function' ? fmtDate(b.awardedAt) : '';
  box.innerHTML = `
    <div class="bd-icon ${b.earned ? 'tone-' + escapeHtml(b.tone) : ''}"${b.earned ? '' : ' style="background:#E8EAEE;color:#94A3B8"'}><i class="ms${b.earned ? '' : ' outline'}">${b.earned ? escapeHtml(b.icon) : 'lock'}</i></div>
    <div class="bd-name">${escapeHtml(b.name)}</div>
    <div class="bd-desc">받는 기준 · ${escapeHtml(b.description)}</div>
    <div class="bd-bar" aria-label="${b.value} / ${b.goal}"><span style="width:${b.earned ? 100 : pct}%"></span></div>
    <div class="bd-state${b.earned ? ' got' : ''}">${b.earned ? `${when ? when + ' 에 ' : ''}받았어요 🎉` : `${b.value} / ${b.goal} · ${b.goal - b.value}${escapeHtml(b.unit || "개")} 더 하면 받아요`}</div>`;
  document.getElementById('badge-modal').classList.add('show');
}
function closeBadgeDetail(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  const m = document.getElementById('badge-modal');
  if (m) m.classList.remove('show');
}
