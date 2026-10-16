# 데이터 올리기 가이드 (후기 · 휴양소 정보)

엑셀 · PDF 로 모은 **후기**와 회사 안내 PDF 의 **휴양소 정보 · 사진**을 DB 에 넣는 방법입니다.
코드 배포는 `DEPLOY.md`, 이 문서는 **데이터**만 다룹니다. 도구는 모두 Node 입니다. Python 은 폰 원본처럼 큰 사진을 줄일 때(`resize_photos.py`)만 필요합니다.

## 한눈에 보기

| 넣을 것 | 받는 자료 | 도구 (순서대로) | 들어가는 곳 |
|---|---|---|---|
| **후기** | 후기 엑셀 + 원본 PDF + 사진 폴더 | `xlsx_to_meta.js` → (PDF 보고 채우기) → `prepare_photos.js` → `import_reviews.js` | `reviews` · `review_photos` 테이블, `server/uploads/` |
| **공지사항** | 공지 내용 (부서에서 받은 글) | (`공지.json` 작성) → `notices.js` | `notices` 테이블 |
| **꿀팁** | 후기 본문 (DB 에 들어간 후기) | (`꿀팁.json` 작성) → `import_tips.js` | `tips` 테이블 |
| **휴양소 정보 · 사진** | 회사 안내 PDF (세부안내 · 이용 가이드) | (PDF 읽고 `정보.json` 작성) → `pdf_photos.js` → `import_resorts.js` | `resorts` 테이블, `server/uploads/resorts/` |

- 모든 적재 도구는 **먼저 시험 실행**(바뀔 내용만 보여주고 되돌림) → 확인 후 `--commit` 입니다.
- 내 PC 에서 먼저 넣어 화면으로 확인하고, 같은 파일로 개발서버에 넣습니다.
- 받은 자료와 만든 파일(meta.json · contents.txt · 정보.json · 사진)은 **저장소 밖**(예: 받은 자료 폴더 안 `적재준비/`)에 둡니다. 저장소가 공개라 실명 · 주소 · 연락처가 올라가면 안 됩니다.

### 자료 넘길 때 체크리스트 (휴양소별로 후기를 조사해 넘기는 사람)

- [ ] **휴양소마다 폴더 하나** — 폴더 이름은 앱의 휴양소 이름 그대로 (예: `인천(강화)`, `과천휴양소(504호)`). 이름은 관리자 페이지 '휴양소 정보' 목록에서 확인
- [ ] 폴더 안에 **후기 엑셀 + 후기 원본 PDF + 사진 폴더** (아래 '준비물')
- [ ] 넘기는 곳은 **저장소 밖** (메일 · 공유 드라이브 · 내 PC 폴더). `cen_resort` 폴더 안에 두거나 커밋하지 않기
- [ ] 사진에 **사람 얼굴 · 차 번호 · 집 주소**가 크게 보이면 빼기
- [ ] 조사했는데 후기가 없으면 **'OO 휴양소 데이터 없음'** 이라고 알려 주기 (빈 폴더는 보내지 않아도 됨)
- [ ] 앱에서 직접 쓴 후기는 넘기지 않아도 됨 — 이미 DB 에 있음

> 2026-09-30 속초 후기 20건(사진 132장)을 넣으면서 정리했습니다.
> 2026-10-13 경주 후기 2건을 넣으면서 고쳤습니다 — 휴양소 자동 매칭, 동행은 meta.json 에, Python 없이 사진 준비.

---

## 딱 하나만 기억하세요

**서버 DB 파일을 통째로 덮어쓰지 마세요.**

서버는 24시간 돌아갑니다. 작업하는 동안에도 누군가 후기를 쓰고 댓글을 답니다.
내 PC에서 만든 `reviews.db`를 그대로 올리면 **그 사이 쌓인 글이 전부 사라집니다.**

아래 순서는 **새 글만 추가**하도록 되어 있습니다. 그대로만 따라 하면 됩니다.

---

## 어디에 들어가나

후기는 화면이 아니라 **DB 테이블**에 들어갑니다. 넣고 나면 휴양소 상세 · 홈 최근 후기 · 평점 · 후기 수 · 인기 휴양소 순서에 바로 반영됩니다.

| 저장되는 곳 | 내용 |
|---|---|
| `reviews` 테이블 | 후기 1건 = 1줄 (작성자 · 부서 · 회사 · 휴양소 · 본문 · 평점 · 작성일시 · 좋아요 수) |
| `review_photos` 테이블 | 후기 사진 경로 (`/uploads/파일명.jpg`) |
| `server/uploads/` 폴더 | 사진 파일 |

