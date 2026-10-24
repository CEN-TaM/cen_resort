// 공지사항 — 목록 · 상세 · 첨부
//
// 서버가 있으면 DB notices 테이블 (GET /api/notices, /api/notices/:id). 공지 작성은 관리자 도구 tools/notices.js
// 서버가 없으면(시연) data/notices.js 의 예시 공지 (NOTICES) 를 보여준다.
// 화면: 공지 탭(screens/tips.html #notice-list) · 공지 상세(screens/notice-detail.html) · 알림(notification.js)

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
    fileTypes: [...new Set((n.files || []).map(f => String(f.name || '').split('.').pop().toLowerCase()).filter(Boolean))],
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

// 목록 한 줄: [분류][첨부 형식] 태그 · (고정이면 핀) 제목 · 게시일 · 조회
// 본문 앞부분은 검색용으로만 data-summary 에 둔다 (filters.js applyNoticeFilter)
const NOTICE_FILE_TAG = {
  pdf: ['Pdf', 'pdf'], hwp: ['Hwp', 'hwp'], hwpx: ['Hwp', 'hwp'],
  xls: ['Excel', 'xls'], xlsx: ['Excel', 'xls'], csv: ['Excel', 'xls'],
  doc: ['Word', 'doc'], docx: ['Word', 'doc'],
};

// 첨부 확장자 목록 → 형식 태그 (같은 형식은 한 번만). 순서는 항상 Pdf → Excel → 그 외.
// 표에 없는 확장자(png · jpg · jpeg 등)는 그 확장자 이름 그대로 회색 태그로 (png → Png)
const NOTICE_FILE_FIRST = ['Pdf', 'Excel'];
function noticeFileTagsHtml(types) {
  const seen = new Set();
  const rank = label => { const i = NOTICE_FILE_FIRST.indexOf(label); return i < 0 ? NOTICE_FILE_FIRST.length : i; };
  return (types || [])
    .map(t => NOTICE_FILE_TAG[t] || [t.charAt(0).toUpperCase() + t.slice(1), 'doc'])
    .filter(([label]) => !seen.has(label) && seen.add(label))
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([label, cls]) => `<span class="ntag file-${cls}">${escapeHtml(label)}</span>`).join('');
}

function noticeCardHtml(n) {
  const date = (typeof fmtDate === 'function' ? fmtDate(n.createdAt) : '') || '';
  return `
    <div class="notice-card" data-category="${escapeHtml(n.category)}" data-summary="${escapeHtml(n.summary || '')}" onclick="openNoticeDetail('${escapeHtml(n.id)}')">
      <div class="notice-meta">
        <span class="ntag cat">${escapeHtml(n.category)}</span>${noticeFileTagsHtml(n.fileTypes)}
      </div>
      <div class="notice-title">${n.pinned ? '<img class="notice-pin" src="assets/images/ico_pin.png" alt="고정">' : ''}${escapeHtml(n.title)}</div>
      <div class="notice-foot">게시일 ${escapeHtml(date)} · 조회 ${Number(n.views || 0).toLocaleString('ko-KR')}</div>
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
  // 배지 · 고정 표시는 목록 한 줄(noticeCardHtml)과 같은 모양: [분류][첨부 형식] · 제목 앞 핀
  document.getElementById('nd-meta').innerHTML =
    `<span class="ntag cat">${escapeHtml(n.category)}</span>${noticeFileTagsHtml(n.fileTypes)}`;
  document.getElementById('nd-title').innerHTML =
    (n.pinned ? '<img class="notice-pin" src="assets/images/ico_pin.png" alt="고정">' : '') + escapeHtml(n.title);
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
