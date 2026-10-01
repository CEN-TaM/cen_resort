'use strict';
// 제주 조천 휴양소 실제 후기(sample.json, 13건)를 DB에 등록.
// 실행:  JC_BASE=/path/to/Resort_Dataset_Test_Jeju_Jocheon node import_jocheon.js [--force]
//   JC_BASE = sample.json / images / raw_text 가 있는 데이터셋 루트
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const BASE = process.env.JC_BASE;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SENTINEL = 'JC_IMPORT';
const MAX_PHOTOS = 4;

function ratingsFromScore(score){
  const s = Math.max(0, Math.min(100, Number(score)||0));
  const avg = Math.round(s/20*10)/10;
  const a = Math.min(5, Math.max(1, avg));
  const f = Math.floor(a);
  const ceils = Math.min(3, Math.round((a - f)*3));
  const vals = { facility:f, clean:f, location:f };
  const order = ['facility','clean','location'];
  for(let i=0;i<ceils;i++) vals[order[i]] = Math.min(5, f+1);
  return { location:vals.location, facility:vals.facility, clean:vals.clean, avg:a };
}
function companionsFrom(text){
  const c=[];
  if(/가족|아이|유아|부모|아기|딸|아들/.test(text)) c.push('가족');
  else if(/부부|아내|남편|와이프|신혼|연인/.test(text)) c.push('연인');
  else if(/친구/.test(text)) c.push('친구');
  return c;
}
function toISO(postDate){
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec((postDate||'').trim());
  if(!m) return new Date().toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T09:00:00.000Z`;
}
// 원문에서 직급 추출 (인라인/개행 모두 대응): "게시자 우문식 이사 / 부서- 회사"
function positionFromRaw(rawFile){
  try{
    const txt = fs.readFileSync(path.join(BASE, rawFile), 'utf8');
    const m = /게시자\s+(\S+)\s+([^\s/]+)\s*\//.exec(txt);
    return m ? m[2] : '';
  }catch(e){ return ''; }
}
function copyPhoto(fileName){
  const src = path.join(BASE, 'images', fileName);
  if(!fs.existsSync(src)) return null;
  const ext = (path.extname(fileName)||'.jpg').toLowerCase();
  const out = crypto.randomBytes(12).toString('hex')+ext;
  fs.copyFileSync(src, path.join(UPLOADS_DIR, out));
  return '/uploads/'+out;
}

function main(){
  if(!BASE){ console.error('환경변수 JC_BASE 필요 (데이터셋 루트)'); process.exit(1); }
  if(!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR,{recursive:true});

  const existing = db.prepare('SELECT COUNT(*) n FROM reviews WHERE empno=?').get(SENTINEL).n;
  if(existing>0){
    if(!process.argv.includes('--force')){ console.error(`이미 ${existing}건의 조천 임포트가 있습니다. 재임포트는 --force.`); process.exit(1); }
    const olds = db.prepare('SELECT p.path FROM review_photos p JOIN reviews r ON r.id=p.review_id WHERE r.empno=?').all(SENTINEL);
    for(const o of olds){ const f=path.join(__dirname, o.path.replace(/^\//,'')); try{ if(fs.existsSync(f)) fs.unlinkSync(f); }catch{} }
    const ids = db.prepare('SELECT id FROM reviews WHERE empno=?').all(SENTINEL).map(r=>r.id);
    const delP=db.prepare('DELETE FROM review_photos WHERE review_id=?');
    const delR=db.prepare('DELETE FROM reviews WHERE id=?');
    db.exec('BEGIN'); ids.forEach(id=>{delP.run(id);delR.run(id);}); db.exec('COMMIT');
    console.log(`기존 조천 임포트 ${ids.length}건 삭제 후 재임포트.`);
  }

  const records = JSON.parse(fs.readFileSync(path.join(BASE,'sample.json'),'utf8'));
  const data = records.filter(r=>r.review_id)
    .sort((a,b)=> String(a.post_date).localeCompare(String(b.post_date)));

  const insReview = db.prepare(`INSERT INTO reviews
    (empno, author_name, department, company, resort_name, resort_type, companions, content,
     rating_location, rating_facility, rating_clean, rating_avg, likes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insPhoto = db.prepare('INSERT INTO review_photos (review_id, path) VALUES (?,?)');

  let nR=0,nP=0;
  db.exec('BEGIN');
  try{
    for(const r of data){
      const rt = ratingsFromScore(r.ai_recommend_score);
      const pos = positionFromRaw(r.raw_text_file || '');
      const author = ((r.author_name||'익명') + (pos ? ' '+pos : '')).trim();
      const parts=[];
      if(r.summary_ai) parts.push(r.summary_ai);
      if(r.pros) parts.push('👍 좋았던 점\n'+r.pros);
      if(r.cons) parts.push('⚠️ 아쉬웠던 점\n'+r.cons);
      const content = parts.join('\n\n');
      const companions = JSON.stringify(companionsFrom([r.recommended_for,r.tags,r.review_type].join('|')));
      const createdAt = toISO(r.post_date);

      const info=insReview.run(SENTINEL, author, r.department||null, r.company||null,
        '조천 휴양소', 'regular', companions, content,
        rt.location, rt.facility, rt.clean, rt.avg, 0, createdAt);
      const reviewId=Number(info.lastInsertRowid); nR++;

      const files=String(r.image_files||'').split('|').map(s=>s.trim()).filter(Boolean).slice(0,MAX_PHOTOS);
      let saved=0;
      for(const fn of files){ const wp=copyPhoto(fn); if(wp){ insPhoto.run(reviewId, wp); nP++; saved++; } }
      console.log(`+ 조천 휴양소 | ${author} | ${r.post_date} | 평점 ${rt.avg} | 사진 ${saved}`);
    }
    db.exec('COMMIT');
  }catch(e){ db.exec('ROLLBACK'); throw e; }

  console.log(`\n완료: 조천 후기 ${nR}건, 사진 ${nP}장 등록.`);
}
main();
