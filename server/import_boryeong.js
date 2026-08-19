'use strict';
// 보령 실제 후기(보령_PDF_게시물_데이터셋.xlsx '보령 게시물' 시트, 10건)를 DB에 등록.
// 특이점: XML이 x: 네임스페이스 접두사 사용, 작성일시가 엑셀 시리얼 숫자.
// 원본에 평점 없어 4.4~4.9 범위로 게시물번호 기반 결정적 부여(임의값).
//
// 실행: BR_SHEET=/path/to/sheet1.xml BR_IMAGES=/path/to/images node import_boryeong.js [--force]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const SHEET = process.env.BR_SHEET;
const IMAGES = process.env.BR_IMAGES;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SENTINEL = 'BR_IMPORT';
const MAX_PHOTOS = 4;

// ---- xlsx 파서 (x: 접두사 유무 모두 대응, inline string) ----
function colToNum(c){let n=0;for(const ch of c)n=n*26+(ch.charCodeAt(0)-64);return n-1;}
function decode(s){
  return s
    .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
function parseSheet(xml){
  const rows=[];
  const rowRe=/<(?:x:)?row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/g; let rm;
  while((rm=rowRe.exec(xml))){
    const cells=[];
    const cRe=/<(?:x:)?c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g; let cm;
    while((cm=cRe.exec(rm[2]))){
      const col=colToNum(cm[1]); const inner=cm[3]||'';
      const im=/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/.exec(inner);
      const vm=/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(inner);
      cells[col] = im ? decode(im[1]) : (vm ? decode(vm[1]) : '');
    }
    rows.push(cells);
  }
  return rows;
}

// ---- 변환 헬퍼 ----
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
function ratingsFromId(id){
  const seed = parseInt(String(id).replace(/\D/g,''),10) || 0;
  return ratingsFromScore(88 + (seed % 11)); // 4.4~4.9
}
function companionsFrom(text){
  const c=[];
  if(/가족|아이|유아|부모|아기|딸|아들/.test(text)) c.push('가족');
  else if(/부부|아내|남편|와이프|신혼|연인/.test(text)) c.push('연인');
  else if(/친구/.test(text)) c.push('친구');
  return c;
}
function toISO(v){
  const n = parseFloat(v);
  if(isFinite(n) && n > 20000 && n < 90000){ // 엑셀 시리얼 날짜
    return new Date(Date.UTC(1899,11,30) + Math.round(n*86400)*1000).toISOString();
  }
  const m=/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(v).trim());
  if(m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]||'09'}:${m[5]||'00'}:00+09:00`).toISOString();
  return new Date().toISOString();
}
function copyPhoto(fileName){
  const src=path.join(IMAGES, fileName);
  if(!fs.existsSync(src)) return null;
  const ext=(path.extname(fileName)||'.jpg').toLowerCase();
  const out=crypto.randomBytes(12).toString('hex')+ext;
  fs.copyFileSync(src, path.join(UPLOADS_DIR, out));
  return '/uploads/'+out;
}

function main(){
  if(!SHEET || !IMAGES){ console.error('환경변수 BR_SHEET, BR_IMAGES 필요'); process.exit(1); }
  if(!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR,{recursive:true});

  const existing = db.prepare('SELECT COUNT(*) n FROM reviews WHERE empno=?').get(SENTINEL).n;
  if(existing>0){
    if(!process.argv.includes('--force')){ console.error(`이미 ${existing}건의 보령 임포트가 있습니다. 재임포트는 --force.`); process.exit(1); }
    const olds = db.prepare('SELECT p.path FROM review_photos p JOIN reviews r ON r.id=p.review_id WHERE r.empno=?').all(SENTINEL);
    for(const o of olds){ const f=path.join(__dirname, o.path.replace(/^\//,'')); try{ if(fs.existsSync(f)) fs.unlinkSync(f); }catch{} }
    const ids = db.prepare('SELECT id FROM reviews WHERE empno=?').all(SENTINEL).map(r=>r.id);
    const delP=db.prepare('DELETE FROM review_photos WHERE review_id=?');
    const delR=db.prepare('DELETE FROM reviews WHERE id=?');
    db.exec('BEGIN'); ids.forEach(id=>{delP.run(id);delR.run(id);}); db.exec('COMMIT');
    console.log(`기존 보령 임포트 ${ids.length}건 삭제 후 재임포트.`);
  }

  const rows = parseSheet(fs.readFileSync(SHEET,'utf8'));
  const H = rows[0]; const idx=n=>H.indexOf(n); const g=(r,n)=>r[idx(n)]||'';
  const data = rows.slice(1).filter(r=>g(r,'게시물번호'))
    .sort((a,b)=> (parseFloat(g(a,'작성일시'))||0) - (parseFloat(g(b,'작성일시'))||0));

  const insReview = db.prepare(`INSERT INTO reviews
    (empno, author_name, department, company, resort_name, resort_type, companions, content,
     rating_location, rating_facility, rating_clean, rating_avg, likes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insPhoto = db.prepare('INSERT INTO review_photos (review_id, path) VALUES (?,?)');

  let nR=0,nP=0;
  db.exec('BEGIN');
  try{
    for(const r of data){
      const id = g(r,'게시물번호');
      const rt = ratingsFromId(id);
      const author = `${g(r,'작성자')} ${g(r,'직급')}`.trim() || '익명';
      const content = g(r,'본문');
      const companions = JSON.stringify(companionsFrom(g(r,'제목')+' '+content));
      const createdAt = toISO(g(r,'작성일시'));
      const likes = parseInt(g(r,'추천수'),10) || 0;

      const info=insReview.run(SENTINEL, author, g(r,'부서'), g(r,'회사'), '보령 휴양소', 'regular',
        companions, content, rt.location, rt.facility, rt.clean, rt.avg, likes, createdAt);
      const reviewId=Number(info.lastInsertRowid); nR++;

      const files=(g(r,'이미지파일목록')||'').split(/[,;|]\s*/).map(s=>s.trim()).filter(Boolean).slice(0,MAX_PHOTOS);
      let saved=0;
      for(const fn of files){ const wp=copyPhoto(fn); if(wp){ insPhoto.run(reviewId, wp); nP++; saved++; } }
      console.log(`+ 보령 휴양소 | ${author} | ${createdAt.slice(0,10)} | 평점 ${rt.avg} | 사진 ${saved}`);
    }
    db.exec('COMMIT');
  }catch(e){ db.exec('ROLLBACK'); throw e; }

  console.log(`\n완료: 보령 후기 ${nR}건, 사진 ${nP}장 등록.`);
}
main();
