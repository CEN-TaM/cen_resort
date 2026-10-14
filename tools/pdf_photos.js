// PDF 안의 사진(JPEG)을 꺼내서 페이지별로 저장하고, 한눈에 보는 목록(index.html)을 만든다.  (라이브러리 없이 Node 만으로)
//
// 사용:  node tools/pdf_photos.js <파일.pdf> <출력폴더> [최소픽셀=200000]
//
// 결과 (출력폴더에)
//   p<페이지>_<번호>.jpg   PDF 에 들어 있던 사진 원본 그대로 (다시 압축하지 않음)
//   index.html            페이지별 사진 목록 — 브라우저로 열어(또는 Claude 가 스크린샷으로) 대표 사진을 고른다
//
// 휴양소 안내 PDF(PowerPoint · Microsoft Print to PDF)의 외관 · 객실 사진은 대부분 JPEG 그대로 들어 있어 이 방법으로 꺼내진다.
// 지도 · 아이콘 · 장식 같은 작은 그림은 '최소픽셀'(가로×세로) 보다 작아 빠진다.
// JPEG 이 아닌 그림(PNG 류)은 꺼내지 않는다 — 필요한 사진이 목록에 없으면 PDF 를 열어 화면 캡처로 대신한다.
// 사진 위에 '외관' 같은 글씨가 얹혀 보였다면 그건 PDF 의 글자라 꺼낸 사진에는 없다.

const fs = require('fs');
const path = require('path');

const [, , PDF, OUT, MIN = '200000'] = process.argv;
if (!PDF || !OUT || !fs.existsSync(PDF)) {
  console.log('사용: node tools/pdf_photos.js <파일.pdf> <출력폴더> [최소픽셀=200000]');
  process.exit(1);
}
const MIN_PIXELS = Number(MIN);
const buf = fs.readFileSync(PDF);
const s = buf.toString('latin1');

// ── 객체 n 의 사전(<< ... >>) 부분과, 스트림이면 그 시작 위치
const objIndex = {};
for (const m of s.matchAll(/(?:^|[\r\n\s])(\d+) 0 obj\b/g)) objIndex[m[1]] = m.index + m[0].length;
function objText(n) {
  const at = objIndex[n];
  if (at === undefined) return '';
  const end = s.indexOf('endobj', at);
  const st = s.indexOf('stream', at);
  return s.slice(at, st >= 0 && st < end ? st : end);
}
const num = (dict, key) => {
  const m = dict.match(new RegExp('/' + key + '\\s+(\\d+)(\\s+0\\s+R)?'));
  if (!m) return null;
  if (!m[2]) return +m[1];
  const ref = objText(m[1]).match(/^\s*(\d+)/);   // /Length 12 0 R 처럼 다른 객체에 적힌 경우
  return ref ? +ref[1] : null;
};
function streamBytes(n) {
  const at = objIndex[n];
  const dict = objText(n);
  let st = s.indexOf('stream', at) + 6;
  if (s[st] === '\r') st++;
  if (s[st] === '\n') st++;
  const len = num(dict, 'Length');
  return len ? buf.subarray(st, st + len) : null;
}
// 사전 안의 << ... >> (중첩 고려)
function subDict(dict, key) {
  const i = dict.indexOf('/' + key);
  if (i < 0) return '';
  let j = dict.indexOf('<<', i);
  const ref = dict.slice(i + key.length + 1, j < 0 ? undefined : j).match(/^\s*(\d+) 0 R/);
  if (ref) return objText(ref[1]);
  if (j < 0) return '';
  let depth = 0, k = j;
  for (; k < dict.length; k++) {
    if (dict.startsWith('<<', k)) { depth++; k++; }
    else if (dict.startsWith('>>', k)) { depth--; k++; if (depth === 0) break; }
  }
  return dict.slice(j, k + 1);
}

