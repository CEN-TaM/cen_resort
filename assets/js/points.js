// 휴양소 포인트 — 나의 페이지 잔액 · 적립내역
// 서버(GET /api/points/me)가 잔액과 내역을 준다. 적립·차감은 서버가 후기 등록·삭제 때 직접 한다 (화면은 보여주기만).
// 회사 복지포인트(복지몰)와는 별개인 이 서비스의 포인트다.

const POINT_REASON = { review: '후기 작성', review_deleted: '후기 삭제', adjust: '포인트 조정' };

async function fetchMyPoints() {
  if (!(await hasReviewServer()) || !getProfile()) return null;
  try { return await apiFetch('/api/points/me'); } catch (e) { return null; }
}

// 나의 페이지 잔액 (서버가 없거나 로그인 전이면 '-')
async function refreshMyPoints() {
  const el = document.getElementById('my-points');
  if (!el) return;
  const p = await fetchMyPoints();
  el.textContent = p ? Number(p.balance).toLocaleString('ko-KR') : '-';
}

async function openPointHistory() {
  const modal = document.getElementById('point-modal');
  const box = document.getElementById('point-history');
  if (!modal || !box) return;
  box.innerHTML = '<div class="ph-empty">불러오는 중...</div>';
  modal.classList.add('show');
  const p = await fetchMyPoints();
  if (!p) { box.innerHTML = '<div class="ph-empty">포인트 내역을 불러오지 못했어요.</div>'; return; }
  const rows = p.history.map(h => {
    const plus = h.amount > 0;
    const date = (typeof fmtDate === 'function') ? fmtDate(h.createdAt) : String(h.createdAt).slice(0, 10);
    return `
      <div class="ph-row">
        <div class="ph-main">
          <div class="ph-title">${escapeHtml(POINT_REASON[h.reason] || h.reason)}${h.resortName ? ` · ${escapeHtml(h.resortName)}` : ''}</div>
          <div class="ph-date">${escapeHtml(date)}</div>
        </div>
        <div class="ph-amt ${plus ? 'plus' : 'minus'}">${plus ? '+' : ''}${h.amount}P</div>
      </div>`;
  }).join('');
  box.innerHTML = `
    <div class="ph-total"><div>보유 <b>${Number(p.balance).toLocaleString('ko-KR')}P</b></div><span>후기 1건당 ${p.perReview}P</span></div>
    ${rows || '<div class="ph-empty">아직 적립된 포인트가 없어요.<br>후기를 쓰면 포인트가 쌓여요!</div>'}`;
}

function closePointHistory(event) {
  if (event && event.target.closest && event.target.closest('.comment-sheet')) return;
  const m = document.getElementById('point-modal');
  if (m) m.classList.remove('show');
}
