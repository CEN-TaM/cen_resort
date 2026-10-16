// 관리자 API — /api/admin/... 는 모두 관리자(users.role = 'admin')만 쓸 수 있다 (auth.requireAdmin).
// 화면은 admin/ (PC 용 관리자 페이지, http://…:8999/admin). 권한은 화면이 아니라 여기서 서버 세션으로 판단한다.
//
//   공지사항
//   GET    /api/admin/notices          전체 (숨긴 공지 포함) + 조회수
//   GET    /api/admin/notices/:id      한 개 (본문 · 첨부 포함)
//   POST   /api/admin/notices          새 공지  { category, title, body, author, pinned, active, files, createdAt }
//   PUT    /api/admin/notices/:id      고치기   (보낸 칸만 바뀐다)
//   DELETE /api/admin/notices/:id      지우기   (조회 기록도 같이 지워진다. 되돌릴 수 없어 화면은 숨기기를 먼저 권한다)

// 화면 분류 칩과 같아야 한다 (screens/tips.html · tools/notices.js 도 이 목록을 쓴다)
const NOTICE_CATEGORIES = ['이용수칙', '예약', '복지포인트', '이벤트', '시설'];
const LIMIT = { title: 100, author: 30, body: 20000, files: 10 };

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
}

module.exports = { register, NOTICE_CATEGORIES };