DB 파일은 `server/data/reviews.db` 입니다 (후기 · 휴양소 · 회원 · 즐겨찾기 · 포인트가 모두 이 파일 안에 있습니다).
DB 와 사진은 `.gitignore` 대상이라 **GitHub 에 올라가지 않습니다.** 내 PC 와 개발서버에 각각 넣어야 합니다.

옮겨 온 후기는 이렇게 다룹니다.

- 작성자 사번은 비워 둡니다 → 앱에서 '내 후기' 로 잡히지 않고, **삭제는 관리자만** 할 수 있습니다.
- **휴양소 포인트(10P)는 주지 않습니다.** 앱에서 직접 쓴 후기만 적립됩니다.
- 좋아요 수는 원래 게시판의 추천수에서 시작합니다.

---

## 준비물

| 무엇 | 쓰임 |
|---|---|
| 엑셀 | 작성자·부서·회사·작성일·AI 추천점수 |
| 사진 폴더 | 후기별 사진 |
| **원본 PDF** | **후기 본문** |

**본문은 엑셀이 아니라 PDF에서 가져옵니다.** 엑셀의 `summary_ai`는 AI가 만든 요약이라,
게시판에 올라갈 글로는 맞지 않습니다. 그룹웨어 인쇄 PDF는 글자가 아니라 그림이라 복사가 안 되니
Claude Code에게 읽어달라고 하세요.

---

## 세 가지 규칙

### 평점 — AI 추천점수를 환산합니다

엑셀의 `ai_recommend_score`(0~100)를 위치·시설·청결 세 항목(각 1~5점)으로 바꿉니다.
계산은 `tools/import_reviews.js`가 알아서 합니다.

| 추천점수 | 위치 | 시설 | 청결 | 평균 |
|---|---|---|---|---|
| 97~100 | 5 | 5 | 5 | 5.0 |
| 90~96 | 5 | 5 | 4 | 4.7 |
| 84~89 | 5 | 4 | 4 | 4.3 |
| 77~83 | 4 | 4 | 4 | 4.0 |

> 1~5점 정수 세 개로는 촘촘한 구분이 안 됩니다. **점수 6~7점 폭이 통째로 같은 평점**이 됩니다.
> 속초 20건은 87~95점에 몰려 있어 4.7(17건)과 4.3(3건) 두 가지로만 갈렸습니다.
> 작성자가 매긴 점수가 아니라 AI 추정값을 바꾼 것이라는 점을 기억해 두세요.

### 사진 — 큰 사진은 줄이고, 이름은 서버 규칙으로

파일 이름은 서버 규칙(무작위 24자리.jpg)으로 바꿔서 올립니다. 크기에 따라 도구가 다릅니다.

| 사진 | 도구 |
|---|---|
| **PDF 에서 뽑은 사진** (보통 700px · 100KB 안팎) | `node tools/prepare_photos.js` — 이름만 바꿔 복사. 설치할 것 없음 |
| **폰 원본 사진** (장당 3~4MB) | `python tools/resize_photos.py` — **긴 변 1600px, JPEG 품질 82**로 줄임 (`pip install pillow` 필요) |

`prepare_photos.js` 는 1MB 넘는 사진이 있으면 경고합니다. 그때는 `resize_photos.py` 를 쓰세요.
속초 132장은 `resize_photos.py` 로 **450MB → 28MB** (장당 218KB). 경주 4장은 PDF 추출본이라 장당 71KB 그대로 썼습니다.

### 회사명 — 법인 표기는 떼고 넣습니다

`주식회사 아이티센엔텍`, `(주)씨플랫폼` 처럼 들어온 회사명에서 **법인 표기를 떼어** `아이티센엔텍`, `씨플랫폼` 으로 저장합니다.

| 들어온 값 | 저장되는 값 |
|---|---|
| `주식회사 아이티센엔텍` | `아이티센엔텍` |
| `(주)씨플랫폼` | `씨플랫폼` |
| `아이티센코어 주식회사` | `아이티센코어` |
| `식회사 아이티센클로잇` | `아이티센클로잇` |

**`tools/import_reviews.js` 가 적재할 때 자동으로 처리하므로 따로 하실 일은 없습니다.**
엑셀에 어떻게 적혀 있든 같은 회사는 같은 이름으로 저장됩니다. 같은 회사가 `주식회사 X` 와 `X` 로 갈려
후기 목록에서 서로 다른 회사처럼 보이던 문제를 막기 위한 것입니다.

