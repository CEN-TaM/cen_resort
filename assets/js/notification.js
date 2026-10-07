// 알림센터 — 내 활동의 후속 반응(댓글·답글) + 새 공지
//
// 알림 종류
//   comment  내가 쓴 후기에 댓글이 달림      (서버 /api/notifications)
//   reply    내가 쓴 댓글에 답글이 달림      (서버 /api/notifications)
//   notice   새 공지사항                     (클라이언트 NOTICES 로 생성)
//
// 읽음 상태는 서버에 저장한다(기기가 바뀌어도 유지). key 는 'n:{id}' / 'notice:{공지id}'.

const NOTI_TYPE = {
  comment: { label: '댓글', cls: 'comment' },
  reply: { label: '답글', cls: 'reply' },
  notice: { label: '공지', cls: 'notice' },
};

// 알림 한 줄의 제목과 부제를 만든다.
//   제목  그 알림에만 있는 정보 (공지 제목 / 누가 무엇에 반응했는지)
//   부제  맥락과 시간 (공지 분류 / 어느 휴양소 글인지)
// 종류 구분은 왼쪽 배지가 하므로 문장에서 '공지사항이 등록되었습니다' 처럼 되풀이하지 않는다.
function notiTexts(n) {
  if (n.type === 'notice') {
    return { text: n.title || '새 공지사항', sub: n.category || '' };
  }
  const who = n.actorName ? `${n.actorName}님이` : '누군가';
  const what = n.type === 'reply' ? '내 댓글에 답글을 남겼어요' : '내 후기에 댓글을 남겼어요';
  return { text: `${who} ${what}`, sub: n.resortName || '' };
}

let notiItems = [];        // 화면에 뿌릴 알림 목록 (최신순)
let notiReadKeys = new Set();

// '방금 전' / '10분 전' 형태로
function notiTimeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return '방금 전';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}일 전`;
  return iso.slice(0, 10).replace(/-/g, '.');
}

// 공지 날짜(2026.05.19)를 ISO 로. 시각 정보가 없어 자정 기준으로 둔다.
function noticeDateToIso(d) {
  const m = String(d || '').match(/(\d{4})\.(\d{2})\.(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z` : new Date(0).toISOString();
}

// 공지 알림은 서버가 모르므로 클라이언트에서 만든다.
function buildNoticeNotifications() {
  if (typeof NOTICES !== 'object' || !NOTICES) return [];
  return Object.entries(NOTICES).map(([id, n]) => ({
    key: `notice:${id}`,
    type: 'notice',
    title: n.title,
    category: n.category,
    createdAt: noticeDateToIso(n.date),
    noticeId: id,
  }));
}

