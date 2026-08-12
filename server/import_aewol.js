'use strict';
// 애월 실제 후기 데이터셋(dataset_aewol.xlsx)을 DB에 등록하는 임포트 스크립트.
// 실행: node import_aewol.js            (이미 임포트돼 있으면 중단)
//       node import_aewol.js --force    (기존 AW_IMPORT 후기 삭제 후 재임포트)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const DATASET = 'C:/Users/pgy/Downloads/띵앤맥_데이터추출_애월 1/띵앤맥_데이터추출_애월/애월 정리/aewol_dataset_light';
const SHEET1 = path.join(DATASET, 'xl_extract', 'sheet1.xml'); // 아래에서 직접 unzip한 위치 대신 파싱된 XML 사용
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SENTINEL = 'AW_IMPORT';
const MAX_PHOTOS = 4;

// ---- xlsx inline-string 시트 파서 ----
function colToNum(c){let n=0;for(const ch of c)n=n*26+(ch.charCodeAt(0)-64);return n-1;}
function decode(s){
  return s
    .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10)))
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
function parseSheet(xml){
  const rows=[];
  const rowRe=/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g; let rm;
  while((rm=rowRe.exec(xml))){
    const cells=[];
    const cRe=/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g; let cm;
    while((cm=cRe.exec(rm[2]))){
      const col=colToNum(cm[1]); const attrs=cm[2]; const inner=cm[3];
      const t=(/t="([^"]*)"/.exec(attrs)||[])[1];
      let val='';
      if(t==='inlineStr'){const im=/<t[^>]*>([\s\S]*?)<\/t>/.exec(inner); val=im?decode(im[1]):'';}
      else {const vm=/<v>([\s\S]*?)<\/v>/.exec(inner); val=vm?decode(vm[1]):'';}
      cells[col]=val;
    }
    rows.push(cells);
  }
  return rows;
}

