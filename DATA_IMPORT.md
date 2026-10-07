# 후기 데이터 올리기 가이드

엑셀·PDF로 모은 후기와 사진을 서버에 넣는 방법입니다.
코드 배포는 `DEPLOY.md`, 이 문서는 **데이터**만 다룹니다.

> 2026-09-30 속초 후기 20건(사진 132장)을 넣으면서 정리했습니다.

---

## 딱 하나만 기억하세요

**서버 DB 파일을 통째로 덮어쓰지 마세요.**

서버는 24시간 돌아갑니다. 작업하는 동안에도 누군가 후기를 쓰고 댓글을 답니다.
내 PC에서 만든 `reviews.db`를 그대로 올리면 **그 사이 쌓인 글이 전부 사라집니다.**

아래 순서는 **새 글만 추가**하도록 되어 있습니다. 그대로만 따라 하면 됩니다.

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

### 사진 — 리사이즈해서 올립니다

원본은 장당 3~4MB라 그대로 올리면 목록 화면이 느려집니다.
`tools/resize_photos.py`가 **긴 변 1600px, JPEG 품질 82**로 줄이고 파일명도 서버 규칙(무작위 24자리)에 맞춥니다.

속초 132장 기준 **450MB → 28MB** (장당 218KB). 기존 사진 평균이 232KB라 비슷한 수준입니다.

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

후기 하나당 이런 모양입니다. (`python -m pip install openpyxl`)

```json
[{ "review_id": "RV-GW-SC-000543",
   "resort_name": "속초 힐스 휴양소",
   "author_name": "이진환",
   "department": "국세서비스팀",
   "company": "주식회사 아이티센엔텍",
   "ai_recommend_score": "92",
   "image_count": "12",
   "image_files": ["속초_힐스_543_이미지/RV-GW-SC-000543_001.png", "..."] }]
```

### ② PDF에서 본문 뽑아 `contents.txt` 만들기

```
===후기ID|작성일시(한국시간)|추천수
본문 여러 줄...
===다음 후기ID|...
```

### ③ 사진 줄이기

```bash
python tools/resize_photos.py <사진폴더> meta.json resized/
```

`resized/` 안에 줄인 사진과 `photomap.json`이 생깁니다.

### ④ 내 PC에서 먼저 넣어보기

```bash
node tools/import_reviews.js server/data/reviews.db .            # 시험 (되돌림)
node tools/import_reviews.js server/data/reviews.db . --commit   # 실제
```

시험 실행 결과 표에서 **휴양소 이름·작성일시·사진 장수**를 확인하세요.
휴양소 이름은 `속초(힐스) 휴양소`처럼 앱 목록(`assets/js/review-write.js`)과 글자까지 같아야 합니다.

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

scp -i ~/.ssh/cen_resort_deploy -P 7722 tools/import_reviews.js tools/verify_db.js \
    meta.json contents.txt resized/photomap.json \
    devadm01@192.168.64.57:~/import/
```

> `scp`는 대문자 `-P`, `ssh`는 소문자 `-p` 입니다.

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
| 휴양소 필터에 안 잡힘 | 이름 불일치. `속초 힐스 휴양소`(엑셀) ≠ `속초(힐스) 휴양소`(앱) |
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
