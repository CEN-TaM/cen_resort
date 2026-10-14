// index.html 만들기 — screens/ 의 화면 파일들을 screens/_layout.html 에 끼워 넣는다.
//
//   node tools/build_index.js           index.html 다시 만들기
//   node tools/build_index.js --check   index.html 이 screens/ 와 같은지만 확인 (다르면 실패)
//
// 화면은 screens/<화면이름>.html 에서 고친다. index.html 은 이 도구가 만드는 결과물이라 직접 고치지 않는다.
// (파일을 더블클릭해 여는 것 · GitHub Pages · 서버 모두 index.html 한 파일을 그대로 쓰므로 결과물도 저장소에 올린다)
// 서버를 `npm start` 로 켜 두면 screens/ 를 고칠 때마다 자동으로 다시 만든다 (server/index.js).
//
// _layout.html 안의  <!-- @include 파일이름.html -->  자리에 그 파일 내용이 들어간다 (들여쓰기 유지).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'screens');
const OUT = path.join(ROOT, 'index.html');
const NOTICE = '<!-- 자동 생성 파일 — 직접 고치지 마세요. screens/ 폴더를 고친 뒤 `node tools/build_index.js` (npm start 중이면 자동) -->';

function build() {
  const layout = fs.readFileSync(path.join(DIR, '_layout.html'), 'utf8');
  const eol = layout.includes('\r\n') ? '\r\n' : '\n';
  const used = new Set();
  let html = layout.replace(/^([ \t]*)<!-- @include ([\w.-]+) -->[ \t]*(\r?\n)?/gm, (m, indent, file, nl) => {
    const p = path.join(DIR, file);
    if (!fs.existsSync(p)) throw new Error(`screens/_layout.html: ${file} 이 없습니다`);
    used.add(file);
    let body = fs.readFileSync(p, 'utf8').replace(/\r?\n$/, '');
    body = body.split(/\r?\n/).map(l => (l ? indent + l : l)).join(eol);
    return body + (nl || '');
  });
  html = html.replace(/^(<!DOCTYPE html>)(\r?\n)/i, `$1$2${NOTICE}$2`);
  const unused = fs.readdirSync(DIR).filter(f => f.endsWith('.html') && f !== '_layout.html' && !used.has(f));
  return { html, unused };
}

if (require.main === module) {
  const { html, unused } = build();
  if (unused.length) console.log('⚠️ _layout.html 에 넣지 않은 화면 파일:', unused.join(', '));
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== html) { console.error('⛔ index.html 이 screens/ 와 다릅니다. node tools/build_index.js 를 실행하세요.'); process.exit(1); }
    console.log('✅ index.html 최신');
  } else {
    fs.writeFileSync(OUT, html);
    console.log(`✅ index.html 생성 (${html.split('\n').length}줄)`);
  }
}

module.exports = { build, OUT, DIR };
