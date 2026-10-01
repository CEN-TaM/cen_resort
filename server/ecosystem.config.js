// pm2 프로세스 설정 — 서버에서 'cen-resort' 앱을 단 1개 인스턴스로만 관리한다.
// 공용 계정에서 여러 명이 각자 node를 띄워 포트가 충돌하는 것을 방지.
module.exports = {
  apps: [
    {
      name: 'cen-resort',
      script: 'index.js',
      cwd: __dirname,          // server/ 디렉터리
      instances: 1,            // 반드시 1개만 (8999 단일 포트)
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      time: true,              // 로그에 타임스탬프
      env: {
        NODE_ENV: 'production',
        PORT: 8999,
      },
    },
  ],
};
