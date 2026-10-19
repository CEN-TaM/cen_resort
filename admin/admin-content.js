// 관리자 페이지 — 후기 · 꿀팁 (목록 · 찾기 · 자세히 보기 · 숨기기/보이기 · 삭제)
// API: /api/admin/reviews · /api/admin/tips (server/admin.js). 삭제는 앱과 같은 DELETE /api/reviews/:id · /api/tips/:id
// 공용 함수($ · esc · api · toast · fmtDate · handleErr)는 admin.js

let ctab = 'reviews';
let contentData = { reviews: [], tips: [] };
let cmItem = null;   // 자세히 보기에 열린 글

MENUS.content = () => loadContent();

async function loadContent() {
  try {
    const [r, t] = await Promise.all([api('/api/admin/reviews'), api('/api/admin/tips')]);
    contentData = { reviews: r.reviews, tips: t.tips };
    // 휴양소 고르기 — 글이 있는 휴양소만
    const names = [...new Set([...r.reviews.map(x => x.resortName), ...t.tips.map(x => x.resortName)])].sort((a, b) => a.localeCompare(b, 'ko'));
    const sel = $('content-resort'); const keep = sel.value;
    sel.innerHTML = '<option value="">휴양소 전체</option>' + names.map(n => `<option${n === keep ? ' selected' : ''}>${esc(n)}</option>`).join('');
    renderContent();
  } catch (e) { handleErr(e); }
}

function contentList() {
  const q = $('content-q').value.trim().toLowerCase();
  const resort = $('content-resort').value;
  const f = $('content-filter').value;
  return contentData[ctab].filter(x =>
    (!resort || x.resortName === resort) &&
    (!f || (f === 'shown' && !x.hidden) || (f === 'hidden' && x.hidden) || (f === 'member' && !x.imported) || (f === 'imported' && x.imported)) &&
    (!q || [x.authorName || x.author, x.company, x.department, x.resortName, x.title || '', x.content || ''].join(' ').toLowerCase().includes(q)));
}

function whoHtml(x) {
  return `<b>${esc(x.authorName || x.author)}</b>${x.imported ? ' <span class="chip imp" title="엑셀 · PDF 로 옮겨 온 글 — 작성자 계정과 연결되지 않음">옮겨 온 글</span>' : ''}
    <div class="muted">${esc(x.company)}${x.company && x.department ? ' · ' : ''}${esc(x.department)}</div>`;
}

function renderContent() {
  $('ctab-reviews-n').textContent = contentData.reviews.length;
  $('ctab-tips-n').textContent = contentData.tips.length;
  document.querySelectorAll('.tab[data-ctab]').forEach(b => b.classList.toggle('on', b.dataset.ctab === ctab));
  const list = contentList();
  const all = contentData[ctab];
  $('content-count').textContent = `${list.length}개 / 전체 ${all.length}개 · 숨김 ${all.filter(x => x.hidden).length}`;
  const actions = x => `<div class="acts">
      <button class="btn sm" data-cview="${esc(x.id)}">보기</button>
      <button class="btn sm" data-ctoggle="${esc(x.id)}">${x.hidden ? '보이기' : '숨기기'}</button>
      <button class="btn sm danger" data-cdel="${esc(x.id)}">삭제</button></div>`;
  const state = x => `<span class="chip ${x.hidden ? 'off' : 'on'}">${x.hidden ? '숨김' : '보임'}</span>`;
  if (ctab === 'reviews') {
    $('content-head').innerHTML = `<tr><th style="width:96px" class="c">작성일</th><th style="width:130px">휴양소</th><th style="width:170px">작성자</th><th>내용</th>
      <th style="width:52px" class="num">평점</th><th style="width:52px" class="num">사진</th><th style="width:52px" class="num">댓글</th><th style="width:64px" class="num">좋아요</th>
      <th style="width:64px" class="c">상태</th><th style="width:190px"></th></tr>`;
    if (!list.length) paged('content-' + ctab, list, 'content-pager', renderContent);   // 비면 쪽 번호도 지운다
  $('content-rows').innerHTML = list.length ? paged('content-' + ctab, list, 'content-pager', renderContent).map(x => `
      <tr class="${x.hidden ? 'off' : ''}">
        <td class="c">${fmtDate(x.createdAt)}</td><td>${esc(x.resortName)}</td><td>${whoHtml(x)}</td>
        <td class="snip" data-cview="${esc(x.id)}"><span>${esc(oneLine(x.content))}</span></td>
        <td class="num">${x.rating != null ? Number(x.rating).toFixed(1) : '-'}</td><td class="num">${x.photos}</td><td class="num">${x.comments}</td><td class="num">${x.likes}</td>
        <td class="c">${state(x)}</td><td>${actions(x)}</td>
      </tr>`).join('') : emptyRow(10);
  } else {
    $('content-head').innerHTML = `<tr><th style="width:96px" class="c">작성일</th><th style="width:130px">휴양소</th><th style="width:170px">작성자</th><th>제목 · 내용</th>
      <th style="width:64px" class="c">상태</th><th style="width:190px"></th></tr>`;
    if (!list.length) paged('content-' + ctab, list, 'content-pager', renderContent);   // 비면 쪽 번호도 지운다
  $('content-rows').innerHTML = list.length ? paged('content-' + ctab, list, 'content-pager', renderContent).map(x => `
      <tr class="${x.hidden ? 'off' : ''}">
        <td class="c">${fmtDate(x.createdAt)}</td><td>${esc(x.resortName)}</td><td>${whoHtml(x)}</td>
        <td class="snip" data-cview="${esc(x.id)}"><b>${esc(x.title)}</b><span>${esc(x.content)}</span></td>
        <td class="c">${state(x)}</td><td>${actions(x)}</td>
      </tr>`).join('') : emptyRow(6);
  }
}
// 목록 내용 칸 — 본문 전체를 한 줄로 이어 붙이고, 두 줄을 넘으면 CSS(line-clamp)가 끝에 … 을 붙인다
const oneLine = s => String(s || '').replace(/\s+/g, ' ').trim();
const emptyRow = n => `<tr><td colspan="${n}" class="empty">${contentData[ctab].length ? '조건에 맞는 글이 없습니다.' : '아직 글이 없습니다.'}</td></tr>`;

