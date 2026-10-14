// 공지사항 — 목록 · 상세 · 첨부
//
// 서버가 있으면 DB notices 테이블 (GET /api/notices, /api/notices/:id). 공지 작성은 관리자 도구 tools/notices.js
// 서버가 없으면(시연) data/notices.js 의 예시 공지 (NOTICES) 를 보여준다.
// 화면: 공지 탭(screens/tips.html #notice-list) · 공지 상세(screens/notice-detail.html) · 알림(notification.js)

const NOTICE_TONE = { '예약': 'sky', '복지포인트': 'mint', '이용수칙': 'peach', '이벤트': 'coral', '시설': 'lilac' };
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

// 본문 표기 → HTML (### 소제목 · - 목록 · > 강조 · **굵게** · 빈 줄 문단). 글자는 모두 이스케이프한 뒤 바꾼다
function noticeBodyHtml(text) {
  const inline = s => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push('<ul>' + list.map(l => `<li>${inline(l)}</li>`).join('') + '</ul>'); list = null; } };
  String(text || '').split(/\r?\n\s*\r?\n/).forEach(block => {
    block.split(/\r?\n/).forEach(line => {
      const t = line.trim();
      if (!t) return;
      if (/^- /.test(t)) { (list = list || []).push(t.slice(2)); return; }
      flush();
      if (/^### /.test(t)) out.push(`<h4>${inline(t.slice(4))}</h4>`);
      else if (/^> /.test(t)) out.push(`<div class="callout">${inline(t.slice(2))}</div>`);
      else out.push(`<p>${inline(t)}</p>`);
    });
    flush();
  });
  return out.join('');
}

function noticeCardHtml(n) {
  const tone = NOTICE_TONE[n.category] || 'sky';
  const when = (typeof timeAgo === 'function' ? timeAgo(n.createdAt) : '') || '';
  return `
    <div class="notice-card" data-category="${escapeHtml(n.category)}" onclick="openNoticeDetail('${escapeHtml(n.id)}')">
      <div class="notice-meta">
        ${n.pinned ? '<span class="pin"><i class="ms">push_pin</i> 고정</span>' : ''}
        <span class="tag tone-${tone}">${escapeHtml(n.category)}</span>
      </div>
      <div class="notice-title">${escapeHtml(n.title)}</div>
      <div class="notice-body">${escapeHtml(n.summary || '')}</div>
      <div class="notice-foot">
        <span>${escapeHtml(n.author)}${when ? ' · ' + escapeHtml(when) : ''}</span>
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
  document.getElementById('nd-avatar').textContent = (n.author || '?').trim()[0];
  document.getElementById('nd-author-name').textContent = n.author;
  document.getElementById('nd-date').textContent = ' ' + ((typeof fmtDate === 'function' && fmtDate(n.createdAt)) || '');
  document.getElementById('nd-views').textContent = ' ' + Number(n.views || 0).toLocaleString('ko-KR');
  document.getElementById('nd-body').innerHTML = n.html != null ? n.html : noticeBodyHtml(n.body);

  // 첨부 — 주소(url)가 있는 파일만 받을 수 있다
  const files = n.files || [];
  const withUrl = files.filter(f => f.url);
  const attSection = document.getElementById('nd-attachments');
  attSection.style.display = files.length ? '' : 'none';
  document.getElementById('nd-att-count').textContent = files.length + '개';
  document.querySelectorAll('#nd-attachments .att-all, .nd-action-bar .primary').forEach(b => { b.style.display = withUrl.length ? '' : 'none'; });
  document.getElementById('nd-att-list').innerHTML = files.map((f, i) => {
    const ext = String(f.name || '').split('.').pop().toLowerCase();
    const type = ext === 'pdf' ? 'pdf' : ext === 'hwp' ? 'hwp' : /xlsx?|csv/.test(ext) ? 'xls' : 'doc';
    const ic = FILE_ICON[type] || FILE_ICON.doc;
    return `
      <div class="attach-row">
        <div class="att-icon ${ic.tone}"><span class="ms">${ic.ico}</span></div>
        <div class="att-info">
          <div class="att-name">${escapeHtml(f.name)}</div>
          <div class="att-meta">${ic.label}${f.size ? ' · ' + escapeHtml(f.size) : ''}</div>
        </div>
        <div class="att-actions">
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

function downloadFile(i) {
  const f = currentNotice && (currentNotice.files || [])[i];
  if (f && f.url) window.open(f.url, '_blank', 'noopener');
}
function downloadAllFiles() {
  const list = ((currentNotice && currentNotice.files) || []).filter(f => f.url);
  list.forEach(f => window.open(f.url, '_blank', 'noopener'));
  if (list.length) showNoticeToast(`${list.length}개 파일을 열었어요`);
}
function printNotice() {
  window.print();
}
