// 샘플 후기 — 서버가 없을 때(GitHub Pages 시연)만 보여준다. 서버가 있으면 DB 후기만 쓴다.
// 전부 지어낸 예시다. 실제 후기·실명을 여기에 넣지 않는다 (저장소가 공개라 그대로 외부에 보인다).
// 실제 후기는 서버 DB 에 넣는다 (DATA_IMPORT.md).
// 모양은 server/index.js loadReview() 와 같다. 좋아요·댓글·삭제는 data-source.js 의 SampleDB(브라우저 메모리)로 동작한다.
//   resortName  반드시 data/resorts.js 정식명
//   ratings     { location, facility, clean, avg }
//   photos      assets/images/reviews/*.jpg
//   tags        특징 칩(바다뷰 등). 서버 DB 에는 아직 칸이 없다
const SAMPLE_ME = '11223';   // 데모 로그인 사번 — 이 사번의 후기·댓글은 '내 것'으로 보인다
const SAMPLE_DAY = 864e5;
const SAMPLE_HOUR = 36e5;
const sampleAgo = (days, hours) => new Date(Date.now() - days * SAMPLE_DAY - (hours || 0) * SAMPLE_HOUR).toISOString();
const SAMPLE_PH = {
  seawall: 'assets/images/reviews/rv1b.jpg',
  sunset: 'assets/images/reviews/rv4a.jpg',
  beach: 'assets/images/reviews/rv4c.jpg',
  farm: 'assets/images/reviews/rv5c.jpg',
  bread: 'assets/images/reviews/rv1a.jpg',
  cafe: 'assets/images/reviews/rv3b.jpg',
  cafe2: 'assets/images/reviews/rv5b.jpg',
  fish: 'assets/images/reviews/rv3a.jpg',
};
const S54 = { location: 5, facility: 5, clean: 4, avg: 4.7 };   // 추천점수 90~96
const S44 = { location: 5, facility: 4, clean: 4, avg: 4.3 };   // 추천점수 84~89
const sampleComment = (id, parentId, empno, author, text, created_at) => ({ id, parentId, empno, author, color: null, text, created_at });
const SC = sampleComment;