document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-ctab]');
  if (b) { ctab = b.dataset.ctab; renderContent(); }   // 탭마다 쪽 번호를 따로 기억한다
});
['content-q', 'content-resort', 'content-filter'].forEach(id => $(id).addEventListener(id === 'content-q' ? 'input' : 'change', () => { resetPage('content-reviews'); resetPage('content-tips'); renderContent(); }));

$('content-rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-cview],[data-ctoggle],[data-cdel]');
  if (!b) return;
  const id = b.dataset.cview || b.dataset.ctoggle || b.dataset.cdel;
  const x = contentData[ctab].find(i => i.id === id);
  if (b.dataset.cview) return openContent(x);
  if (b.dataset.ctoggle) return toggleContent(x);
  if (b.dataset.cdel) return deleteContent(x);
});

const label = () => (ctab === 'reviews' ? '후기' : '꿀팁');
async function toggleContent(x) {
  try {
    await api(`/api/admin/${ctab}/${x.id}`, { method: 'PUT', body: JSON.stringify({ hidden: !x.hidden }) });
    toast(x.hidden ? `${label()}를 다시 보이게 했습니다` : `${label()}를 숨겼습니다 — 앱에 안 보입니다`);
    $('content-modal').hidden = true;
    loadContent();
  } catch (err) { handleErr(err); }
}
async function deleteContent(x) {
  const who = x.authorName || x.author;
  const extra = ctab === 'reviews' ? '\n사진 · 댓글 · 좋아요도 같이 지워지고, 이 후기로 받은 포인트는 작성자에게서 빠집니다.' : '';
  if (!confirm(`${who} 님의 ${label()}를 삭제할까요?${extra}\n\n되돌릴 수 없습니다. 앱에서만 내리려면 '숨기기' 를 쓰세요.`)) return;
  try {
    await api(`/api/${ctab}/${x.id}`, { method: 'DELETE' });
    toast('삭제했습니다');
    $('content-modal').hidden = true;
    loadContent();
  } catch (err) { handleErr(err); }
}

// ───────── 자세히 보기 ─────────
// 맨 윗줄: [후기|꿀팁] [휴양소] 📅 날짜 · ★ 평점 · ♥ 좋아요 (평점 · 좋아요는 후기만)
const ICO = {
  date: '<svg class="mi" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  star: '<svg class="mi fill" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  heart: '<svg class="mi" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
};
function metaHtml(x) {
  const isReview = ctab === 'reviews';
  return `<span class="mtag ${isReview ? 'review' : 'tip'}">${isReview ? '후기' : '꿀팁'}</span>
    <span class="mtag resort">${esc(x.resortName)}</span>
    <span class="mstat">${ICO.date}${fmtDate(x.createdAt)}</span>
    ${isReview ? `<span class="mstat star">${ICO.star}${x.rating != null ? Number(x.rating).toFixed(1) : '-'}</span>
    <span class="mstat">${ICO.heart}${Number(x.likes || 0).toLocaleString('ko-KR')}</span>` : ''}`;
}
async function openContent(x) {
  cmItem = x;
  $('cm-state').className = `chip ${x.hidden ? 'off' : 'on'}`;
  $('cm-state').textContent = x.hidden ? '숨김' : '보임';   // 목록의 상태 배지와 같은 말
  $('cm-toggle').textContent = x.hidden ? '보이기' : '숨기기';
  $('cm-who').innerHTML = `${esc(x.authorName || x.author)} · ${esc(x.company)}${x.company && x.department ? ' · ' : ''}${esc(x.department)}${x.imported ? ' · 옮겨 온 글' : ''}`;
  $('cm-photos').innerHTML = ''; $('cm-comments').innerHTML = '';
  if (ctab === 'tips') {
    $('cm-meta').innerHTML = metaHtml(x);
    $('cm-title').textContent = x.title;
    $('cm-body').textContent = x.content;
  } else {
    $('cm-meta').innerHTML = metaHtml(x);
    $('cm-title').textContent = `${x.authorName} 님의 후기`;
    $('cm-body').textContent = '불러오는 중...';
    try {
      const r = (await api(`/api/admin/reviews/${x.id}`)).review;
      if (cmItem !== x) return;
      $('cm-body').textContent = r.content || '(본문 없음)';
      // 사진은 /uploads/... 만 (다른 주소는 그리지 않는다)
      $('cm-photos').innerHTML = (r.photos || []).filter(p => /^\/uploads\//.test(p))
        .map(p => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="" loading="lazy"></a>`).join('');
      $('cm-comments').innerHTML = (r.comments || []).length
        ? '<b>댓글</b>' + r.comments.map(c => `<div class="c${c.parentId ? ' reply' : ''}"><b>${esc(c.author)}</b>${esc(c.text)} <em>${fmtDate(c.created_at)}</em></div>`).join('')
        : '';
    } catch (err) { $('cm-body').textContent = err.message; }
  }
  $('content-modal').hidden = false;
}
$('cm-toggle').addEventListener('click', () => cmItem && toggleContent(cmItem));
$('cm-delete').addEventListener('click', () => cmItem && deleteContent(cmItem));
