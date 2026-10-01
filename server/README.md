# cen_resort 백엔드 (후기 저장 서버)

모바일 휴양소 후기 서비스의 후기를 **실제로 저장/조회**하는 API 서버입니다.
Express + Node 내장 SQLite(`node:sqlite`)로 구성되어 별도 DB 설치가 필요 없습니다.

## 실행

```bash
cd server
npm install      # 최초 1회 (Express 설치)
npm start        # = node index.js
```

- Windows에서는 `start_server.bat` 더블클릭으로도 실행됩니다.
- 실행 후 브라우저에서 **http://localhost:8999** 접속 → `index.html`이 서버로 서빙됩니다.
- 기존처럼 `index.html`을 파일로 열어도 됩니다(서버가 켜져 있으면 CORS 허용으로 동작).

## 데이터 위치

- DB: `server/data/reviews.db` (백업은 이 파일만 복사하면 됨)
- 사진: `server/uploads/` (파일로 저장, `/uploads/파일명`으로 제공)
- 두 폴더는 `.gitignore` 처리되어 저장소에 올라가지 않습니다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/reviews` | 후기 등록 (사진 base64, +300P) |
| GET  | `/api/reviews?resort=이름` | 휴양소별 후기 목록 (없으면 전체) |
| GET  | `/api/reviews/mine?empno=사번` | 내가 쓴 후기 |
| POST | `/api/reviews/:id/like` | 좋아요 (+/-1) |
| POST | `/api/reviews/:id/comments` | 댓글 등록 |
| GET  | `/api/health` | 헬스체크 |

## 개발서버 배포 (192.168.64.57, 포트 8999)

1. 서버에 Node LTS(≥ 22.5) 설치
2. 프로젝트 복사 후 `cd server && npm install`
3. `node index.js` 실행 (상시 구동은 `pm2` 또는 systemd 권장)
4. 방화벽은 이미 7722(SSH)/8999(웹) 허용됨 → `http://192.168.64.57:8999` 접속
