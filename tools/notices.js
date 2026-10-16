// 공지사항 관리 (보통은 관리자 페이지 /admin 에서 쓴다. 이 도구는 여러 개를 한 번에 넣을 때 · 서버에서 실행)
//
//   node tools/notices.js list
//   node tools/notices.js add <공지.json> [--commit]       새 공지 (여러 개면 배열)
//   node tools/notices.js edit <번호> <공지.json> [--commit] 고치기 (적은 칸만 바뀐다)
//   node tools/notices.js off <번호> | on <번호>            숨기기 / 다시 보이기 (지우지 않는다)
//
// add · edit 는 --commit 없이 실행하면 들어갈 내용만 보여주고 되돌린다.
//
// 공지.json
//   { "category": "예약", "title": "...", "pinned": false,    (author 작성 부서는 선택 — 앱에 보이지 않는다)
//     "body": "본문",  "files": [{ "name": "안내.pdf", "url": "https://...", "size": "1.2MB" }],
//     "createdAt": "2026-10-14T09:00:00+09:00" }        ← 없으면 지금
//   category 는 화면 분류 칩과 같아야 한다: 이용수칙 · 예약 · 포인트 (server/admin.js NOTICE_CATEGORIES)
//   body 표기 (HTML 은 쓰지 않는다 — 화면이 글자로만 그린다)
//     ### 소제목        - 목록 한 줄        > 강조 상자        **굵게**        빈 줄 = 문단 나눔
//   files 의 url 은 사내에서 열리는 주소. 없으면 첨부 칸에 이름만 보인다

const fs = require('fs');
const db = require('../server/db');

const { NOTICE_CATEGORIES: CATEGORIES } = require('../server/admin');   // 관리자 화면과 같은 분류 목록
const [cmd, ...rest] = process.argv.slice(2);
const COMMIT = rest.includes('--commit');
const args = rest.filter(a => a !== '--commit');
const fail = m => { console.error('⛔ ' + m); process.exit(1); };
const now = () => new Date().toISOString();

function readJson(file) {
  if (!file || !fs.existsSync(file)) fail('공지 파일이 없습니다: ' + file);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(j) ? j : [j];
}
function check(n, partial) {
  if (!partial || n.category !== undefined) if (!CATEGORIES.includes(n.category)) fail(`분류는 ${CATEGORIES.join(' · ')} 중 하나: ${n.category}`);
  if (!partial) for (const k of ['title', 'body']) if (!String(n[k] || '').trim()) fail(`'${k}' 가 비어 있습니다 (${n.title || ''})`);
  if (n.files && !Array.isArray(n.files)) fail('files 는 배열이어야 합니다');
}
function toIso(v) {
  if (!v) return now();
  const d = new Date(v);
  if (isNaN(d)) fail('createdAt 형식이 틀립니다: ' + v);
  return d.toISOString();
}

switch (cmd) {
  case 'list': {
    const rows = db.prepare('SELECT n.id, n.category, n.title, n.author, n.pinned, n.active, n.created_at, (SELECT COUNT(*) FROM notice_views v WHERE v.notice_id = n.id) AS views FROM notices n ORDER BY n.id').all();
    if (!rows.length) { console.log('공지가 없습니다.'); break; }
    console.table(rows.map(r => ({ 번호: r.id, 분류: r.category, 제목: r.title.slice(0, 30), 부서: r.author, 고정: r.pinned ? 'O' : '', 상태: r.active ? '보임' : '숨김', 조회: r.views, 작성: r.created_at.slice(0, 10) })));
    break;
  }
  case 'add': {
    const list = readJson(args[0]);
    list.forEach(n => check(n, false));
    db.exec('BEGIN');
    const ins = db.prepare('INSERT INTO notices (category, title, body, author, pinned, files, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)');
    list.forEach(n => {
      const at = toIso(n.createdAt);
      const info = ins.run(n.category, n.title.trim(), n.body.trim(), String(n.author || '').trim(), n.pinned ? 1 : 0, n.files ? JSON.stringify(n.files) : null, at, at);
      console.log(`+ ${info.lastInsertRowid}번 [${n.category}] ${n.title}${n.pinned ? ' (고정)' : ''}`);
    });
    if (COMMIT) { db.exec('COMMIT'); console.log('>>> 반영 완료'); } else { db.exec('ROLLBACK'); console.log('>>> 시험 실행(되돌림). 실제로 넣으려면 --commit'); }
    break;
  }
  case 'edit': {
    const id = Number(args[0]);
    const [n] = readJson(args[1]);
    const before = db.prepare('SELECT * FROM notices WHERE id = ?').get(id);
    if (!before) fail(`${id}번 공지가 없습니다`);
    check(n, true);
    const map = { category: 'category', title: 'title', body: 'body', author: 'author', pinned: 'pinned', files: 'files', createdAt: 'created_at' };
    const sets = Object.entries(n).filter(([k]) => map[k]).map(([k, v]) => [map[k], k === 'files' ? JSON.stringify(v) : k === 'pinned' ? (v ? 1 : 0) : k === 'createdAt' ? toIso(v) : String(v).trim()]);
    if (!sets.length) fail('바꿀 칸이 없습니다');
    db.exec('BEGIN');
    db.prepare(`UPDATE notices SET ${sets.map(s => s[0] + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).run(...sets.map(s => s[1]), now(), id);
    sets.forEach(([c, v]) => console.log(`  ${c}: ${String(before[c] ?? '').slice(0, 40)}  →  ${String(v).slice(0, 40)}`));
    if (COMMIT) { db.exec('COMMIT'); console.log('>>> 반영 완료'); } else { db.exec('ROLLBACK'); console.log('>>> 시험 실행(되돌림). 실제로 넣으려면 --commit'); }
    break;
  }
  case 'off':
  case 'on': {
    const id = Number(args[0]);
    if (!db.prepare('SELECT 1 FROM notices WHERE id = ?').get(id)) fail(`${id}번 공지가 없습니다`);
    db.prepare('UPDATE notices SET active = ?, updated_at = ? WHERE id = ?').run(cmd === 'on' ? 1 : 0, now(), id);
    console.log(`✅ ${id}번 ${cmd === 'on' ? '보이기' : '숨김'}`);
    break;
  }
  default:
    console.log('사용법: node tools/notices.js list | add | edit | off | on  (파일 맨 위 주석 참고)');
}
