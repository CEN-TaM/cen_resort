'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const { requireUser } = auth;

const app = express();

// 개발 중(pm2 가 아닌 npm start)에는 screens/ 를 고칠 때마다 index.html 을 다시 만든다 (tools/build_index.js).
// 서버(pm2)에서는 저장소에 올라온 index.html 을 그대로 쓴다.
if (!process.env.pm_id) {
  try {
    const { build, OUT, DIR } = require('../tools/build_index');
    const rebuild = () => {
      try {
        const { html } = build();
        if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== html) { fs.writeFileSync(OUT, html); console.log('index.html 다시 만듦 (screens/ 변경)'); }
      } catch (e) { console.error('index.html 만들기 실패:', e.message); }
    };
    rebuild();
    let t = null;
    fs.watch(DIR, () => { clearTimeout(t); t = setTimeout(rebuild, 150); });
  } catch (e) { console.error('screens/ 감시를 켜지 못했습니다:', e.message); }
}
const PORT = process.env.PORT || 8999;

// 프로젝트 루트(= index.html이 있는 상위 폴더)를 정적 서빙
const ROOT_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// CORS: file://로 열어 테스트할 때도 API 호출이 되도록 허용
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// base64 사진이 커질 수 있어 한도를 넉넉히
app.use(express.json({ limit: '30mb' }));

// 로그인 · 세션 — 이 아래 모든 /api 요청에 req.user(로그인한 회원, 없으면 null)를 채운다
auth.register(app, db);

// 업로드된 사진 정적 제공
app.use('/uploads', express.static(UPLOADS_DIR, {
  // 브라우저가 파일 내용을 보고 형식을 추측하지 않게 한다 (확장자대로만 이미지로 보여준다)
  setHeaders: res => res.set('X-Content-Type-Options', 'nosniff'),
}));

// ───────────────────────── 헬퍼 ─────────────────────────

// ── 사진 업로드 ──
// JPG · PNG · WEBP 만 받는다. 화면이 보낸 형식(data:image/...)은 믿지 않고 파일 앞부분(매직 바이트)으로 직접 판별한다.
// SVG 처럼 스크립트를 담을 수 있는 형식이나 이미지인 척하는 다른 파일은 여기서 막힌다.
const PHOTO_MAX_COUNT = 10;                 // 화면(review-write.js PHOTO_MAX)과 같다
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;   // 장당 10MB
function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
// data URL 하나 → { buf, ext } 또는 { error }
function decodePhoto(dataUrl) {
  const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(dataUrl || '');
  if (!m) return { error: '사진 형식이 올바르지 않습니다.' };
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > PHOTO_MAX_BYTES) return { error: `사진은 한 장에 ${PHOTO_MAX_BYTES / 1024 / 1024}MB 까지 올릴 수 있어요.` };
  const ext = sniffImage(buf);
  if (!ext) return { error: '사진은 JPG · PNG · WEBP 만 올릴 수 있어요.' };
  return { buf, ext };
}
function savePhoto({ buf, ext }) {
  const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return '/uploads/' + name;
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}

// 후기 1건을 프론트에서 쓰기 좋은 형태로 조립. viewerEmpno 가 있으면 그 사람이 좋아요를 눌렀는지(liked)도 담는다
function loadReview(row, viewerEmpno) {
  const photos = db.prepare('SELECT path FROM review_photos WHERE review_id = ? ORDER BY id')
    .all(row.id).map(p => p.path);
  const comments = db.prepare(
    'SELECT id, parent_id, empno, author, color, text, created_at FROM review_comments WHERE review_id = ? ORDER BY id'
  ).all(row.id).map(c => ({
    id: c.id, parentId: c.parent_id, empno: c.empno,
    author: c.author, color: c.color, text: c.text, created_at: c.created_at,
  }));
  let companions = [];
  try { companions = JSON.parse(row.companions || '[]'); } catch { companions = []; }
  return {
    id: row.id,
    empno: row.empno,
    authorName: row.author_name,
    department: row.department,
    company: row.company,
    resortName: row.resort_name,
    resortType: row.resort_type,
    companions,
    content: row.content,
    ratings: {
      location: row.rating_location,
      facility: row.rating_facility,
      clean: row.rating_clean,
      avg: row.rating_avg,
    },
    likes: row.likes,
    liked: viewerEmpno
      ? !!db.prepare('SELECT 1 FROM review_likes WHERE review_id = ? AND empno = ?').get(row.id, viewerEmpno)
      : false,
    photos,
    comments,
    createdAt: row.created_at,
  };
}

