'use strict';
// 사번 로그인 · 사번인증(첫 비밀번호 설정) · 세션 · 권한
//
// 회원가입은 없다. 직원 명단(users)은 관리자가 미리 넣고(tools/users.js), 직원은 처음 한 번
// '사번인증 및 비밀번호 설정' 화면에서 본인 확인 → 비밀번호를 정한다.
//
// 흐름
//   사번인증 POST /api/auth/verify/code   사번 + 회사 메일이 명단과 같으면 인증코드 발급
//            POST /api/auth/verify/check  코드 확인 → 명단의 이름·직급을 돌려준다 (화면 자동 입력)
//            POST /api/auth/activate      코드 + 새 비밀번호 + 연락처 → 비밀번호 설정 완료
//   로그인  POST /api/auth/login  사번+비밀번호 확인 → 세션 토큰을 HttpOnly 쿠키로 내려준다
//   이후    브라우저가 쿠키를 자동으로 보낸다 → 서버가 세션으로 "누구인지" 판단 (req.user)
//   권한    후기 작성·삭제·댓글·알림은 화면이 보낸 사번이 아니라 req.user 로만 판단한다
//
// 저장
//   users           직원 명단 + 비밀번호 (scrypt 해시로만 저장 — 원문은 어디에도 남지 않는다)
//                   password_hash 가 비어 있으면 아직 사번인증을 안 한 직원
//   sessions        로그인 세션 (토큰 원문 대신 SHA-256 해시를 저장)
//   verify_codes    사번인증 코드 (10분 유효, 5번 틀리면 다시 발급)
//
// ⚠️ 메일 발송 서버(SMTP)가 아직 없다. 그래서 인증코드를 응답에 담아 화면에 보여준다 (개발용).
//    메일 발송을 붙이면 AUTH_SHOW_CODE=0 으로 끄고 sendVerifyMail() 을 채운다.

const crypto = require('crypto');

const SESSION_COOKIE = 'cr_session';
const SESSION_DAYS_KEEP = 30;          // '로그인 유지' 체크
const SESSION_HOURS = 12;              // 체크 안 함 (브라우저를 닫으면 쿠키도 사라진다)
const CODE_MINUTES = 10;
const PW_MIN = 4;                      // 화면 규칙과 같다 (비밀번호 설정·정보수정)
const SHOW_CODE = process.env.AUTH_SHOW_CODE !== '0';
const LOGIN_MAX_FAIL = 5;              // 같은 사번으로 연속 실패하면
const LOGIN_LOCK_MIN = 5;              // 이 시간 동안 막는다

