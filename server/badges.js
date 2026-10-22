// 배지 — 기준은 DB badges 테이블(관리자 페이지에서 고친다), 받은 기록은 badge_awards.
//
//   GET  /api/me/badges            내 배지 (켜진 배지 전부 + 지금 값 · 받았는지 · 받은 날) + 화면 위 숫자(작성 후기 · 받은 좋아요)
//                                  기준을 넘은 배지는 이때 받은 기록을 남긴다 → 한 번 받으면 후기를 지워도 유지
//   GET  /api/admin/badges         전체 (꺼진 배지 포함) + 받은 사람 수 + 셀 수 있는 항목 목록(METRICS)
//   POST /api/admin/badges         새 배지 { name, description, metric, param, goal, icon, tone }
//   PUT  /api/admin/badges/:id     고치기 { name, description, metric, param, goal, icon, tone, active }
//   순서는 따로 정하지 않는다 — 만든 순서 (앱은 받은 배지를 먼저, 받은 순서대로 보여준다)
//
// '무엇을 셀지'(metric)는 아래 METRICS 에서만 고른다. 새 셈법이 필요하면 여기에 함수를 더한다.
// 세는 글은 앱에서 직접 쓴 것(사번이 있는 것)만, 관리자가 숨긴 글은 뺀다.

// 내 후기 → 휴양소 (정식명 · 옛 표기 어느 쪽으로 저장돼 있어도). 한 후기는 한 번만
const MY_REVIEWS = `
  SELECT DISTINCT v.id, r.id AS rid, r.type, r.map_label
  FROM reviews v
  JOIN resorts r ON r.name = v.resort_name OR r.id IN (SELECT resort_id FROM resort_aliases WHERE alias = v.resort_name)
  WHERE v.empno = ? AND v.hidden = 0`;

const METRICS = {
  reviews:        { label: '후기 수', unit: '편', sql: 'SELECT COUNT(*) AS c FROM reviews WHERE empno = ? AND hidden = 0' },
  photo_reviews:  { label: '사진 있는 후기 수', unit: '편', sql: 'SELECT COUNT(*) AS c FROM reviews v WHERE v.empno = ? AND v.hidden = 0 AND EXISTS (SELECT 1 FROM review_photos p WHERE p.review_id = v.id)' },
  resorts:        { label: '후기를 쓴 휴양소 수 (서로 다른 곳)', unit: '곳', sql: `SELECT COUNT(DISTINCT rid) AS c FROM (${MY_REVIEWS})` },
  type_reviews:   { label: '휴양소 종류별 후기 수', unit: '편', param: '종류 — regular(정기) · summer(하계) · winter(동계)',
                    sql: `SELECT COUNT(*) AS c FROM (${MY_REVIEWS}) WHERE type = ?` },
  region_reviews: { label: '지역별 후기 수', unit: '편', param: '지역 — 지도 이름, 여러 개는 쉼표 (예: 제주,서귀포)',
                    sql: null },   // 지역 목록이 바뀌므로 아래에서 만든다
  tips:           { label: '꿀팁 수', unit: '개', sql: 'SELECT COUNT(*) AS c FROM tips WHERE empno = ? AND hidden = 0' },
  comments:       { label: '댓글 수', unit: '개', sql: 'SELECT COUNT(*) AS c FROM review_comments c JOIN reviews v ON v.id = c.review_id WHERE c.empno = ? AND v.hidden = 0 AND c.hidden = 0 AND c.deleted = 0' },
  likes_received: { label: '내 후기가 받은 좋아요', unit: '개', sql: 'SELECT COUNT(*) AS c FROM review_likes l JOIN reviews v ON v.id = l.review_id WHERE v.empno = ? AND v.hidden = 0' },
  likes_given:    { label: '다른 사람 후기에 누른 좋아요', unit: '번', sql: 'SELECT COUNT(*) AS c FROM review_likes l JOIN reviews v ON v.id = l.review_id WHERE l.empno = ? AND v.hidden = 0 AND (v.empno IS NULL OR v.empno <> l.empno)' },
};

// 화면 아이콘 (Material Symbols 이름) · 색 (앱의 .tone-* )
const ICONS = ['edit_note', 'menu_book', 'emoji_events', 'photo_camera', 'explore', 'flag', 'sunny', 'ac_unit', 'landscape',
  'lightbulb', 'forum', 'thumb_up', 'favorite', 'star', 'workspace_premium', 'military_tech', 'beach_access', 'hiking', 'map', 'celebration'];
const TONES = ['mint', 'sky', 'cream', 'coral', 'lilac', 'peach', 'pink', 'teal'];

