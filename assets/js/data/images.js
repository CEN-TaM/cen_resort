// 이미지 매핑 (로컬 파일 우선, 없으면 fallback)
// assets/images/ 에 동일한 파일명을 넣으면 자동으로 그 이미지가 적용됨
const IMG = {
  sokcho: { local: 'assets/images/resort-sokcho.jpg', fallback: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&q=75' },
  aewol: { local: 'assets/images/resort-aewol.jpg', fallback: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=75' },
  yeosu: { local: 'assets/images/resort-yeosu.jpg', fallback: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=500&q=75' },
  jocheon: { local: 'assets/images/resort-jocheon.jpg', fallback: 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=500&q=75' },
  gwacheon: { local: 'assets/images/resort-gwacheon.jpg', fallback: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=500&q=75' },
  view1: { local: 'assets/images/review-1.jpg', fallback: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=400&q=75' },
  view2: { local: 'assets/images/review-2.jpg', fallback: 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?w=400&q=75' },
  view3: { local: 'assets/images/review-3.jpg', fallback: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=400&q=75' },
  view4: { local: 'assets/images/review-4.jpg', fallback: 'https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=400&q=75' },
  'hero-jocheon': { local: 'assets/images/hero-jocheon.jpg', fallback: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=900&q=85' },
  'banner-summer': { local: 'assets/images/banner-summer.png', fallback: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85' },
  'banner-second': { local: 'assets/images/banner-vacation.png', fallback: 'assets/images/banner-summer.png' },
  'banner-third': { local: 'assets/images/banner-info.png', fallback: 'assets/images/banner-summer.png' },
  'win-1': { local: 'assets/images/resort-winter-1.jpg', fallback: 'https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=500&q=75' },
  'win-2': { local: 'assets/images/resort-winter-2.jpg', fallback: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=500&q=75' }
};