// ── 페이지 순서 (Pages 트리를 따라 내려간다)
function pagesOf(n, out = [], inherited = '') {
  const d = objText(n);
  if (/\/Type\s*\/Pages\b/.test(d)) {
    const kids = (d.match(/\/Kids\s*\[([^\]]*)\]/) || [])[1] || '';
    const res = subDict(d, 'Resources') || inherited;
    for (const k of kids.matchAll(/(\d+) 0 R/g)) pagesOf(k[1], out, res);
  } else if (/\/Type\s*\/Page\b/.test(d)) {
    out.push({ obj: n, res: subDict(d, 'Resources') || inherited });
  }
  return out;
}
const root = (s.match(/\/Root\s+(\d+) 0 R/) || [])[1];
const pagesRoot = root && (objText(root).match(/\/Pages\s+(\d+) 0 R/) || [])[1];
if (!pagesRoot) { console.error('⛔ PDF 페이지 구조를 읽지 못했습니다'); process.exit(1); }
const pages = pagesOf(pagesRoot);

// ── 페이지마다 그 페이지가 쓰는 그림(XObject) → JPEG 이고 충분히 크면 저장 (Form 안에 든 그림도 따라간다)
fs.mkdirSync(OUT, { recursive: true });
const saved = [];
const seen = new Set();
let skippedNonJpeg = 0;
function collect(resDict, pageNo, depth = 0) {
  const xo = subDict(resDict, 'XObject');
  for (const m of xo.matchAll(/\/[^\s/]+\s+(\d+) 0 R/g)) {
    const n = m[1];
    const d = objText(n);
    if (/\/Subtype\s*\/Form/.test(d) && depth < 4) { collect(subDict(d, 'Resources'), pageNo, depth + 1); continue; }
    if (!/\/Subtype\s*\/Image/.test(d)) continue;
    const w = num(d, 'Width'), h = num(d, 'Height');
    if (!w || !h || w * h < MIN_PIXELS) continue;
    if (!/DCTDecode/.test(d)) { skippedNonJpeg++; continue; }
    if (seen.has(n)) continue;           // 여러 페이지에 같은 그림이면 처음 페이지에만
    seen.add(n);
    const bytes = streamBytes(n);
    if (!bytes || bytes[0] !== 0xFF || bytes[1] !== 0xD8) continue;
    const file = `p${String(pageNo).padStart(2, '0')}_${n}.jpg`;
    fs.writeFileSync(path.join(OUT, file), bytes);
    saved.push({ page: pageNo, file, w, h, kb: Math.round(bytes.length / 1024) });
  }
}
pages.forEach((p, i) => collect(p.res, i + 1));

// ── 목록 페이지
const byPage = {};
saved.forEach(x => (byPage[x.page] = byPage[x.page] || []).push(x));
const html = `<!doctype html><meta charset="utf-8"><title>${path.basename(PDF)} 사진</title>
<body style="margin:12px;font:13px sans-serif">
<h3 style="margin:0 0 8px">${path.basename(PDF)} — 사진 ${saved.length}장 (페이지 ${pages.length}쪽)</h3>
${Object.entries(byPage).map(([p, list]) => `<div style="display:flex;gap:6px;align-items:flex-start;margin:6px 0;flex-wrap:wrap">
  <b style="width:34px">p${p}</b>${list.map(x => `<figure style="margin:0"><img src="${x.file}" style="height:130px;display:block"><figcaption>${x.file} · ${x.w}×${x.h} · ${x.kb}KB</figcaption></figure>`).join('')}</div>`).join('')}
</body>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);

console.log(`페이지 ${pages.length}쪽 · 사진 ${saved.length}장 → ${OUT}`);
Object.entries(byPage).forEach(([p, list]) => console.log(`  p${p}: ${list.map(x => `${x.file}(${x.w}×${x.h})`).join('  ')}`));
if (skippedNonJpeg) console.log(`  (JPEG 이 아닌 큰 그림 ${skippedNonJpeg}개는 건너뜀 — 필요하면 화면 캡처로)`);
console.log(`\n목록 보기: ${path.join(OUT, 'index.html')}`);
