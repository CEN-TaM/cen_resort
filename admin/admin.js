// 관리자 페이지 — 로그인 확인 · 공지사항 목록 / 쓰기 / 고치기 / 숨기기 / 고정 / 삭제
// API: /api/auth/* (로그인, server/auth.js) · /api/admin/notices (server/admin.js, 관리자만)

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.error || `요청 실패 (${res.status})`); e.status = res.status; throw e; }
  return json;
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ───────── 로그인 ─────────
async function start() {
  let me = null;
  try { me = (await api('/api/auth/me')).user; } catch (e) { /* 로그인 안 함 */ }
  if (!me) return showGate('관리자 계정으로 로그인하세요.');
  if (me.role !== 'admin') return showGate(`${me.name} 님은 관리자가 아닙니다. 관리자 계정으로 로그인하세요.`);
  ME = me;
  $('gate').hidden = true; $('app').hidden = false;
  $('me-name').textContent = `${me.name}${me.position ? ' ' + me.position : ''} (${me.empno})`;
  showMenu((location.hash.slice(1) in MENUS) ? location.hash.slice(1) : 'notices');
}

// ───────── 메뉴 ─────────
// 메뉴마다 첫 화면(목록)을 여는 함수. 직원 명단은 admin-users.js 가 MENUS.users 를 채운다
let ME = null;
const MENUS = { notices: () => loadNotices() };
const FIRST_VIEW = { notices: 'notice-list-view', users: 'user-list-view' };
function showMenu(name) {
  if (!$('notice-edit-view').hidden && dirty && !confirm('저장하지 않은 공지가 있습니다. 나갈까요?')) return;
  dirty = false;
  document.querySelectorAll('.side-nav a[data-menu]').forEach(a => a.classList.toggle('on', a.dataset.menu === name));
  document.querySelectorAll('section[data-view]').forEach(s => { s.hidden = s.id !== FIRST_VIEW[name]; });
  history.replaceState(null, '', '#' + name);
  MENUS[name]();
}
document.querySelector('.side-nav').addEventListener('click', e => {
  const a = e.target.closest('a[data-menu]');
  if (a) showMenu(a.dataset.menu);
});
// 팝업(직원 추가 · CSV) 닫기 — 바깥 누르기 · 취소 · Esc
document.addEventListener('click', e => {
  const m = e.target.closest('.modal');
  if (m && (e.target === m || e.target.closest('[data-close]'))) m.hidden = true;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); });
function showGate(msg) {
  $('app').hidden = true; $('gate').hidden = false;
  $('gate-msg').textContent = msg;
  $('login-empno').focus();
}
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('login-err').textContent = '';
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ empno: $('login-empno').value.trim(), password: $('login-pw').value }) });
    $('login-pw').value = '';
    start();
  } catch (err) { $('login-err').textContent = err.message; }
});
$('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  showGate('로그아웃했습니다.');
});

// ───────── 공지 목록 ─────────
let notices = [], categories = [];
async function loadNotices() {
  try {
    const r = await api('/api/admin/notices');
    notices = r.notices; categories = r.categories;
    renderNotices();
  } catch (e) { handleErr(e); }
}
function renderNotices() {
  const q = $('notice-q').value.trim().toLowerCase();
  const f = $('notice-filter').value;
  const list = notices.filter(n =>
    (!q || (n.title + ' ' + n.author).toLowerCase().includes(q)) &&
    (!f || (f === 'active' && n.active) || (f === 'hidden' && !n.active) || (f === 'pinned' && n.pinned)));
  $('notice-count').textContent = `${list.length}개 / 전체 ${notices.length}개`;
  $('notice-rows').innerHTML = list.length ? list.map(n => `
    <tr class="${n.active ? '' : 'off'}">
      <td><button class="pin-btn${n.pinned ? ' on' : ''}" title="${n.pinned ? '고정 풀기' : '맨 위에 고정'}" data-pin="${esc(n.id)}">📌</button></td>
      <td><span class="chip">${esc(n.category)}</span></td>
      <td class="title" data-edit="${esc(n.id)}">${esc(n.title)}</td>
      <td>${esc(n.author)}</td>
      <td><span class="chip ${n.active ? 'on' : 'off'}">${n.active ? '보임' : '숨김'}</span></td>
      <td class="num">${Number(n.views || 0).toLocaleString('ko-KR')}</td>
      <td>${fmtDate(n.createdAt)}</td>
      <td><div class="acts">
        <button class="btn sm" data-edit="${esc(n.id)}">수정</button>
        <button class="btn sm" data-toggle="${esc(n.id)}">${n.active ? '숨기기' : '보이기'}</button>
        <button class="btn sm danger" data-del="${esc(n.id)}">삭제</button>
      </div></td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty">${notices.length ? '조건에 맞는 공지가 없습니다.' : '아직 공지가 없습니다. 오른쪽 위 \'+ 새 공지\' 로 첫 공지를 써 보세요.'}</td></tr>`;
}
$('notice-q').addEventListener('input', renderNotices);
$('notice-filter').addEventListener('change', renderNotices);
$('notice-rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-edit],[data-toggle],[data-pin],[data-del]');
  if (!b) return;
  const id = b.dataset.edit || b.dataset.toggle || b.dataset.pin || b.dataset.del;
  const n = notices.find(x => x.id === id);
  if (b.dataset.edit) return openEditor(id);
  try {
    if (b.dataset.toggle) { await api(`/api/admin/notices/${id}`, { method: 'PUT', body: JSON.stringify({ active: !n.active }) }); toast(n.active ? '앱에서 숨겼습니다' : '앱에 다시 보입니다'); }
    if (b.dataset.pin) { await api(`/api/admin/notices/${id}`, { method: 'PUT', body: JSON.stringify({ pinned: !n.pinned }) }); toast(n.pinned ? '고정을 풀었습니다' : '맨 위에 고정했습니다'); }
    if (b.dataset.del) { if (!(await confirmDelete(n))) return; }
    loadNotices();
  } catch (err) { handleErr(err); }
});
async function confirmDelete(n) {
  if (!confirm(`'${n.title}' 공지를 삭제할까요?\n\n삭제하면 되돌릴 수 없습니다. 잠깐 내리려면 '숨기기' 를 쓰세요.`)) return false;
  await api(`/api/admin/notices/${n.id}`, { method: 'DELETE' });
  toast('삭제했습니다');
  return true;
}