// 휴양소별 샘플. 여기에 없는 휴양소는 아래 GENERIC 3건을 그 휴양소 이름으로 보여준다(예전 화면과 같은 동작)
const REVIEW_SEED = [
  {
    id: 's101', empno: '20817', authorName: '이OO', department: 'IST사업부', company: '(주)아이티센씨티에스',
    resortName: '속초(힐스)', resortType: 'regular', companions: ['가족'], tags: ['바다뷰', '깨끗해요'],
    content: '비 예보가 있어 걱정했는데 도착하니 날이 개서 다니기 좋았어요.\n\n첫날은 근처 바닷가 사찰을 둘러봤고, 저녁에는 숙소에서 걸어서 시장에 다녀왔어요. 포장해 온 간식을 숙소에서 먹으니 다들 만족했습니다.',
    ratings: S54, likes: 12,
    photos: [SAMPLE_PH.seawall, SAMPLE_PH.sunset, SAMPLE_PH.beach, SAMPLE_PH.farm, SAMPLE_PH.bread, SAMPLE_PH.cafe],
    comments: [
      SC(11, null, '20451', '김OO 선임', '낙산사 코스 좋네요! 다음 달에 가는데 그대로 따라가 볼게요 😊', sampleAgo(1, 3)),
      SC(12, 11, '20817', '이OO', '비 와도 운치 있어서 좋았어요. 즐거운 여행 되세요!', sampleAgo(1, 1)),
      SC(13, null, SAMPLE_ME, '관리자', '중앙시장이 걸어서 갈 거리군요. 메모해 갑니다.', sampleAgo(0, 5)),
    ],
    createdAt: sampleAgo(2),
  },
  {
    id: 's102', empno: '20451', authorName: '김OO', department: '클라우드사업팀', company: '주식회사 아이티센엔텍',
    resortName: '속초(힐스)', resortType: 'regular', companions: ['친구'], tags: ['바다뷰', '야경'],
    content: '친구들이랑 2박 했는데 거실 창으로 바다가 바로 보여서 다들 감탄했어요. 밤에는 엑스포타워 쪽까지 산책했는데 야경이 예쁘고 숙소에서 멀지 않아서 좋았습니다.',
    ratings: S54, likes: 8,
    photos: [SAMPLE_PH.sunset, SAMPLE_PH.seawall, SAMPLE_PH.cafe2],
    comments: [SC(21, null, '33102', '박OO 책임', '엑스포타워 야경 저도 강추합니다!', sampleAgo(3, 2))],
    createdAt: sampleAgo(5),
  },
  {
    id: 's103', empno: '33102', authorName: '박OO', department: '플랫폼개발팀', company: '아이티센엔텍',
    resortName: '속초(힐스)', resortType: 'regular', companions: [], tags: ['가성비', '주차편해요'],
    content: '주차 공간이 넉넉해서 차 가져가기 편했습니다. 시설은 조금 연식이 느껴지지만 가격 생각하면 충분히 만족스러워요.',
    ratings: S44, likes: 3, photos: [], comments: [],
    createdAt: sampleAgo(13),
  },
  {
    id: 's104', empno: SAMPLE_ME, authorName: '관리자', department: '전략기획팀', company: '아이티센엔텍',
    resortName: '속초(힐스)', resortType: 'regular', companions: ['가족'], tags: ['깨끗해요', '조용해요'],
    content: '아이들과 함께 다녀왔어요. 객실이 깔끔하고 조용해서 푹 쉬다 왔습니다. 근처 빵집이 맛있어서 아침은 빵으로 해결했어요.',
    ratings: S54, likes: 5,
    photos: [SAMPLE_PH.bread, SAMPLE_PH.cafe],
    comments: [
      SC(41, null, '40876', '최OO 수석', '빵집 이름 알려주실 수 있나요?', sampleAgo(18)),
      SC(42, 41, SAMPLE_ME, '관리자', '중앙시장 입구 쪽 빵집이에요! 오전에 가면 종류가 많아요.', sampleAgo(17, 20)),
    ],
    createdAt: sampleAgo(20),
  },
  {
    id: 's105', empno: '40876', authorName: '최OO', department: '경영지원팀', company: '(주)씨플랫폼',
    resortName: '속초(힐스)', resortType: 'regular', companions: ['부부'], tags: ['바다뷰', '친절해요'],
    content: '남편이랑 둘이 조용히 쉬려고 갔는데 일출이 정말 예뻤어요. 새벽 다섯 시 반쯤 창가에 앉아서 해 뜨는 걸 봤는데 이것만으로도 다시 오고 싶을 정도였습니다.\n관리실 직원분도 주변 맛집을 친절하게 알려주셔서 마지막 날까지 알차게 보냈어요.',
    ratings: S54, likes: 15,
    photos: [SAMPLE_PH.beach, SAMPLE_PH.sunset, SAMPLE_PH.seawall, SAMPLE_PH.farm],
    comments: [SC(51, null, '51234', '정OO 사원', '일출 사진 너무 예뻐요 👍', sampleAgo(30))],
    createdAt: sampleAgo(34),
  },
  {
    id: 's106', empno: '51234', authorName: '정OO', department: '국세서비스팀', company: '아이티센엔텍',
    resortName: '속초(힐스)', resortType: 'regular', companions: ['아이와'], tags: ['깨끗해요', '시설최고'],
    content: '아이랑 근처 체험목장에 다녀왔는데 아이가 제일 좋아했어요. 숙소는 침구가 깨끗하고 주방 도구도 잘 갖춰져 있어서 간단히 해 먹기 좋았습니다.',
    ratings: S54, likes: 6,
    photos: [SAMPLE_PH.farm, SAMPLE_PH.fish],
    comments: [],
    createdAt: sampleAgo(48),
  },
  {
    id: 's107', empno: '61021', authorName: '한OO', department: 'MES팀', company: '아이티센코어 주식회사',
    resortName: '속초(힐스)', resortType: 'regular', companions: [], tags: ['가성비'],
    content: '위치는 정말 좋은데 세탁기가 한 대뿐이라 사람이 몰리면 기다려야 해요. 그래도 가성비는 최고입니다.',
    ratings: S44, likes: 2, photos: [], comments: [],
    createdAt: sampleAgo(61),
  },
  {
    id: 's108', empno: '61344', authorName: '송OO', department: '보안솔루션팀', company: '식회사 아이티센클로잇',
    resortName: '속초(힐스)', resortType: 'regular', companions: ['친구'], tags: ['야경', '바다뷰'],
    content: '대포항까지 차로 10분 정도라 회 먹으러 다녀오기 좋았어요. 밤바다 보면서 산책하기도 좋습니다.',
    ratings: S54, likes: 4, photos: [SAMPLE_PH.seawall], comments: [],
    createdAt: sampleAgo(75),
  },
  {
    id: 's109', empno: '61502', authorName: '임OO', department: '공공사업1팀', company: '아이티센엔텍',
    resortName: '속초(힐스)', resortType: 'regular', companions: ['가족'], tags: ['깨끗해요', '친절해요', '주차편해요'],
    content: '부모님 모시고 다녀왔습니다. 엘리베이터가 있어서 짐 옮기기 편했고, 객실도 깨끗하게 관리되고 있었어요.',
    ratings: S54, likes: 9,
    photos: [SAMPLE_PH.fish, SAMPLE_PH.bread, SAMPLE_PH.cafe2],
    comments: [SC(91, null, '20451', '김OO 선임', '부모님 모시고 가기 좋다니 참고할게요!', sampleAgo(90))],
    createdAt: sampleAgo(92),
  },
  {
    id: 's110', empno: '61733', authorName: '문OO', department: '인사복지팀', company: '아이티센엔텍',
    resortName: '속초(힐스)', resortType: 'regular', companions: ['동료'], tags: ['가성비', '조용해요'],
    content: '팀 동료들과 워크숍 겸 다녀왔어요. 거실이 넓어서 다 같이 모여 이야기하기 좋았습니다.',
    ratings: S54, likes: 1, photos: [SAMPLE_PH.cafe2], comments: [],
    createdAt: sampleAgo(120),
  },
];