// 처음 켤 때 넣는 기본 배지 (2026-10 정함 — 휴양소는 추첨이라 1년에 한두 번 가기도 어렵다는 점을 반영해 문턱을 낮췄다)
const DEFAULT_BADGES = [
  ['first',     '첫 후기',     '후기 1편',                     'reviews',        null,          1, 'edit_note',    'mint'],
  ['writer',    '후기 작가',   '후기 3편',                     'reviews',        null,          3, 'menu_book',    'sky'],
  ['legend',    '후기왕',      '후기 5편',                     'reviews',        null,          5, 'emoji_events', 'cream'],
  ['photo',     '사진작가',    '사진 있는 후기 2편',           'photo_reviews',  null,          2, 'photo_camera', 'lilac'],
  ['explorer',  '탐험가',      '서로 다른 휴양소 2곳 후기',    'resorts',        null,          2, 'explore',      'peach'],
  ['master',    '정복자',      '서로 다른 휴양소 5곳 후기',    'resorts',        null,          5, 'flag',         'mint'],
  ['summer',    '여름 휴양객', '하계 이벤트 휴양소 후기 1편',  'type_reviews',   'summer',      1, 'sunny',        'coral'],
  ['winter',    '겨울 휴양객', '동계 이벤트 휴양소 후기 1편',  'type_reviews',   'winter',      1, 'ac_unit',      'sky'],
  ['jeju',      '제주 전문가', '제주 휴양소 후기 2편',         'region_reviews', '제주,서귀포', 2, 'landscape',    'teal'],
  ['first_tip', '첫 꿀팁',     '꿀팁 1개',                     'tips',           null,          1, 'lightbulb',    'cream'],
  ['talker',    '소통왕',      '댓글 10개',                    'comments',       null,         10, 'forum',        'peach'],
  ['helpful',   '도움왕',      '내 후기가 받은 좋아요 5개',    'likes_received', null,          5, 'thumb_up',     'coral'],
  ['cheer',     '응원왕',      '다른 사람 후기에 좋아요 10번', 'likes_given',    null,         10, 'favorite',     'pink'],
];

