// 관리자 API — 휴양소 정보 (관리자만). 화면은 admin/admin-resorts.js
//
//   GET  /api/admin/resorts          전체 (숨긴 휴양소 포함) + 후기 수 · 평점 · 편의시설 고르기 목록 · 지도 지역 목록
//   POST /api/admin/resorts          새 휴양소 { name, type, ... } — id 는 서버가 만든다
//   PUT  /api/admin/resorts/:id      고치기 (보낸 칸만 바뀐다)
//   POST /api/admin/resort-photos    사진 올리기 { data(data URL) } → { url } — 휴양소에 붙는 건 저장할 때 (photos)
//   사진은 photos [경로...] 로 받는다. 첫 장이 대표 사진(photo — 목록 · 지도 카드). 최대 10장
//
// 지우기는 없다 — 후기가 휴양소 이름으로 이어져 있어서. 운영이 끝나면 '앱에 보이기' 를 끈다 (active = 0).
// 이름을 바꾸면 옛 이름을 resort_aliases 에 남긴다 — 옛 이름으로 저장된 후기도 계속 이 휴양소 후기로 센다.
// 안내 PDF 에서 옮길 때 넣지 않는 것(담당자 개인 연락처 · 와이파이 · 출입 비밀번호 등)은 DATA_IMPORT.md '넣지 않는 것'.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PHOTO_DIR = path.join(__dirname, 'uploads', 'resorts');
const PHOTO_MAX = 10 * 1024 * 1024;
const TYPES = ['regular', 'summer', 'winter'];
// 편의시설 칩 — 분류별로 고를 수 있는 이름 (앱 아이콘은 assets/js/data/resorts.js FEATURE_META). 새 이름은 거기에도 아이콘을 더한다
const FEATURE_CHOICES = {
  '환경': ['바다', '산', '숲', '강'],
  '숙소 유형': ['호텔형', '리조트', '레지던스', '펜션', '독채', '풀빌라', '한옥'],
  '편의시설': ['와이파이', '주방', '바베큐', '주차', '세탁기', '에어컨', 'TV', '렌터카', '수영장', '스파', '히노끼탕', '온천', '워터파크', '캠핑장', '불멍'],
  '주변 활동': ['해수욕', '트레킹', '일출', '전통시장', '바다낚시', '해루질', '스키'],
};
const PHOTO_LIMIT = 10;
// 사진 목록 — photos 칸이 비어 있으면(예전 데이터) 대표 사진 한 장
function photosOf(r) {
  let list = [];
  try { list = JSON.parse(r.photos || '[]'); } catch (e) { list = []; }
  return Array.isArray(list) && list.length ? list : (r.photo ? [r.photo] : []);
}
const isResortPhoto = u => /^\/uploads\/resorts\/[a-z0-9-]+\.(jpg|png|webp)$/.test(String(u || ''));

