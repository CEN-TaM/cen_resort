// 관리자 페이지 — 직원 명단 · 권한
// API: /api/admin/users (server/admin.js). 공용 함수($ · esc · api · toast · fmtDate · handleErr · ME)는 admin.js
// 회원가입은 없다: 여기 넣은 직원이 앱의 '사번인증 및 비밀번호 설정'(사번 + 회사 메일)으로 처음 로그인한다.

const USER_STATUS = { pending: '사번인증 전', ready: '인증 완료', blocked: '로그인 막힘' };
let users = [];
let editingEmpno = null;

MENUS.users = () => loadUsers();

async function loadUsers() {
  try { users = (await api('/api/admin/users')).users; renderUsers(); } catch (e) { handleErr(e); }
}

function renderUsers() {
  const q = $('user-q').value.trim().toLowerCase();
  const f = $('user-filter').value;
  const list = users.filter(u =>
    (!q || [u.empno, u.name, u.department, u.company, u.email].join(' ').toLowerCase().includes(q)) &&
    (!f || (f === 'admin' ? u.role === 'admin' : u.status === f)));
  const n = s => users.filter(u => u.status === s).length;
  $('user-count').textContent = `${list.length}명 / 전체 ${users.length}명 · 사번인증 전 ${n('pending')} · 인증 완료 ${n('ready')} · 막힘 ${n('blocked')}`;
  if (!list.length) paged('users', list, 'user-pager', renderUsers);   // 비면 쪽 번호도 지운다
  $('user-rows').innerHTML = list.length ? paged('users', list, 'user-pager', renderUsers).map(u => {
    const me = ME && u.empno === ME.empno;
    return `
    <tr class="${u.active ? '' : 'off'}">
      <td>${esc(u.empno)}</td>
      <td><b>${esc(u.name)}</b>${me ? '<span class="me-tag">나</span>' : ''}</td>
      <td>${esc(u.position) || '<span class="muted">-</span>'}</td>
      <td>${esc(u.company)}${u.company && u.department ? ' · ' : ''}<span class="muted">${esc(u.department)}</span></td>
      <td class="mail">${esc(u.email)}</td>
      <td class="c"><span class="chip ${u.role === 'admin' ? 'admin' : ''}">${u.role === 'admin' ? '관리자' : '직원'}</span></td>
      <td class="c"><span class="chip ${u.status === 'ready' ? 'on' : u.status}">${USER_STATUS[u.status]}</span></td>
      <td class="num"><button type="button" class="link pt-link" data-upoint="${esc(u.empno)}" title="포인트 내역 · 조정">${Number(u.points || 0).toLocaleString('ko-KR')}P</button></td>
      <td class="c">${u.lastLogin ? fmtDate(u.lastLogin) : '<span class="muted">-</span>'}</td>
      <td><div class="acts">
        <button class="btn sm" data-uedit="${esc(u.empno)}">수정</button>
        ${me ? '' : `<button class="btn sm" data-ureset="${esc(u.empno)}"${u.status === 'pending' ? ' disabled title="아직 비밀번호를 정하지 않았습니다"' : ''}>비밀번호 초기화</button>
        <button class="btn sm ${u.active ? 'danger' : ''}" data-uactive="${esc(u.empno)}">${u.active ? '로그인 막기' : '막기 풀기'}</button>`}
      </div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="10" class="empty">${users.length ? '조건에 맞는 직원이 없습니다.' : '명단이 비어 있습니다.'}</td></tr>`;
}
$('user-q').addEventListener('input', () => { resetPage('users'); renderUsers(); });
$('user-filter').addEventListener('change', () => { resetPage('users'); renderUsers(); });

$('user-rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-uedit],[data-ureset],[data-uactive],[data-upoint]');
  if (!b || b.disabled) return;
  const empno = b.dataset.uedit || b.dataset.ureset || b.dataset.uactive || b.dataset.upoint;
  const u = users.find(x => x.empno === empno);
  if (b.dataset.uedit) return openUserModal(u);
  if (b.dataset.upoint) return openPointModal(u);
  try {
    if (b.dataset.ureset) {
      if (!confirm(`${u.name} 님의 비밀번호를 초기화할까요?\n\n지금 로그인도 끊기고, 앱의 '사번인증 및 비밀번호 설정' 에서 사번 + 회사 메일(${u.email})로 다시 정해야 합니다.`)) return;
      await api(`/api/admin/users/${encodeURIComponent(empno)}/reset`, { method: 'POST' });
      toast(`${u.name} 님 비밀번호를 초기화했습니다`);
    }
    if (b.dataset.uactive) {
      if (u.active && !confirm(`${u.name} 님의 로그인을 막을까요? (퇴사 등)\n\n지금 로그인도 끊깁니다. 쓴 후기 · 꿀팁은 그대로 남습니다.`)) return;
      await api(`/api/admin/users/${encodeURIComponent(empno)}`, { method: 'PUT', body: JSON.stringify({ active: !u.active }) });
      toast(u.active ? `${u.name} 님 로그인을 막았습니다` : `${u.name} 님 로그인을 다시 허용했습니다`);
    }
    loadUsers();
  } catch (err) { handleErr(err); }
});

