// 엑셀·PDF로 모은 후기를 reviews.db 에 추가한다. (기존 글은 건드리지 않는다)
//
// 사용:  node import_reviews.js <db경로> <데이터폴더> [--commit]
//        --commit 없이 실행하면 넣는 시늉만 하고 되돌린다. 먼저 이걸로 확인할 것.
//
// 데이터폴더에 있어야 할 파일: meta.json, contents.txt, photomap.json
// 자세한 설명은 DATA_IMPORT.md
//
// 휴양소는 DB resorts 테이블(정식명 · 옛 표기)에서 찾는다. 띄어쓰기는 무시한다 ('경주 휴양소' = '경주휴양소').
// 못 찾으면 멈추고 알려준다 → 아래 RESORT_MAP 에 '엑셀 표기': 'DB 정식명' 을 적거나, DB 에 옛 표기를 추가한다.
// 동행(companions)은 2026-10 부터 앱에 보이지 않는다. meta.json 에 있으면 그대로 저장하고, 없으면 빈 배열. 새로 채우지 않는다.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { cleanCompanyName } = require('./clean_company');

const [, , DB_PATH, SP, ...flags] = process.argv;
const COMMIT = flags.includes('--commit');

// ── 휴양소명: 이름이 많이 달라 자동으로 못 찾는 것만 여기 적는다 (엑셀 표기 → DB 정식명)
const RESORT_MAP = {
  '속초 힐스 휴양소': '속초(힐스)',
  '속초 서희스타힐스 더베이': '속초(서희)',
  '제주 애월 1호점': '애월 1호점',
  '제주 애월 2호점': '애월 2호점',
};

// ── 동행(companions): 앱에 보이지 않으므로 채우지 않는다. (엑셀 recommended_for 는 추천 대상이라 동행으로 쓰면 안 된다)

// ── AI 추천점수(0~100) → 위치/시설/청결 각 1~5점
function toRatings(score) {
  const target = Number(score) / 20;              // 0~5 척도
  let sum = Math.round(target * 3);               // 3항목 합계
  sum = Math.max(3, Math.min(15, sum));
  const base = Math.floor(sum / 3), rem = sum % 3;
  const clamp = (v) => Math.max(1, Math.min(5, v));
  const location = clamp(base + (rem >= 1 ? 1 : 0));
  const facility = clamp(base + (rem >= 2 ? 1 : 0));
  const clean = clamp(base);
  const avg = Math.round(((location + facility + clean) / 3) * 10) / 10;
  return { location, facility, clean, avg };
}

// ── 작성 시각(KST) → ISO8601 UTC
function toUtc(kst) {
  return new Date(kst + '+09:00').toISOString();
}

// ── 본문 파일 파싱
function loadContents(file) {
  const out = {};
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const block of raw.split(/^===/m).slice(1)) {
    const nl = block.indexOf('\n');
    const [id, when, likes] = block.slice(0, nl).split('|');
    out[id.trim()] = { content: block.slice(nl + 1).trimEnd(), when: when.trim(), likes: Number(likes) };
  }
  return out;
}

const meta = JSON.parse(fs.readFileSync(path.join(SP, 'meta.json'), 'utf8'));
const photos = JSON.parse(fs.readFileSync(path.join(SP, 'photomap.json'), 'utf8'));
const contents = loadContents(path.join(SP, 'contents.txt'));

const db = new DatabaseSync(DB_PATH);

// ── DB 휴양소: 정식명 · 옛 표기 → { name, type }  (띄어쓰기를 지운 이름으로도 찾는다)
const hasResorts = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'resorts'").get();
if (!hasResorts) throw new Error('DB 에 resorts 테이블이 없습니다. 새 코드로 서버를 한 번 켠 뒤 다시 실행하세요.');
const resortByName = {};
const norm = s => String(s || '').replace(/\s+/g, '');
const putResort = (key, r) => { resortByName[key] = r; resortByName[norm(key)] = resortByName[norm(key)] || r; };
db.prepare('SELECT id, name, type FROM resorts').all().forEach(r => putResort(r.name, r));
db.prepare('SELECT a.alias, r.id, r.name, r.type FROM resort_aliases a JOIN resorts r ON r.id = a.resort_id').all()
  .forEach(a => putResort(a.alias, { id: a.id, name: a.name, type: a.type }));
