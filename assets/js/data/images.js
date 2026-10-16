// 이미지 매핑 (로컬 파일 우선, 없으면 fallback)
// assets/images/ 에 파일을 넣고 local 에 그 경로를 적으면 그 이미지가 쓰인다. local 이 비어 있으면 fallback 만 쓴다
// (예전엔 없는 파일 경로가 적혀 있어 화면마다 404 오류가 났다 — 지금 없는 파일은 비워 둠)
const IMG = {
  sokcho: { local: '', fallback: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&q=75' },
  aewol: { local: '', fallback: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=75' },
  yeosu: { local: '', fallback: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=500&q=75' },
  jocheon: { local: '', fallback: 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=500&q=75' },
  gwacheon: { local: '', fallback: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=500&q=75' },
  view1: { local: '', fallback: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=400&q=75' },
  view2: { local: '', fallback: 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?w=400&q=75' },
  view3: { local: '', fallback: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=400&q=75' },
  view4: { local: '', fallback: 'https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=400&q=75' },
  'hero-jocheon': { local: '', fallback: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=900&q=85' },
  'banner-summer': { local: 'assets/images/banner-summer.png', fallback: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85' },
  'banner-second': { local: 'assets/images/banner-vacation.png', fallback: 'assets/images/banner-summer.png' },
  'banner-third': { local: 'assets/images/banner-info.png', fallback: 'assets/images/banner-summer.png' },
  'win-1': { local: '', fallback: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=500&q=75' },
  'win-2': { local: '', fallback: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=500&q=75' }
};
