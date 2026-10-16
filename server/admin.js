// 관리자 API — /api/admin/... 는 모두 관리자(users.role = 'admin')만 쓸 수 있다 (auth.requireAdmin).
// 화면은 admin/ (PC 용 관리자 페이지, http://…:8999/admin). 권한은 화면이 아니라 여기서 서버 세션으로 판단한다.
//
//   공지사항
//   GET    /api/admin/notices          전체 (숨긴 공지 포함) + 조회수
//   GET    /api/admin/notices/:id      한 개 (본문 · 첨부 포함)
//   POST   /api/admin/notices          새 공지  { category, title, body, author, pinned, active, files, createdAt }
//   PUT    /api/admin/notices/:id      고치기   (보낸 칸만 바뀐다)
//   DELETE /api/admin/notices/:id      지우기   (조회 기록도 같이 지워진다. 되돌릴 수 없어 화면은 숨기기를 먼저 권한다)
//
//   직원 명단 (회원가입은 없다 — 여기 넣은 직원이 '사번인증 및 비밀번호 설정'으로 처음 로그인한다)
//   GET    /api/admin/users                명단 + 상태(사번인증 전 · 인증완료 · 막힘). 비밀번호 해시 · 연락처는 보내지 않는다
//   POST   /api/admin/users                한 명 추가 { empno, name, position, department, company, email, role }
//   PUT    /api/admin/users/:empno         고치기 { name, position, department, company, email, role, active }
//   POST   /api/admin/users/:empno/reset   비밀번호 초기화 → 그 직원은 사번인증부터 다시 (로그인도 끊는다)
//   POST   /api/admin/users/import         CSV 명단 { csv, commit } — commit 이 아니면 결과만 보여주고 넣지 않는다
//   자기 자신의 관리자 권한 빼기 · 로그인 막기는 안 된다 (아무도 관리자 페이지에 못 들어가는 일을 막는다)

// 화면 분류 칩과 같아야 한다 (screens/tips.html · tools/notices.js 도 이 목록을 쓴다)
const NOTICE_CATEGORIES = ['이용수칙', '예약', '복지포인트', '이벤트', '시설'];
const LIMIT = { title: 100, author: 30, body: 20000, files: 10 };

// 직원 명단 CSV — 첫 줄은 머리글. 열: 사번,이름,직급,이메일[,부서,회사] (tools/users.js import 와 같은 모양)
// 따옴표로 감싼 칸("A, B")도 읽는다. 돌려주는 rows 는 { line, empno, name, position, email, department, company }
// 회사명은 법인 표기(주식회사 · (주))를 떼고 저장한다 — 후기(tools/import_reviews.js)와 같은 규칙. 같은 회사가 두 이름으로 갈리지 않게
const { cleanCompanyName } = require('../tools/clean_company');
const isCompanyMail = s => /^[^\s@]+@itcen\.com$/i.test(String(s || '').trim());
function parseUserCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  const cells = line => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const rows = [];
  lines.forEach((l, i) => {
    if (i === 0 || !l.trim()) return;
    const [empno = '', name = '', position = '', email = '', department = '', company = ''] = cells(l);
    rows.push({ line: i + 1, empno, name, position, email: email.toLowerCase(), department, company: cleanCompanyName(company) });
  });
  return rows;
}