// ───────── 쓰기 · 고치기 ─────────
let editingId = null, dirty = false;
const toLocalInput = iso => { if (!iso) return ''; const d = new Date(iso); const p = v => String(v).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

async function openEditor(id) {
  editingId = id || null;
  let n = { category: categories[0], title: '', author: localStorage.getItem('admin-last-author') || '', body: '', pinned: false, active: true, files: [], createdAt: '' };
  if (id) { try { n = (await api(`/api/admin/notices/${id}`)).notice; } catch (e) { return handleErr(e); } }
  $('f-category').innerHTML = categories.map(c => `<option${c === n.category ? ' selected' : ''}>${esc(c)}</option>`).join('');
  $('f-title').value = n.title; $('f-author').value = n.author; $('f-body').value = n.body;
  $('f-pinned').checked = !!n.pinned; $('f-active').checked = n.active !== false;
  $('f-created').value = toLocalInput(n.createdAt);
  $('file-rows').innerHTML = ''; (n.files || []).forEach(addFileRow);
  $('edit-title').textContent = id ? '공지 수정' : '새 공지';
  $('danger-zone').hidden = !id;
  $('form-err').textContent = '';
  $('notice-list-view').hidden = true; $('notice-edit-view').hidden = false;
  dirty = false;
  $('f-title').focus();
}
function closeEditor(force) {
  if (!force && dirty && !confirm('저장하지 않은 내용이 있습니다. 나갈까요?')) return;
  $('notice-edit-view').hidden = true; $('notice-list-view').hidden = false;
  dirty = false;
}
function addFileRow(f = {}) {
  const row = document.createElement('div');
  row.className = 'file-row';
  row.innerHTML = `<input class="fn" placeholder="파일 이름 (예: 이용안내.pdf)" value="${esc(f.name || '')}">
    <input class="fu" placeholder="받기 주소 (https://… 없으면 이름만 보임)" value="${esc(f.url || '')}">
    <input class="fs" placeholder="크기 (1.2MB)" value="${esc(f.size || '')}">
    <button type="button" class="btn sm">빼기</button>`;
  row.querySelector('button').onclick = () => { row.remove(); dirty = true; };
  $('file-rows').appendChild(row);
}
function formValue() {
  const files = [...document.querySelectorAll('#file-rows .file-row')].map(r => ({
    name: r.querySelector('.fn').value.trim(), url: r.querySelector('.fu').value.trim(), size: r.querySelector('.fs').value.trim(),
  })).filter(f => f.name);
  const created = $('f-created').value;
  return {
    category: $('f-category').value, title: $('f-title').value.trim(), author: $('f-author').value.trim(),
    body: $('f-body').value, pinned: $('f-pinned').checked, active: $('f-active').checked, files,
    ...(created ? { createdAt: new Date(created).toISOString() } : {}),
  };
}
$('notice-form').addEventListener('input', () => { dirty = true; });
$('notice-form').addEventListener('change', () => { dirty = true; });
$('file-add').addEventListener('click', () => { addFileRow(); dirty = true; });
$('new-notice-btn').addEventListener('click', () => openEditor(null));
$('edit-back').addEventListener('click', () => closeEditor());
$('edit-cancel').addEventListener('click', () => closeEditor());
$('edit-save').addEventListener('click', async () => {
  const v = formValue();
  $('form-err').textContent = '';
  if (!v.title || !v.author || !v.body.trim()) { $('form-err').textContent = '분류 · 작성 부서 · 제목 · 본문은 꼭 입력해야 합니다.'; return; }
  $('edit-save').disabled = true;
  try {
    if (editingId) await api(`/api/admin/notices/${editingId}`, { method: 'PUT', body: JSON.stringify(v) });
    else await api('/api/admin/notices', { method: 'POST', body: JSON.stringify(v) });
    localStorage.setItem('admin-last-author', v.author);
    toast(editingId ? '저장했습니다' : '공지를 올렸습니다' + (v.active ? '' : ' (숨김 상태)'));
    closeEditor(true);
    loadNotices();
  } catch (err) { $('form-err').textContent = err.message; if (err.status === 401 || err.status === 403) handleErr(err); }
  finally { $('edit-save').disabled = false; }
});
$('edit-delete').addEventListener('click', async () => {
  const n = notices.find(x => x.id === editingId) || { id: editingId, title: $('f-title').value };
  try { if (await confirmDelete(n)) { closeEditor(true); loadNotices(); } } catch (err) { handleErr(err); }
});
window.addEventListener('beforeunload', e => { if (dirty && !$('notice-edit-view').hidden) { e.preventDefault(); e.returnValue = ''; } });

function handleErr(e) {
  if (e.status === 401) return showGate('로그인이 끝났습니다. 다시 로그인하세요.');
  if (e.status === 403) return showGate('관리자만 쓸 수 있습니다.');
  toast(e.message);
}

// 다른 메뉴 파일(admin-users.js)까지 읽힌 뒤 시작한다
window.addEventListener('DOMContentLoaded', start);