> **`식회사` 가 표에 있는 이유.** 화면에 회사명을 그릴 때 `(주)` 를 떼는 규칙이 `주식회사` 의 첫 글자를
> 먼저 지워버려서, 한동안 `식회사 아이티센엔텍` 으로 보였습니다. 지금은 고쳤지만 그렇게 잘린 값이
> 섞여 들어와도 받아내도록 규칙에 남겨 뒀습니다.

**이미 들어가 있는 데이터를 정리하려면** 같은 스크립트를 직접 실행합니다.

```bash
node tools/clean_company.js server/data/reviews.db            # 시험 (되돌림)
node tools/clean_company.js server/data/reviews.db --commit   # 실제
```

---

## 순서

### ① 엑셀에서 `meta.json` 만들기

```bash
node tools/xlsx_to_meta.js "<후기 엑셀.xlsx>" <작업폴더>      # meta.json + contents.txt 틀
```

엑셀 첫 시트를 읽어 `meta.json` 을 만들고, 본문 자리만 비워 둔 `contents.txt` 틀도 만듭니다.
**그다음 원본 PDF 를 보고 직접 채웁니다** — 직급(`author_name`), 동행(`companions`), 본문 · 작성일시(`contents.txt`).
틀을 채우지 않은 채 ④ 를 실행하면 도구가 멈춥니다. 후기 하나당 이런 모양입니다.

```json
[{ "review_id": "RV-GJ-000001",
   "resort_name": "경주 휴양소",
   "author_name": "홍길동 수석",
   "department": "OO사업부",
   "company": "주식회사 아이티센씨티에스",
   "ai_recommend_score": "86",
   "companions": ["가족"],
   "image_count": "0",
   "image_files": [] }]
```

- `author_name` 은 **PDF 게시자 줄의 이름 + 직급**(`홍길동 수석`)으로 씁니다. 앱이 작성자를 '이름 직급'으로 보여주기 때문입니다.
- `companions` 는 본문에 드러난 동행만 적습니다 (아래 '동행' 참고). 없으면 `[]`.
- `resort_name` 은 엑셀 그대로 둬도 됩니다. 도구가 DB 휴양소에서 띄어쓰기를 무시하고 찾습니다 (`경주 휴양소` → `경주휴양소`).

### ② PDF에서 본문 뽑아 `contents.txt` 만들기

```
===후기ID|작성일시(한국시간)|추천수
본문 여러 줄...
===다음 후기ID|...
```

작성일시는 PDF 제목 옆 `2026-08-31 17:02` 를 `2026-08-31T17:02:00` 으로 적습니다.
PDF 는 인쇄 폭에서 줄이 끊겨 있습니다(`차단` / `기가`). 문장 중간에서 끊긴 줄은 이어 붙이고, 글쓴이가 바꾼 줄은 그대로 둡니다.

### ③ 사진 준비

```bash
node tools/prepare_photos.js <사진폴더> meta.json resized/          # PDF 추출 사진
python tools/resize_photos.py <사진폴더> meta.json resized/         # 폰 원본 (큰 사진)
cp resized/photomap.json .                                          # 도구는 데이터폴더의 photomap.json 을 읽습니다
```

`resized/` 안에 사진과 `photomap.json`이 생깁니다. 사진이 없는 후기는 `[]` 로 들어가고, 화면에는 사진 없이 나옵니다.

### ④ 내 PC에서 먼저 넣어보기

```bash
node tools/import_reviews.js server/data/reviews.db .            # 시험 (되돌림)
node tools/import_reviews.js server/data/reviews.db . --commit   # 실제
```

시험 실행 결과 표에서 **휴양소 이름·작성일시·사진 장수**를 확인하세요.
휴양소는 DB `resorts` 테이블의 정식명·옛 표기에서 **띄어쓰기를 무시하고** 찾습니다. 휴양소 종류(정기/하계/동계)도 DB 값을 씁니다.
못 찾으면 DB 휴양소 목록을 보여주고 멈춥니다 → `tools/import_reviews.js` 맨 위 `RESORT_MAP` 에 `'엑셀 표기': 'DB 정식명'` 을 추가하세요.

### ⑤ 서버에 올리기

