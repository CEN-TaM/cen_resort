// 후기 사진을 서버 규칙 이름(무작위 24자리.jpg)으로 복사하고 photomap.json 을 만든다. (Python 없이)
//
// 사용:  node tools/prepare_photos.js <사진폴더> <meta.json> <출력폴더>
//
// 결과:  출력폴더에 복사된 jpg + photomap.json(후기ID ↔ /uploads/파일명)
//
// 크기는 줄이지 않는다. PDF 에서 뽑은 사진은 보통 700px · 100KB 안팎이라 그대로 써도 된다.
// 1MB 가 넘는 사진(폰 원본 등)이 있으면 경고를 낸다 — 그때는 tools/resize_photos.py 로 줄인다.
// .jpg/.jpeg 만 받는다 (서버 사진 목록이 jpg 기준). PNG 등은 resize_photos.py 가 jpg 로 바꿔 준다.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , SRC, META, OUT] = process.argv;
if (!SRC || !META || !OUT) {
  console.log('사용: node tools/prepare_photos.js <사진폴더> <meta.json> <출력폴더>');
  process.exit(1);
}
const BIG = 1024 * 1024;

fs.mkdirSync(OUT, { recursive: true });
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const mapping = {};
const missing = [], big = [], notJpg = [];
let total = 0, count = 0;

for (const rec of meta) {
  const paths = [];
  for (const rel of rec.image_files || []) {
    const src = path.join(SRC, rel);
    if (!fs.existsSync(src)) { missing.push(rel); continue; }
    if (!/\.jpe?g$/i.test(src)) { notJpg.push(rel); continue; }
    const size = fs.statSync(src).size;
    if (size > BIG) big.push(`${rel} (${(size / BIG).toFixed(1)}MB)`);
    const name = crypto.randomBytes(12).toString('hex') + '.jpg';   // 서버 업로드와 같은 규칙
    fs.copyFileSync(src, path.join(OUT, name));
    paths.push('/uploads/' + name);
    total += size; count++;
  }
  mapping[rec.review_id] = paths;
  if (rec.image_count !== undefined && paths.length !== Number(rec.image_count)) {
    console.log(`  [경고] ${rec.review_id}: 엑셀 ${rec.image_count}장 / 실제 ${paths.length}장`);
  }
}

fs.writeFileSync(path.join(OUT, 'photomap.json'), JSON.stringify(mapping, null, 1));
console.log(`복사: ${count}장, 합계 ${(total / 1024).toFixed(0)}KB${count ? `, 평균 ${(total / count / 1024).toFixed(0)}KB` : ''}`);
if (missing.length) console.log('⛔ 원본을 못 찾은 파일:', missing);
if (notJpg.length) console.log('⛔ jpg 가 아니라 건너뜀 (resize_photos.py 로 변환):', notJpg);
if (big.length) console.log('⚠️ 1MB 넘는 사진 — resize_photos.py 로 줄이는 걸 권장:', big);
