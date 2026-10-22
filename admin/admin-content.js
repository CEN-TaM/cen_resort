// 관리자 페이지 — 후기 · 꿀팁 (목록 · 찾기 · 자세히 보기 · 숨기기/보이기 · 삭제) · 후기 댓글 숨기기/삭제
// 메뉴는 '후기'(#reviews) · '꿀팁'(#tips) 둘이고 화면(#content-view)은 같이 쓴다. ctab = 지금 메뉴
// API: /api/admin/reviews · /api/admin/tips · /api/admin/comments (server/admin.js). 글 삭제는 앱과 같은 DELETE /api/reviews/:id · /api/tips/:id
// 공용 함수($ · esc · api · toast · fmtDate · handleErr)는 admin.js

let ctab = 'reviews';
let contentData = { reviews: [], tips: [] };
let cmItem = null;   // 자세히 보기에 열린 글

const CONTENT_HEAD = {
  reviews: { title: '후기', sub: '숨기면 앱 어디에도 안 보이고 평점 · 후기 수 · 배지에서도 빠집니다 (지우지는 않아 언제든 다시 보이게 할 수 있어요). 삭제는 되돌릴 수 없습니다. 댓글은 \'보기\' 에서 숨기거나 삭제할 수 있어요.' },
  tips: { title: '꿀팁', sub: '숨기면 앱 휴양소 상세 · 내가 쓴 꿀팁에 안 보입니다 (지우지는 않아 언제든 다시 보이게 할 수 있어요). 삭제는 되돌릴 수 없습니다.' },
};
MENUS.reviews = () => openContentMenu('reviews');
MENUS.tips = () => openContentMenu('tips');

function openContentMenu(tab) {
  if (ctab !== tab) {   // 메뉴를 바꾸면 찾기 · 걸러보기를 비운다 (휴양소 목록이 메뉴마다 다르다)
    ctab = tab;
    $('content-q').value = ''; $('content-resort').value = ''; $('content-filter').value = '';
  }
  $('content-title').textContent = CONTENT_HEAD[tab].title;
  $('content-sub').textContent = CONTENT_HEAD[tab].sub;
  $('content-q').placeholder = tab === 'reviews' ? '작성자 · 본문 · 회사 · 휴양소 검색' : '작성자 · 제목 · 내용 · 회사 · 휴양소 검색';
  contentData[tab] = [];
  renderContent();
  loadContent();
}

async function loadContent() {
  const tab = ctab;
  try {
    const r = await api(`/api/admin/${tab}`);
    if (tab !== ctab) return;   // 받는 사이 다른 메뉴로 옮겼다
    contentData[tab] = r[tab];
    // 휴양소 고르기 — 글이 있는 휴양소만
    const names = [...new Set(r[tab].map(x => x.resortName))].sort((a, b) => a.localeCompare(b, 'ko'));
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
      renderComments(r.comments || []);
    } catch (err) { $('cm-body').textContent = err.message; }
  }
  $('content-modal').hidden = false;
}
$('cm-toggle').addEventListener('click', () => cmItem && toggleContent(cmItem));
$('cm-delete').addEventListener('click', () => cmItem && deleteContent(cmItem));

// ───────── 댓글 — 숨기기 / 보이기 · 삭제 ─────────
// 숨기면 앱에 안 보인다 (답글이 있으면 답글도 같이). 삭제하면 앱 · 관리자 모두 '관리자에 의해 삭제되었습니다.' 로 보인다
let cmComments = [];
function renderComments(list) {
  cmComments = list;
  const hiddenRoots = new Set(list.filter(c => c.hidden && !c.parentId).map(c => c.id));
  $('cm-comments').innerHTML = list.length ? `<b>댓글 ${list.length}</b>` + list.map(c => {
    const underHidden = c.parentId && hiddenRoots.has(c.parentId);   // 원 댓글을 숨겨 같이 안 보이는 답글
    const state = c.deleted ? '<span class="chip blocked">삭제됨</span>'
      : c.hidden ? '<span class="chip off">숨김</span>'
      : underHidden ? '<span class="chip off" title="원 댓글을 숨겨서 앱에 같이 안 보여요">원 댓글 숨김</span>' : '';
    const acts = c.deleted ? '' : `<span class="c-acts">
        <button type="button" class="btn sm" data-chide="${esc(c.id)}">${c.hidden ? '보이기' : '숨기기'}</button>
        <button type="button" class="btn sm danger" data-cmdel="${esc(c.id)}">삭제</button></span>`;
    return `<div class="c${c.parentId ? ' reply' : ''}${c.deleted ? ' deleted' : ''}${c.hidden || underHidden ? ' off' : ''}">
        <div class="c-main">${c.deleted ? '' : `<b>${esc(c.author)}</b>`}<span class="c-text">${esc(c.text)}</span> <em>${fmtDate(c.created_at)}</em> ${state}</div>
        ${acts}
      </div>`;
  }).join('') : '';
}
async function reloadComments() {
  const x = cmItem;
  const r = (await api(`/api/admin/reviews/${x.id}`)).review;
  if (cmItem === x) renderComments(r.comments || []);
}
$('cm-comments').addEventListener('click', async e => {
  const b = e.target.closest('[data-chide],[data-cmdel]');
  if (!b || !cmItem) return;
  const c = cmComments.find(i => String(i.id) === (b.dataset.chide || b.dataset.cmdel));
  if (!c) return;
  try {
    if (b.dataset.chide) {
      await api(`/api/admin/comments/${c.id}`, { method: 'PUT', body: JSON.stringify({ hidden: !c.hidden }) });
      toast(c.hidden ? '댓글을 다시 보이게 했습니다' : '댓글을 숨겼습니다 — 앱에 안 보입니다');
    } else {
      const replies = cmComments.filter(i => i.parentId === c.id && !i.deleted).length;
      if (!confirm(`${c.author} 님의 댓글을 삭제할까요?\n앱과 관리자 페이지에 '관리자에 의해 삭제되었습니다.' 로 보입니다.${replies ? `\n(답글 ${replies}개는 그대로 남아요)` : ''}\n\n되돌릴 수 없습니다. 잠깐 내리려면 '숨기기' 를 쓰세요.`)) return;
      await api(`/api/admin/comments/${c.id}`, { method: 'DELETE' });
      toast('댓글을 삭제했습니다');
    }
    await reloadComments();
  } catch (err) { handleErr(err); }
});
