// server/ 폴더에서 실행: node verify.js
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const db = new DatabaseSync('data/reviews.db');
console.log('무결성:', db.prepare('PRAGMA integrity_check').get().integrity_check);
console.log('리뷰:', db.prepare('SELECT COUNT(*) c FROM reviews').get().c,
            '/ 사진:', db.prepare('SELECT COUNT(*) c FROM review_photos').get().c);

const rows = db.prepare('SELECT path FROM review_photos').all();
const files = fs.readdirSync('uploads');
const used = new Set(rows.map(r => r.path.replace('/uploads/', '')));
console.log('파일 없음:', rows.filter(r => !fs.existsSync('.' + r.path)).length,
            '/ 미참조 파일:', files.filter(f => !used.has(f)).length);

console.log('--- 휴양소별 ---');
for (const r of db.prepare('SELECT resort_name, COUNT(*) c FROM reviews GROUP BY resort_name ORDER BY c DESC').all()) {
  console.log('  ' + r.resort_name + ': ' + r.c);
}
db.close();
