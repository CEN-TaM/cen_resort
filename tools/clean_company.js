// 후기 회사명에서 법인 표기('주식회사', '(주)')를 떼어 낸다.
//
// 두 가지로 쓴다.
//   1) DB 정리:  node clean_company.js <db경로> [--commit]
//      --commit 없이 실행하면 바뀔 내용만 보여주고 되돌린다.
//   2) 적재 중 자동 정리:  const { cleanCompanyName } = require('./clean_company')
//
// 자세한 배경은 DATA_IMPORT.md 의 '회사명' 항목.

// '주식회사' 를 '주' 보다 먼저 지워야 한다. 순서가 반대면 '주식회사 X' 에서
// 첫 글자만 떨어져 '식회사 X' 가 된다 — 화면에서 실제로 그렇게 보였던 적이 있다.
function cleanCompanyName(value) {
  return String(value == null ? '' : value).trim()
    .replace(/^\(?\s*주식회사\s*\)?\s*/, '')
    .replace(/^식회사\s*/, '')                        // 잘못 잘린 값이 들어와도 받아낸다
    .replace(/^\(\s*주\s*\)\s*/, '')
    .replace(/\s*(?:주식회사|\(\s*주\s*\))\s*$/, '')   // 뒤에 붙은 경우
    .trim();
}

module.exports = { cleanCompanyName };

// ── 여기부터는 직접 실행했을 때만 ──────────────────────────────
if (require.main === module) {
  const { DatabaseSync } = require('node:sqlite');
  const [, , DB_PATH, ...flags] = process.argv;
  const COMMIT = flags.includes('--commit');

  if (!DB_PATH) {
    console.error('사용: node clean_company.js <db경로> [--commit]');
    process.exit(1);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('BEGIN');

  const rows = db.prepare('SELECT id, company FROM reviews WHERE company IS NOT NULL AND company != ?').all('');
  const upd = db.prepare('UPDATE reviews SET company = ? WHERE id = ?');
  const changed = new Map();
  let n = 0;

  for (const r of rows) {
    const after = cleanCompanyName(r.company);
    if (after === r.company) continue;
    upd.run(after, r.id);
    changed.set(`${r.company} → ${after}`, (changed.get(`${r.company} → ${after}`) || 0) + 1);
    n++;
  }

  for (const [label, c] of changed) console.log(`  ${label}  ${c}건`);
  console.log(`총 ${n}건 변경`);

  console.log('--- 변경 후 회사명 ---');
  for (const r of db.prepare('SELECT company, COUNT(*) c FROM reviews WHERE company IS NOT NULL AND company != ? GROUP BY company ORDER BY c DESC').all('')) {
    console.log(`  ${r.company}: ${r.c}`);
  }

  if (COMMIT) { db.exec('COMMIT'); console.log('>>> 커밋 완료'); }
  else { db.exec('ROLLBACK'); console.log('>>> 시험 실행(rollback). 반영하려면 --commit'); }
  db.close();
}