```bash
# 백업 먼저
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57
node ~/cen_resort/server/backup.js
exit

# 사진과 데이터 올리기
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57 "mkdir -p ~/import"

scp -i ~/.ssh/cen_resort_deploy -P 7722 resized/*.jpg \
    devadm01@192.168.64.57:~/cen_resort/server/uploads/

scp -i ~/.ssh/cen_resort_deploy -P 7722 tools/import_reviews.js tools/clean_company.js tools/verify_db.js \
    meta.json contents.txt resized/photomap.json \
    devadm01@192.168.64.57:~/import/
```

> `scp`는 대문자 `-P`, `ssh`는 소문자 `-p` 입니다.
> `clean_company.js` 를 빠뜨리면 서버에서 `Cannot find module './clean_company'` 로 멈춥니다.

```bash
# 서버에서 넣기
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57

cd ~/import
node import_reviews.js ~/cen_resort/server/data/reviews.db .            # 시험
node import_reviews.js ~/cen_resort/server/data/reviews.db . --commit   # 실제
pm2 reload cen-resort

cd ~/cen_resort/server && node ~/import/verify_db.js                    # 확인
exit
```

`verify_db.js`에서 **"파일 없음 0 / 미참조 파일 0"** 이 나오면 성공입니다.
브라우저에서 http://192.168.64.57:8999 도 열어보세요.

> `~/import`는 일부러 프로젝트 **바깥**에 둡니다. 배포할 때 `~/cen_resort` 안은 정리되기 때문입니다.

---

## 안 될 때

| 증상 | 원인 |
|---|---|
| 사진이 옆으로 누움 | EXIF 회전 보정 누락 (`resize_photos.py`를 쓰면 안 생깁니다) |
| 후기는 있는데 사진이 안 보임 | DB에만 넣고 `uploads/`에 파일을 안 올림 |
| `휴양소를 찾을 수 없음` 으로 멈춤 | 엑셀 이름이 DB 와 너무 다름. 도구의 `RESORT_MAP` 에 추가 |
| `resorts 테이블이 없습니다` | 서버가 아직 예전 코드. 배포 후 서버를 한 번 켠 뒤 실행 |
| 작성일이 하루 밀림 | 한국시간을 UTC로 안 바꿈 (스크립트가 처리하니 직접 계산하지 마세요) |
| 같은 후기가 두 번 들어감 | 스크립트가 `작성자 + 작성일시`로 거릅니다. 이 부분을 고치지 마세요 |
| DB 파일을 복사했더니 깨짐 | 서버 DB는 켜진 채로 복사하면 안 됩니다. `backup.js`를 쓰세요 |

**동행(가족·친구·연인…)에 대하여**
엑셀의 `recommended_for`는 "누구에게 추천하는 여행인가"이지 작성자가 누구와 갔는지가 아닙니다.
그대로 옮기면 한 후기에 `가족`과 `연인`이 같이 붙습니다.
본문에 "저희 가족은…"처럼 드러난 것만 채우고 아니면 비워 두세요. 빈 값도 정상입니다.

---

## 되돌리기

| | |
|---|---|
| 서버 | `~/backups/YYYY-MM-DD/` 에서 복구 (방법은 `server/backup.js` 맨 위 주석) |
| 내 PC | 넣기 전에 `cp server/data/reviews.db server/data/reviews.db.백업` |

사진은 지우지 않아도 됩니다. DB가 참조하지 않는 사진은 화면에 나오지 않습니다.

---

# 휴양소 정보 올리기

회사 안내 PDF(이벤트 휴양소 세부안내 · 휴양소 이용 가이드)의 내용을 DB `resorts` 테이블에 넣습니다.
**화면(index.html)은 고치지 않습니다.** 목록 · 상세 · 지도 · 길찾기가 이 테이블을 그대로 읽습니다.

> 2026-10-13 하계 8곳 · 동계 6곳 · 과천 2곳 · 애월 2곳 (PDF 5개) 을 넣으면서 정리했습니다.

## 순서

### ① PDF 를 읽고 `정보.json` 만들기

> 한두 곳만 고칠 때는 관리자 페이지 **휴양소 정보** 메뉴에서 바로 고칠 수 있습니다 (대표 사진 올리기 포함). 아래 순서는 여러 곳을 한꺼번에 넣을 때.

