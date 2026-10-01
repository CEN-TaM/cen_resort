// 휴양소 꿀팁 표본 데이터
//
// 꿀팁은 아직 서버에 저장하지 않는다. 이 시드가 화면에 보이는 기본 목록이고,
// 사용자가 쓴 꿀팁은 브라우저(localStorage)에 쌓아 시드와 합쳐 보여준다. (tips.js)
// mine: true 는 "내가 쓴 꿀팁"으로 잡히는 항목 — 로그인한 사람 이름으로 표시된다.
const TIP_SEED = [
  // ── 조천 휴양소
  {
    id: 'seed-jocheon-1', resort: '조천 휴양소', tag: '주차', hot: true,
    title: '조천 휴양소 주차장 꿀팁',
    content: '정문 주차장은 협소하니 후문 공용 주차장 이용 추천! 도보 3분, 무료입니다.',
    author: '박OO 책임', daysAgo: 7, views: 142, likes: 28,
  },
  {
    id: 'seed-jocheon-2', resort: '조천 휴양소', tag: '마트',
    title: '근처 마트는 GS25 + 농협하나로마트',
    content: '차로 10분 거리 농협하나로마트가 가격 좋아요. 도착 전 미리 장보고 가는 게 베스트!',
    author: '최OO 매니저', daysAgo: 14, views: 89, likes: 17,
  },
  {
    id: 'seed-jocheon-3', resort: '조천 휴양소', tag: '맛집', hot: true,
    title: '조천 흑돼지 맛집 BEST 3',
    content: '1. 돈사돈 (현지인 추천)\n2. 흑돈가 (가성비)\n3. 제주아침 (포장 가능)',
    author: '이OO 선임', daysAgo: 21, views: 234, likes: 45,
  },
  {
    id: 'seed-jocheon-4', resort: '조천 휴양소', tag: '준비물', mine: true,
    title: '꼭 챙겨가세요 — 비치타올 & 모기약',
    content: '바다가 가까워서 비치타올 필수! 여름엔 모기가 좀 있어서 모기약도 챙기시면 좋아요.',
    daysAgo: 30, views: 67, likes: 12,
  },

  // ── 속초(힐스)
  {
    id: 'seed-sokcho-hills-1', resort: '속초(힐스)', tag: '시장', hot: true,
    title: '중앙시장은 걸어서 5분',
    content: '숙소에서 속초중앙시장까지 도보 5분이라 저녁거리 사 오기 좋아요. 닭강정은 포장 줄이 기니 이른 시간 추천.',
    author: '김OO 수석', daysAgo: 5, views: 186, likes: 34,
  },
  {
    id: 'seed-sokcho-hills-2', resort: '속초(힐스)', tag: '뷰',
    title: '일출 보려면 거실 커튼 미리 열어두기',
    content: '고층 오션뷰라 침대에서도 일출이 보입니다. 전날 밤에 커튼 살짝 열어두면 아침에 그대로 볼 수 있어요.',
    daysAgo: 12, views: 121, likes: 26, mine: true,
  },
  {
    id: 'seed-sokcho-hills-3', resort: '속초(힐스)', tag: '준비물',
    title: '수건은 3장, 더 필요하면 챙겨가세요',
    content: '식기류·비닐봉투·쓰레기봉투는 잘 구비돼 있습니다. 수건만 인원수보다 부족할 수 있어요.',
    author: '박OO 책임', daysAgo: 18, views: 98, likes: 21,
  },

  // ── 속초(서희)
  {
    id: 'seed-sokcho-seohee-1', resort: '속초(서희)', tag: '주차',
    title: '주차는 시장 공영주차장이 편해요',
    content: '건물 주차장이 좁은 편입니다. 중앙시장 공영주차장에 대고 걸어오는 게 오히려 빠를 때가 많아요.',
    author: '정OO 팀장', daysAgo: 9, views: 77, likes: 15,
  },
  {
    id: 'seed-sokcho-seohee-2', resort: '속초(서희)', tag: '맛집', hot: true,
    title: '해수욕장 앞 생선구이 골목',
    content: '도보 10분 거리에 생선구이 집이 모여 있어요. 저녁엔 웨이팅이 있으니 6시 전에 가시면 바로 앉습니다.',
    author: '손OO 수석', daysAgo: 16, views: 203, likes: 39,
  },
  {
    id: 'seed-sokcho-seohee-3', resort: '속초(서희)', tag: '아이동반',
    title: '아이랑 가면 과자의 성 추천',
    content: '차로 10분 거리에 과자 만들기 체험장이 있어요. 5~8세 아이들이 특히 좋아합니다.',
    author: '신OO 수석', daysAgo: 25, views: 112, likes: 24,
  },

  // ── 애월 1호점 / 2호점
  {
    id: 'seed-aewol1-1', resort: '애월 1호점', tag: '카페', hot: true,
    title: '애월 해안도로 카페는 평일 오전이 한산',
    content: '주말 오후엔 주차 자리가 없습니다. 평일 오전에 가면 창가 자리도 여유롭게 앉을 수 있어요.',
    daysAgo: 8, views: 165, likes: 31, mine: true,
  },
  {
    id: 'seed-aewol1-2', resort: '애월 1호점', tag: '렌터카',
    title: '렌터카는 공항에서 미리 예약',
    content: '성수기엔 현장 대여가 거의 불가능합니다. 최소 2주 전 예약을 권합니다.',
    author: '오OO 책임', daysAgo: 20, views: 94, likes: 18,
  },
  {
    id: 'seed-aewol2-1', resort: '애월 2호점', tag: '마트',
    title: '하나로마트 애월점이 가장 가까워요',
    content: '차로 7분 거리입니다. 저녁 8시면 닫으니 도착이 늦어질 것 같으면 미리 장 보고 오세요.',
    author: '강OO 매니저', daysAgo: 11, views: 72, likes: 13,
  },

  // ── 여수 / 보령 / 부산
  {
    id: 'seed-yeosu-1', resort: '여수휴양소', tag: '야경', hot: true,
    title: '해상케이블카는 해 질 무렵이 제일 예뻐요',
    content: '낮보다 일몰 30분 전이 훨씬 좋습니다. 돌산공원 쪽에서 타면 야경까지 한 번에 볼 수 있어요.',
    author: '문OO 선임', daysAgo: 13, views: 218, likes: 42,
  },
  {
    id: 'seed-boryeong-1', resort: '보령 휴양소', tag: '준비물',
    title: '머드축제 기간엔 여벌 옷 필수',
    content: '숙소까지 머드가 묻은 채로 오게 됩니다. 갈아입을 옷과 비닐봉투를 넉넉히 챙기세요.',
    author: '윤OO 책임', daysAgo: 28, views: 86, likes: 16,
  },
  {
    id: 'seed-busan-1', resort: '부산휴양소(해운대)', tag: '교통',
    title: '해운대는 지하철이 차보다 빠릅니다',
    content: '주말 해운대 일대는 정체가 심해요. 숙소에 차를 두고 지하철로 움직이는 편이 훨씬 낫습니다.',
    author: '배OO 수석', daysAgo: 6, views: 154, likes: 29,
  },
];

// 태그별 색상 — 없는 태그는 기본 톤
const TIP_TAG_TONE = {
  '주차': 'peach', '마트': 'teal', '맛집': 'pink', '준비물': 'lilac',
  '시장': 'cream', '뷰': 'sky', '카페': 'mint', '렌터카': 'sky',
  '야경': 'lilac', '교통': 'teal', '아이동반': 'coral',
};
