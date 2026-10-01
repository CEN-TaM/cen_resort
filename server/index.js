'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');

const app = express();
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

// 업로드된 사진 정적 제공
app.use('/uploads', express.static(UPLOADS_DIR));

// ───────────────────────── 헬퍼 ─────────────────────────

// data:image/png;base64,.... → 파일로 저장하고 웹 경로 반환
function saveDataUrl(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const mime = m[1];
  const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const buf = Buffer.from(m[2], 'base64');
  const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return '/uploads/' + name;
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}

// 후기 1건을 프론트에서 쓰기 좋은 형태로 조립
function loadReview(row) {
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
    photos,
    comments,
    createdAt: row.created_at,
  };
}

// ───────────────────────── API ─────────────────────────

// 후기 등록
app.post('/api/reviews', (req, res) => {
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
    db.exec('BEGIN');
    try {
      const info = insertReview.run(
        b.empno || null, b.authorName || null, b.department || null, b.company || null,
        resortName, b.resortType || null,
        companions, b.content || '', rl, rf, rc, avg, createdAt
      );
      reviewId = Number(info.lastInsertRowid);

      let saved = 0;
      for (const dataUrl of photos) {
        const webPath = saveDataUrl(dataUrl);
        if (webPath) { insertPhoto.run(reviewId, webPath); saved++; }
      }
      if (saved < 1) throw new Error('유효한 사진이 없습니다.');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
    res.status(201).json({ review: loadReview(row), pointsAwarded: 300 });
  } catch (err) {
    console.error('POST /api/reviews 실패:', err);
    res.status(500).json({ error: '후기 등록 중 오류가 발생했습니다.' });
  }
});

// 후기 목록 (resort 쿼리로 필터, 없으면 전체) — 최신순
app.get('/api/reviews', (req, res) => {
  try {
    const resort = (req.query.resort || '').trim();
    const rows = resort
      ? db.prepare('SELECT * FROM reviews WHERE resort_name = ? ORDER BY datetime(created_at) DESC, id DESC').all(resort)
      : db.prepare('SELECT * FROM reviews ORDER BY datetime(created_at) DESC, id DESC').all();
    res.json({ reviews: rows.map(loadReview) });
  } catch (err) {
    console.error('GET /api/reviews 실패:', err);
    res.status(500).json({ error: '목록 조회 실패' });
  }
});

// 내가 쓴 후기
app.get('/api/reviews/mine', (req, res) => {
  try {
    const empno = (req.query.empno || '').trim();
    if (!empno) return res.json({ reviews: [] });
    const rows = db.prepare('SELECT * FROM reviews WHERE empno = ? ORDER BY datetime(created_at) DESC, id DESC').all(empno);
    res.json({ reviews: rows.map(loadReview) });
  } catch (err) {
    console.error('GET /api/reviews/mine 실패:', err);
    res.status(500).json({ error: '목록 조회 실패' });
  }
});

// 내 후기 삭제 (본인 사번 검증). 사진·댓글은 CASCADE, 알림·사진파일은 수동 정리.
app.delete('/api/reviews/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const empno = (req.query.empno || '').trim();
    if (!empno) return res.status(400).json({ error: '사번이 필요합니다.' });
    const row = db.prepare('SELECT id, empno FROM reviews WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });
    if (String(row.empno) !== String(empno)) {
      return res.status(403).json({ error: '본인 후기만 삭제할 수 있습니다.' });
    }
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
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/reviews/:id 실패:', err);
    res.status(500).json({ error: '삭제 실패' });
  }
});

// 좋아요 토글 (liked=true → +1, false → -1)
app.post('/api/reviews/:id/like', (req, res) => {
  try {
    const id = Number(req.params.id);
    const liked = !!(req.body && req.body.liked);
    const row = db.prepare('SELECT likes FROM reviews WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: '후기를 찾을 수 없습니다.' });
    const likes = Math.max(0, row.likes + (liked ? 1 : -1));
    db.prepare('UPDATE reviews SET likes = ? WHERE id = ?').run(likes, id);
    res.json({ likes });
  } catch (err) {
    console.error('POST like 실패:', err);
    res.status(500).json({ error: '좋아요 처리 실패' });
  }
});

// 댓글 등록
// 댓글 / 답글 등록. parentId 가 있으면 답글이다.
// 등록과 동시에 알림을 만든다 — 내 글에 댓글(comment), 내 댓글에 답글(reply).
app.post('/api/reviews/:id/comments', (req, res) => {
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

    const empno = (req.body?.empno || '').trim() || null;
    const author = req.body?.author || '나';
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

// ───────────────────────── 알림 ─────────────────────────

// 내 알림 목록 (댓글·답글) + 읽음 처리된 key 목록
// 공지 알림은 클라이언트가 NOTICES 로 만들고, 읽음 여부만 readKeys 로 대조한다.
app.get('/api/notifications', (req, res) => {
  try {
    const empno = (req.query.empno || '').trim();
    if (!empno) return res.json({ notifications: [], readKeys: [] });

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
app.post('/api/notifications/read', (req, res) => {
  try {
    const empno = (req.body?.empno || '').trim();
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

// 정적 파일 (index.html, assets 등). API 라우트 뒤에 위치.
app.use(express.static(ROOT_DIR));

app.listen(PORT, () => {
  console.log(`cen_resort 서버 실행 중 → http://localhost:${PORT}`);
});