- PDF 는 글자가 그림이라 복사가 안 됩니다. **Claude Code 에게 PDF 를 읽게 하고** 휴양소별로 옮기게 합니다.
- 모양은 `tools/examples/resorts-info.sample.json` (가짜 값 예시), 칸 설명은 `tools/import_resorts.js` 맨 위 주석.
- `id` 는 DB 휴양소 id 입니다 (`http://localhost:8999/api/resorts` 에서 확인). PDF 의 지역 · 숙소 이름으로 맞는 휴양소를 찾습니다.
  예) 동계 '충남' = 아르띠에 도고(아산) → `winter-chungnam`
- **적은 칸만 바뀌고, 적지 않은 칸은 그대로** 남습니다. 일부만 고칠 때는 그 칸만 적으면 됩니다.
- 편의시설 칩(`features`)에 새 이름을 쓰면 아이콘은 `assets/js/data/resorts.js` 의 `FEATURE_META` 에 더합니다 (없으면 체크 아이콘).
- 아래 '넣지 않는 것' 은 빼고 옮깁니다.

### ② 대표 사진 고르기

```bash
node tools/pdf_photos.js "<안내.pdf>" <작업폴더>/photos-pdf1     # PDF 안 사진을 페이지별로 꺼내고 목록(index.html)을 만든다
```

- 목록(`index.html`)을 브라우저로 열어(Claude 는 스크린샷으로) 휴양소마다 **외관 사진 1장**을 고릅니다. 외관이 없으면 거실 · 객실.
- 페이지 순서 = PDF 의 휴양소 순서입니다. 사진에 그 휴양소 이름이 없으니 PDF 페이지 제목과 맞춰 봅니다.
- 고른 사진을 `server/uploads/resorts/<id>-<짧은해시>.jpg` 로 복사하고, `정보.json` 의 `photo` 에 `/uploads/resorts/<그 파일이름>` 을 적습니다.
  짧은해시는 파일 내용으로 만든 8자리 (예: `md5sum 파일 | cut -c1-8`) — **사진을 바꾸면 이름도 바뀌어야** 브라우저가 옛 사진을 쓰지 않습니다.
- 사진이 없는 휴양소는 기존 기본 사진이 나옵니다.
- 원하는 사진이 목록에 없으면(PNG 로 들어 있는 경우) PDF 를 열어 그 부분을 화면 캡처해 씁니다.
- 사진 속 차량 번호판 · 사람 얼굴이 크게 보이면 다른 사진을 고르거나 잘라 냅니다.

### ③ 내 PC 에서 시험 → 실제

```bash
node tools/import_resorts.js 정보.json            # 바뀔 내용만 보여줌 (되돌림)
node tools/import_resorts.js 정보.json --commit   # 실제
```

`http://localhost:8999` 에서 휴양소 목록 · 상세 · '휴양소 정보 전체보기' · 길찾기를 확인합니다.

### ④ 개발서버에 넣기

```bash
# 백업 먼저 (후기 ⑤ 와 같음)
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57 "export PATH=\$HOME/opt/node/bin:\$PATH && node ~/cen_resort/server/backup.js && mkdir -p ~/import ~/cen_resort/server/uploads/resorts"

# 사진 · 정보 파일 올리기
scp -i ~/.ssh/cen_resort_deploy -P 7722 server/uploads/resorts/*.jpg devadm01@192.168.64.57:~/cen_resort/server/uploads/resorts/
scp -i ~/.ssh/cen_resort_deploy -P 7722 정보.json devadm01@192.168.64.57:~/import/

# 서버에서 넣기 (도구는 서버에 배포된 코드의 것을 쓴다 — 서버가 휴양소 테이블이 있는 새 버전이어야 한다)
ssh -i ~/.ssh/cen_resort_deploy -p 7722 devadm01@192.168.64.57
export PATH=$HOME/opt/node/bin:$PATH && cd ~/cen_resort
node tools/import_resorts.js ~/import/정보.json            # 시험
node tools/import_resorts.js ~/import/정보.json --commit   # 실제
```

서버를 다시 켤 필요는 없습니다 (요청마다 DB 를 읽습니다).

## 넣지 않는 것

