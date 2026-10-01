// Q&A 질문 작성 · 답변 작성
// ===== Q&A 질문 작성 =====
function openQnaModal() {
  const m = document.getElementById('qna-modal');
  if (!m) return;
  m.classList.add('show');
  setTimeout(() => { const t = document.getElementById('qna-input'); if (t) t.focus(); }, 300);
}
function closeQnaModal(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  document.getElementById('qna-modal').classList.remove('show');
}
function submitQna() {
  const inp = document.getElementById('qna-input');
  const q = (inp.value || '').trim();
  if (!q) {
    if (typeof showToast === 'function') showToast('질문 내용을 입력해주세요');
    return;
  }
  const pane = document.querySelector('.screen[data-screen="detail"] .dtab-pane[data-dtab="qna"]');
  if (pane) {
    const btn = pane.querySelector('.qna-write-btn');
    const item = document.createElement('div');
    item.className = 'qna-item unanswered';
    item.innerHTML =
      '<div class="qhead"><div class="qavatar" style="background:#1F4FE0">박</div>' +
      '<div class="qname">관리자 (나)</div><div class="qdate">방금 전</div></div>' +
      '<div class="qtext">Q. ' + escapeHtml(q) + '</div>' +
      '<div class="answer-cta" style="cursor:default">아직 답변이 없어요. 답변을 기다리고 있어요 ⏳</div>';
    if (btn && btn.nextSibling) btn.parentNode.insertBefore(item, btn.nextSibling);
    else pane.appendChild(item);
    // Q&A 탭 개수 +1
    const qnaNav = document.querySelector('.screen[data-screen="detail"] .tab-nav .tnav[onclick*="qna"]');
    if (qnaNav) {
      const m = qnaNav.textContent.match(/\d+/);
      qnaNav.textContent = 'Q&A ' + (m ? parseInt(m[0], 10) + 1 : 1);
    }
  }
  inp.value = '';
  document.getElementById('qna-modal').classList.remove('show');
  if (typeof showToast === 'function') showToast('질문이 등록되었어요! ❓');
}

// ===== Q&A 답변 작성 =====
function openAnswerInput(qnaId) {
  document.getElementById(qnaId + '-cta').style.display = 'none';
  const form = document.getElementById(qnaId + '-form');
  form.style.display = 'block';
  setTimeout(() => document.getElementById(qnaId + '-input').focus(), 50);
}

function cancelAnswer(qnaId) {
  document.getElementById(qnaId + '-cta').style.display = '';
  document.getElementById(qnaId + '-form').style.display = 'none';
  document.getElementById(qnaId + '-input').value = '';
}

function submitAnswer(qnaId) {
  const input = document.getElementById(qnaId + '-input');
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  const item = document.getElementById(qnaId);
  item.classList.remove('unanswered');
  document.getElementById(qnaId + '-cta').remove();
  document.getElementById(qnaId + '-form').remove();
  const html = `
  <div class="answer">
    <div class="ahead">
      <i class="ti ti-corner-down-right" style="color:#1F4FE0"></i>
      관리자 (나) <span style="color:#475569;font-weight:400;font-size:10px">· 방금 전</span>
    </div>
    <div class="atext">${escapeHtml(text)}</div>
  </div>
`;
  item.insertAdjacentHTML('beforeend', html);
}
