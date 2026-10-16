// 휴양소 꿀팁 넣기 (후기에서 추린 꿀팁 등 · 서버에서 실행)
//
//   node tools/import_tips.js <꿀팁.json>            넣을 내용만 보여주고 되돌린다 (시험)
//   node tools/import_tips.js <꿀팁.json> --commit   실제로 넣는다
//
// 꿀팁.json (배열)
//   [{ "resort_id": "jocheon", "tag": "주차", "title": "주차는 후문으로", "content": "본문 한 줄",
//      "author": "홍길동 책임", "company": "주식회사 OO", "department": "OO사업부",
//      "created_at": "2026-08-31T08:02:00.000Z" }]
//   resort_id  DB 휴양소 id (http://localhost:8999/api/resorts)
//   tag        6자 이내 (예: 주차 · 맛집 · 준비물 · 시설 · 교통 · 관광 · 아이동반 · 체크인 · 주변)
//   title      60자 이내 · content 1000자 이내 (서버 API 와 같은 제한)
//   company · department  작성자 회사 · 부서 (이름 아래에 보인다. 없으면 비워 둔다). 회사명의 (주) · 주식회사 는 뗀다
//   created_at 없으면 지금
//   그 밖의 칸(review_id 등)은 읽지 않는다
//
// 넣은 꿀팁의 사번은 비워 두는 대신 IMPORT_EMPNO 로 적는다 → 앱에서 '내 꿀팁' 으로 잡히지 않고, 고치기 · 지우기는 관리자만.
// 같은 휴양소 · 작성자 · 제목인 꿀팁이 이미 있으면 건너뛴다 (두 번 실행해도 겹치지 않는다).
// 꿀팁.json 은 저장소(공개)에 올리지 않는다 — 실제 후기 문장과 작성자 이름이 들어 있다.

const fs = require('fs');
const db = require('../server/db');
const { cleanCompanyName } = require('./clean_company');

const IMPORT_EMPNO = 'TIP_IMPORT';
const [file, ...flags] = process.argv.slice(2);
const COMMIT = flags.includes('--commit');
const fail = m => { console.error('⛔ ' + m); process.exit(1); };

if (!file || !fs.existsSync(file)) fail('사용: node tools/import_tips.js <꿀팁.json> [--commit]');
const list = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(list)) fail('꿀팁.json 은 배열이어야 합니다');

const resortName = id => (db.prepare('SELECT name FROM resorts WHERE id = ?').get(id) || {}).name;
list.forEach((t, i) => {
  const at = `${i + 1}번째 (${t.title || ''})`;
  if (!resortName(t.resort_id)) fail(`휴양소 id 가 DB 에 없습니다: ${t.resort_id} — ${at}`);
  for (const k of ['title', 'content', 'author']) if (!String(t[k] || '').trim()) fail(`'${k}' 가 비어 있습니다 — ${at}`);
  if (String(t.tag || '').trim().length > 6) fail(`tag 는 6자 이내: ${t.tag} — ${at}`);
  if (t.title.trim().length > 60) fail(`title 은 60자 이내 — ${at}`);
  if (t.content.trim().length > 1000) fail(`content 는 1000자 이내 — ${at}`);
  if (t.created_at && isNaN(new Date(t.created_at))) fail(`created_at 형식이 틀립니다: ${t.created_at} — ${at}`);
});

const exists = db.prepare('SELECT 1 FROM tips WHERE resort_id = ? AND author = ? AND title = ?');
const ins = db.prepare('INSERT INTO tips (resort_id, empno, author, department, company, tag, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
let added = 0, skipped = 0;
db.exec('BEGIN');
for (const t of list) {
  const title = t.title.trim(), author = t.author.trim();
  if (exists.get(t.resort_id, author, title)) { skipped++; console.log(`= 건너뜀 (이미 있음) ${resortName(t.resort_id)} · ${title}`); continue; }
  const createdAt = t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString();
  ins.run(t.resort_id, IMPORT_EMPNO, author, String(t.department || '').trim() || null, cleanCompanyName(t.company) || null,
    String(t.tag || '').trim() || null, title, t.content.trim(), createdAt);
  added++;
  console.log(`+ ${resortName(t.resort_id).padEnd(12)} [${t.tag || '-'}] ${title}  — ${author}`);
}
const per = {};
list.forEach(t => { per[t.resort_id] = (per[t.resort_id] || 0) + 1; });
console.log(`\n추가 ${added}개 · 건너뜀 ${skipped}개 · 휴양소 ${Object.keys(per).length}곳`);
if (COMMIT) { db.exec('COMMIT'); console.log('>>> 반영 완료'); } else { db.exec('ROLLBACK'); console.log('>>> 시험 실행(되돌림). 실제로 넣으려면 --commit'); }
