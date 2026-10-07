// 휴양소 꿀팁 표본 데이터
//
// 꿀팁은 아직 서버에 저장하지 않는다. 이 시드가 화면에 보이는 기본 목록이고,
// 사용자가 쓴 꿀팁은 브라우저(localStorage)에 쌓아 시드와 합쳐 보여준다. (tips.js)
// mine: true 는 "내가 쓴 꿀팁"으로 잡히는 항목 — 로그인한 사람 이름으로 표시된다.
const TIP_SEED = [
  {
    id: 'seed-sokcho-hills-1', resort: '속초(힐스)', tag: '시장', mine: true,
    title: '중앙시장은 걸어서 5분',
    content: '숙소에서 속초중앙시장까지 도보 5분이라 저녁거리 사 오기 좋아요. 닭강정은 포장 줄이 기니 이른 시간에 들르시는 걸 추천합니다.',
    daysAgo: 5, views: 186, likes: 34,
  },
];

// 태그별 색상 — 없는 태그는 기본 톤
const TIP_TAG_TONE = {
  '주차': 'peach', '마트': 'teal', '맛집': 'pink', '준비물': 'lilac',
  '시장': 'cream', '뷰': 'sky', '카페': 'mint', '렌터카': 'sky',
  '야경': 'lilac', '교통': 'teal', '아이동반': 'coral',
};
