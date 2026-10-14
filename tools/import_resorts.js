// 휴양소 정보를 resorts 테이블에 넣는다 (있는 휴양소는 고치고, 없는 휴양소는 추가한다).
//
// 사용:  node tools/import_resorts.js <정보.json> [--commit]
//        --commit 없이 실행하면 바뀔 내용만 보여주고 되돌린다. 먼저 이걸로 확인할 것.
//
// 정보.json = 배열. 휴양소 하나에 { id, ...칸 }. 적은 칸만 바꾸고, 적지 않은 칸은 그대로 둔다.
//   id            resorts.id (예: summer-geumodo). 새 휴양소면 name · type 도 적는다
//   name, type, loc, address, img, sort, active
//   facilityName  실제 숙소 이름      summary   한 줄 소개      season  운영 시즌 (이벤트)
//   roomType      객실 구성           capacity  최대 인원       capacityBase  기준 인원
//   details       [{ label, value }]  상세 표 (가전 · 가구 · 부대시설 · 냉난방 · 교통 · 입퇴실 ...)
//   features      { 환경, 숙소 유형, 편의시설, 주변 활동 }   — 칩으로 보이는 편의시설
//   phone, website, nearby [이름...], notices [이용 수칙 문장...], photo (/uploads/resorts/파일)
//   map           { label, x, y }
//
// 회사 안내 PDF 에서 옮길 때: 개인 연락처(담당자 휴대폰 · 메일), 와이파이 비밀번호는 넣지 않는다.
// 이 파일(정보.json)은 저장소에 올리지 않는다 — 회사 숙소 주소 · 연락처가 들어 있다.

const fs = require('fs');
const db = require('../server/db');

const [, , FILE, ...flags] = process.argv;
const COMMIT = flags.includes('--commit');
if (!FILE || !fs.existsSync(FILE)) {
  console.log('사용: node tools/import_resorts.js <정보.json> [--commit]');
  process.exit(1);
}

// JSON 칸 → DB 칸 (JSON 으로 저장할 칸은 json: true)
const COLS = {
  name: { col: 'name' }, type: { col: 'type' }, loc: { col: 'loc' }, address: { col: 'address' },
  img: { col: 'img' }, sort: { col: 'sort_order' }, active: { col: 'active' },
  facilityName: { col: 'facility_name' }, summary: { col: 'summary' }, season: { col: 'season' },
  roomType: { col: 'room_type' }, capacity: { col: 'capacity' }, capacityBase: { col: 'capacity_base' },
  details: { col: 'details', json: true }, features: { col: 'features', json: true },
  phone: { col: 'phone' }, website: { col: 'website' },
  nearby: { col: 'nearby', json: true }, notices: { col: 'notices', json: true },
  photo: { col: 'photo' },
};

const rows = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const now = id => db.prepare('SELECT * FROM resorts WHERE id = ?').get(id);
const short = v => { const s = v == null ? '(없음)' : String(v); return s.length > 60 ? s.slice(0, 57) + '...' : s; };

db.exec('BEGIN');
let changed = 0, added = 0, same = 0;
try {
  for (const r of rows) {
    if (!r.id) throw new Error('id 가 없는 항목이 있습니다: ' + JSON.stringify(r).slice(0, 80));
    const before = now(r.id);
    const sets = [];
    for (const [k, v] of Object.entries(r)) {
      if (k === 'id' || k === 'map') continue;
      const c = COLS[k];
      if (!c) throw new Error(`${r.id}: 모르는 칸 '${k}'`);
      sets.push([c.col, c.json ? JSON.stringify(v) : v]);
    }
    if (r.map) sets.push(['map_label', r.map.label], ['map_x', r.map.x], ['map_y', r.map.y]);

    if (!before) {
      if (!r.name || !r.type) throw new Error(`${r.id}: 새 휴양소는 name · type 이 필요합니다`);
      const cols = ['id', ...sets.map(s => s[0])];
      db.prepare(`INSERT INTO resorts (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
        .run(r.id, ...sets.map(s => s[1]));
      console.log(`+ ${r.id} (${r.name}) 추가`);
      added++;
      continue;
    }
    const diff = sets.filter(([col, v]) => String(before[col] ?? '') !== String(v ?? ''));
    if (!diff.length) { same++; continue; }
    console.log(`~ ${r.id} (${before.name})`);
    diff.forEach(([col, v]) => console.log(`    ${col.padEnd(14)} ${short(before[col])}  →  ${short(v)}`));
    db.prepare(`UPDATE resorts SET ${diff.map(d => d[0] + ' = ?').join(', ')} WHERE id = ?`).run(...diff.map(d => d[1]), r.id);
    changed++;
  }
} catch (e) {
  db.exec('ROLLBACK');
  console.error('⛔ ' + e.message);
  process.exit(1);
}

console.log(`\n수정 ${changed}곳 · 추가 ${added}곳 · 그대로 ${same}곳`);
if (COMMIT) { db.exec('COMMIT'); console.log('>>> 반영 완료'); }
else { db.exec('ROLLBACK'); console.log('>>> 시험 실행(되돌림). 실제로 넣으려면 --commit'); }
