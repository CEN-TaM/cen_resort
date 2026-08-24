// 좋아요 / 댓글
// ===== 좋아요 / 댓글 기능 =====
const reviewState = {
  rv1: {
    liked: false, likes: 24, comments: [
      { author: '김OO 선임', color: '#1F4FE0', text: '저도 다음주에 가요! 정보 감사해요 😊' },
      { author: '이OO 책임', color: '#F59E0B', text: '마트 정보 진짜 도움됐어요. 미리 장 봐서 갈게요!' }
    ]
  },
  rv2: {
    liked: false, likes: 18, comments: [
      { author: '박OO 책임', color: '#1F4FE0', text: '주차 정보 감사합니다 👍 평일에 가야겠네요' }
    ]
  },
  rv3: { liked: false, likes: 12, comments: [] },
  rv4: { liked: false, likes: 9, comments: [] }
};
let currentReviewId = null;

function toggleLike(event, id) {
  event.stopPropagation();
  const s = reviewState[id];
  if (!s) return;
  s.liked = !s.liked;
  s.likes += s.liked ? 1 : -1;
  document.querySelectorAll(`[data-like="${id}"]`).forEach(btn => {
    btn.classList.toggle('liked', s.liked);
    const ico = btn.querySelector('i.ms, i.ti');
    if (ico) {
      ico.className = s.liked ? 'ms' : 'ms outline';
      ico.textContent = 'favorite';
    }
    const cnt = btn.querySelector('.like-count');
    if (cnt) cnt.textContent = s.likes;
    // 상세 화면 인라인 스타일 버튼 컬러 동기화
    if (btn.classList.contains('detail-action') || btn.hasAttribute('style')) {
      if (s.liked) {
        btn.style.background = '#FFE8EC';
        btn.style.borderColor = '#FFC4CC';
        btn.style.color = '#E94A4A';
        if (cnt) cnt.style.color = '#E94A4A';
      } else {
        btn.style.background = '#FFFFFF';
        btn.style.borderColor = '#E8EAEE';
        btn.style.color = '#475569';
        if (cnt) cnt.style.color = '#0F172A';
      }
    }
  });
}

function openComments(event, id) {
  if (event) event.stopPropagation();
  currentReviewId = id;
  renderComments();
  document.getElementById('comment-modal').classList.add('show');
  setTimeout(() => document.getElementById('comment-input').focus(), 300);
}

function closeCommentModal(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  document.getElementById('comment-modal').classList.remove('show');
}

function renderComments() {
  const list = document.getElementById('comment-list');
  const comments = reviewState[currentReviewId].comments;
  document.getElementById('comment-count-label').textContent = comments.length;
  if (comments.length === 0) {
    list.innerHTML = '<div class="comment-empty">아직 댓글이 없어요.<br>첫 댓글을 남겨보세요! ✨</div>';
    return;
  }
  list.innerHTML = comments.map(c => `
  <div class="comment-row">
    <div class="ch">
      <div class="cavatar" style="background:${c.color || '#1F4FE0'}">${c.author[0]}</div>
      <div class="cname">${escapeHtml(c.author)}</div>
    </div>
    <div class="cbody">${escapeHtml(c.text)}</div>
  </div>
`).join('');
}

function addComment() {
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  if (!text || !currentReviewId) return;
  reviewState[currentReviewId].comments.push({ author: '나', color: '#047857', text });
  input.value = '';
  renderComments();
  updateCommentCounts();
  const list = document.getElementById('comment-list');
  list.scrollTop = list.scrollHeight;
}

function updateCommentCounts() {
  Object.entries(reviewState).forEach(([id, s]) => {
    document.querySelectorAll(`[data-comment="${id}"] .comment-count`).forEach(el => {
      el.textContent = s.comments.length;
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