function register(app, db, auth) {
  const { requireAdmin } = auth;
  const now = () => new Date().toISOString();
  const bad = (res, msg) => res.status(400).json({ error: msg });

  const views = db.prepare('SELECT COUNT(*) AS c FROM notice_views WHERE notice_id = ?');
  const rowOut = (n, withBody) => ({
    id: String(n.id), category: n.category, title: n.title, author: n.author,
    pinned: !!n.pinned, active: !!n.active, createdAt: n.created_at, updatedAt: n.updated_at,
    views: views.get(n.id).c,
    ...(withBody ? { body: n.body, files: n.files ? JSON.parse(n.files) : [] } : {}),
  });

  // 보낸 값 검사 → DB 칸 값. partial 이면 보낸 칸만 (고치기)
  function clean(b, partial) {
    const out = {};
    const has = k => b[k] !== undefined;
    if (!partial || has('category')) {
      if (!NOTICE_CATEGORIES.includes(b.category)) return { error: `분류는 ${NOTICE_CATEGORIES.join(' · ')} 중 하나여야 합니다.` };
      out.category = b.category;
    }
    for (const k of ['title', 'author', 'body']) {
      if (!partial || has(k)) {
        const v = String(b[k] ?? '').trim();
        if (!v) return { error: { title: '제목', author: '작성 부서', body: '본문' }[k] + '을(를) 입력해주세요.' };
        if (v.length > LIMIT[k]) return { error: `${k === 'title' ? '제목' : k === 'author' ? '작성 부서' : '본문'}이 너무 깁니다 (${LIMIT[k]}자 이내).` };
        out[k] = v;
      }
    }
    if (has('pinned')) out.pinned = b.pinned ? 1 : 0;
    if (has('active')) out.active = b.active ? 1 : 0;
    if (has('files')) {
      if (!Array.isArray(b.files) || b.files.length > LIMIT.files) return { error: `첨부는 ${LIMIT.files}개까지입니다.` };
      const files = [];
      for (const f of b.files) {
        const name = String(f?.name || '').trim();
        const url = String(f?.url || '').trim();
        if (!name) continue;
        // 받기 주소는 http(s) 만 (javascript: 같은 주소로 엉뚱한 동작을 막는다)
        if (url && !/^https?:\/\//i.test(url)) return { error: `첨부 주소는 http:// 또는 https:// 로 시작해야 합니다: ${name}` };
        files.push({ name: name.slice(0, 100), ...(url ? { url } : {}), ...(f.size ? { size: String(f.size).slice(0, 20) } : {}) });
      }
      out.files = files.length ? JSON.stringify(files) : null;
    }
    if (has('createdAt') && b.createdAt) {
      const d = new Date(b.createdAt);
      if (isNaN(d)) return { error: '작성일 형식이 틀립니다.' };
      out.created_at = d.toISOString();
    }
    return { out };
  }

  app.get('/api/admin/notices', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM notices ORDER BY pinned DESC, datetime(created_at) DESC, id DESC').all();
    res.json({ notices: rows.map(n => rowOut(n, false)), categories: NOTICE_CATEGORIES });
  });

  app.get('/api/admin/notices/:id', requireAdmin, (req, res) => {
    const n = db.prepare('SELECT * FROM notices WHERE id = ?').get(Number(req.params.id));
    if (!n) return res.status(404).json({ error: '공지를 찾을 수 없습니다.' });
    res.json({ notice: rowOut(n, true) });
  });

  app.post('/api/admin/notices', requireAdmin, (req, res) => {
    const { out, error } = clean(req.body || {}, false);
    if (error) return bad(res, error);
    const at = now();
    const info = db.prepare(`INSERT INTO notices (category, title, body, author, pinned, files, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(out.category, out.title, out.body, out.author, out.pinned || 0,
      out.files ?? null, out.active === undefined ? 1 : out.active, out.created_at || at, at);
    const n = db.prepare('SELECT * FROM notices WHERE id = ?').get(Number(info.lastInsertRowid));
    console.log(`[admin] 공지 추가 #${n.id} by ${req.user.empno}`);
    res.status(201).json({ notice: rowOut(n, true) });
  });

  app.put('/api/admin/notices/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM notices WHERE id = ?').get(id)) return res.status(404).json({ error: '공지를 찾을 수 없습니다.' });
    const { out, error } = clean(req.body || {}, true);
    if (error) return bad(res, error);
    const cols = Object.keys(out);
    if (!cols.length) return bad(res, '바꿀 내용이 없습니다.');
    db.prepare(`UPDATE notices SET ${cols.map(c => c + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`)
      .run(...cols.map(c => out[c]), now(), id);
    console.log(`[admin] 공지 수정 #${id} (${cols.join(',')}) by ${req.user.empno}`);
    res.json({ notice: rowOut(db.prepare('SELECT * FROM notices WHERE id = ?').get(id), true) });
  });

  app.delete('/api/admin/notices/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM notice_views WHERE notice_id = ?').run(id);
      const n = db.prepare('DELETE FROM notices WHERE id = ?').run(id).changes;
      db.exec('COMMIT');
      if (!n) return res.status(404).json({ error: '공지를 찾을 수 없습니다.' });
      console.log(`[admin] 공지 삭제 #${id} by ${req.user.empno}`);
      res.json({ ok: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  });

  // ───────── 직원 명단 ─────────
  const findUser = empno => db.prepare('SELECT * FROM users WHERE empno = ?').get(String(empno || '').trim());
  const status = u => (!u.active ? 'blocked' : u.password_hash ? 'ready' : 'pending');
  const lastLogin = db.prepare('SELECT MAX(created_at) AS t FROM sessions WHERE empno = ?');
  const reviewCount = db.prepare('SELECT COUNT(*) AS c FROM reviews WHERE empno = ?');
  const userOut = u => ({
    empno: u.empno, name: u.name, position: u.position || '', department: u.department || '', company: u.company || '',
    email: u.email || '', role: u.role, active: !!u.active, status: status(u),
    lastLogin: lastLogin.get(u.empno).t || null, reviews: reviewCount.get(u.empno).c,
    createdAt: u.created_at, updatedAt: u.updated_at,
  });
  const T = v => String(v ?? '').trim();
  // 보낸 값 검사. partial 이면 보낸 칸만 (고치기)
  function cleanUser(b, partial) {
    const out = {};
    const has = k => b[k] !== undefined;
    if (!partial) {
      if (!/^\w{2,20}$/.test(T(b.empno))) return { error: '사번을 확인해주세요 (영문 · 숫자 2~20자).' };
      out.empno = T(b.empno);
    }
    if (!partial || has('name')) { if (!T(b.name) || T(b.name).length > 30) return { error: '이름을 확인해주세요 (30자 이내).' }; out.name = T(b.name); }
    for (const k of ['position', 'department', 'company']) if (!partial || has(k)) { if (T(b[k]).length > 50) return { error: '직급 · 부서 · 회사는 50자 이내입니다.' }; out[k] = (k === 'company' ? cleanCompanyName(b[k]) : T(b[k])) || null; }
    if (!partial || has('email')) {
      if (!isCompanyMail(b.email)) return { error: '회사 메일(@itcen.com)을 넣어주세요. 사번인증 때 이 메일로 본인 확인을 합니다.' };
      out.email = T(b.email).toLowerCase();
    }
    if (!partial || has('role')) { const r = b.role || 'user'; if (!['user', 'admin'].includes(r)) return { error: '역할은 user 또는 admin 입니다.' }; out.role = r; }
    if (has('active')) out.active = b.active ? 1 : 0;
    return { out };
  }

  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM users ORDER BY role = \'admin\' DESC, empno').all();
    res.json({ users: rows.map(userOut) });
  });

  app.post('/api/admin/users', requireAdmin, (req, res) => {
    const { out, error } = cleanUser(req.body || {}, false);
    if (error) return bad(res, error);
    if (findUser(out.empno)) return bad(res, `사번 ${out.empno} 는 이미 명단에 있습니다.`);
    db.prepare(`INSERT INTO users (empno, name, position, department, company, email, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(out.empno, out.name, out.position, out.department, out.company, out.email, out.role, now(), now());
    console.log(`[admin] 직원 추가 ${out.empno} (${out.role}) by ${req.user.empno}`);
    res.status(201).json({ user: userOut(findUser(out.empno)) });
  });

  app.put('/api/admin/users/:empno', requireAdmin, (req, res) => {
    const u = findUser(req.params.empno);
    if (!u) return res.status(404).json({ error: '명단에 없는 사번입니다.' });
    const { out, error } = cleanUser(req.body || {}, true);
    if (error) return bad(res, error);
    const self = u.empno === req.user.empno;
    if (self && out.role === 'user') return bad(res, '내 관리자 권한은 뺄 수 없습니다. 다른 관리자에게 부탁하세요.');
    if (self && out.active === 0) return bad(res, '내 계정은 막을 수 없습니다.');
    const cols = Object.keys(out);
    if (!cols.length) return bad(res, '바꿀 내용이 없습니다.');
    db.prepare(`UPDATE users SET ${cols.map(c => c + ' = ?').join(', ')}, updated_at = ? WHERE empno = ?`).run(...cols.map(c => out[c]), now(), u.empno);
    if (out.active === 0) db.prepare('DELETE FROM sessions WHERE empno = ?').run(u.empno);   // 막으면 지금 로그인도 끊는다
    console.log(`[admin] 직원 수정 ${u.empno} (${cols.join(',')}) by ${req.user.empno}`);
    res.json({ user: userOut(findUser(u.empno)) });
  });

  app.post('/api/admin/users/:empno/reset', requireAdmin, (req, res) => {
    const u = findUser(req.params.empno);
    if (!u) return res.status(404).json({ error: '명단에 없는 사번입니다.' });
    if (u.empno === req.user.empno) return bad(res, '내 비밀번호는 앱의 회원정보 수정에서 바꾸세요.');
    db.prepare('UPDATE users SET password_hash = NULL, updated_at = ? WHERE empno = ?').run(now(), u.empno);
    db.prepare('DELETE FROM sessions WHERE empno = ?').run(u.empno);
    console.log(`[admin] 비밀번호 초기화 ${u.empno} by ${req.user.empno}`);
    res.json({ user: userOut(findUser(u.empno)) });
  });

  app.post('/api/admin/users/import', requireAdmin, (req, res) => {
    const rows = parseUserCsv((req.body || {}).csv);
    if (!rows.length) return bad(res, '파일에 직원이 없습니다. 첫 줄은 제목 줄(사번,이름,직급,이메일,부서,회사)이고, 둘째 줄부터 한 사람씩 읽습니다.');
    if (rows.length > 5000) return bad(res, '한 번에 5,000명까지 올릴 수 있습니다.');
    const seen = new Set();
    const result = rows.map(r => {
      let reason = '';
      if (!r.empno || !r.name) reason = '사번 · 이름이 비어 있음';
      else if (!/^\w{2,20}$/.test(r.empno)) reason = '사번 형식이 이상함';
      else if (!isCompanyMail(r.email)) reason = '회사 메일(@itcen.com)이 아님';
      else if (seen.has(r.empno)) reason = 'CSV 안에서 사번이 겹침';
      else if (findUser(r.empno)) reason = '이미 명단에 있음';
      seen.add(r.empno);
      return { ...r, ok: !reason, reason };
    });
    const add = result.filter(r => r.ok);
    if (req.body.commit && add.length) {
      const ins = db.prepare(`INSERT INTO users (empno, name, position, department, company, email, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'user', ?, ?)`);
      db.exec('BEGIN');
      try { add.forEach(r => ins.run(r.empno, r.name, r.position || null, r.department || null, r.company || null, r.email, now(), now())); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
      console.log(`[admin] 직원 CSV ${add.length}명 추가 by ${req.user.empno}`);
    }
    res.json({ committed: !!req.body.commit, added: add.length, skipped: result.length - add.length, rows: result });
  });
}

module.exports = { register, NOTICE_CATEGORIES, parseUserCsv, isCompanyMail };
