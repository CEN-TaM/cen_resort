// 휴양소 이름을 일괄 변경한다. (표기 통일용)
//
// 사용:  node rename_resort.js <db경로> [--commit]
//        --commit 없이 실행하면 바뀔 내용만 보여주고 되돌린다.
//
// reviews 와 notifications 양쪽의 resort_name 을 함께 바꾼다.
const { DatabaseSync } = require('node:sqlite');

const [, , DB_PATH, ...flags] = process.argv;
const COMMIT = flags.includes('--commit');

// 옛 이름 → 새 이름
const RENAME = {
  '속초(힐스) 휴양소': '속초(힐스)',
  '속초 (힐스)': '속초(힐스)',
  '속초(서희) 휴양소': '속초(서희)',
};

const db = new DatabaseSync(DB_PATH);
db.exec('BEGIN');

let total = 0;
for (const [from, to] of Object.entries(RENAME)) {
  for (const table of ['reviews', 'notifications']) {
    const n = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE resort_name = ?`).get(from).c;
    if (!n) continue;
    db.prepare(`UPDATE ${table} SET resort_name = ? WHERE resort_name = ?`).run(to, from);
    console.log(`  ${table}: "${from}" → "${to}"  ${n}건`);
    total += n;
  }
}

console.log('--- 변경 후 휴양소별 후기 수 ---');
for (const r of db.prepare('SELECT resort_name, COUNT(*) c FROM reviews GROUP BY resort_name ORDER BY c DESC').all()) {
  console.log(`  ${r.resort_name}: ${r.c}`);
}
console.log(`총 ${total}건 변경`);

if (COMMIT) { db.exec('COMMIT'); console.log('>>> 커밋 완료'); }
else { db.exec('ROLLBACK'); console.log('>>> 시험 실행(rollback). 반영하려면 --commit'); }
db.close();
