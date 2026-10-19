// 이미 들어간 후기에 사진을 더 붙인다 (예: 처음 넣을 때 4장까지만 넣은 후기를 원본대로 10장까지).
//
// 사용:  node tools/add_review_photos.js <사진추가.json> [--commit]
//        --commit 없이 실행하면 붙일 내용만 보여주고 되돌린다. 먼저 이걸로 확인할 것.
//
// 사진추가.json = [{ resort: '보령 휴양소', author: '홍길동 수석', photos: ['/uploads/<무작위24자리>.jpg', ...] }]
//   - 후기는 휴양소 이름 + 작성자로 찾는다 (같은 휴양소에 같은 작성자 후기가 둘 이상이면 멈춘다)
//   - 사진 파일은 먼저 server/uploads/ 에 올려 둔다 (없는 파일이 있으면 멈춘다)
//   - 이미 붙어 있는 사진은 건너뛰고, 원래 사진 뒤에 순서대로 붙인다. 후기 하나에 10장을 넘기지 않는다 (앱 후기 쓰기와 같은 한도)
// 사진추가.json 과 사진은 저장소 밖에 둔다 (실제 후기 사진).

const fs = require('fs');
const path = require('path');
const db = require('../server/db');

const MAX = 10;
const [, , FILE, ...flags] = process.argv;
const COMMIT = flags.includes('--commit');
if (!FILE || !fs.existsSync(FILE)) {
  console.log('사용: node tools/add_review_photos.js <사진추가.json> [--commit]');
  process.exit(1);
}
const UPLOADS = path.join(__dirname, '..', 'server', 'uploads');
const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const find = db.prepare('SELECT id FROM reviews WHERE resort_name = ? AND author_name = ?');
const photosOf = db.prepare('SELECT path FROM review_photos WHERE review_id = ? ORDER BY id');
const ins = db.prepare('INSERT INTO review_photos (review_id, path) VALUES (?, ?)');

db.exec('BEGIN');
let added = 0, reviews = 0;
try {
  for (const it of items) {
    const found = find.all(it.resort, it.author);
    if (found.length !== 1) throw new Error(`${it.resort} · ${it.author}: 후기를 ${found.length}개 찾음 (1개여야 함)`);
    const rid = found[0].id;
    const have = photosOf.all(rid).map(p => p.path);
    const todo = (it.photos || []).filter(p => !have.includes(p));
    for (const p of todo) {
      if (!/^\/uploads\/[a-f0-9]{24}\.(jpg|jpeg|png|webp)$/i.test(p)) throw new Error(`${it.author}: 사진 주소 형식이 아님 ${p}`);
      if (!fs.existsSync(path.join(UPLOADS, path.basename(p)))) throw new Error(`${it.author}: 사진 파일이 없음 server/uploads/${path.basename(p)} — 먼저 올리세요`);
    }
    const room = Math.max(0, MAX - have.length);
    const put = todo.slice(0, room);
    put.forEach(p => ins.run(rid, p));
    if (put.length) reviews++;
    added += put.length;
    console.log(`${put.length ? '+' : '='} ${it.resort} · ${it.author}  ${have.length}장 → ${have.length + put.length}장${todo.length > room ? `  (${todo.length - room}장은 ${MAX}장을 넘어 뺌)` : ''}`);
  }
  if (COMMIT) { db.exec('COMMIT'); console.log(`\n>>> 반영 완료 — 후기 ${reviews}개에 사진 ${added}장`); }
  else { db.exec('ROLLBACK'); console.log(`\n후기 ${reviews}개에 사진 ${added}장\n>>> 시험 실행(되돌림). 실제로 넣으려면 --commit`); }
} catch (e) {
  db.exec('ROLLBACK');
  console.error('⛔ 멈춤:', e.message);
  process.exit(1);
}
