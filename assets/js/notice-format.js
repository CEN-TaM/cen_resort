// 공지 본문 표기 → HTML (notice.js 공지 상세가 쓴다).
//   ### 소제목      - 목록 한 줄      > 강조 상자      **굵게**      빈 줄 = 문단 나눔
// 글자는 모두 이스케이프한 뒤 바꾼다 (본문에 HTML 을 써도 글자로 보인다)
function noticeBodyHtml(text) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
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
