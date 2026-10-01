// 서버 후기의 댓글 · 답글
//
// 댓글을 달면 글쓴이에게, 답글을 달면 원 댓글 작성자에게 알림이 간다(서버에서 생성).
// 답글은 1단계까지만 — 답글에는 다시 답글을 달 수 없다.

// 후기 상세 카드에 붙일 댓글 영역
function reviewCommentsHtml(rv) {
  const all = rv.comments || [];
  const roots = all.filter(c => !c.parentId);
  const repliesOf = (id) => all.filter(c => c.parentId === id);

  const rows = roots.map(c => `
    <div class="rc-row">
      ${rcOne(c, false)}
      ${repliesOf(c.id).map(r => rcOne(r, true)).join('')}
      <div class="rc-reply-form" id="rc-form-${c.id}" hidden>
        <input type="text" id="rc-input-${c.id}" placeholder="답글을 입력하세요" maxlength="300"
               onkeydown="if(event.key==='Enter')submitReviewComment(${rv.id}, ${c.id})">
        <button onclick="submitReviewComment(${rv.id}, ${c.id})">등록</button>
      </div>
    </div>`).join('');

  return `
  <div class="rc-wrap" id="rc-wrap-${rv.id}">
    <div class="rc-head">댓글 <b>${all.length}</b></div>
    <div class="rc-list">${rows || '<div class="rc-empty">첫 댓글을 남겨보세요.</div>'}</div>
    <div class="rc-input">
      <input type="text" id="rc-new-${rv.id}" placeholder="댓글을 입력하세요" maxlength="300"
             onkeydown="if(event.key==='Enter')submitReviewComment(${rv.id}, null)">
      <button onclick="submitReviewComment(${rv.id}, null)">등록</button>
    </div>
  </div>`;
}

function rcOne(c, isReply) {
  const name = c.author || '익명';
  return `
  <div class="rc-item${isReply ? ' reply' : ''}">
    <div class="rc-avatar" style="background:${c.color || '#1F4FE0'}">${escapeHtml(name[0] || '?')}</div>
    <div class="rc-body">
      <div class="rc-name">${escapeHtml(name)}<span class="rc-time">${rcTime(c.created_at)}</span></div>
      <div class="rc-text">${escapeHtml(c.text)}</div>
      ${isReply ? '' : `<button class="rc-reply-btn" onclick="toggleReplyForm(${c.id})">답글</button>`}
    </div>
  </div>`;
}

function rcTime(iso) {
  return (typeof notiTimeAgo === 'function') ? notiTimeAgo(iso) : '';
}

function toggleReplyForm(commentId) {
  const f = document.getElementById('rc-form-' + commentId);
  if (!f) return;
  f.hidden = !f.hidden;
  if (!f.hidden) document.getElementById('rc-input-' + commentId)?.focus();
}

// parentId 가 있으면 답글, 없으면 댓글
async function submitReviewComment(reviewId, parentId) {
  const inputId = parentId ? `rc-input-${parentId}` : `rc-new-${reviewId}`;
  const input = document.getElementById(inputId);
  const text = (input?.value || '').trim();
  if (!text) return;

  const p = (typeof getProfile === 'function' ? getProfile() : null) || {};
  const author = (typeof composeDisplayName === 'function' ? composeDisplayName(p) : p.name) || '나';

  try {
    const res = await fetch(API_BASE + `/api/reviews/${reviewId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empno: p.empno || '', author, parentId, text }),
    });
    if (!res.ok) throw new Error((await res.json()).error || '등록 실패');
    input.value = '';
    // 현재 보고 있는 휴양소의 후기 목록을 다시 그려 새 댓글을 반영한다
    const resort = document.getElementById('detail-resort-name')?.textContent?.trim();
    if (resort && typeof loadServerReviews === 'function') await loadServerReviews(resort);
    if (typeof showToast === 'function') showToast(parentId ? '답글을 등록했어요' : '댓글을 등록했어요');
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || '등록에 실패했어요');
  }
}