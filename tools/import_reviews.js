// 엑셀·PDF로 모은 후기를 reviews.db 에 추가한다. (기존 글은 건드리지 않는다)
//
// 사용:  node import_reviews.js <db경로> <데이터폴더> [--commit]
//        --commit 없이 실행하면 넣는 시늉만 하고 되돌린다. 먼저 이걸로 확인할 것.
//
// 데이터폴더에 있어야 할 파일: meta.json, contents.txt, photomap.json
// 자세한 설명은 DATA_IMPORT.md
//
// 새 데이터를 넣을 때는 아래 RESORT_MAP 과 COMPANIONS 를 그 데이터에 맞게 고친다.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const [, , DB_PATH, SP, ...flags] = process.argv;
const COMMIT = flags.includes('--commit');

// ── 휴양소명: 엑셀 표기 → 앱의 REVIEW_RESORTS 표기
const RESORT_MAP = {
  '속초 힐스 휴양소': '속초(힐스) 휴양소',
  '속초 서희스타힐스 더베이': '속초(서희) 휴양소',
};

// ── 동행: 본문에 실제로 드러난 경우만 채운다.
//    엑셀의 recommended_for 는 "누구에게 추천하는 여행인가"(추천 대상)라서
//    작성자가 누구와 갔는지와는 다른 축이다. 그대로 쓰면 가족+연인처럼 모순된 값이 된다.
const COMPANIONS = {
  'RV-GW-SC-000509': ['가족'],   // "가족들과 함께 속초 여행"
  'RV-GW-SC-000556': ['가족'],   // "저희 가족은 황태해장국이랑..."
  'RV-GW-SC-000557': ['가족'],   // "이번 이용은 아이들에게 좋은 경험"
  'RV-GW-SC-000567': ['가족'],   // "회사 휴양소로 가족이 행복하게 쉬었다"
  'RV-GW-SC-000579': ['가족'],   // "중딩뿐아니라 대딩도 잘 보았네요"
  'RV-GW-SC-000586': ['가족'],   // "부모님이 좋아하셔서", "아빠랑 둘이서"
};

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

  const resort = RESORT_MAP[rec.resort_name];
  if (!resort) throw new Error('휴양소명 매핑 없음: ' + rec.resort_name);

  const createdAt = toUtc(c.when);
  if (dup.get(rec.author_name, createdAt)) { console.log('이미 있음, 건너뜀:', rec.review_id); skipped++; continue; }

  const comp = COMPANIONS[rec.review_id] || [];
  const r = toRatings(rec.ai_recommend_score);
  const info = insReview.run(null, rec.author_name, resort, 'regular', JSON.stringify(comp),
    c.content, r.location, r.facility, r.clean, r.avg, c.likes, createdAt,
    rec.department || null, rec.company || null);

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
