// 공지사항 상세 · 첨부파일 액션
let currentNoticeId = null;

function openNoticeDetail(id) {
  const n = NOTICES[id];
  if (!n) return;
  currentNoticeId = id;

  // meta
  const meta = document.getElementById('nd-meta');
  meta.innerHTML = (n.pinned ? `<span class="pin"><span class="ms">push_pin</span> 고정</span>` : '') +
    `<span class="tag tone-${n.categoryTone}">${n.category}</span>`;

  document.getElementById('nd-title').textContent = n.title;
  document.getElementById('nd-avatar').textContent = n.authorInitial;
  document.getElementById('nd-author-name').textContent = n.author;
  document.getElementById('nd-date').textContent = ' ' + n.date;
  document.getElementById('nd-views').textContent = ' ' + n.views;
  document.getElementById('nd-body').innerHTML = n.body;

  // attachments
  const attSection = document.getElementById('nd-attachments');
  const list = document.getElementById('nd-att-list');
  const count = document.getElementById('nd-att-count');
  if (!n.files || n.files.length === 0) {
    attSection.style.display = 'none';
  } else {
    attSection.style.display = '';
    count.textContent = n.files.length + '개';
    list.innerHTML = n.files.map(f => {
      const ic = FILE_ICON[f.type] || FILE_ICON.doc;
      const safeName = f.name.replace(/'/g, "\\'");
      return `
      <div class="attach-row">
        <div class="att-icon ${ic.tone}"><span class="ms">${ic.ico}</span></div>
        <div class="att-info">
          <div class="att-name">${f.name}</div>
          <div class="att-meta">${ic.label} · ${f.size} · ${f.date}</div>
        </div>
        <div class="att-actions">
          <button class="att-btn" onclick="previewFile('${safeName}')" aria-label="미리보기"><span class="ms">visibility</span></button>
          <button class="att-btn primary" onclick="downloadFile('${safeName}')" aria-label="다운로드"><span class="ms">download</span></button>
        </div>
      </div>
    `;
    }).join('');
  }

  showScreen('device1', 'notice-detail');
}

function showNoticeToast(msg) {
  const toast = document.getElementById('nd-toast');
  document.getElementById('nd-toast-msg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(showNoticeToast._t);
  showNoticeToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

function downloadFile(name) {
  showNoticeToast(`${name} 다운로드 시작`);
}
function previewFile(name) {
  showNoticeToast(`${name} 미리보기를 여는 중...`);
}
function downloadAllFiles() {
  const n = NOTICES[currentNoticeId];
  if (!n || !n.files) return;
  showNoticeToast(`${n.files.length}개 파일을 ZIP으로 받았어요`);
}
function printNotice() {
  showNoticeToast('인쇄 미리보기를 여는 중...');
}
