// 옮겨 온 후기의 작성자 이름에 빠진 직급을 채운다.
//
// 후기 작성자는 '이름 직급'(홍길동 수석)으로 저장한다 (DATA_IMPORT.md '① 엑셀에서 meta.json 만들기').
// 이름만 넣고 지나간 경우 이 도구로 뒤늦게 채운다.
//
// 사용:
//   node tools/fix_author.js <db경로> <작성자.json>            # 시험 (바뀔 내용만 보여주고 되돌림)
//   node tools/fix_author.js <db경로> <작성자.json> --commit   # 실제
//
// 작성자.json — 받은 자료의 원본 PDF '게시자' 줄을 보고 적는다. 저장소가 공개라 **저장소 밖**에 둔다.
//   [{ "resort": "속초(힐스)", "name": "이진환", "department": "국세서비스팀", "position": "수석" }]
//     resort      휴양소 이름 (DB 에 저장된 그대로)
//     name        지금 저장돼 있는 이름 (직급 없이)
//     department  같은 이름이 여럿일 때 가려내는 용도. 없으면 휴양소+이름으로만 찾는다
//     position    붙일 직급 (수석 · 책임 · 팀장 · 이사 …)
//
// 이미 직급이 붙어 있으면 건너뛴다. 여러 번 돌려도 '이름 직급 직급' 이 되지 않는다.

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const [, , DB_PATH, MAP_PATH, ...flags] = process.argv;
const COMMIT = flags.includes('--commit');

if (!DB_PATH || !MAP_PATH) {
  console.error('사용: node tools/fix_author.js <db경로> <작성자.json> [--commit]');
  process.exit(1);
}

const list = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
if (!Array.isArray(list) || !list.length) {
  console.error('작성자.json 이 비어 있습니다.');
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
db.exec('BEGIN');

const byDept = db.prepare(
  'SELECT id, author_name FROM reviews WHERE resort_name = ? AND author_name = ? AND department = ?');
const byName = db.prepare(
  'SELECT id, author_name FROM reviews WHERE resort_name = ? AND author_name = ?');
const upd = db.prepare('UPDATE reviews SET author_name = ? WHERE id = ?');

let done = 0, skip = 0, miss = 0;

for (const row of list) {
  const resort = String(row.resort || '').trim();
  const name = String(row.name || '').trim();
  const pos = String(row.position || '').trim();
  if (!resort || !name || !pos) { console.log(`  [건너뜀] 칸이 비었습니다: ${JSON.stringify(row)}`); skip++; continue; }

  const dept = row.department ? String(row.department).trim() : null;
  const found = dept ? byDept.all(resort, name, dept) : byName.all(resort, name);

  if (!found.length) {
    // 이미 직급이 붙어 있는지도 본다 (두 번째 실행)
    const already = byName.all(resort, `${name} ${pos}`);
    if (already.length) { console.log(`  [이미 됨] ${resort} · ${name} ${pos}`); skip += already.length; }
    else { console.log(`  [못 찾음] ${resort} · ${name}${dept ? ' · ' + dept : ''}`); miss++; }
    continue;
  }

  for (const r of found) {
    const after = `${name} ${pos}`;
    if (r.author_name === after) { skip++; continue; }
    upd.run(after, r.id);
    console.log(`  #${String(r.id).padStart(3)}  ${r.author_name}  →  ${after}`);
    done++;
  }
}

console.log(`\n바꿈 ${done}건 · 건너뜀 ${skip}건 · 못 찾음 ${miss}건`);

if (miss) {
  console.log('\n못 찾은 항목이 있습니다. 휴양소 이름 · 작성자 이름이 DB 와 같은지 확인하세요.');
  console.log('DB 에 있는 작성자를 보려면:');
  console.log(`  node -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('${DB_PATH}');` +
    `for(const r of d.prepare('SELECT resort_name,author_name,department FROM reviews ORDER BY id').all())` +
    `console.log(r.resort_name,'|',r.author_name,'|',r.department)"`);
}

if (COMMIT) { db.exec('COMMIT'); console.log('>>> 커밋 완료'); }
else { db.exec('ROLLBACK'); console.log('>>> 시험 실행(rollback). 반영하려면 --commit'); }
db.close();
