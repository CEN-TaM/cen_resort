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
// 다른 서버에도 한 부 (서버가 통째로 고장 나도 남게)
//   ~/.cen_resort_backup.json 이 있으면, 그날 백업 폴더를 그 서버로 scp 로 복사하고 오래된 것을 지운다.
//   { "remote": "devadm01@192.168.64.58", "port": 7722, "key": "~/.ssh/cen_resort_backup", "dir": "backups_from_dev", "keepDays": 30 }
//   (키는 비밀번호 없는 전용 키. 파일이 없으면 이 단계는 건너뛴다 — 저장소에는 넣지 않는다)
//   받는 쪽에서 복구할 때는 아래 '복구' 의 ~/backups/ 대신 받는 서버의 ~/backups_from_dev/ 에서 가져온다
//
// 복구
//   pm2 stop cen-resort
//   cp ~/backups/2026-08-24/reviews.db  ~/cen_resort/server/data/reviews.db
//   rm -f ~/cen_resort/server/data/reviews.db-wal ~/cen_resort/server/data/reviews.db-shm
//   cp -r ~/backups/2026-08-24/uploads/. ~/cen_resort/server/uploads/
//   pm2 start cen-resort

const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
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
  let linked = 0, copied = 0;
  // 하위 폴더(resorts/ 휴양소 사진 · notices/ 공지 첨부)까지 따라 들어간다.
  // (예전엔 uploads/ 바로 아래 파일만 남겨서 휴양소 대표 사진이 백업에서 빠졌다)
  const walk = (srcDir, dstDir) => {
    fs.mkdirSync(dstDir, { recursive: true });
    for (const name of fs.readdirSync(srcDir)) {
      const src = path.join(srcDir, name);
      const dst = path.join(dstDir, name);
      const st = fs.statSync(src);
      if (st.isDirectory()) { walk(src, dst); continue; }
      if (!st.isFile() || fs.existsSync(dst)) continue;
      try { fs.linkSync(src, dst); linked++; }
      catch { fs.copyFileSync(src, dst); copied++; }   // 파일시스템이 다르면 복사로 대체
    }
  };
  walk(UPLOADS_DIR, dest);
  log(`사진 · 첨부 ${linked + copied}개 (하드링크 ${linked} / 복사 ${copied})`);
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

// 다른 서버로 한 부 — 실패해도 이 서버 백업은 이미 끝났으니 오류만 남긴다 (pm2 logs 에서 보임)
const REMOTE_CONF = path.join(os.homedir(), '.cen_resort_backup.json');
function copyRemote(destDir) {
  if (!fs.existsSync(REMOTE_CONF)) { log('다른 서버 복사 — 설정 없음, 건너뜀'); return null; }
  const c = JSON.parse(fs.readFileSync(REMOTE_CONF, 'utf8'));
  const dir = String(c.dir || 'backups_from_dev').replace(/[^\w.-]/g, '');
  const keep = Number(c.keepDays || 30);
  const port = String(c.port || 22);
  const ssh = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-i', String(c.key || '').replace(/^~(?=\/)/, os.homedir())];
  const run = (cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30 * 60_000 });
    if (r.status !== 0) throw new Error(`${cmd} 실패 (${r.status}): ${String(r.stderr || r.error || '').trim().split('\n').pop()}`);
  };
  const name = path.basename(destDir);
  // 같은 날 두 번 돌면 덮어쓴다 (먼저 지우고 복사)
  run('ssh', [...ssh, '-p', port, c.remote, `mkdir -p ~/${dir} && rm -rf ~/${dir}/${name}`]);
  run('scp', [...ssh, '-P', port, '-r', '-q', destDir, `${c.remote}:${dir}/`]);
  // 받는 쪽 정리 — 날짜 이름 폴더만, keepDays 보다 오래된 것
  run('ssh', [...ssh, '-p', port, c.remote,
    `find ~/${dir} -mindepth 1 -maxdepth 1 -type d -name '20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]' -mtime +${keep} -exec rm -rf {} +`]);
  log(`다른 서버 복사 완료 → ${c.remote}:~/${dir}/${name} (보관 ${keep}일)`);
  return c.remote;
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
  let remote = null;
  try { remote = copyRemote(destDir); } catch (err) { console.error('[backup] 다른 서버 복사 실패:', err.message); process.exitCode = 1; }
  if (remote) {
    const mf = path.join(destDir, 'manifest.json');
    fs.writeFileSync(mf, JSON.stringify({ ...JSON.parse(fs.readFileSync(mf, 'utf8')), copiedTo: remote }, null, 2));
  }
  const kept = fs.existsSync(BACKUP_ROOT)
    ? fs.readdirSync(BACKUP_ROOT).filter((n) => DATE_RE.test(n)).sort()
    : [];
  log(`완료 — 보관 중인 백업 ${kept.length}개 (${kept[0] || '-'} ~ ${kept[kept.length - 1] || '-'})`);
}

try { main(); }
catch (err) { console.error('[backup] 실패:', err); process.exit(1); }