// ── 휴양소 포인트 (회사 복지포인트와 별개인 이 서비스의 포인트) ──
const REVIEW_POINTS = 10;  // 후기 1건 작성 시 적립. 화면 문구(screens/home · my · write.html '+10P')도 함께 바꾼다
function pointBalance(empno) {
  return db.prepare('SELECT COALESCE(SUM(amount), 0) AS n FROM point_history WHERE empno = ?').get(empno).n;
}
function addPoints(empno, amount, reason, reviewId, resortName) {
  db.prepare('INSERT INTO point_history (empno, amount, reason, review_id, resort_name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(empno, amount, reason, reviewId, resortName || null, new Date().toISOString());
}

// ───────────────────────── API ─────────────────────────

// 후기 등록
// 작성자는 화면이 보낸 값이 아니라 로그인한 회원(req.user)으로 저장한다
app.post('/api/reviews', requireUser, (req, res) => {
  try {
    const b = req.body || {};
    const resortName = (b.resortName || '').trim();
    if (!resortName) return res.status(400).json({ error: '휴양소를 선택해주세요.' });

    const rl = clampScore(b.ratings?.location);
    const rf = clampScore(b.ratings?.facility);
    const rc = clampScore(b.ratings?.clean);
    if (rl == null || rf == null || rc == null) {
      return res.status(400).json({ error: '항목별 평점을 모두 입력해주세요.' });
    }

    const photos = Array.isArray(b.photos) ? b.photos : [];
    if (photos.length < 1) {
      return res.status(400).json({ error: '사진을 최소 1장 첨부해주세요.' });
    }
    if (photos.length > PHOTO_MAX_COUNT) {
      return res.status(400).json({ error: `사진은 최대 ${PHOTO_MAX_COUNT}장까지 첨부할 수 있어요.` });
    }
    // 저장하기 전에 전부 검사한다 — 한 장이라도 형식이 틀리면 후기 전체를 받지 않는다
    const decoded = photos.map(decodePhoto);
    const bad = decoded.find(d => d.error);
    if (bad) return res.status(400).json({ error: bad.error });

    const avg = Math.round(((rl + rf + rc) / 3) * 10) / 10;
    const companions = JSON.stringify(Array.isArray(b.companions) ? b.companions : []);
    const createdAt = new Date().toISOString();

    // 트랜잭션으로 후기 + 사진 함께 저장
    const insertReview = db.prepare(`
      INSERT INTO reviews
        (empno, author_name, department, company, resort_name, resort_type, companions, content,
         rating_location, rating_facility, rating_clean, rating_avg, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPhoto = db.prepare('INSERT INTO review_photos (review_id, path) VALUES (?, ?)');

    let reviewId;
    const written = [];
    db.exec('BEGIN');
    try {
      const info = insertReview.run(
        req.user.empno, auth.displayName(req.user), req.user.department || null, req.user.company || null,
        resortName, b.resortType || null,
        companions, b.content || '', rl, rf, rc, avg, createdAt
      );
      reviewId = Number(info.lastInsertRowid);

      for (const d of decoded) {
        const webPath = savePhoto(d);
        written.push(webPath);
        insertPhoto.run(reviewId, webPath);
      }
      // 후기와 같은 트랜잭션에서 적립 — 후기 저장이 실패하면 포인트도 들어가지 않는다
      addPoints(req.user.empno, REVIEW_POINTS, 'review', reviewId, resortName);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      // 저장 도중 실패하면 이미 쓴 사진 파일도 지운다 (DB 가 참조하지 않는 파일이 남지 않게)
      written.forEach(w => { try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(w))); } catch (_) { } });
      throw e;
    }

    const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
    res.status(201).json({ review: loadReview(row, req.user.empno), pointsAwarded: REVIEW_POINTS, points: pointBalance(req.user.empno) });
  } catch (err) {
    console.error('POST /api/reviews 실패:', err);
    res.status(500).json({ error: '후기 등록 중 오류가 발생했습니다.' });
  }
});

// 이름(정식명 또는 옛 표기) → 그 휴양소가 후기에 저장될 수 있는 모든 이름. 모르는 이름이면 그 이름 하나
function resortNames(name) {
  const r = db.prepare(`
    SELECT id, name FROM resorts WHERE name = ?
    UNION SELECT r.id, r.name FROM resort_aliases a JOIN resorts r ON r.id = a.resort_id WHERE a.alias = ?`
  ).get(name, name);
  if (!r) return [name];
  const aliases = db.prepare('SELECT alias FROM resort_aliases WHERE resort_id = ?').all(r.id).map(a => a.alias);
  return [r.name, ...aliases];
}

// 휴양소 목록 — 평점 · 후기 수는 후기 테이블에서 계산한다 (후기가 없으면 rating null, reviews 0)
app.get('/api/resorts', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM resorts WHERE active = 1 ORDER BY sort_order, name').all();
    const aliases = {};
    db.prepare('SELECT alias, resort_id FROM resort_aliases').all()
      .forEach(a => (aliases[a.resort_id] = aliases[a.resort_id] || []).push(a.alias));

    // 후기에 저장된 이름(정식명·옛 표기) → 휴양소 id
    const idOf = {};
    rows.forEach(r => { idOf[r.name] = r.id; (aliases[r.id] || []).forEach(a => { idOf[a] = r.id; }); });
    const stats = {};
    db.prepare(`
      SELECT resort_name, COUNT(*) AS n, SUM(rating_avg) AS sum, COUNT(rating_avg) AS rated
      FROM reviews GROUP BY resort_name`
    ).all().forEach(s => {
      const id = idOf[s.resort_name];
      if (!id) return;
      const t = stats[id] = stats[id] || { n: 0, sum: 0, rated: 0 };
      t.n += s.n; t.sum += s.sum || 0; t.rated += s.rated;
    });

    res.json({
      resorts: rows.map(r => {
        const s = stats[r.id];
        return {
          id: r.id, name: r.name, type: r.type, loc: r.loc, address: r.address, img: r.img,
          roomType: r.room_type, capacity: r.capacity, capacityBase: r.capacity_base,
          facilityName: r.facility_name, summary: r.summary, season: r.season,
          phone: r.phone, website: r.website, photo: r.photo,
          details: r.details ? JSON.parse(r.details) : [],
          nearby: r.nearby ? JSON.parse(r.nearby) : [],
          notices: r.notices ? JSON.parse(r.notices) : [],
          features: r.features ? JSON.parse(r.features) : null,
          aliases: aliases[r.id] || [],
          map: r.map_label ? { label: r.map_label, x: r.map_x, y: r.map_y } : null,
          sort: r.sort_order,
          rating: s && s.rated ? Math.round((s.sum / s.rated) * 10) / 10 : null,
          reviews: s ? s.n : 0,
        };
      }),
    });
  } catch (err) {
    console.error('GET /api/resorts 실패:', err);
    res.status(500).json({ error: '휴양소 목록 조회 실패' });
  }
});

// 후기 목록 (resort 쿼리로 필터, 없으면 전체) — 최신순
// resort 는 정식명·옛 표기 어느 쪽이어도 그 휴양소의 후기를 모두 돌려준다
app.get('/api/reviews', (req, res) => {
  try {
    const resort = (req.query.resort || '').trim();
    let rows;
    if (resort) {
      const names = resortNames(resort);
      rows = db.prepare(
        `SELECT * FROM reviews WHERE resort_name IN (${names.map(() => '?').join(',')}) ORDER BY datetime(created_at) DESC, id DESC`
      ).all(...names);
    } else {
      rows = db.prepare('SELECT * FROM reviews ORDER BY datetime(created_at) DESC, id DESC').all();
    }
    res.json({ reviews: rows.map(r => loadReview(r, req.user && req.user.empno)) });
  } catch (err) {
    console.error('GET /api/reviews 실패:', err);
    res.status(500).json({ error: '목록 조회 실패' });
  }
});

// 내가 쓴 후기
app.get('/api/reviews/mine', requireUser, (req, res) => {
  try {
    const empno = req.user.empno;
    const rows = db.prepare('SELECT * FROM reviews WHERE empno = ? ORDER BY datetime(created_at) DESC, id DESC').all(empno);
    res.json({ reviews: rows.map(r => loadReview(r, req.user && req.user.empno)) });
  } catch (err) {
    console.error('GET /api/reviews/mine 실패:', err);
    res.status(500).json({ error: '목록 조회 실패' });
  }
});

// 내 후기 삭제 (로그인한 본인 또는 관리자). 사진·댓글은 CASCADE, 알림·사진파일은 수동 정리.
app.delete('/api/reviews/:id', requireUser, (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT id, empno, resort_name FROM reviews WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });
    if (String(row.empno) !== String(req.user.empno) && req.user.role !== 'admin') {
      return res.status(403).json({ error: '본인 후기만 삭제할 수 있습니다.' });
    }
    // 이 후기로 적립된 포인트를 되돌린다 (쓰고 지우기를 반복해 쌓지 못하게). 관리자가 지워도 작성자에게서 차감
    const granted = db.prepare('SELECT empno, SUM(amount) AS n FROM point_history WHERE review_id = ? GROUP BY empno').all(id);
    granted.forEach(g => { if (g.n > 0) addPoints(g.empno, -g.n, 'review_deleted', id, row.resort_name); });
    // 업로드된 사진 파일 삭제
    const photos = db.prepare('SELECT path FROM review_photos WHERE review_id = ?').all(id);
    photos.forEach(p => {
      try {
        const fp = path.join(UPLOADS_DIR, path.basename(p.path || ''));
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (e) { /* 파일 없으면 무시 */ }
    });
    // 알림 정리 (FK 없음)
    db.prepare('DELETE FROM notifications WHERE review_id = ?').run(id);
    // 리뷰 삭제 → 사진/댓글 CASCADE
    db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
    res.json({ ok: true, points: pointBalance(req.user.empno) });
  } catch (err) {
    console.error('DELETE /api/reviews/:id 실패:', err);
    res.status(500).json({ error: '삭제 실패' });
  }
});

// 좋아요 토글 (liked=true → +1, false → -1)
// 한 사람이 한 후기에 한 번만 — review_likes 에 (후기, 사번) 을 기록하고, 실제로 바뀐 경우에만 숫자를 더하고 뺀다.
// reviews.likes 는 합계다 (옮겨 온 후기는 원래 게시판의 추천수에서 시작한다).
app.post('/api/reviews/:id/like', requireUser, (req, res) => {
  try {
    const id = Number(req.params.id);
    const liked = !!(req.body && req.body.liked);
    const row = db.prepare('SELECT likes FROM reviews WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });
    const empno = req.user.empno;
    const changed = liked
      ? db.prepare('INSERT OR IGNORE INTO review_likes (review_id, empno, created_at) VALUES (?, ?, ?)')
        .run(id, empno, new Date().toISOString()).changes
      : db.prepare('DELETE FROM review_likes WHERE review_id = ? AND empno = ?').run(id, empno).changes;
    if (changed) db.prepare('UPDATE reviews SET likes = MAX(0, likes + ?) WHERE id = ?').run(liked ? 1 : -1, id);
    const likes = db.prepare('SELECT likes FROM reviews WHERE id = ?').get(id).likes;
    res.json({ likes, liked });
  } catch (err) {
    console.error('POST like 실패:', err);
    res.status(500).json({ error: '좋아요 처리 실패' });
  }
});

// 댓글 등록
// 댓글 / 답글 등록. parentId 가 있으면 답글이다.
// 등록과 동시에 알림을 만든다 — 내 글에 댓글(comment), 내 댓글에 답글(reply).
app.post('/api/reviews/:id/comments', requireUser, (req, res) => {
  try {
    const id = Number(req.params.id);
    const text = (req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });

    const review = db.prepare('SELECT id, empno, resort_name FROM reviews WHERE id = ?').get(id);
    if (!review) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });

    // 답글이면 부모 댓글이 같은 후기에 있어야 한다. 답글의 답글은 만들지 않는다(1단계까지).
    const parentId = req.body?.parentId ? Number(req.body.parentId) : null;
    let parent = null;
    if (parentId) {
      parent = db.prepare('SELECT id, review_id, empno, parent_id FROM review_comments WHERE id = ?').get(parentId);
      if (!parent || parent.review_id !== id) return res.status(400).json({ error: '원 댓글을 찾을 수 없습니다.' });
      if (parent.parent_id) return res.status(400).json({ error: '답글에는 다시 답글을 달 수 없습니다.' });
    }

    const empno = req.user.empno;
    const author = auth.displayName(req.user);
    const createdAt = new Date().toISOString();

    const info = db.prepare(
      'INSERT INTO review_comments (review_id, parent_id, empno, author, color, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, parentId, empno, author, req.body?.color || '#047857', text, createdAt);
    const commentId = Number(info.lastInsertRowid);

    // 알림 생성 — 받는 사람이 본인이면 만들지 않는다.
    const notify = (recipient, type) => {
      if (!recipient || recipient === empno) return;
      db.prepare(
        'INSERT INTO notifications (empno, type, actor_name, review_id, comment_id, resort_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(recipient, type, author, id, commentId, review.resort_name, createdAt);
    };
    if (parent) notify(parent.empno, 'reply');       // 내 댓글에 답글
    else notify(review.empno, 'comment');            // 내 글에 댓글

    const comments = db.prepare(
      'SELECT id, parent_id, empno, author, color, text, created_at FROM review_comments WHERE review_id = ? ORDER BY id'
    ).all(id).map(c => ({
      id: c.id, parentId: c.parent_id, empno: c.empno,
      author: c.author, color: c.color, text: c.text, created_at: c.created_at,
    }));
    res.status(201).json({ comments });
  } catch (err) {
    console.error('POST comment 실패:', err);
    res.status(500).json({ error: '댓글 등록 실패' });
  }
});

// ───────────────────────── 공지사항 ─────────────────────────
// 쓰기는 관리자 도구(tools/notices.js). 앱은 읽기만 한다. 조회수 = 본 사람 수
function noticeRow(n, withBody) {
  const views = db.prepare('SELECT COUNT(*) AS c FROM notice_views WHERE notice_id = ?').get(n.id).c;
  return {
    id: String(n.id), category: n.category, title: n.title, author: n.author, pinned: !!n.pinned,
    createdAt: n.created_at, views,
    // 목록 카드 미리보기 = 본문 첫 문단 (소제목 · 목록 · 강조 상자 줄은 건너뛴다)
    summary: (n.body.split(/\r?\n\s*\r?\n/).map(b => b.trim()).find(b => b && !/^(###|- |> )/.test(b)) || n.body)
      .replace(/^[#>\-\s]+/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
    ...(withBody ? { body: n.body, files: n.files ? JSON.parse(n.files) : [] } : {}),
  };
}
app.get('/api/notices', requireUser, (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM notices WHERE active = 1 ORDER BY pinned DESC, datetime(created_at) DESC, id DESC').all();
    res.json({ notices: rows.map(n => noticeRow(n, false)) });
  } catch (err) {
    console.error('GET /api/notices 실패:', err);
    res.status(500).json({ error: '공지 조회 실패' });
  }
});
// 상세 — 열면 '본 사람' 으로 기록한다
app.get('/api/notices/:id', requireUser, (req, res) => {
  try {
    const n = db.prepare('SELECT * FROM notices WHERE id = ? AND active = 1').get(Number(req.params.id));
    if (!n) return res.status(404).json({ error: '공지를 찾을 수 없습니다.' });
    db.prepare('INSERT OR IGNORE INTO notice_views (notice_id, empno, viewed_at) VALUES (?, ?, ?)')
      .run(n.id, req.user.empno, new Date().toISOString());
    res.json({ notice: noticeRow(n, true) });
  } catch (err) {
    console.error('GET /api/notices/:id 실패:', err);
    res.status(500).json({ error: '공지 조회 실패' });
  }
});

// ───────────────────────── 꿀팁 ─────────────────────────
function resortIdOf(name) {
  const r = db.prepare(`
    SELECT id FROM resorts WHERE id = ? OR name = ?
    UNION SELECT resort_id FROM resort_aliases WHERE alias = ?`).get(name, name, name);
  return r ? r.id : null;
}
function tipRow(t, viewer) {
  const r = db.prepare('SELECT name FROM resorts WHERE id = ?').get(t.resort_id);
  return {
    id: String(t.id), resortId: t.resort_id, resort: r ? r.name : t.resort_id,
    empno: t.empno, author: t.author, department: t.department || '', company: t.company || '',
    tag: t.tag || '', title: t.title, content: t.content, createdAt: t.created_at,
    likes: db.prepare('SELECT COUNT(*) AS c FROM tip_likes WHERE tip_id = ?').get(t.id).c,
    liked: viewer ? !!db.prepare('SELECT 1 FROM tip_likes WHERE tip_id = ? AND empno = ?').get(t.id, viewer) : false,
  };
}
// ?resort=이름|id → 그 휴양소 꿀팁 최신순
app.get('/api/tips', requireUser, (req, res) => {
  try {
    const id = resortIdOf(String(req.query.resort || '').trim());
    if (!id) return res.json({ tips: [] });
    const rows = db.prepare('SELECT * FROM tips WHERE resort_id = ? ORDER BY datetime(created_at) DESC, id DESC').all(id);
    res.json({ tips: rows.map(t => tipRow(t, req.user.empno)) });
  } catch (err) {
    console.error('GET /api/tips 실패:', err);
    res.status(500).json({ error: '꿀팁 조회 실패' });
  }
});
app.get('/api/tips/mine', requireUser, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tips WHERE empno = ? ORDER BY datetime(created_at) DESC, id DESC').all(req.user.empno);
    res.json({ tips: rows.map(t => tipRow(t, req.user.empno)) });
  } catch (err) {
    console.error('GET /api/tips/mine 실패:', err);
    res.status(500).json({ error: '꿀팁 조회 실패' });
  }
});
app.post('/api/tips', requireUser, (req, res) => {
  try {
    const b = req.body || {};
    const id = resortIdOf(String(b.resort || '').trim());
    const title = String(b.title || '').trim().slice(0, 60);
    const content = String(b.content || '').trim().slice(0, 1000);
    const tag = String(b.tag || '').trim().slice(0, 6);
    if (!id) return res.status(400).json({ error: '휴양소를 찾을 수 없습니다.' });
    if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    const info = db.prepare('INSERT INTO tips (resort_id, empno, author, department, company, tag, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.user.empno, auth.displayName(req.user), req.user.department || null, req.user.company || null,
        tag || null, title, content, new Date().toISOString());
    res.status(201).json({ tip: tipRow(db.prepare('SELECT * FROM tips WHERE id = ?').get(Number(info.lastInsertRowid)), req.user.empno) });
  } catch (err) {
    console.error('POST /api/tips 실패:', err);
    res.status(500).json({ error: '꿀팁 등록 실패' });
  }
});
// 꿀팁 고치기 (본인 · 관리자) { tag, title, content }
app.put('/api/tips/:id', requireUser, (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM tips WHERE id = ?').get(Number(req.params.id));
    if (!t) return res.status(404).json({ error: '꿀팁을 찾을 수 없습니다.' });
    if (t.empno !== req.user.empno && req.user.role !== 'admin') return res.status(403).json({ error: '본인 꿀팁만 고칠 수 있습니다.' });
    const b = req.body || {};
    const title = String(b.title || '').trim().slice(0, 60);
    const content = String(b.content || '').trim().slice(0, 1000);
    const tag = String(b.tag || '').trim().slice(0, 6);
    if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    db.prepare('UPDATE tips SET tag = ?, title = ?, content = ? WHERE id = ?').run(tag || null, title, content, t.id);
    res.json({ tip: tipRow(db.prepare('SELECT * FROM tips WHERE id = ?').get(t.id), req.user.empno) });
  } catch (err) {
    console.error('PUT /api/tips 실패:', err);
    res.status(500).json({ error: '꿀팁 수정 실패' });
  }
});
app.delete('/api/tips/:id', requireUser, (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM tips WHERE id = ?').get(Number(req.params.id));
    if (!t) return res.status(404).json({ error: '꿀팁을 찾을 수 없습니다.' });
    if (t.empno !== req.user.empno && req.user.role !== 'admin') return res.status(403).json({ error: '본인 꿀팁만 삭제할 수 있습니다.' });
    db.prepare('DELETE FROM tips WHERE id = ?').run(t.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tips 실패:', err);
    res.status(500).json({ error: '삭제 실패' });
  }
});
// 좋아요 1인 1회 { liked }
app.post('/api/tips/:id/like', requireUser, (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM tips WHERE id = ?').get(Number(req.params.id));
    if (!t) return res.status(404).json({ error: '꿀팁을 찾을 수 없습니다.' });
    if (req.body && req.body.liked) {
      db.prepare('INSERT OR IGNORE INTO tip_likes (tip_id, empno, created_at) VALUES (?, ?, ?)').run(t.id, req.user.empno, new Date().toISOString());
    } else {
      db.prepare('DELETE FROM tip_likes WHERE tip_id = ? AND empno = ?').run(t.id, req.user.empno);
    }
    const row = tipRow(t, req.user.empno);
    res.json({ likes: row.likes, liked: row.liked });
  } catch (err) {
    console.error('POST /api/tips/:id/like 실패:', err);
    res.status(500).json({ error: '좋아요 처리 실패' });
  }
});

// ───────────────────────── 내 활동 (배지) ─────────────────────────
// 배지 화면이 쓰는 숫자. 배지 기준은 화면(assets/js/badges.js)에 있다
app.get('/api/me/stats', requireUser, (req, res) => {
  try {
    const e = req.user.empno;
    const one = (sql, ...a) => db.prepare(sql).get(...a).c;
    const byResort = db.prepare(`
      SELECT r.id, r.map_label AS region, COUNT(*) AS c FROM reviews v
      JOIN resorts r ON r.name = v.resort_name OR r.id IN (SELECT resort_id FROM resort_aliases WHERE alias = v.resort_name)
      WHERE v.empno = ? GROUP BY r.id`).all(e);
    res.json({
      reviews: one('SELECT COUNT(*) AS c FROM reviews WHERE empno = ?', e),
      photos: one('SELECT COUNT(*) AS c FROM review_photos p JOIN reviews v ON v.id = p.review_id WHERE v.empno = ?', e),
      likesReceived: one('SELECT COUNT(*) AS c FROM review_likes l JOIN reviews v ON v.id = l.review_id WHERE v.empno = ?', e)
        + one('SELECT COUNT(*) AS c FROM tip_likes l JOIN tips t ON t.id = l.tip_id WHERE t.empno = ?', e),
      tips: one('SELECT COUNT(*) AS c FROM tips WHERE empno = ?', e),
      comments: one('SELECT COUNT(*) AS c FROM review_comments WHERE empno = ?', e),
      resorts: byResort.length,
      regions: byResort.reduce((m, r) => { m[r.region] = (m[r.region] || 0) + r.c; return m; }, {}),
    });
  } catch (err) {
    console.error('GET /api/me/stats 실패:', err);
    res.status(500).json({ error: '활동 조회 실패' });
  }
});

// ───────────────────────── 즐겨찾기 ─────────────────────────
// 사람별 · 휴양소 id 별로 저장한다. 목록은 추가한 순서 (화면 '기본순')
function myFavorites(empno) {
  return db.prepare('SELECT resort_id, created_at FROM favorites WHERE empno = ? ORDER BY created_at, resort_id')
    .all(empno).map(f => ({ resortId: f.resort_id, createdAt: f.created_at }));
}
app.get('/api/favorites', requireUser, (req, res) => {
  try {
    res.json({ favorites: myFavorites(req.user.empno) });
  } catch (err) {
    console.error('GET /api/favorites 실패:', err);
    res.status(500).json({ error: '즐겨찾기 조회 실패' });
  }
});
// { on: true } 추가 / { on: false } 해제 → 바뀐 목록
app.put('/api/favorites/:resortId', requireUser, (req, res) => {
  try {
    const resortId = String(req.params.resortId || '');
    if (!db.prepare('SELECT 1 FROM resorts WHERE id = ?').get(resortId)) {
      return res.status(404).json({ error: '휴양소를 찾을 수 없습니다.' });
    }
    if (req.body && req.body.on) {
      db.prepare('INSERT OR IGNORE INTO favorites (empno, resort_id, created_at) VALUES (?, ?, ?)')
        .run(req.user.empno, resortId, new Date().toISOString());
    } else {
      db.prepare('DELETE FROM favorites WHERE empno = ? AND resort_id = ?').run(req.user.empno, resortId);
    }
    res.json({ favorites: myFavorites(req.user.empno) });
  } catch (err) {
    console.error('PUT /api/favorites 실패:', err);
    res.status(500).json({ error: '즐겨찾기 저장 실패' });
  }
});

// 내 휴양소 포인트 — 잔액 + 최근 내역 50건
app.get('/api/points/me', requireUser, (req, res) => {
  try {
    const history = db.prepare(
      'SELECT amount, reason, resort_name, created_at FROM point_history WHERE empno = ? ORDER BY id DESC LIMIT 50'
    ).all(req.user.empno).map(h => ({ amount: h.amount, reason: h.reason, resortName: h.resort_name, createdAt: h.created_at }));
    res.json({ balance: pointBalance(req.user.empno), perReview: REVIEW_POINTS, history });
  } catch (err) {
    console.error('GET /api/points/me 실패:', err);
    res.status(500).json({ error: '포인트 조회 실패' });
  }
});

// ───────────────────────── 알림 ─────────────────────────

// 내 알림 목록 (댓글·답글) + 읽음 처리된 key 목록
// 공지 알림은 클라이언트가 NOTICES 로 만들고, 읽음 여부만 readKeys 로 대조한다.
app.get('/api/notifications', requireUser, (req, res) => {
  try {
    const empno = req.user.empno;

    const rows = db.prepare(
      'SELECT * FROM notifications WHERE empno = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 100'
    ).all(empno);
    const readKeys = db.prepare('SELECT key FROM notification_reads WHERE empno = ?')
      .all(empno).map(r => r.key);

    res.json({
      notifications: rows.map(n => ({
        key: `n:${n.id}`,
        type: n.type,                 // comment | reply
        actorName: n.actor_name,
        reviewId: n.review_id,
        commentId: n.comment_id,
        resortName: n.resort_name,
        createdAt: n.created_at,
      })),
      readKeys,
    });
  } catch (err) {
    console.error('GET /api/notifications 실패:', err);
    res.status(500).json({ error: '알림 조회 실패' });
  }
});

// 읽음 처리. keys 배열을 그대로 기록한다 ('모두 읽음'도 화면의 전체 key 를 보내면 된다)
app.post('/api/notifications/read', requireUser, (req, res) => {
  try {
    const empno = req.user.empno;
    const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter(k => typeof k === 'string') : [];
    if (!empno || keys.length === 0) return res.json({ ok: true, added: 0 });

    const readAt = new Date().toISOString();
    const stmt = db.prepare('INSERT OR IGNORE INTO notification_reads (empno, key, read_at) VALUES (?, ?, ?)');
    for (const k of keys.slice(0, 500)) stmt.run(empno, k, readAt);

    res.json({ ok: true, added: Math.min(keys.length, 500) });
  } catch (err) {
    console.error('POST /api/notifications/read 실패:', err);
    res.status(500).json({ error: '읽음 처리 실패' });
  }
});

// 헬스체크
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// 정적 파일. API 라우트 뒤에 위치.
// ⚠️ 저장소 폴더 전체(ROOT_DIR)를 열면 안 된다 — server/data/reviews.db(직원 명단 · 세션 · 비밀번호 해시)와
//    .git 까지 주소로 받아졌다. 화면에 필요한 것만 연다: index.html · assets/ (후기 사진은 위 /uploads)
// no-cache: 브라우저가 저장해 둔 파일을 쓰기 전에 바뀌었는지 매번 확인한다 (안 바뀌었으면 304 로 가볍게 끝남)
// — 배포 뒤 화면(HTML)은 새것인데 JS 는 옛것이 섞여 기능이 안 되는 일을 막는다
const staticOpts = { setHeaders: res => res.setHeader('Cache-Control', 'no-cache'), dotfiles: 'deny', index: false };
app.get(['/', '/index.html'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});
app.use('/assets', express.static(path.join(ROOT_DIR, 'assets'), staticOpts));
app.use((_req, res) => res.status(404).send('Not Found'));

app.listen(PORT, () => {
  console.log(`cen_resort 서버 실행 중 → http://localhost:${PORT}`);
});
