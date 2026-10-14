// 후기 엑셀(띵앤맥 데이터셋) → meta.json + contents.txt 틀   (Python · 라이브러리 없이 Node 만으로)
//
// 사용:  node tools/xlsx_to_meta.js <엑셀.xlsx> <출력폴더>
//
// 결과 (출력폴더에)
//   meta.json      tools/import_reviews.js 가 읽는 후기 목록. 엑셀 첫 시트의 review_id · author_name · department ·
//                  company · resort_name · ai_recommend_score · image_count · image_files 를 옮긴다
//   contents.txt   본문 틀. 후기마다  ===후기ID|작성일시|0  줄만 만들어 둔다 → 본문은 원본 PDF 에서 채운다
//
// 사람이(또는 Claude 가) 채워야 하는 것 — DATA_IMPORT.md '순서' 참고
//   - author_name 에 직급 붙이기 ('홍길동' → '홍길동 수석', PDF 게시자 줄)
//   - companions: 본문에 드러난 동행만 (엑셀 recommended_for 는 쓰지 않는다)
//   - contents.txt 의 작성일시(PDF 제목 옆 '2026-08-31 17:02' → 2026-08-31T17:02:00)와 본문

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [, , XLSX, OUT] = process.argv;
if (!XLSX || !OUT || !fs.existsSync(XLSX)) {
  console.log('사용: node tools/xlsx_to_meta.js <엑셀.xlsx> <출력폴더>');
  process.exit(1);
}

// ── xlsx = zip. 필요한 파일만 꺼낸다
function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('엑셀(zip) 파일이 아닙니다');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ds = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(ds, ds + csize);
    files[name] = method === 8 ? zlib.inflateRawSync(data) : data;
    p += 46 + nlen + xlen + clen;
  }
  return files;
}

const dec = s => String(s)
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function firstSheetRows(files) {
  const ss = files['xl/sharedStrings.xml']
    ? [...files['xl/sharedStrings.xml'].toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''))
    : [];
  const sheet = files['xl/worksheets/sheet1.xml'];
  if (!sheet) throw new Error('첫 번째 시트를 찾을 수 없습니다');
  return [...sheet.toString('utf8').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r => Object.fromEntries(
    [...r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => {
      const t = (c[2].match(/t="(\w+)"/) || [])[1];
      const inner = c[3] || '';
      let v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
      if (t === 's') v = ss[+v];
      if (t === 'inlineStr') v = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('');
      return [c[1], dec(v || '').trim()];
    })));
}

const rows = firstSheetRows(unzip(fs.readFileSync(XLSX)));
// 머리글: 'review_id (후기 ID)' 처럼 영문 이름 + 한글 설명 → 영문 이름만
const head = Object.fromEntries(Object.entries(rows[0] || {}).map(([col, h]) => [col, h.split(/\s/)[0]]));
const records = rows.slice(1).map(r => Object.fromEntries(Object.entries(r).map(([col, v]) => [head[col] || col, v])))
  .filter(r => r.review_id);
if (!records.length) throw new Error('후기 행이 없습니다 (첫 시트 · 첫 줄 머리글에 review_id 가 있어야 합니다)');

const meta = records.map(r => ({
  review_id: r.review_id,
  resort_name: r.resort_name,
  author_name: r.author_name,          // ← PDF 게시자 줄의 직급을 붙인다
  department: r.department || '',
  company: r.company || '',
  ai_recommend_score: r.ai_recommend_score,
  companions: [],                      // ← 본문에 드러난 동행만
  image_count: r.image_count || '0',
  image_files: (r.image_files || '').split('|').map(s => s.trim()).filter(Boolean),
  source_pdf: r.source_pdf || '',
  post_date: r.post_date || '',
}));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
const contents = meta.map(m => `===${m.review_id}|${m.post_date ? m.post_date + 'T00:00:00' : 'YYYY-MM-DDTHH:MM:00'}|0\n(본문 — ${m.source_pdf || '원본 PDF'} 에서 옮기고, 작성일시도 PDF 제목 옆 시각으로 고친다)\n`).join('');
const cPath = path.join(OUT, 'contents.txt');
if (fs.existsSync(cPath)) console.log('contents.txt 가 이미 있어 새로 만들지 않았습니다 (덮어쓰지 않음)');
else fs.writeFileSync(cPath, contents);

console.log(`후기 ${meta.length}건 → ${path.join(OUT, 'meta.json')}`);
meta.forEach(m => console.log(`  ${m.review_id}  ${m.resort_name}  ${m.author_name}  점수 ${m.ai_recommend_score}  사진 ${m.image_files.length}장  ${m.source_pdf}`));
console.log('\n다음: ① author_name 에 직급 ② companions ③ contents.txt 본문 · 작성일시 — 모두 원본 PDF 를 보고 채운다');