function findResort(excelName) {
  const key = RESORT_MAP[excelName] || excelName;
  return resortByName[key] || resortByName[norm(key)] || null;
}
const existing = db.prepare('SELECT COUNT(*) c FROM reviews').get().c;
const dup = db.prepare('SELECT id FROM reviews WHERE author_name = ? AND created_at = ?');
const insReview = db.prepare(`INSERT INTO reviews
  (empno, author_name, resort_name, resort_type, companions, content,
   rating_location, rating_facility, rating_clean, rating_avg, likes, created_at, department, company)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insPhoto = db.prepare('INSERT INTO review_photos (review_id, path) VALUES (?,?)');

db.exec('BEGIN');
let added = 0, skipped = 0, photoCount = 0;
const report = [];
for (const rec of meta) {
  const c = contents[rec.review_id];
  if (!c) { console.log('본문 없음, 건너뜀:', rec.review_id); skipped++; continue; }
  // xlsx_to_meta.js 가 만든 틀을 채우지 않은 채 넣지 않게 막는다
  if (/^\(본문 —/.test(c.content) || /YYYY/.test(c.when)) {
    throw new Error(`${rec.review_id}: contents.txt 의 본문 · 작성일시를 아직 채우지 않았습니다 (원본 PDF 에서 옮기세요)`);
  }

  const resortRow = findResort(rec.resort_name);
  if (!resortRow) {
    throw new Error(`휴양소를 찾을 수 없음: '${rec.resort_name}' — RESORT_MAP 에 추가하세요. DB 휴양소: ` +
      [...new Set(Object.values(resortByName).map(r => r.name))].join(', '));
  }
  const resort = resortRow.name;

  const createdAt = toUtc(c.when);
  if (dup.get(rec.author_name, createdAt)) { console.log('이미 있음, 건너뜀:', rec.review_id); skipped++; continue; }

  const comp = Array.isArray(rec.companions) ? rec.companions : [];
  const r = toRatings(rec.ai_recommend_score);
  const info = insReview.run(null, rec.author_name, resort, resortRow.type, JSON.stringify(comp),
    c.content, r.location, r.facility, r.clean, r.avg, c.likes, createdAt,
    rec.department || null, cleanCompanyName(rec.company) || null);   // 법인 표기는 떼고 넣는다

  const rid = Number(info.lastInsertRowid);
  for (const p of (photos[rec.review_id] || [])) { insPhoto.run(rid, p); photoCount++; }
  added++;
  report.push([rec.review_id, rid, resort, rec.author_name, rec.ai_recommend_score,
    `${r.location}/${r.facility}/${r.clean}`, r.avg, comp.join(',') || '-',
    (photos[rec.review_id] || []).length, c.content.length, createdAt]);
}

console.log('');
const cols = [['엑셀ID', 18], ['DB', 3], ['휴양소', 17], ['작성자', 7], ['점수', 5],
              ['평점', 7], ['평균', 5], ['동행', 5], ['사진', 4], ['본문', 5], ['작성일시(UTC)', 24]];
const line = (vals) => vals.map((v, i) => String(v).padEnd(cols[i][1])).join(' ');
console.log(line(cols.map(c => c[0])));
for (const row of report) console.log(line(row));
console.log('');
console.log('기존 리뷰 %d건 → 추가 %d건 (건너뜀 %d), 사진 %d장', existing, added, skipped, photoCount);

if (COMMIT) { db.exec('COMMIT'); console.log('>>> 커밋 완료'); }
else { db.exec('ROLLBACK'); console.log('>>> 시험 실행(rollback). 실제 반영하려면 --commit'); }
db.close();
