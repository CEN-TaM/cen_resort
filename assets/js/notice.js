// 공지사항 — 목록 · 상세 · 첨부
//
// 서버가 있으면 DB notices 테이블 (GET /api/notices, /api/notices/:id). 공지 작성은 관리자 도구 tools/notices.js
// 서버가 없으면(시연) data/notices.js 의 예시 공지 (NOTICES) 를 보여준다.
// 화면: 공지 탭(screens/tips.html #notice-list) · 공지 상세(screens/notice-detail.html) · 알림(notification.js)

const NOTICE_TONE = { '예약': 'sky', '포인트': 'mint', '이용가이드': 'peach', '이벤트': 'coral', '시설': 'lilac' };
let currentNotice = null;   // 지금 열린 공지 (첨부 받기용)

// 예시 공지(시연) → 서버와 같은 모양. 예시 본문은 코드에 적힌 HTML 이라 html 로 넘긴다
function sampleNotices() {
  if (typeof NOTICES !== 'object' || !NOTICES) return [];
  const iso = d => { const m = String(d || '').match(/(\d{4})\.(\d{2})\.(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z` : new Date(0).toISOString(); };
  return Object.entries(NOTICES).map(([id, n]) => ({
    id, category: n.category, title: n.title, author: n.author, pinned: !!n.pinned,
    createdAt: iso(n.date), views: Number(String(n.views || 0).replace(/,/g, '')) || 0,
    summary: String(n.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120),
    html: n.body, files: (n.files || []).map(f => ({ name: f.name, size: f.size })),
  })).sort((a, b) => (b.pinned - a.pinned) || (Date.parse(b.createdAt) - Date.parse(a.createdAt)));
}

const NoticeAPI = {
  async list() {
    if (await authMode() === 'server') return (await apiFetch('/api/notices')).notices;
    return sampleNotices();
  },
  async get(id) {
    if (await authMode() === 'server') {
      try { return (await apiFetch('/api/notices/' + encodeURIComponent(id))).notice; } catch (e) { return null; }
    }
    return sampleNotices().find(n => n.id === String(id)) || null;
  },
};

// 본문 표기 → HTML 은 notice-format.js noticeBodyHtml()

// 목록 카드는 제목만 (2026-10). 본문 앞부분은 검색용으로만 data-summary 에 둔다 (filters.js applyNoticeFilter)
function noticeCardHtml(n) {
  const tone = NOTICE_TONE[n.category] || 'sky';
  const when = (typeof timeAgo === 'function' ? timeAgo(n.createdAt) : '') || '';
  return `
    <div class="notice-card" data-category="${escapeHtml(n.category)}" data-summary="${escapeHtml(n.summary || '')}" onclick="openNoticeDetail('${escapeHtml(n.id)}')">
      <div class="notice-meta">
        ${n.pinned ? '<span class="pin"><i class="ms">push_pin</i> 고정</span>' : ''}
        <span class="tag tone-${tone}">${escapeHtml(n.category)}</span>
      </div>
      <div class="notice-title">${escapeHtml(n.title)}</div>
      <div class="notice-foot">
        <span>${escapeHtml(when)}</span>
        <span class="views"><span class="ms outline">visibility</span> ${Number(n.views || 0).toLocaleString('ko-KR')}</span>
      </div>
    </div>`;
}

// 공지 탭 목록 (공지 탭을 열 때마다 새로 읽는다 — core.js showScreen)
async function renderNotices() {
  const box = document.getElementById('notice-list');
  if (!box) return;
  let list = [];
  try { list = await NoticeAPI.list(); } catch (e) { console.error('공지 로드 실패:', e); }
  box.innerHTML = list.length
    ? list.map(noticeCardHtml).join('')
    : '<div class="notice-none">등록된 공지사항이 없어요.</div>';
  if (typeof applyNoticeFilter === 'function') applyNoticeFilter();
}

async function openNoticeDetail(id) {
  const n = await NoticeAPI.get(id);
  if (!n) {   // 없는(지워진) 공지 링크 → 공지 목록으로
    if (typeof showToast === 'function') showToast('공지를 찾을 수 없어요');
    showScreen('device1', 'tips', { replace: true });
    return;
  }
  currentNotice = n;
  const tone = NOTICE_TONE[n.category] || 'sky';
  document.getElementById('nd-meta').innerHTML = (n.pinned ? `<span class="pin"><i class="ms">push_pin</i> 고정</span>` : '') +
    `<span class="tag tone-${tone}">${escapeHtml(n.category)}</span>`;
  document.getElementById('nd-title').textContent = n.title;
  document.getElementById('nd-date').textContent = ' ' + ((typeof fmtDate === 'function' && fmtDate(n.createdAt)) || '');
  document.getElementById('nd-views').textContent = ' ' + Number(n.views || 0).toLocaleString('ko-KR');
  document.getElementById('nd-body').innerHTML = n.html != null ? n.html : noticeBodyHtml(n.body);

  // 첨부 — 주소(url)가 있는 파일만 받을 수 있다
  const files = n.files || [];
  const withUrl = files.filter(f => f.url);
  const attSection = document.getElementById('nd-attachments');
  attSection.style.display = files.length ? '' : 'none';
  document.getElementById('nd-att-count').textContent = files.length + '개';
  document.querySelectorAll('#nd-attachments .att-all').forEach(b => { b.style.display = withUrl.length ? '' : 'none'; });
  document.querySelector('.nd-action-bar').style.display = withUrl.length ? '' : 'none';
  document.getElementById('nd-att-list').innerHTML = files.map((f, i) => {
    const ext = String(f.name || '').split('.').pop().toLowerCase();
    const type = ext === 'pdf' ? 'pdf' : ext === 'hwp' ? 'hwp' : /xlsx?|csv/.test(ext) ? 'xls' : 'doc';
    const ic = FILE_ICON[type] || FILE_ICON.doc;
    // PDF 는 받지 않고 바로 열어 볼 수도 있다 (서버가 /uploads/notices 의 PDF 만 브라우저에서 열리게 보낸다)
    return `
      <div class="attach-row">
        <div class="att-icon ${ic.tone}"><span class="ms">${ic.ico}</span></div>
        <div class="att-info">
          <div class="att-name">${escapeHtml(f.name)}</div>
          <div class="att-meta">${ic.label}${f.size ? ' · ' + escapeHtml(f.size) : ''}</div>
        </div>
        <div class="att-actions">
          ${f.url && type === 'pdf' ? `<button class="att-btn" onclick="viewFile(${i})" aria-label="보기"><span class="ms">visibility</span></button>` : ''}
          ${f.url ? `<button class="att-btn primary" onclick="downloadFile(${i})" aria-label="받기"><span class="ms">download</span></button>` : ''}
        </div>
      </div>`;
  }).join('');

  showScreen('device1', 'notice-detail', { param: n.id });   // 주소 #/notice/<id>
}

function showNoticeToast(msg) {
  const toast = document.getElementById('nd-toast');
  document.getElementById('nd-toast-msg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(showNoticeToast._t);
  showNoticeToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

// 받기 — 이 서버에 올린 파일은 download 링크로 (PDF 도 열지 않고 내려받는다), 바깥 주소는 새 창으로
function saveFile(f) {
  if (!f || !f.url) return;
  if (!/^\//.test(f.url)) { window.open(f.url, '_blank', 'noopener'); return; }
  const a = document.createElement('a');
  a.href = f.url; a.download = f.name || '';
  document.body.appendChild(a); a.click(); a.remove();
}
function downloadFile(i) {
  saveFile(currentNotice && (currentNotice.files || [])[i]);
}
function viewFile(i) {
  const f = currentNotice && (currentNotice.files || [])[i];
  if (f && f.url) window.open(f.url, '_blank', 'noopener');
}
function downloadAllFiles() {
  const list = ((currentNotice && currentNotice.files) || []).filter(f => f.url);
  list.forEach(saveFile);
  if (list.length) showNoticeToast(`${list.length}개 파일을 받았어요`);
}
