// 좋아요 / 댓글
// 후기 카드는 lightbox.js serverReviewCard() 하나로 그리고, 데이터는 data-source.js ReviewAPI 로 오간다.
// 서버 후기면 서버에, 샘플 후기면 브라우저 메모리(SampleDB)에 저장된다.

// ===== 좋아요 =====
// 누르는 즉시 바꾸고(기다리지 않게) 서버가 준 숫자로 맞춘다. 실패하면 되돌린다.
const likeBusy = new Set();

async function toggleLike(event, id) {
  if (event) event.stopPropagation();
  const rv = findReview(id);
  if (!rv || likeBusy.has(rv.id)) return;
  likeBusy.add(rv.id);
  const next = !rv.liked;
  rv.liked = next;
  rv.likes = Math.max(0, (rv.likes || 0) + (next ? 1 : -1));
  paintLike(rv);
  try {
    const res = await ReviewAPI.like(rv, next);
    if (res && typeof res.likes === 'number') rv.likes = res.likes;
  } catch (e) {
    rv.liked = !next;
    rv.likes = Math.max(0, rv.likes + (next ? -1 : 1));
    if (typeof showToast === 'function') showToast('좋아요를 반영하지 못했어요');
  } finally {
    likeBusy.delete(rv.id);
    paintLike(rv);
  }
}

// 켜짐은 .liked 클래스 (색은 cards.css)
function paintLike(rv) {
  document.querySelectorAll(`[data-like="${rv.id}"]`).forEach(btn => {
    btn.classList.toggle('liked', !!rv.liked);
    btn.setAttribute('aria-pressed', String(!!rv.liked));
    const ico = btn.querySelector('.ms');
    if (ico) ico.classList.toggle('outline', !rv.liked);
    const cnt = btn.querySelector('.like-count');
    if (cnt) cnt.textContent = rv.likes || 0;
  });
}

// ===== 댓글 바텀시트 =====
// 답글은 1단계까지 (서버 규칙). 댓글 아래 '답글' 을 누르면 그 자리에 입력줄이 열린다.
let currentReviewId = null;

function openComments(event, id) {
  if (event) event.stopPropagation();
  if (!findReview(id)) return;
  currentReviewId = id;
  renderComments();
  document.getElementById('comment-modal').classList.add('show');
  setTimeout(() => { const i = document.getElementById('comment-input'); if (i) i.focus(); }, 300);
}

function closeCommentModal(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  document.getElementById('comment-modal').classList.remove('show');
}

function renderComments() {
  const list = document.getElementById('comment-list');
  const rv = findReview(currentReviewId);
  if (!list || !rv) return;
  const all = rv.comments || [];
  const label = document.getElementById('comment-count-label');
  if (label) label.textContent = all.length;
  if (all.length === 0) {
    list.innerHTML = '<div class="comment-empty">아직 댓글이 없어요.<br>첫 댓글을 남겨보세요! ✨</div>';
    return;
  }
  const roots = all.filter(c => !c.parentId);
  const repliesOf = id => all.filter(c => c.parentId === id);
  list.innerHTML = roots.map(c => `
    <div class="rc-row">
      ${rcOne(c, false)}
      ${repliesOf(c.id).map(r => rcOne(r, true)).join('')}
      <div class="rc-reply-form" id="rc-form-${c.id}" hidden>
        <input type="text" id="rc-input-${c.id}" placeholder="답글을 입력하세요" maxlength="300"
               onkeydown="if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229)addComment(${c.id})">
        <button onclick="addComment(${c.id})">등록</button>
      </div>
    </div>`).join('');
}

// parentId 가 있으면 답글, 없으면 댓글
let commentBusy = false;
async function addComment(parentId) {
  const input = document.getElementById(parentId ? `rc-input-${parentId}` : 'comment-input');
  const text = (input && input.value || '').trim();
  const rv = findReview(currentReviewId);
  if (!text || !rv || commentBusy) return;
  commentBusy = true;
  try {
    const res = await ReviewAPI.addComment(rv, parentId || null, text);
    rv.comments = res.comments || rv.comments;
    input.value = '';
    renderComments();
    updateCommentCount(rv);
    if (!parentId) {
      const list = document.getElementById('comment-list');
      if (list) list.scrollTop = list.scrollHeight;
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || '댓글을 등록하지 못했어요');
  } finally {
    commentBusy = false;
  }
}

function updateCommentCount(rv) {
  document.querySelectorAll(`[data-comment="${rv.id}"] .comment-count`).forEach(el => {
    el.textContent = (rv.comments || []).length;
  });
}
