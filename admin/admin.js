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
  route();
}

// ───────── 메뉴 · 화면 주소 ─────────
// 화면마다 주소가 있다: #notices · #notices/new · #notices/<공지 번호> · #users · #content
// 화면을 바꿀 때 브라우저 기록을 남겨서 뒤로가기 · 앞으로가기 · 새로고침이 그 화면으로 동작한다 (앱 core.js 와 같은 방식)
// 메뉴마다 첫 화면(목록)을 여는 함수. 직원 명단은 admin-users.js, 후기 · 꿀팁은 admin-content.js 가 MENUS 를 채운다
let ME = null;
const MENUS = { notices: () => loadNotices() };
const FIRST_VIEW = { notices: 'notice-list-view', users: 'user-list-view', content: 'content-view' };
let currentRoute = '';

// 앱 안에서 화면을 바꿀 때. fromApp 표시가 있으면 '목록으로' 를 뒤로가기로 처리해 기록이 겹겹이 쌓이지 않는다
function go(hash) {
  if (location.hash !== hash) history.pushState({ fromApp: true }, '', hash);
  route();
}
// 지금 화면을 닫고 그 메뉴 목록으로 (앱에서 들어왔으면 뒤로가기, 주소로 바로 들어왔으면 목록 주소로 바꾼다)
function backTo(hash) {
  if (history.state && history.state.fromApp) history.back();
  else { history.replaceState(null, '', hash); route(); }
}
function route() {
  const h = location.hash.replace(/^#/, '') || 'notices';
  const [menu, sub] = h.split('/');
  // 저장 안 한 공지를 쓰다가 다른 화면으로 가면 한 번 묻는다. 남겠다고 하면 주소를 되돌린다
  if (currentRoute.startsWith('notices/') && h !== currentRoute && dirty) {
    if (!confirm('저장하지 않은 공지가 있습니다. 나갈까요?')) { history.pushState({ fromApp: true }, '', '#' + currentRoute); return; }
  }
  dirty = false;
  if (!(menu in MENUS)) { history.replaceState(null, '', '#notices'); return route(); }
  currentRoute = h;
  document.querySelectorAll('.side-nav a[data-menu]').forEach(a => a.classList.toggle('on', a.dataset.menu === menu));
  if (menu === 'notices' && sub) {
    document.querySelectorAll('section[data-view]').forEach(s => { s.hidden = s.id !== 'notice-edit-view'; });
    return renderEditor(sub === 'new' ? null : sub);
  }
  document.querySelectorAll('section[data-view]').forEach(s => { s.hidden = s.id !== FIRST_VIEW[menu]; });
  MENUS[menu]();
}
window.addEventListener('popstate', () => { if (ME) route(); });
document.querySelector('.side-nav').addEventListener('click', e => {
  const a = e.target.closest('a[data-menu]');
  if (a) go('#' + a.dataset.menu);
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
    (!q || n.title.toLowerCase().includes(q)) &&
    (!f || (f === 'active' && n.active) || (f === 'hidden' && !n.active) || (f === 'pinned' && n.pinned)));
  $('notice-count').textContent = `${list.length}개 / 전체 ${notices.length}개`;
  $('notice-rows').innerHTML = list.length ? list.map(n => `
    <tr class="${n.active ? '' : 'off'}">
      <td><button class="pin-btn${n.pinned ? ' on' : ''}" title="${n.pinned ? '고정 풀기' : '맨 위에 고정'}" data-pin="${esc(n.id)}">📌</button></td>
      <td><span class="chip">${esc(n.category)}</span></td>
      <td class="title" data-edit="${esc(n.id)}">${esc(n.title)}</td>
      <td><span class="chip ${n.active ? 'on' : 'off'}">${n.active ? '보임' : '숨김'}</span></td>
      <td class="num">${Number(n.views || 0).toLocaleString('ko-KR')}</td>
      <td>${fmtDate(n.createdAt)}</td>
      <td><div class="acts">
        <button class="btn sm" data-edit="${esc(n.id)}">수정</button>
        <button class="btn sm" data-toggle="${esc(n.id)}">${n.active ? '숨기기' : '보이기'}</button>
        <button class="btn sm danger" data-del="${esc(n.id)}">삭제</button>
      </div></td>
    </tr>`).join('') : `<tr><td colspan="7" class="empty">${notices.length ? '조건에 맞는 공지가 없습니다.' : '아직 공지가 없습니다. 오른쪽 위 \'+ 새 공지\' 로 첫 공지를 써 보세요.'}</td></tr>`;
}
$('notice-q').addEventListener('input', renderNotices);
$('notice-filter').addEventListener('change', renderNotices);
$('notice-rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-edit],[data-toggle],[data-pin],[data-del]');
  if (!b) return;
  const id = b.dataset.edit || b.dataset.toggle || b.dataset.pin || b.dataset.del;
  const n = notices.find(x => x.id === id);
  if (b.dataset.edit) return go('#notices/' + id);
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

// 쓰기 · 고치기 화면을 그린다 — 주소(#notices/new · #notices/<번호>)가 바뀌면 route() 가 부른다
async function renderEditor(id) {
  editingId = id || null;
  // 주소로 바로 들어오면(새로고침 등) 분류 목록이 아직 없다
  if (!categories.length) { try { categories = (await api('/api/admin/notices')).categories; } catch (e) { return handleErr(e); } }
  let n = { category: categories[0], title: '', body: '', pinned: false, active: true, files: [], createdAt: '' };
  if (id) {
    try { n = (await api(`/api/admin/notices/${id}`)).notice; }
    catch (e) { if (e.status === 404) { toast('없는 공지입니다'); history.replaceState(null, '', '#notices'); return route(); } return handleErr(e); }
  }
  $('f-category').innerHTML = categories.map(c => `<option${c === n.category ? ' selected' : ''}>${esc(c)}</option>`).join('');
  $('f-title').value = n.title; $('f-body').value = n.body;
  $('f-pinned').checked = !!n.pinned; $('f-active').checked = n.active !== false;
  $('f-created').value = toLocalInput(n.createdAt);
  editFiles = (n.files || []).map(f => ({ ...f })); renderFiles();
  $('edit-title').textContent = id ? '공지 수정' : '새 공지';
  $('danger-zone').hidden = !id;
  $('form-err').textContent = '';
  dirty = false;
  $('f-title').focus();
}
// 목록으로 — 저장 안 한 내용이 있으면 route() 가 묻는다. force(저장 · 삭제 뒤)면 묻지 않는다
function closeEditor(force) {
  if (force) dirty = false;
  backTo('#notices');
}
// ───────── 첨부 — 파일을 고르거나 끌어다 놓으면 바로 서버에 올리고(/api/admin/notice-files) 아래 목록에 쌓는다 ─────────
// 공지에 붙는 건 '저장' 할 때. 저장 전에 빼면 서버 파일은 남지만 공지에는 안 붙는다 (빠진 파일은 저장할 때 서버가 지운다)
const FILE_MAX = 20 * 1024 * 1024, FILE_LIMIT = 10;
let editFiles = [];      // { name, url, size } · 올리는 중이면 { name, uploading: true }
function renderFiles() {
  const ext = n => (String(n).split('.').pop() || '').toUpperCase().slice(0, 4);
  $('file-rows').innerHTML = editFiles.map((f, i) => `
    <li class="${f.uploading ? 'uploading' : ''}">
      <span class="fext">${esc(ext(f.name))}</span>
      ${f.url ? `<a class="fname" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>` : `<span class="fname">${esc(f.name)}</span>`}
      <span class="fsize">${f.uploading ? '올리는 중…' : esc(f.size || '')}${!f.uploading && !f.url ? ' · 받기 주소 없음' : ''}</span>
      ${f.uploading ? '' : `<button type="button" class="x-btn" data-fdel="${i}" title="빼기" aria-label="${esc(f.name)} 빼기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}
    </li>`).join('');
}
$('file-rows').addEventListener('click', e => {
  const b = e.target.closest('[data-fdel]');
  if (!b) return;
  editFiles.splice(Number(b.dataset.fdel), 1); dirty = true; renderFiles();
});
const readAsDataUrl = file => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => fail(r.error); r.readAsDataURL(file); });
async function addFiles(list) {
  const files = [...list];
  $('form-err').textContent = '';
  const room = FILE_LIMIT - editFiles.filter(f => !f.failed).length;
  if (files.length > room) { $('form-err').textContent = `첨부는 ${FILE_LIMIT}개까지입니다. ${room}개만 더 올릴 수 있어요.`; files.length = Math.max(0, room); }
  const errs = [];
  // 한 개씩 차례로 올린다 (큰 파일 여러 개를 한꺼번에 보내면 요청 한도를 넘는다)
  for (const file of files) {
    if (file.size > FILE_MAX) { errs.push(`${file.name}: 20MB 를 넘습니다`); continue; }
    const slot = { name: file.name, uploading: true };
    editFiles.push(slot); renderFiles();
    try {
      const { file: up } = await api('/api/admin/notice-files', { method: 'POST', body: JSON.stringify({ name: file.name, data: await readAsDataUrl(file) }) });
      Object.assign(slot, up, { uploading: false });
      dirty = true;
    } catch (err) {
      editFiles.splice(editFiles.indexOf(slot), 1);
      errs.push(err.message);
      if (err.status === 401 || err.status === 403) { handleErr(err); break; }
    }
    renderFiles();
  }
  if (errs.length) $('form-err').textContent = errs.join(' / ');
}
$('file-input').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
const drop = $('file-drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

function formValue() {
  const files = editFiles.filter(f => !f.uploading).map(f => ({ name: f.name, ...(f.url ? { url: f.url } : {}), ...(f.size ? { size: f.size } : {}) }));
  const created = $('f-created').value;
  return {
    category: $('f-category').value, title: $('f-title').value.trim(),
    body: $('f-body').value, pinned: $('f-pinned').checked, active: $('f-active').checked, files,
    ...(created ? { createdAt: new Date(created).toISOString() } : {}),
  };
}
$('notice-form').addEventListener('input', () => { dirty = true; });
$('notice-form').addEventListener('change', () => { dirty = true; });
$('new-notice-btn').addEventListener('click', () => go('#notices/new'));
$('edit-cancel').addEventListener('click', () => closeEditor());
$('edit-save').addEventListener('click', async () => {
  const v = formValue();
  $('form-err').textContent = '';
  if (!v.title || !v.body.trim()) { $('form-err').textContent = '분류 · 제목 · 본문은 꼭 입력해야 합니다.'; return; }
  if (editFiles.some(f => f.uploading)) { $('form-err').textContent = '첨부 파일을 올리는 중이에요. 다 올라간 뒤 저장해 주세요.'; return; }
  $('edit-save').disabled = true;
  try {
    if (editingId) await api(`/api/admin/notices/${editingId}`, { method: 'PUT', body: JSON.stringify(v) });
    else await api('/api/admin/notices', { method: 'POST', body: JSON.stringify(v) });
    toast(editingId ? '저장했습니다' : '공지를 올렸습니다' + (v.active ? '' : ' (숨김 상태)'));
    closeEditor(true);
  } catch (err) { $('form-err').textContent = err.message; if (err.status === 401 || err.status === 403) handleErr(err); }
  finally { $('edit-save').disabled = false; }
});
$('edit-delete').addEventListener('click', async () => {
  const n = notices.find(x => x.id === editingId) || { id: editingId, title: $('f-title').value };
  try { if (await confirmDelete(n)) closeEditor(true); } catch (err) { handleErr(err); }
});
window.addEventListener('beforeunload', e => { if (dirty && !$('notice-edit-view').hidden) { e.preventDefault(); e.returnValue = ''; } });

function handleErr(e) {
  if (e.status === 401) return showGate('로그인이 끝났습니다. 다시 로그인하세요.');
  if (e.status === 403) return showGate('관리자만 쓸 수 있습니다.');
  toast(e.message);
}

// 다른 메뉴 파일(admin-users.js)까지 읽힌 뒤 시작한다
window.addEventListener('DOMContentLoaded', start);
