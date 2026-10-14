// 내 배지 — 실제 활동(GET /api/me/stats)으로 계산한다. 배지 기준은 아래 BADGES 한 곳에서 정한다.
// 화면: 나의 페이지 '내 배지 컬렉션 N / M' · 내 배지 화면(screens/badges.html)
// 서버가 없으면(시연) 활동이 없는 것으로 보여준다.

// get: 활동 숫자 → 지금 값, goal: 받는 기준
const BADGES = [
  { id: 'first',    name: '첫 후기',     desc: '후기 1편',          icon: 'edit_note',     tone: 'mint',  get: s => s.reviews, goal: 1 },
  { id: 'writer',   name: '후기 작가',   desc: '후기 5편',          icon: 'menu_book',     tone: 'sky',   get: s => s.reviews, goal: 5 },
  { id: 'legend',   name: '후기왕',      desc: '후기 20편',         icon: 'emoji_events',  tone: 'cream', get: s => s.reviews, goal: 20 },
  { id: 'helpful',  name: '도움왕',      desc: '좋아요 30개 받기',   icon: 'thumb_up',      tone: 'coral', get: s => s.likesReceived, goal: 30 },
  { id: 'tipper',   name: '꿀팁 나눔',   desc: '꿀팁 3편',          icon: 'lightbulb',     tone: 'sky',   get: s => s.tips, goal: 3 },
  { id: 'photo',    name: '사진작가',    desc: '후기 사진 30장',     icon: 'photo_camera',  tone: 'lilac', get: s => s.photos, goal: 30 },
  { id: 'explorer', name: '탐험가',      desc: '휴양소 3곳 후기',    icon: 'explore',       tone: 'peach', get: s => s.resorts, goal: 3 },
  { id: 'master',   name: '정복자',      desc: '휴양소 10곳 후기',   icon: 'flag',          tone: 'mint',  get: s => s.resorts, goal: 10 },
  { id: 'jeju',     name: '제주 전문가', desc: '제주 후기 3편',      icon: 'landscape',     tone: 'coral', get: s => (s.regions || {})['제주'] || 0, goal: 3 },
  { id: 'talker',   name: '소통왕',      desc: '댓글 20개',         icon: 'forum',         tone: 'peach', get: s => s.comments, goal: 20 },
];
const EMPTY_STATS = { reviews: 0, photos: 0, likesReceived: 0, tips: 0, comments: 0, resorts: 0, regions: {} };

async function fetchMyStats() {
  if (!getProfile() || (await authMode()) !== 'server') return EMPTY_STATS;
  try { return Object.assign({}, EMPTY_STATS, await apiFetch('/api/me/stats')); } catch (e) { return EMPTY_STATS; }
}

function badgeItemHtml(b, s) {
  const v = Math.min(b.get(s) || 0, b.goal);
  const got = v >= b.goal;
  return `
    <div class="badge-item${got ? '' : ' locked'}">
      <div class="b-icon${got ? ' tone-' + b.tone : ''}"${got ? '' : ' style="background:#E8EAEE"'}><i class="ms${got ? '' : ' outline'}"${got ? '' : ' style="color:#94A3B8"'}>${got ? b.icon : 'lock'}</i></div>
      <div class="bname">${escapeHtml(b.name)}</div>
      <div class="bdesc">${got ? escapeHtml(b.desc) : `${escapeHtml(b.desc)} · ${v}/${b.goal}`}</div>
    </div>`;
}

// 나의 페이지 '내 배지 컬렉션 N / M'
async function refreshBadgeCount() {
  const el = document.getElementById('my-badges-count');
  if (!el) return;
  const s = await fetchMyStats();
  el.textContent = `${BADGES.filter(b => (b.get(s) || 0) >= b.goal).length} / ${BADGES.length}`;
}

// 내 배지 화면
async function renderBadges() {
  const s = await fetchMyStats();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Number(v || 0).toLocaleString('ko-KR'); };
  const got = BADGES.filter(b => (b.get(s) || 0) >= b.goal);
  set('badge-got', got.length);
  set('badge-reviews', s.reviews);
  set('badge-likes', s.likesReceived);
  const grid = document.getElementById('badge-grid');
  // 받은 배지 먼저, 그다음 아직 못 받은 배지
  if (grid) grid.innerHTML = [...got, ...BADGES.filter(b => !got.includes(b))].map(b => badgeItemHtml(b, s)).join('');
}