function setup(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      empno          TEXT PRIMARY KEY,      -- 사번 (로그인 아이디)
      name           TEXT NOT NULL,
      position       TEXT,                  -- 직급
      department     TEXT,
      company        TEXT,
      email          TEXT,                  -- 회사 메일 — 사번인증 때 본인 확인에 쓴다
      phone          TEXT,
      password_hash  TEXT,                  -- scrypt$salt$hash. 비어 있으면 사번인증 전
      role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      active         INTEGER NOT NULL DEFAULT 1,   -- 0 이면 로그인 불가 (퇴사 등)
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash  TEXT PRIMARY KEY,
      empno       TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      FOREIGN KEY (empno) REFERENCES users(empno) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verify_codes (
      empno       TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      code_hash   TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      expires_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_empno ON sessions(empno);
  `);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}

// ───────────── 비밀번호 · 토큰 ─────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(String(pw), salt, a.length);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// 화면에 내려줄 회원 정보 (비밀번호 해시는 절대 내보내지 않는다)
function publicUser(u) {
  return {
    empno: u.empno, name: u.name, position: u.position || '',
    department: u.department || '', company: u.company || '',
    email: u.email || '', phone: u.phone || '', role: u.role,
  };
}
// 후기·댓글에 남는 작성자 표시 이름 ('홍길동 책임')
function displayName(u) {
  return [u.name, u.position].filter(Boolean).join(' ').trim() || u.empno;
}

function register(app, db) {
  setup(db);

  const now = () => new Date().toISOString();
  const findUser = empno => db.prepare('SELECT * FROM users WHERE empno = ?').get(String(empno || '').trim());

  function startSession(req, res, empno, keep) {
    const token = crypto.randomBytes(32).toString('hex');
    const ms = keep ? SESSION_DAYS_KEEP * 864e5 : SESSION_HOURS * 36e5;
    db.prepare('INSERT INTO sessions (token_hash, empno, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(sha256(token), empno, now(), new Date(Date.now() + ms).toISOString());
    const parts = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
    if (keep) parts.push(`Max-Age=${Math.floor(ms / 1000)}`);
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }
  function clearCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  // 모든 /api 요청: 쿠키의 세션으로 req.user 를 채운다 (없으면 null)
  app.use('/api', (req, _res, next) => {
    req.user = null;
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
      const s = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token));
      if (s && s.expires_at > now()) {
        const u = findUser(s.empno);
        if (u && u.active) { req.user = u; req.sessionHash = s.token_hash; }
      }
    }
    next();
  });

  // ───────────── 로그인 · 로그아웃 · 내 정보 ─────────────
  const fails = new Map();   // 사번 → { n, until }  (서버 재시작 시 초기화 — 간단한 무차별 대입 방지)

  app.post('/api/auth/login', (req, res) => {
    const empno = String(req.body?.empno || '').trim();
    const password = String(req.body?.password || '');
    if (!empno || !password) return res.status(400).json({ error: '사번과 비밀번호를 모두 입력해주세요.' });

    const f = fails.get(empno);
    if (f && f.until > Date.now()) {
      return res.status(429).json({ error: `로그인을 여러 번 실패했어요. ${LOGIN_LOCK_MIN}분 뒤에 다시 시도해주세요.` });
    }
    const u = findUser(empno);
    if (!u || !u.active || !verifyPassword(password, u.password_hash)) {
      // 잠금이 풀린 뒤(until 지남)에는 0부터 다시 센다
      const n = (f && !f.until ? f.n : 0) + 1;
      fails.set(empno, { n, until: n >= LOGIN_MAX_FAIL ? Date.now() + LOGIN_LOCK_MIN * 6e4 : 0 });
      return res.status(401).json({ error: '사번 또는 비밀번호가 올바르지 않습니다.' });
    }
    fails.delete(empno);
    startSession(req, res, u.empno, !!req.body?.keep);
    res.json({ user: publicUser(u) });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.sessionHash) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
    clearCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    res.json({ user: publicUser(req.user) });
  });

  // 내 정보 수정 — 연락처 · 메일 · 비밀번호. 이름·직급은 관리자가 바꾼다
  app.put('/api/auth/me', requireUser, (req, res) => {
    const b = req.body || {};
    const u = req.user;
    const phone = String(b.phone ?? u.phone ?? '').trim();
    const email = String(b.email ?? u.email ?? '').trim();
    let hash = u.password_hash;
    if (b.newPassword) {
      if (!verifyPassword(b.currentPassword || '', u.password_hash)) {
        return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
      }
      if (String(b.newPassword).length < PW_MIN) {
        return res.status(400).json({ error: `새 비밀번호는 ${PW_MIN}자리 이상으로 설정해주세요.` });
      }
      hash = hashPassword(b.newPassword);
    }
    db.prepare('UPDATE users SET phone = ?, email = ?, password_hash = ?, updated_at = ? WHERE empno = ?')
      .run(phone, email, hash, now(), u.empno);
    // 비밀번호를 바꿨으면 다른 기기의 로그인은 끊는다
    if (hash !== u.password_hash) {
      db.prepare('DELETE FROM sessions WHERE empno = ? AND token_hash != ?').run(u.empno, req.sessionHash);
    }
    res.json({ user: publicUser(findUser(u.empno)) });
  });

  // ───────────── 사번인증 및 비밀번호 설정 ─────────────
  // 1) 인증코드 발급 — 사번과 회사 메일이 직원 명단과 같아야 한다 (지금은 SMTP 가 없어 응답에 코드를 담는다)
  app.post('/api/auth/verify/code', (req, res) => {
    const empno = String(req.body?.empno || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!empno) return res.status(400).json({ error: '사번을 입력해주세요.' });
    if (!/^[^\s@]+@itcen\.com$/i.test(email)) {
      return res.status(400).json({ error: '회사 개인 이메일(@itcen.com)을 정확히 입력해주세요.' });
    }
    const u = findUser(empno);
    // 명단에 없는 사번인지, 메일만 틀린 건지는 알려주지 않는다 (남의 사번 확인 방지)
    if (!u || !u.active || String(u.email || '').toLowerCase() !== email) {
      return res.status(400).json({ error: '사번과 이메일이 직원 정보와 일치하지 않습니다. 계속 안 되면 담당자에게 문의해주세요.' });
    }
    if (u.password_hash) {
      return res.status(409).json({ error: '이미 비밀번호를 설정한 사번입니다. 로그인해주세요. 비밀번호를 잊었다면 담당자에게 초기화를 요청해주세요.' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    db.prepare(`
      INSERT INTO verify_codes (empno, email, code_hash, attempts, expires_at) VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(empno) DO UPDATE SET email = excluded.email, code_hash = excluded.code_hash,
        attempts = 0, expires_at = excluded.expires_at`
    ).run(empno, email, sha256(code), new Date(Date.now() + CODE_MINUTES * 6e4).toISOString());
    // TODO(SMTP): sendVerifyMail(email, code)
    res.json(SHOW_CODE ? { ok: true, devCode: code } : { ok: true });
  });

  // 2) 코드 확인 (화면의 '확인' 버튼) → 명단의 이름·직급을 돌려준다
  app.post('/api/auth/verify/check', (req, res) => {
    const r = checkCode(req.body?.empno, req.body?.code);
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ name: r.user.name, position: r.user.position || '' });
  });

  // 3) 비밀번호 설정 — 코드를 한 번 더 확인하고, 성공하면 코드를 지운다
  app.post('/api/auth/activate', (req, res) => {
    const b = req.body || {};
    const password = String(b.password || '');
    if (password.length < PW_MIN) return res.status(400).json({ error: `비밀번호는 ${PW_MIN}자리 이상으로 설정해주세요.` });
    const r = checkCode(b.empno, b.code);
    if (r.error) return res.status(400).json({ error: r.error });
    if (r.user.password_hash) return res.status(409).json({ error: '이미 비밀번호를 설정한 사번입니다. 로그인해주세요.' });

    db.prepare('UPDATE users SET password_hash = ?, phone = ?, updated_at = ? WHERE empno = ?')
      .run(hashPassword(password), String(b.phone || '').trim() || r.user.phone || null, now(), r.user.empno);
    db.prepare('DELETE FROM verify_codes WHERE empno = ?').run(r.user.empno);
    res.json({ ok: true });
  });

  function checkCode(empnoIn, codeIn) {
    const empno = String(empnoIn || '').trim();
    const row = db.prepare('SELECT * FROM verify_codes WHERE empno = ?').get(empno);
    if (!row || row.expires_at < now()) return { error: '인증코드를 다시 발급받아주세요.' };
    if (row.attempts >= 5) return { error: '인증코드를 여러 번 틀렸어요. 다시 발급받아주세요.' };
    if (sha256(String(codeIn || '').trim()) !== row.code_hash) {
      db.prepare('UPDATE verify_codes SET attempts = attempts + 1 WHERE empno = ?').run(empno);
      return { error: '인증코드가 일치하지 않습니다.' };
    }
    const user = findUser(empno);
    if (!user || !user.active) return { error: '인증코드를 다시 발급받아주세요.' };
    return { user };
  }
}

// ───────────── 권한 미들웨어 ─────────────
function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 할 수 있습니다.' });
  next();
}

module.exports = { setup, register, requireUser, requireAdmin, displayName, hashPassword };