async function loadNotifications() {
  const p = (typeof getProfile === 'function' ? getProfile() : null) || {};
  let server = [];
  if (p.empno) {
    try {
      const res = await fetch(API_BASE + '/api/notifications?empno=' + encodeURIComponent(p.empno));
      if (res.ok) {
        const j = await res.json();
        server = (j.notifications || []).map(n => ({
          key: n.key,
          type: n.type,
          actorName: n.actorName,
          resortName: n.resortName,
          createdAt: n.createdAt,
          reviewId: n.reviewId,
        }));
        notiReadKeys = new Set(j.readKeys || []);
      }
    } catch (e) { /* 서버가 없어도 공지 알림은 보여준다 */ }
  }
  notiItems = [...server, ...buildNoticeNotifications()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return notiItems;
}

function notiUnreadCount() {
  return notiItems.filter(n => !notiReadKeys.has(n.key)).length;
}

// 읽지 않은 알림 개수 배지 — 홈 햄버거, 나의 페이지 종 아이콘
// 표시 대상은 data-noti-badge 속성으로 찾는다 (붙이는 곳이 늘어도 이 함수는 그대로)
function syncNotiBadge() {
  const n = notiUnreadCount();
  const text = n > 99 ? '99+' : String(n);
  document.querySelectorAll('[data-noti-badge]').forEach(el => {
    el.textContent = text;
    el.classList.toggle('wide', text.length > 1);   // 한 자리는 정원, 두 자리부터 알약
    el.style.display = n > 0 ? '' : 'none';
  });
}

function renderNotifications() {
  const out = document.getElementById('notifications-list');
  if (!out) return;

  if (notiItems.length === 0) {
    out.innerHTML = '<div class="noti-empty">아직 알림이 없어요.</div>';
  } else {
    out.innerHTML = notiItems.map(n => {
      const t = NOTI_TYPE[n.type] || NOTI_TYPE.notice;
      const unread = !notiReadKeys.has(n.key);
      const { text, sub } = notiTexts(n);
      const meta = [escapeHtml(sub), notiTimeAgo(n.createdAt)].filter(Boolean).join(' · ');
      return `
      <button class="noti-row${unread ? ' unread' : ''}" onclick="openNotification('${n.key}')">
        <span class="noti-badge ${t.cls}">${t.label}</span>
        <span class="noti-main">
          <span class="noti-text">${escapeHtml(text)}</span>
          <span class="noti-meta">${meta}</span>
        </span>
        ${unread ? '<span class="noti-dot" aria-label="읽지 않음"></span>' : ''}
      </button>`;
    }).join('');
  }

  const allBtn = document.getElementById('noti-read-all');
  if (allBtn) allBtn.disabled = notiUnreadCount() === 0;
  syncNotiBadge();
}

// 읽음 기록을 서버에 남긴다. 실패해도 화면은 이미 갱신된 뒤라 흐름을 막지 않는다.
async function markNotiRead(keys) {
  const fresh = keys.filter(k => !notiReadKeys.has(k));
  if (fresh.length === 0) return;
  fresh.forEach(k => notiReadKeys.add(k));
  renderNotifications();
  syncNotiBadge();          // 읽은 만큼 배지 숫자도 바로 줄인다

  const p = (typeof getProfile === 'function' ? getProfile() : null) || {};
  if (!p.empno) return;
  try {
    await fetch(API_BASE + '/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empno: p.empno, keys: fresh }),
    });
  } catch (e) { /* 다음 조회 때 다시 시도된다 */ }
}

function markAllNotiRead() {
  markNotiRead(notiItems.map(n => n.key));
}

// 알림 선택 → 읽음 처리 후 해당 글/공지로 이동
function openNotification(key) {
  const item = notiItems.find(n => n.key === key);
  markNotiRead([key]);
  if (!item) return;

  if (item.type === 'notice') {
    if (typeof openNoticeDetail === 'function') openNoticeDetail(item.noticeId);
    return;
  }
  // 댓글·답글 → 해당 후기가 달린 휴양소 상세로
  openReviewFromNotification(item.reviewId);
}

// 알림에 담긴 후기 id 로 휴양소를 찾아 상세 화면을 연다.
async function openReviewFromNotification(reviewId) {
  if (!reviewId) return;
  try {
    const res = await fetch(API_BASE + '/api/reviews');
    const list = res.ok ? (await res.json()).reviews || [] : [];
    const rv = list.find(r => r.id === reviewId);
    if (rv && typeof goResortDetail === 'function') {
      goResortDetail(rv.resortName);
      return;
    }
  } catch (e) { /* 아래 안내로 넘어간다 */ }
  if (typeof showToast === 'function') showToast('해당 후기를 찾을 수 없어요');
}

async function openNotifications() {
  showScreen('device1', 'notifications');
  await loadNotifications();
  renderNotifications();
  syncNotiBadge();
}

// 로그인 직후처럼 사용자가 바뀐 시점에 배지를 다시 맞춘다
function refreshNotiBadge() {
  return loadNotifications().then(syncNotiBadge).catch(() => { });
}

// 첫 진입 시 배지 상태만 맞춰둔다 (목록은 화면 열 때 불러온다)
refreshNotiBadge();