// 예전 index.html 의 정적 샘플 3건 (#sample-reviews). 자기 샘플이 없는 휴양소는 이걸 보여준다.
// resortName 은 비워 두고, 보여줄 때 그 휴양소 이름을 넣는다.
const REVIEW_SEED_GENERIC = [
  {
    id: 'g1', empno: '30001', authorName: '박OO 책임', department: '플랫폼개발팀', company: '아이티센엔텍',
    resortType: 'regular', companions: [], tags: ['바다뷰', '깨끗해요'],
    content: '👍 좋았던 점\n바다 뷰가 정말 환상이에요. 거실이 넓어서 4명이 편하게 쉬었고, 주방 도구도 잘 구비되어 있습니다.\n\n⚠️ 아쉬웠던 점\n마트가 차로 10분 거리예요. 미리 장 봐가시는 거 추천드립니다.',
    ratings: { location: 4.7, facility: 5, clean: 4.8, avg: 4.8 }, likes: 24,
    photos: ['assets/images/reviews/rv4c.jpg', 'assets/images/reviews/rv5b.jpg', 'assets/images/reviews/rv1b.jpg', 'assets/images/reviews/rv3a.jpg'],
    comments: [
      SC(1, null, '30002', '김OO 선임', '저도 다음주에 가요! 정보 감사해요 😊', '2025-05-11T01:00:00.000Z'),
      SC(2, null, '30003', '이OO 책임', '마트 정보 진짜 도움됐어요. 미리 장 봐서 갈게요!', '2025-05-11T03:00:00.000Z'),
    ],
    createdAt: '2025-05-10T01:00:00.000Z',
  },
  {
    id: 'g2', empno: '30002', authorName: '김OO 선임', department: '클라우드사업팀', company: '아이티센엔텍',
    resortType: 'regular', companions: [], tags: ['조용해요'],
    content: '👍 좋았던 점\n조용하고 한적해서 힐링하기 좋아요. 일출 명소가 가까워서 새벽에 다녀왔는데 정말 좋았습니다.\n\n⚠️ 아쉬웠던 점\n샤워 수압이 약간 약한 편이에요.',
    ratings: { location: 4.5, facility: 4.4, clean: 4.6, avg: 4.5 }, likes: 9, photos: [], comments: [],
    createdAt: '2025-04-22T01:00:00.000Z',
  },
  {
    id: 'g3', empno: '30003', authorName: '이OO 선임', department: '경영지원팀', company: '아이티센엔텍',
    resortType: 'regular', companions: [], tags: ['시설최고'],
    content: '👍 좋았던 점\n시설은 정말 좋고 바베큐 시설도 잘 갖춰져 있어요.\n\n⚠️ 아쉬웠던 점\n주차가 좀 협소합니다. 미리 가시는 거 추천드려요.',
    ratings: { location: 4, facility: 4.6, clean: 4.1, avg: 4.2 }, likes: 18, photos: [],
    comments: [SC(3, null, '30001', '박OO 책임', '주차 정보 감사합니다 👍 평일에 가야겠네요', '2025-05-01T01:00:00.000Z')],
    createdAt: '2025-04-30T01:00:00.000Z',
  },
];