| | 이유 |
|---|---|
| 담당자 개인 휴대폰 · 메일 | 개인정보. 화면에는 '휴양소 담당자에게 연락' 으로만 |
| 와이파이 이름 · 비밀번호 | 현장에 붙어 있음. 앱에 올리면 외부로 퍼진다 |
| 렌터카 세부 (업체 · 전화 · 회사 예약자명 · 운전 조건 · 인수/반납 방법 · 면책금) | 회사 계약 정보. `렌터카: 휴양소 전용 렌터카 있음` 한 줄만 |
| 회사 내부 예약 절차 (예약번호 발급 방식 등) | 예약은 회사 시스템에서. 앱은 휴양소 소개만 |
| 출입 비밀번호 · 키 보관 위치 | 보안. '출입 키는 경영지원실에서 수령' 처럼 절차만 |
| `정보.json` 파일 | 저장소(공개)에 올리지 않는다. 회사 숙소 주소 · 연락처가 들어 있다 |

---

# 공지사항 올리기

공지는 DB `notices` 테이블에 있고, 공지 탭 · 공지 상세 · 알림이 그대로 읽습니다.
**보통은 관리자 페이지(`/admin` → 공지사항)에서 씁니다** — 쓰기 · 고치기 · 숨기기 · 고정 · 삭제. 아래 도구는 여러 개를 한 번에 넣을 때 씁니다.
코드의 예시 공지(`assets/js/data/notices.js`)는 **서버 없이 열었을 때(시연)만** 보이는 지어낸 글입니다. 실제 공지로 쓰지 않습니다.

```bash
node tools/notices.js add 공지.json            # 시험 (되돌림)
node tools/notices.js add 공지.json --commit   # 실제
node tools/notices.js list                     # 목록 · 조회수
node tools/notices.js edit 3 고칠내용.json --commit   # 3번 공지 고치기 (적은 칸만)
node tools/notices.js off 3                    # 숨기기 (on 으로 다시 보이기)
```

화면 확인용 예시 공지 6개는 `tools/examples/notices.sample.json` 에 있습니다 (`node tools/notices.js add tools/examples/notices.sample.json --commit`). 실제 운영 서버에는 넣지 않습니다.
`공지.json` 모양과 본문 쓰는 법(`### 소제목`, `- 목록`, `> 강조`, `**굵게**`)은 `tools/notices.js` 맨 위 주석에 있습니다.
- 분류는 화면 칩과 같아야 합니다: 이용수칙 · 예약 · 포인트
- 본문에 HTML 은 쓰지 않습니다 (글자로 보입니다).
- 첨부는 사내에서 열리는 주소(`url`)가 있을 때만 받기 버튼이 생깁니다.
- 조회수는 공지를 연 **사람 수**입니다 (한 사람이 여러 번 열어도 1).
- 개발서버에 넣을 때는 `공지.json` 을 `~/import/` 에 올린 뒤 서버의 `~/cen_resort` 에서 같은 명령을 실행합니다.

---

# 꿀팁 올리기

휴양소 상세의 '다녀온 동료들의 꿀팁' 은 DB `tips` 테이블에 있습니다. 앱에서 직원이 쓰는 것 말고, 후기에서 쓸 만한 한 줄을 골라 미리 넣어 둘 수 있습니다.

> 2026-10-16 후기가 있는 휴양소 10곳에 1~4개씩 넣으면서 정리했습니다.

1. 후기 본문에서 **다음 사람에게 도움이 되는 한 줄**(주차 · 준비물 · 맛집 · 아이 동반 · 체크인 등)을 고릅니다. 휴양소당 1~4개.
   - 본문은 **후기 문장 그대로** 옮깁니다 (앞의 `- ` · `1)` 같은 목록 표시만 뗌). 제목(`title`)만 짧게 새로 씁니다.
   - 작성자(`author`)는 그 후기의 작성자, 작성일(`created_at`)은 그 후기의 작성일.
   - 위 '넣지 않는 것' 과 같은 내용(출입 비밀번호 · 와이파이 · 연락처 · 렌터카 업체 · 호수)은 고르지 않습니다.
2. `꿀팁.json` 으로 저장합니다 (모양은 `tools/import_tips.js` 맨 위 주석). **저장소 밖**에 둡니다.
3. 넣기

```bash
node tools/import_tips.js 꿀팁.json            # 시험 (되돌림)
node tools/import_tips.js 꿀팁.json --commit   # 실제
```

- 같은 휴양소 · 작성자 · 제목이 이미 있으면 건너뜁니다. 두 번 실행해도 겹치지 않습니다.
- 넣은 꿀팁은 앱에서 '내 꿀팁' 으로 잡히지 않고, 고치기 · 지우기는 관리자만 할 수 있습니다.
- 개발서버에서는 `꿀팁.json` 을 `~/import/` 에 올린 뒤 서버의 `~/cen_resort` 에서 같은 명령을 실행합니다.