function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function register(app, db, auth) {
  const { requireAdmin } = auth;
  const bad = (res, msg) => res.status(400).json({ error: msg });
  const json = v => { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };

  const out = (r, aliases, stat) => ({
    id: r.id, name: r.name, type: r.type, loc: r.loc || '', address: r.address || '',
    facilityName: r.facility_name || '', summary: r.summary || '', season: r.season || '',
    roomType: r.room_type || '', capacity: r.capacity, capacityBase: r.capacity_base,
    phone: r.phone || '', website: r.website || '', photo: r.photo || '', photos: photosOf(r), img: r.img || '',
    details: json(r.details) || [], nearby: json(r.nearby) || [], notices: json(r.notices) || [],
    features: json(r.features) || {}, mapLabel: r.map_label || '',
    active: !!r.active, aliases: aliases || [],
    reviews: stat ? stat.n : 0, rating: stat && stat.rated ? Math.round((stat.sum / stat.rated) * 10) / 10 : null,
  });

  // 후기 수 · 평점 — 앱(/api/resorts)과 같이 숨긴 후기는 빼고, 옛 이름으로 쓴 후기도 센다
  function listAll() {
    const rows = db.prepare('SELECT * FROM resorts ORDER BY sort_order, name').all();
    const aliases = {};
    db.prepare('SELECT alias, resort_id FROM resort_aliases').all()
      .forEach(a => (aliases[a.resort_id] = aliases[a.resort_id] || []).push(a.alias));
    const idOf = {};
    rows.forEach(r => { idOf[r.name] = r.id; (aliases[r.id] || []).forEach(a => { idOf[a] = r.id; }); });
    const stats = {};
    db.prepare('SELECT resort_name, COUNT(*) AS n, SUM(rating_avg) AS sum, COUNT(rating_avg) AS rated FROM reviews WHERE hidden = 0 GROUP BY resort_name')
      .all().forEach(s => {
        const id = idOf[s.resort_name];
        if (!id) return;
        const t = stats[id] = stats[id] || { n: 0, sum: 0, rated: 0 };
        t.n += s.n; t.sum += s.sum || 0; t.rated += s.rated;
      });
    return rows.map(r => out(r, aliases[r.id], stats[r.id]));
  }

  app.get('/api/admin/resorts', requireAdmin, (_req, res) => {
    const resorts = listAll();
    // 지도 지역 — 새 휴양소는 이미 있는 지역 중에서 고르면 그 자리에 마커가 붙는다
    const mapLabels = db.prepare('SELECT map_label AS label, MIN(map_x) AS x, MIN(map_y) AS y FROM resorts WHERE map_label IS NOT NULL GROUP BY map_label ORDER BY map_label').all()
      .map(m => m.label);
    // 고르기 목록 = 기본 목록 + DB 에만 있는 이름 (적재 도구로 넣은 것)
    const choices = Object.fromEntries(Object.entries(FEATURE_CHOICES).map(([k, v]) => [k, [...v]]));
    resorts.forEach(r => Object.entries(r.features).forEach(([k, list]) => {
      choices[k] = choices[k] || [];
      (list || []).forEach(x => { if (!choices[k].includes(x)) choices[k].push(x); });
    }));
    res.json({ resorts, featureChoices: choices, mapLabels });
  });

  // 받은 값 → DB 칸. 틀린 값은 { error }
  function columnsFrom(b, isNew) {
    const cols = {};
    const text = (k, col, max, required) => {
      if (!(k in b)) { if (isNew && required) return `${required} 은(는) 꼭 입력해야 합니다.`; return null; }
      const v = String(b[k] ?? '').trim();
      if (required && !v) return `${required} 은(는) 꼭 입력해야 합니다.`;
      if (v.length > max) return `${required || k} 은(는) ${max}자까지입니다.`;
      cols[col] = v || null;
      return null;
    };
    const err = text('name', 'name', 40, '이름')
      || text('loc', 'loc', 40) || text('address', 'address', 120) || text('facilityName', 'facility_name', 60)
      || text('summary', 'summary', 200) || text('season', 'season', 30) || text('roomType', 'room_type', 200)
      || text('phone', 'phone', 40) || text('website', 'website', 200);
    if (err) return { error: err };
    if ('type' in b || isNew) {
      if (!TYPES.includes(b.type)) return { error: '종류는 정기 · 하계 · 동계 중 하나여야 합니다.' };
      cols.type = b.type;
    }
    if (cols.website && !/^https?:\/\//i.test(cols.website)) return { error: '홈페이지는 http:// 또는 https:// 로 시작해야 합니다.' };
    for (const [k, col] of [['capacity', 'capacity'], ['capacityBase', 'capacity_base']]) {
      if (!(k in b)) continue;
      if (b[k] === '' || b[k] == null) { cols[col] = null; continue; }
      const n = Number(b[k]);
      if (!Number.isInteger(n) || n < 1 || n > 100) return { error: '인원은 1~100 사이 숫자로 적어 주세요.' };
      cols[col] = n;
    }
    if ('details' in b) {
      if (!Array.isArray(b.details)) return { error: '상세 정보 형식이 올바르지 않습니다.' };
      const d = b.details.map(x => ({ label: String(x.label || '').trim().slice(0, 20), value: String(x.value || '').trim().slice(0, 300) })).filter(x => x.label && x.value);
      cols.details = d.length ? JSON.stringify(d) : null;
    }
    for (const [k, max] of [['nearby', 30], ['notices', 300]]) {
      if (!(k in b)) continue;
      if (!Array.isArray(b[k])) return { error: '목록 형식이 올바르지 않습니다.' };
      const list = b[k].map(s => String(s || '').trim().slice(0, max)).filter(Boolean).slice(0, 40);
      cols[k] = list.length ? JSON.stringify(list) : null;
    }
    if ('features' in b) {
      const f = {};
      for (const [k, list] of Object.entries(b.features || {})) {
        const v = (Array.isArray(list) ? list : []).map(s => String(s || '').trim().slice(0, 12)).filter(Boolean);
        if (v.length) f[String(k).slice(0, 12)] = [...new Set(v)];
      }
      cols.features = Object.keys(f).length ? JSON.stringify(f) : null;
    }
    if ('photos' in b) {
      if (!Array.isArray(b.photos)) return { error: '사진 목록 형식이 올바르지 않습니다.' };
      const list = [...new Set(b.photos.map(String))];
      if (list.length > PHOTO_LIMIT) return { error: `사진은 ${PHOTO_LIMIT}장까지입니다.` };
      if (list.some(u => !isResortPhoto(u))) return { error: '사진은 여기서 올린 사진만 쓸 수 있습니다.' };
      cols.photos = list.length ? JSON.stringify(list) : null;
      cols.photo = list[0] || null;   // 첫 장 = 대표 사진
    } else if ('photo' in b) {
      if (b.photo && !isResortPhoto(b.photo)) return { error: '대표 사진은 여기서 올린 사진만 쓸 수 있습니다.' };
      cols.photo = b.photo || null;
      cols.photos = b.photo ? JSON.stringify([b.photo]) : null;
    }
    if ('active' in b) cols.active = b.active ? 1 : 0;
    if ('mapLabel' in b) {
      const m = b.mapLabel ? db.prepare('SELECT map_label, map_x, map_y FROM resorts WHERE map_label = ? LIMIT 1').get(String(b.mapLabel)) : null;
      if (b.mapLabel && !m) return { error: '지도 지역을 목록에서 골라 주세요.' };
      cols.map_label = m ? m.map_label : null; cols.map_x = m ? m.map_x : null; cols.map_y = m ? m.map_y : null;
    }
    return { cols };
  }
  const nameTaken = (name, exceptId) => db.prepare(`
    SELECT 1 FROM resorts WHERE name = ? AND id != ?
    UNION SELECT 1 FROM resort_aliases WHERE alias = ? AND resort_id != ?`).get(name, exceptId, name, exceptId);
  // 바뀐 대표 사진 — 다른 휴양소가 안 쓰면 파일을 지운다 (/uploads/resorts/ 안만)
  function dropPhoto(url) {
    if (!isResortPhoto(url)) return;
    if (db.prepare('SELECT 1 FROM resorts WHERE photo = ? OR photos LIKE ?').get(url, `%"${url}"%`)) return;
    try { fs.unlinkSync(path.join(PHOTO_DIR, path.basename(url))); } catch (e) { /* 이미 없음 */ }
  }

  app.post('/api/admin/resorts', requireAdmin, (req, res) => {
    const b = req.body || {};
    const { cols, error } = columnsFrom(b, true);
    if (error) return bad(res, error);
    if (nameTaken(cols.name, '')) return bad(res, `'${cols.name}' 이름의 휴양소가 이미 있습니다.`);
    // id — 주소(#/resort/<id>)에 쓰는 영문 키. 한 번 정하면 바꾸지 않는다
    const id = `${cols.type}-${crypto.randomBytes(3).toString('hex')}`;
    const sort = (db.prepare('SELECT MAX(sort_order) AS m FROM resorts').get().m || 0) + 10;
    const keys = Object.keys(cols);
    db.prepare(`INSERT INTO resorts (id, sort_order, ${keys.join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')})`)
      .run(id, sort, ...keys.map(k => cols[k]));
    console.log(`[admin] 휴양소 추가 ${id} (${cols.name}) by ${req.user.empno}`);
    res.status(201).json({ resort: listAll().find(r => r.id === id) });
  });

  app.put('/api/admin/resorts/:id', requireAdmin, (req, res) => {
    const before = db.prepare('SELECT * FROM resorts WHERE id = ?').get(req.params.id);
    if (!before) return res.status(404).json({ error: '없는 휴양소입니다.' });
    const { cols, error } = columnsFrom(req.body || {}, false);
    if (error) return bad(res, error);
    if (cols.name && cols.name !== before.name && nameTaken(cols.name, before.id)) return bad(res, `'${cols.name}' 이름의 휴양소가 이미 있습니다.`);
    const keys = Object.keys(cols);
    if (!keys.length) return res.json({ resort: listAll().find(r => r.id === before.id) });
    db.exec('BEGIN');
    try {
      db.prepare(`UPDATE resorts SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map(k => cols[k]), before.id);
      if (cols.name && cols.name !== before.name) {
        // 옛 이름은 옛 표기로 남긴다 (후기 연결). 새 이름이 옛 표기에 있었으면 그건 뺀다
        db.prepare('INSERT OR IGNORE INTO resort_aliases (alias, resort_id) VALUES (?, ?)').run(before.name, before.id);
        db.prepare('DELETE FROM resort_aliases WHERE alias = ? AND resort_id = ?').run(cols.name, before.id);
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    // 빠진 사진 파일은 지운다 (다른 휴양소가 쓰면 남긴다)
    if ('photo' in cols) {
      const now = new Set(cols.photos ? JSON.parse(cols.photos) : []);
      photosOf(before).filter(u => !now.has(u)).forEach(dropPhoto);
    }
    console.log(`[admin] 휴양소 고침 ${before.id} (${keys.join(',')}) by ${req.user.empno}`);
    res.json({ resort: listAll().find(r => r.id === before.id) });
  });

  // 대표 사진 — 화면에서 긴 쪽 1600px 로 줄여 보낸다. 파일 이름은 무작위 (사진 원래 이름은 남기지 않는다)
  app.post('/api/admin/resort-photos', requireAdmin, (req, res) => {
    const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(String((req.body || {}).data || ''));
    if (!m) return bad(res, '사진 형식이 올바르지 않습니다.');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > PHOTO_MAX) return bad(res, '사진은 10MB 까지 올릴 수 있어요.');
    const ext = sniffImage(buf);
    if (!ext) return bad(res, '사진은 JPG · PNG · WEBP 만 올릴 수 있어요.');
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    const name = `r-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(PHOTO_DIR, name), buf);
    console.log(`[admin] 휴양소 사진 올림 ${name} (${Math.round(buf.length / 1024)}KB) by ${req.user.empno}`);
    res.status(201).json({ url: `/uploads/resorts/${name}` });
  });
}

module.exports = { register, FEATURE_CHOICES };