// ---- 변환 헬퍼 ----
function mapResort(name){
  if(/2\s*호/.test(name)) return '애월 2호점';
  if(/1\s*호/.test(name)) return '애월 1호점';
  return name.replace(/^제주\s*/, '');
}
function ratingsFromScore(scoreStr){
  const score = Math.max(0, Math.min(100, Number(scoreStr)||0));
  const avg = Math.round(score/20*10)/10;               // 5점 만점 소수1자리
  const a = Math.min(5, Math.max(1, avg));
  const f = Math.floor(a);
  const ceils = Math.min(3, Math.round((a - f)*3));
  const vals = { facility:f, clean:f, location:f };
  const order = ['facility','clean','location'];         // 시설·청결을 우선 상향
  for(let i=0;i<ceils;i++) vals[order[i]] = Math.min(5, f+1);
  return { location:vals.location, facility:vals.facility, clean:vals.clean, avg:a };
}
function companionsFrom(text){
  const c=[];
  if(/가족|아이|유아|부모|아기/.test(text)) c.push('가족');
  if(/부부|아내|남편|와이프/.test(text) && !c.includes('가족')) c.push('연인');
  return c;
}
function toISO(postDate){
  // "2026-04-01" → ISO. 날짜만 있으면 09:00 KST로.
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(postDate||'');
  if(!m) return new Date().toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T09:00:00.000Z`;
}
function copyPhoto(fileName){
  // thumbnails 우선, 없으면 images
  const candidates=[path.join(DATASET,'thumbnails',fileName), path.join(DATASET,'images',fileName)];
  const src=candidates.find(p=>fs.existsSync(p));
  if(!src) return null;
  const ext=(path.extname(fileName)||'.jpg').toLowerCase();
  const out=crypto.randomBytes(12).toString('hex')+ext;
  fs.copyFileSync(src, path.join(UPLOADS_DIR, out));
  return '/uploads/'+out;
}

// ---- 메인 ----
function main(){
  const force = process.argv.includes('--force');
  if(!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR,{recursive:true});

  const existing = db.prepare('SELECT COUNT(*) n FROM reviews WHERE empno = ?').get(SENTINEL).n;
  if(existing>0){
    if(!force){ console.error(`이미 ${existing}건의 애월 임포트 후기가 있습니다. 재임포트하려면 --force 로 실행하세요.`); process.exit(1); }
    // 기존 임포트분 사진 파일 제거 후 행 삭제
    const olds = db.prepare(`SELECT p.path FROM review_photos p JOIN reviews r ON r.id=p.review_id WHERE r.empno=?`).all(SENTINEL);
    for(const o of olds){ const f=path.join(__dirname, o.path.replace(/^\//,'')); try{ if(fs.existsSync(f)) fs.unlinkSync(f); }catch{} }
    const ids = db.prepare('SELECT id FROM reviews WHERE empno=?').all(SENTINEL).map(r=>r.id);
    const delP=db.prepare('DELETE FROM review_photos WHERE review_id=?');
    const delR=db.prepare('DELETE FROM reviews WHERE id=?');
    db.exec('BEGIN'); ids.forEach(id=>{delP.run(id);delR.run(id);}); db.exec('COMMIT');
    console.log(`기존 임포트 ${ids.length}건 삭제 후 재임포트합니다.`);
  }

  const xml = fs.readFileSync(process.env.SHEET1_PATH, 'utf8');
  const rows = parseSheet(xml);
  const H = rows[0]; const idx=n=>H.indexOf(n); const g=(r,n)=>r[idx(n)]||'';

  // 게시일 오름차순 정렬 → 최신 글이 마지막에 삽입(=최신 노출)
  const data = rows.slice(1).filter(r=>g(r,'review_id'))
    .sort((a,b)=> (g(a,'post_date')).localeCompare(g(b,'post_date')));

  const insReview = db.prepare(`INSERT INTO reviews
    (empno, author_name, resort_name, resort_type, companions, content,
     rating_location, rating_facility, rating_clean, rating_avg, likes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insPhoto = db.prepare('INSERT INTO review_photos (review_id, path) VALUES (?,?)');

  let nR=0,nP=0;
  db.exec('BEGIN');
  try{
    for(const r of data){
      const resortName = mapResort(g(r,'resort_name'));
      const rt = ratingsFromScore(g(r,'ai_recommend_score'));
      const recFor = g(r,'recommended_for')+'|'+g(r,'tags')+'|'+g(r,'review_type');
      const companions = JSON.stringify(companionsFrom(recFor));
      const parts=[];
      const summary=g(r,'summary_ai'); if(summary) parts.push(summary);
      const pros=g(r,'pros'); if(pros) parts.push('👍 좋았던 점\n'+pros);
      const cons=g(r,'cons'); if(cons) parts.push('⚠️ 아쉬웠던 점\n'+cons);
      const content=parts.join('\n\n');
      const createdAt=toISO(g(r,'post_date'));
      const info=insReview.run(SENTINEL, g(r,'author_name')||'익명', resortName, 'regular',
        companions, content, rt.location, rt.facility, rt.clean, rt.avg, 0, createdAt);
      const reviewId=Number(info.lastInsertRowid); nR++;

      const files=(g(r,'image_files')||'').split('|').map(s=>s.trim()).filter(Boolean).slice(0,MAX_PHOTOS);
      for(const fn of files){ const wp=copyPhoto(fn); if(wp){ insPhoto.run(reviewId, wp); nP++; } }
      console.log(`+ ${resortName} | ${g(r,'author_name')} | ${g(r,'post_date')} | 평점 ${rt.avg} | 사진 ${files.length}`);
    }
    db.exec('COMMIT');
  }catch(e){ db.exec('ROLLBACK'); throw e; }

  console.log(`\n완료: 후기 ${nR}건, 사진 ${nP}장 등록.`);
}
main();
