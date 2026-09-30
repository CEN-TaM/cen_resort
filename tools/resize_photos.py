# 후기 사진을 웹에 올릴 크기로 줄인다.
#
# 사용:  python resize_photos.py <사진폴더> <meta.json> <출력폴더>
# 준비:  python -m pip install pillow
#
# 결과:  출력폴더에 리사이즈된 jpg + photomap.json(후기ID ↔ 사진경로 연결표)
#
# 원본은 장당 3~4MB라 그대로 올리면 목록 화면이 느려진다.
# 속초 132장 기준 450MB → 28MB (장당 218KB)로 줄었다.

import os, sys, json, secrets
from PIL import Image, ImageOps

MAXSIDE = 1600      # 긴 변 기준. 이보다 작은 사진은 그대로 둔다
QUALITY = 82        # JPEG 품질

if len(sys.argv) != 4:
    print(__doc__ or '사용: python resize_photos.py <사진폴더> <meta.json> <출력폴더>')
    sys.exit(1)

SRC, META, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)

meta = json.load(open(META, encoding='utf-8'))
mapping = {}
total_in = total_out = 0
missing = []

for rec in meta:
    paths = []
    for rel in rec['image_files']:
        src = os.path.join(SRC, rel.replace('/', os.sep))
        if not os.path.exists(src):
            missing.append(rel)
            continue
        total_in += os.path.getsize(src)

        im = ImageOps.exif_transpose(Image.open(src))   # 스마트폰 세로 사진 회전 보정
        if im.mode in ('RGBA', 'LA', 'P'):              # 투명 PNG는 흰 배경에 합성
            bg = Image.new('RGB', im.size, (255, 255, 255))
            im = im.convert('RGBA')
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert('RGB')
        im.thumbnail((MAXSIDE, MAXSIDE), Image.LANCZOS)

        name = secrets.token_hex(12) + '.jpg'           # 서버 업로드와 같은 규칙
        dst = os.path.join(OUT, name)
        im.save(dst, 'JPEG', quality=QUALITY, optimize=True)
        total_out += os.path.getsize(dst)
        paths.append('/uploads/' + name)

    mapping[rec['review_id']] = paths
    if len(paths) != int(rec.get('image_count', len(paths))):
        print('  [경고] %s: 엑셀 %s장 / 실제 %d장' % (rec['review_id'], rec['image_count'], len(paths)))

json.dump(mapping, open(os.path.join(OUT, 'photomap.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

n = sum(len(v) for v in mapping.values())
print('변환: %d장' % n)
if n:
    print('원본 %.1f MB → 변환 %.1f MB (%.1f%%)' % (total_in/1048576, total_out/1048576, total_out/total_in*100))
    print('평균 장당: %.0f KB' % (total_out/n/1024))
if missing:
    print('원본을 못 찾은 파일 %d개:' % len(missing), missing[:5])