function setup(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS badges (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL,            -- 화면 아래 줄 (예: 후기 3편)
      metric       TEXT NOT NULL,            -- 무엇을 셀지 — server/badges.js METRICS
      param        TEXT,                     -- metric 에 따라 (종류 summer · 지역 '제주,서귀포')
      goal         INTEGER NOT NULL,         -- 이 값 이상이면 받는다
      icon         TEXT NOT NULL,
      tone         TEXT NOT NULL,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      active       INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    -- 받은 기록 — 한 번 받으면 기준 아래로 내려가도(후기 삭제 등) 남는다
    CREATE TABLE IF NOT EXISTS badge_awards (
      empno       TEXT NOT NULL,
      badge_id    TEXT NOT NULL,
      awarded_at  TEXT NOT NULL,
      PRIMARY KEY (empno, badge_id),
      FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
    );
  `);
  if (!db.prepare('SELECT COUNT(*) AS c FROM badges').get().c) {
    const now = new Date().toISOString();
    const ins = db.prepare(`INSERT INTO badges (id, name, description, metric, param, goal, icon, tone, sort_order, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`);
    DEFAULT_BADGES.forEach((b, i) => ins.run(...b, (i + 1) * 10, now, now));
  }
}

// 이 사람의 이 배지 지금 값
function metricValue(db, b, empno) {
  const m = METRICS[b.metric];
  if (!m) return 0;
  if (b.metric === 'region_reviews') {
    const regions = String(b.param || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!regions.length) return 0;
    return db.prepare(`SELECT COUNT(*) AS c FROM (${MY_REVIEWS}) WHERE map_label IN (${regions.map(() => '?').join(',')})`).get(empno, ...regions).c;
  }
  if (b.metric === 'type_reviews') return db.prepare(m.sql).get(empno, String(b.param || '')).c;
  return db.prepare(m.sql).get(empno).c;
}

function register(app, db, auth) {
  setup(db);
  const { requireUser, requireAdmin } = auth;
  const now = () => new Date().toISOString();
  const bad = (res, msg) => res.status(400).json({ error: msg });

  app.get('/api/me/badges', requireUser, (req, res) => {
    try {
      const e = req.user.empno;
      const awards = Object.fromEntries(db.prepare('SELECT badge_id, awarded_at FROM badge_awards WHERE empno = ?').all(e).map(a => [a.badge_id, a.awarded_at]));
      const give = db.prepare('INSERT OR IGNORE INTO badge_awards (empno, badge_id, awarded_at) VALUES (?, ?, ?)');
      const newly = [];
      const list = db.prepare('SELECT * FROM badges WHERE active = 1 ORDER BY sort_order, id').all().map(b => {
        const value = metricValue(db, b, e);
        if (!awards[b.id] && value >= b.goal) { awards[b.id] = now(); give.run(e, b.id, awards[b.id]); newly.push(b.id); }
        return { id: b.id, name: b.name, description: b.description, icon: b.icon, tone: b.tone, goal: b.goal, unit: (METRICS[b.metric] || {}).unit || '개',
          value: Math.min(value, b.goal), earned: !!awards[b.id], awardedAt: awards[b.id] || null };
      });
      res.json({
        badges: list, newly,
        stats: { reviews: metricValue(db, { metric: 'reviews' }, e), likesReceived: metricValue(db, { metric: 'likes_received' }, e) },
      });
    } catch (err) {
      console.error('GET /api/me/badges 실패:', err);
      res.status(500).json({ error: '배지 조회 실패' });
    }
  });

  // ───────── 관리자 ─────────
  const awardCount = db.prepare('SELECT COUNT(*) AS c FROM badge_awards WHERE badge_id = ?');
  const out = b => ({ id: b.id, name: b.name, description: b.description, metric: b.metric, param: b.param || '', goal: b.goal,
    icon: b.icon, tone: b.tone, sort: b.sort_order, active: !!b.active, awarded: awardCount.get(b.id).c, updatedAt: b.updated_at });
  const T = v => String(v ?? '').trim();
  function clean(b, partial) {
    const o = {};
    const has = k => b[k] !== undefined;
    if (!partial || has('name')) { if (!T(b.name) || T(b.name).length > 20) return { error: '배지 이름을 확인해주세요 (20자 이내).' }; o.name = T(b.name); }
    if (!partial || has('description')) { if (!T(b.description) || T(b.description).length > 40) return { error: '설명(받는 기준)을 확인해주세요 (40자 이내).' }; o.description = T(b.description); }
    if (!partial || has('metric')) { if (!METRICS[b.metric]) return { error: '무엇을 셀지 골라주세요.' }; o.metric = b.metric; }
    if (!partial || has('param')) o.param = T(b.param) || null;
    const metric = o.metric || b.metricNow;
    if (metric === 'type_reviews' && o.param !== undefined && !['regular', 'summer', 'winter'].includes(o.param)) return { error: '종류는 regular · summer · winter 중 하나입니다.' };
    if (metric === 'region_reviews' && o.param !== undefined && !o.param) return { error: '지역을 적어주세요 (예: 제주,서귀포).' };
    if (!partial || has('goal')) { const g = Number(b.goal); if (!Number.isInteger(g) || g < 1 || g > 1000) return { error: '기준 숫자는 1 ~ 1000 입니다.' }; o.goal = g; }
    if (!partial || has('icon')) { if (!ICONS.includes(b.icon)) return { error: '아이콘을 골라주세요.' }; o.icon = b.icon; }
    if (!partial || has('tone')) { if (!TONES.includes(b.tone)) return { error: '색을 골라주세요.' }; o.tone = b.tone; }
    if (has('active')) o.active = b.active ? 1 : 0;
    if (has('sort')) { const s = Number(b.sort); if (!Number.isFinite(s)) return { error: '순서는 숫자입니다.' }; o.sort_order = Math.round(s); }
    return { o };
  }

  app.get('/api/admin/badges', requireAdmin, (_req, res) => {
    res.json({
      badges: db.prepare('SELECT * FROM badges ORDER BY sort_order, id').all().map(out),
      metrics: Object.entries(METRICS).map(([id, m]) => ({ id, label: m.label, unit: m.unit, param: m.param || '' })),
      icons: ICONS, tones: TONES,
      members: db.prepare("SELECT COUNT(*) AS c FROM users WHERE active = 1").get().c,
    });
  });

  app.post('/api/admin/badges', requireAdmin, (req, res) => {
    const { o, error } = clean(req.body || {}, false);
    if (error) return bad(res, error);
    const id = 'b' + Date.now().toString(36);
    const sort = (db.prepare('SELECT MAX(sort_order) AS m FROM badges').get().m || 0) + 10;
    db.prepare(`INSERT INTO badges (id, name, description, metric, param, goal, icon, tone, sort_order, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(id, o.name, o.description, o.metric, o.param, o.goal, o.icon, o.tone, sort, now(), now());
    console.log(`[admin] 배지 추가 ${id} by ${req.user.empno}`);
    res.status(201).json({ badge: out(db.prepare('SELECT * FROM badges WHERE id = ?').get(id)) });
  });

  app.put('/api/admin/badges/:id', requireAdmin, (req, res) => {
    const b = db.prepare('SELECT * FROM badges WHERE id = ?').get(req.params.id);
    if (!b) return res.status(404).json({ error: '배지를 찾을 수 없습니다.' });
    const { o, error } = clean({ ...(req.body || {}), metricNow: b.metric }, true);
    if (error) return bad(res, error);
    const cols = Object.keys(o);
    if (!cols.length) return bad(res, '바꿀 내용이 없습니다.');
    db.prepare(`UPDATE badges SET ${cols.map(c => c + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).run(...cols.map(c => o[c]), now(), b.id);
    console.log(`[admin] 배지 수정 ${b.id} (${cols.join(',')}) by ${req.user.empno}`);
    res.json({ badge: out(db.prepare('SELECT * FROM badges WHERE id = ?').get(b.id)) });
  });
}

module.exports = { register, METRICS, DEFAULT_BADGES };
