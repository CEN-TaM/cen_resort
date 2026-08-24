'use strict';
// 후기 DB·사진 자동 백업
//
// 왜 필요한가: server/data(SQLite)와 server/uploads(사진)는 .gitignore 대상이라
// git 에 백업이 없다. 서버 한 곳에만 존재하므로 유실되면 복구할 수 없다.
//
// 실행
//   수동:   node backup.js
//   자동:   pm2 start backup.js --name cen-resort-backup --cron "0 3 * * *" --no-autorestart
//           pm2 save
//   (devadm01 은 crontab 이 금지돼 있어 pm2 의 cron 기능을 쓴다)
//
// 결과물   ~/backups/YYYY-MM-DD/{reviews.db, uploads/, manifest.json}
//
// 복구
//   pm2 stop cen-resort
//   cp ~/backups/2026-08-24/reviews.db  ~/cen_resort/server/data/reviews.db
//   rm -f ~/cen_resort/server/data/reviews.db-wal ~/cen_resort/server/data/reviews.db-shm
//   cp -r ~/backups/2026-08-24/uploads/. ~/cen_resort/server/uploads/
//   pm2 start cen-resort

const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const SERVER_DIR = __dirname;
const DB_FILE = path.join(SERVER_DIR, 'data', 'reviews.db');
const UPLOADS_DIR = path.join(SERVER_DIR, 'uploads');
const BACKUP_ROOT = process.env.BACKUP_DIR || path.join(os.homedir(), 'backups');
const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS || 14);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const log = (m) => console.log(`[backup] ${m}`);

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// WAL 모드에서는 .db 파일만 복사하면 최근 쓰기가 누락될 수 있다.
// VACUUM INTO 는 SQLite 가 일관된 스냅샷을 새 파일로 떠 주므로 안전하다.
function backupDatabase(destDir) {
  if (!fs.existsSync(DB_FILE)) { log('DB 없음 — 건너뜀'); return null; }
  const dest = path.join(destDir, 'reviews.db');
  fs.rmSync(dest, { force: true });          // VACUUM INTO 는 대상이 있으면 실패
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    const snap = new DatabaseSync(dest, { readOnly: true });
    const rows = snap.prepare('SELECT COUNT(*) c FROM reviews').get().c;
    snap.close();
    log(`DB 스냅샷 ${rows}건 (${fs.statSync(dest).size} bytes)`);
    return rows;
  } finally { db.close(); }
}

// 사진은 업로드 후 변경되지 않으므로 하드링크로 남긴다.
// 디스크를 거의 쓰지 않으면서, 원본이 지워져도 백업본은 남는다. (rsync --link-dest 와 같은 방식)
function backupUploads(destDir) {
  if (!fs.existsSync(UPLOADS_DIR)) { log('uploads 없음 — 건너뜀'); return 0; }
  const dest = path.join(destDir, 'uploads');
  fs.mkdirSync(dest, { recursive: true });
  let linked = 0, copied = 0;
  for (const name of fs.readdirSync(UPLOADS_DIR)) {
    const src = path.join(UPLOADS_DIR, name);
    if (!fs.statSync(src).isFile()) continue;
    const dst = path.join(dest, name);
    if (fs.existsSync(dst)) continue;
    try { fs.linkSync(src, dst); linked++; }
    catch { fs.copyFileSync(src, dst); copied++; }   // 파일시스템이 다르면 복사로 대체
  }
  log(`사진 ${linked + copied}개 (하드링크 ${linked} / 복사 ${copied})`);
  return linked + copied;
}

function prune() {
  if (!fs.existsSync(BACKUP_ROOT)) return;
  const cutoff = Date.now() - KEEP_DAYS * 86400_000;
  for (const name of fs.readdirSync(BACKUP_ROOT)) {
    if (!DATE_RE.test(name)) continue;              // 날짜 형식 디렉터리만 대상
    const dir = path.join(BACKUP_ROOT, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (new Date(name + 'T00:00:00').getTime() >= cutoff) continue;
    fs.rmSync(dir, { recursive: true, force: true });
    log(`오래된 백업 삭제: ${name}`);
  }
}

function main() {
  const destDir = path.join(BACKUP_ROOT, today());
  fs.mkdirSync(destDir, { recursive: true });
  log(`시작 → ${destDir}`);

  const rows = backupDatabase(destDir);
  const photos = backupUploads(destDir);

  fs.writeFileSync(
    path.join(destDir, 'manifest.json'),
    JSON.stringify({ createdAt: new Date().toISOString(), reviews: rows, photos, keepDays: KEEP_DAYS }, null, 2)
  );

  prune();
  const kept = fs.existsSync(BACKUP_ROOT)
    ? fs.readdirSync(BACKUP_ROOT).filter((n) => DATE_RE.test(n)).sort()
    : [];
  log(`완료 — 보관 중인 백업 ${kept.length}개 (${kept[0] || '-'} ~ ${kept[kept.length - 1] || '-'})`);
}

try { main(); }
catch (err) { console.error('[backup] 실패:', err); process.exit(1); }