// ───────── 추가 · 고치기 ─────────
function openUserModal(u) {
  editingEmpno = u ? u.empno : null;
  $('user-modal-title').textContent = u ? `${u.name} 님 정보 수정` : '한 명 추가';
  $('u-empno').value = u ? u.empno : ''; $('u-empno').disabled = !!u;
  $('u-name').value = u ? u.name : ''; $('u-position').value = u ? u.position : '';
  $('u-company').value = u ? u.company : ''; $('u-department').value = u ? u.department : '';
  $('u-email').value = u ? u.email : ''; $('u-role').value = u ? u.role : 'user';
  // 내 관리자 권한은 여기서 못 뺀다 (서버도 막는다)
  $('u-role').disabled = !!(u && ME && u.empno === ME.empno);
  $('user-err').textContent = '';
  $('user-modal').hidden = false;
  (u ? $('u-name') : $('u-empno')).focus();
}
$('user-new-btn').addEventListener('click', () => openUserModal(null));
$('user-form').addEventListener('submit', async () => {
  const body = {
    name: $('u-name').value, position: $('u-position').value, company: $('u-company').value,
    department: $('u-department').value, email: $('u-email').value, role: $('u-role').value,
  };
  if (!editingEmpno) body.empno = $('u-empno').value;
  if ($('u-role').disabled) delete body.role;
  $('user-err').textContent = '';
  $('user-save').disabled = true;
  try {
    if (editingEmpno) await api(`/api/admin/users/${encodeURIComponent(editingEmpno)}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
    $('user-modal').hidden = true;
    toast(editingEmpno ? '저장했습니다' : `${body.name} 님을 명단에 넣었습니다 — 앱에서 사번인증하면 로그인할 수 있습니다`);
    loadUsers();
  } catch (err) { $('user-err').textContent = err.message; if (err.status === 401 || err.status === 403) handleErr(err); }
  finally { $('user-save').disabled = false; }
});

// ───────── CSV 올리기 (먼저 결과만 보고 → '명단에 넣기') ─────────
let importCsv = '';
$('user-import-btn').addEventListener('click', () => {
  importCsv = ''; $('import-file').value = ''; $('import-result').innerHTML = ''; $('import-err').textContent = '';
  $('import-commit').disabled = true; $('import-modal').hidden = false;
});
// 양식 받기 — 제목 줄만 있는 CSV. 예시 사람은 넣지 않는다 (지우는 걸 잊고 올리면 가짜 직원이 명단에 들어간다)
// 맨 앞 BOM(﻿)이 있어야 엑셀이 한글을 깨지 않고 연다
$('import-template').addEventListener('click', () => {
  const blob = new Blob(['﻿사번,이름,직급,이메일,부서,회사\r\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '직원명단_양식.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
// 엑셀 기본 CSV 는 EUC-KR 이라 UTF-8 로 읽으면 한글이 깨진다(�) → 깨지면 EUC-KR 로 다시 읽는다
async function readCsvFile(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  try { return new TextDecoder('euc-kr').decode(buf); } catch (e) { return utf8; }
}
async function previewImport(commit) {
  $('import-err').textContent = '';
  const r = await api('/api/admin/users/import', { method: 'POST', body: JSON.stringify({ csv: importCsv, commit }) });
  const skip = r.rows.filter(x => !x.ok);
  $('import-result').innerHTML = `
    <div class="import-sum"><span class="ok">${commit ? '넣음' : '넣을 예정'} ${r.added}명</span><span class="skip">건너뜀 ${r.skipped}명</span></div>
    <table class="grid small"><thead><tr><th>줄</th><th>사번</th><th>이름</th><th>직급</th><th>회사 메일</th><th>부서</th><th>회사</th><th>결과</th></tr></thead><tbody>
    ${[...skip, ...r.rows.filter(x => x.ok)].slice(0, 300).map(x => `<tr class="${x.ok ? '' : 'skip'}"><td>${x.line}</td><td>${esc(x.empno)}</td><td>${esc(x.name)}</td><td>${esc(x.position)}</td>
      <td>${esc(x.email)}</td><td>${esc(x.department)}</td><td>${esc(x.company)}</td><td>${x.ok ? (commit ? '넣음' : '넣을 예정') : esc(x.reason)}</td></tr>`).join('')}
    </tbody></table>${r.rows.length > 300 ? `<p class="hint">처음 300줄만 보입니다 (전체 ${r.rows.length}줄).</p>` : ''}`;
  $('import-commit').disabled = commit || !r.added;
  return r;
}
$('import-file').addEventListener('change', async () => {
  const f = $('import-file').files[0];
  if (!f) return;
  try { importCsv = await readCsvFile(f); await previewImport(false); }
  catch (err) { $('import-err').textContent = err.message; $('import-commit').disabled = true; }
});
$('import-commit').addEventListener('click', async () => {
  if (!confirm('위 결과대로 명단에 넣을까요?')) return;
  $('import-commit').disabled = true;
  try { const r = await previewImport(true); toast(`${r.added}명을 명단에 넣었습니다`); loadUsers(); }
  catch (err) { $('import-err').textContent = err.message; }
});

// ───────── 휴양소 포인트 (잔액 · 내역 · 조정) ─────────
// API: GET · POST /api/admin/users/:empno/points. 조정은 내역에 '포인트 조정 · 이유' 로 쌓이고 직원 앱 적립내역에도 보인다
let pointUser = null;
async function openPointModal(u) {
  pointUser = u;
  $('point-modal-title').textContent = `${u.name} 님 휴양소 포인트`;
  $('pt-amount').value = ''; $('pt-note').value = ''; $('pt-sign').value = '1'; $('pt-err').textContent = '';
  $('pt-history').innerHTML = '<div class="muted">불러오는 중...</div>';
  $('point-modal').hidden = false;
  $('pt-amount').focus();
  try { renderPoints(await api(`/api/admin/users/${encodeURIComponent(u.empno)}/points`)); } catch (err) { handleErr(err); }
}
function renderPoints(p) {
  $('pt-balance').textContent = Number(p.balance).toLocaleString('ko-KR');
  $('pt-history').innerHTML = p.history.length ? `<table class="grid sm"><thead><tr><th style="width:96px">날짜</th><th>내용</th><th style="width:90px" class="num">포인트</th></tr></thead><tbody>${
    p.history.map(h => `<tr><td>${fmtDate(h.createdAt)}</td>
      <td>${esc(h.reason)}${h.resortName ? ' · ' + esc(h.resortName) : ''}${h.note ? ' · ' + esc(h.note) : ''}${h.by ? ` <span class="muted">(${esc(h.by)})</span>` : ''}</td>
      <td class="num pt-amt ${h.amount > 0 ? 'plus' : 'minus'}">${h.amount > 0 ? '+' : ''}${h.amount.toLocaleString('ko-KR')}P</td></tr>`).join('')
  }</tbody></table>` : '<div class="muted">아직 포인트 내역이 없습니다.</div>';
}
$('point-form').addEventListener('submit', async () => {
  const n = Number($('pt-amount').value);
  const amount = n * Number($('pt-sign').value);
  const note = $('pt-note').value.trim();
  $('pt-err').textContent = '';
  if (!Number.isInteger(n) || n < 1) { $('pt-err').textContent = '포인트를 1 이상 숫자로 적어 주세요.'; return; }
  if (!note) { $('pt-err').textContent = '이유를 적어 주세요. 직원 앱 적립내역에 같이 보여요.'; return; }
  if (!confirm(`${pointUser.name} 님에게 ${amount > 0 ? '+' : ''}${amount.toLocaleString('ko-KR')}P 를 ${amount > 0 ? '더할까요' : '뺄까요'}?

이유: ${note}`)) return;
  $('pt-save').disabled = true;
  try {
    const p = await api(`/api/admin/users/${encodeURIComponent(pointUser.empno)}/points`, { method: 'POST', body: JSON.stringify({ amount, note }) });
    renderPoints(p);
    $('pt-amount').value = ''; $('pt-note').value = '';
    toast(`${pointUser.name} 님 포인트 ${amount > 0 ? '+' : ''}${amount.toLocaleString('ko-KR')}P — 지금 ${p.balance.toLocaleString('ko-KR')}P`);
    loadUsers();
  } catch (err) { $('pt-err').textContent = err.message; if (err.status === 401 || err.status === 403) handleErr(err); }
  finally { $('pt-save').disabled = false; }
});
