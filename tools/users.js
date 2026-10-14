// 직원 명단 관리 (서버에서 실행)
//
// 회원가입은 없다. 여기서 직원을 명단에 넣어 두면, 그 직원이 처음 한 번
// '사번인증 및 비밀번호 설정' 화면에서 사번 + 회사 메일로 본인 확인을 하고 비밀번호를 정한다.
//
//   node tools/users.js list
//   node tools/users.js add <사번> <이름> <회사메일> [직급] [--dept=부서] [--company=회사] [--admin]
//   node tools/users.js add <사번> <이름> --password [직급] [--admin]   사번인증 없이 바로 로그인할 계정
//        (관리자 계정용) 임시 비밀번호를 만들어 한 번만 보여준다. 로그인 후 '회원정보 수정'에서 바꾼다
//   node tools/users.js import <명단.csv> [--commit]   CSV 열: 사번,이름,직급,이메일[,부서,회사] (첫 줄 머리글)
//   node tools/users.js role <사번> admin|user
//   node tools/users.js reset <사번>          비밀번호를 지운다 → 그 직원이 사번인증부터 다시 한다
//   node tools/users.js off <사번> | on <사번>  로그인 막기 / 풀기 (퇴사 등)
//
// DB 는 server/data/reviews.db (서버의 db.js 와 같은 파일). 서버가 켜져 있어도 실행해도 된다.

const fs = require('fs');
const crypto = require('crypto');
const db = require('../server/db');
const auth = require('../server/auth');

auth.setup(db);

const [cmd, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.slice(2).split('=');
  return [k, v === undefined ? true : v];
}));
const args = rest.filter(a => !a.startsWith('--'));
const now = () => new Date().toISOString();
const find = empno => db.prepare('SELECT * FROM users WHERE empno = ?').get(String(empno || ''));
const fail = msg => { console.error('⛔ ' + msg); process.exit(1); };
const isMail = s => /^[^\s@]+@itcen\.com$/i.test(String(s || ''));

function need(empno) {
  const u = find(empno);
  if (!u) fail(`사번 ${empno} 직원이 명단에 없습니다.`);
  return u;
}

const insert = db.prepare(`
  INSERT INTO users (empno, name, position, department, company, email, role, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

switch (cmd) {
  case 'list': {
    const rows = db.prepare('SELECT * FROM users ORDER BY empno').all();
    if (!rows.length) { console.log('명단이 비어 있습니다.'); break; }
    console.table(rows.map(u => ({
      사번: u.empno, 이름: u.name, 직급: u.position, 메일: u.email, 역할: u.role,
      상태: !u.active ? '막힘' : u.password_hash ? '인증완료' : '사번인증 전',
    })));
    break;
  }
  case 'add': {
    // --password 면 메일 없이 [직급] 이 세 번째 자리에 온다
    const [empno, name, third = '', fourth = ''] = args;
    const email = flags.password ? (isMail(third) ? third : '') : third;
    const position = flags.password && !isMail(third) ? third : fourth;
    if (!empno || !name || (!email && !flags.password)) {
      fail('사용법: node tools/users.js add <사번> <이름> <회사메일> [직급] [--admin]  또는  add <사번> <이름> --password [직급] [--admin]');
    }
    if (email && !isMail(email)) fail('회사 메일(@itcen.com)을 넣어주세요. 사번인증 때 이 메일로 본인 확인을 합니다.');
    if (find(empno)) fail(`사번 ${empno} 는 이미 명단에 있습니다.`);
    insert.run(empno, name, position, flags.dept || null, flags.company || null, email ? email.toLowerCase() : null,
      flags.admin ? 'admin' : 'user', now(), now());
    const who = `${empno} ${name} ${position}`.trim() + (flags.admin ? ' (관리자)' : '');
    if (flags.password) {
      const pw = crypto.randomBytes(5).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || crypto.randomBytes(4).toString('hex');
      db.prepare('UPDATE users SET password_hash = ? WHERE empno = ?').run(auth.hashPassword(pw), empno);
      console.log(`✅ ${who} 추가 — 바로 로그인할 수 있습니다`);
      console.log(`   임시 비밀번호: ${pw}   ← 지금 한 번만 보입니다. 로그인 후 '회원정보 수정'에서 바꾸세요`);
    } else {
      console.log(`✅ ${who} 명단에 추가 — 사번인증 화면에서 비밀번호를 정하면 됩니다`);
    }
    break;
  }
  case 'import': {
    const [file] = args;
    if (!file || !fs.existsSync(file)) fail('사용법: node tools/users.js import <명단.csv> [--commit]');
    const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    let added = 0, skipped = 0;
    db.exec('BEGIN');
    lines.slice(1).forEach((line, i) => {
      const [empno, name, position, email, dept, company] = line.split(',').map(s => s.trim());
      const at = `${i + 2}행`;
      if (!empno || !name || !isMail(email)) { console.log(`  건너뜀 ${at}: 사번·이름·회사메일 확인 (${line})`); skipped++; return; }
      if (find(empno)) { console.log(`  건너뜀 ${at}: ${empno} 이미 있음`); skipped++; return; }
      insert.run(empno, name, position || '', dept || null, company || null, email.toLowerCase(), 'user', now(), now());
      added++;
    });
    if (flags.commit) { db.exec('COMMIT'); console.log(`✅ ${added}명 추가, ${skipped}건 건너뜀`); }
    else { db.exec('ROLLBACK'); console.log(`(시험) ${added}명 추가 예정, ${skipped}건 건너뜀 — 실제로 넣으려면 --commit`); }
    break;
  }
  case 'role': {
    const [empno, role] = args;
    if (!['admin', 'user'].includes(role)) fail('역할은 admin 또는 user');
    need(empno);
    db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE empno = ?').run(role, now(), empno);
    console.log(`✅ ${empno} → ${role}`);
    break;
  }
  case 'reset': {
    const [empno] = args;
    need(empno);
    db.prepare('UPDATE users SET password_hash = NULL, updated_at = ? WHERE empno = ?').run(now(), empno);
    db.prepare('DELETE FROM sessions WHERE empno = ?').run(empno);   // 기존 로그인은 끊는다
    console.log(`✅ ${empno} 비밀번호 초기화 — '사번인증 및 비밀번호 설정'을 다시 하면 됩니다`);
    break;
  }
  case 'off':
  case 'on': {
    const [empno] = args;
    need(empno);
    db.prepare('UPDATE users SET active = ?, updated_at = ? WHERE empno = ?').run(cmd === 'on' ? 1 : 0, now(), empno);
    if (cmd === 'off') db.prepare('DELETE FROM sessions WHERE empno = ?').run(empno);
    console.log(`✅ ${empno} ${cmd === 'on' ? '로그인 허용' : '로그인 막음'}`);
    break;
  }
  default:
    console.log('사용법: node tools/users.js list | add | import | role | reset | off | on  (파일 맨 위 주석 참고)');
}
