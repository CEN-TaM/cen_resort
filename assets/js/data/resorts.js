// 휴양소 기본 데이터 (시드)
//
// 휴양소의 진짜 원본은 서버 DB 의 resorts 테이블이다. 이 파일은 두 곳에서만 쓴다.
//   1) 서버가 처음 켜져 resorts 테이블이 비어 있을 때 채우는 초기값 (server/db.js)
//   2) 서버 없이 열었을 때(GitHub Pages · 서버 꺼짐) 화면이 대신 쓰는 값 (assets/js/resort-data.js)
// 서버가 한 번 켜진 뒤에는 이 파일을 고쳐도 서버 DB 에는 반영되지 않는다. 휴양소 추가·수정은 DB 에서 한다.
//
// 한 줄 = 휴양소 하나. 목록 · 검색 · 지도 · 상세 · 후기 작성 선택지가 모두 이 데이터로 그려진다.
//   id        고유키 (영문, 바꾸지 않는다)
//   name      정식 이름. 후기는 이 이름으로 저장된다
//   type      'regular'(정기) | 'summer'(하계 이벤트) | 'winter'(동계 이벤트)
//   loc       짧은 지역 표기 · address 주소(없으면 loc 를 보여준다)
//   img       사진 키 (data/images.js 의 IMG)
//   roomType, capacity  객실 · 정원 (상세 '휴양소 정보')
//   features  분류별 편의시설 { 환경, 숙소 유형, 편의시설, 주변 활동 }
//   aliases   옛 표기 — 예전에 저장된 후기·즐겨찾기가 쓰는 이름도 같은 휴양소로 받는다
//   map       지도 마커 { label, x, y } — 같은 label 끼리 한 마커로 묶인다. x/y 는 지도 SVG(200x280) 좌표
//   sort      목록 순서 (작을수록 위)
// 평점 · 후기 수는 여기 두지 않는다. 서버가 후기 테이블에서 실제로 계산한다.
const RESORT_SEED = [
  // 정기 휴양소 12곳
  { id: 'busan-haeundae', name: '부산휴양소(해운대)', type: 'regular', loc: '부산 해운대구', img: 'yeosu', map: { label: '부산', x: 152.7, y: 200.1 }, sort: 10 },
  { id: 'busan-gijang', name: '부산휴양소(기장)', type: 'regular', loc: '부산 기장군', img: 'aewol', map: { label: '부산', x: 152.7, y: 200.1 }, sort: 20 },
  {
    id: 'sokcho-hills', name: '속초(힐스)', type: 'regular', loc: '강원 속초시', img: 'sokcho',
    roomType: '4인실', capacity: 4,
    features: {
      '환경': ['바다', '산'],
      '숙소 유형': ['호텔형'],
      '편의시설': ['와이파이', '주방', '바베큐', '주차', '세탁기', '에어컨', 'TV'],
      '주변 활동': ['해수욕', '트레킹', '일출', '전통시장'],
    },
    aliases: ['속초(힐스) 휴양소', '속초 (힐스)'],
    map: { label: '속초', x: 131, y: 32.5 }, sort: 30,
  },
  { id: 'sokcho-seohee', name: '속초(서희)', type: 'regular', loc: '강원 속초시', img: 'sokcho', aliases: ['속초(서희) 휴양소'], map: { label: '속초', x: 131, y: 32.5 }, sort: 40 },
  { id: 'gyeongju', name: '경주휴양소', type: 'regular', loc: '경북 경주시', img: 'gwacheon', map: { label: '경주', x: 140, y: 178 }, sort: 50 },
  { id: 'jocheon', name: '조천 휴양소', type: 'regular', loc: '제주 제주시 조천읍', img: 'jocheon', aliases: ['조천'], map: { label: '제주', x: 38.6, y: 293.1 }, sort: 60 },
  { id: 'aewol-1', name: '애월 1호점', type: 'regular', loc: '제주 제주시 애월읍', img: 'aewol', map: { label: '제주', x: 38.6, y: 293.1 }, sort: 70 },
  { id: 'aewol-2', name: '애월 2호점', type: 'regular', loc: '제주 제주시 애월읍', img: 'aewol', map: { label: '제주', x: 38.6, y: 293.1 }, sort: 80 },
  { id: 'boryeong', name: '보령 휴양소', type: 'regular', loc: '충남 보령시', img: 'yeosu', map: { label: '보령', x: 42.3, y: 136.2 }, sort: 90 },
  { id: 'yeosu', name: '여수휴양소', type: 'regular', loc: '전남 여수시', img: 'yeosu', aliases: ['여수', '여수 휴양소'], map: { label: '여수', x: 89.3, y: 223.3 }, sort: 100 },
  { id: 'gwacheon-1001', name: '과천휴양소(1001호)', type: 'regular', loc: '경기 과천시', img: 'gwacheon', aliases: ['과천 1001호'], map: { label: '과천', x: 59.1, y: 75.6 }, sort: 110 },
  { id: 'gwacheon-504', name: '과천휴양소(504호)', type: 'regular', loc: '경기 과천시', img: 'gwacheon', map: { label: '과천', x: 59.1, y: 75.6 }, sort: 120 },

  // 이벤트(하계) 8곳
  { id: 'summer-seogwipo', name: '제주(서귀포)', type: 'summer', loc: '제주 서귀포시', img: 'jocheon', map: { label: '서귀포', x: 39.9, y: 306.7 }, sort: 210 },
  { id: 'summer-songdo', name: '부산(송도)', type: 'summer', loc: '부산 서구', img: 'aewol', map: { label: '송도', x: 150.1, y: 205.8 }, sort: 220 },
  { id: 'summer-geumodo', name: '여수(금오도)', type: 'summer', loc: '전남 여수시', img: 'yeosu', map: { label: '금오도', x: 94.6, y: 234.9 }, sort: 230 },
  { id: 'summer-yeongheung', name: '인천(영흥도)', type: 'summer', loc: '인천 옹진군', img: 'aewol', map: { label: '영흥도', x: 36.7, y: 85.7 }, sort: 240 },
  { id: 'summer-ganghwa', name: '인천(강화)', type: 'summer', loc: '인천 강화군', img: 'yeosu', map: { label: '강화', x: 36.7, y: 58 }, sort: 250 },
  { id: 'summer-pocheon', name: '경기(포천)', type: 'summer', loc: '경기 포천시', img: 'sokcho', map: { label: '포천', x: 64, y: 50 }, sort: 260 },
  { id: 'summer-gapyeong', name: '경기(가평)', type: 'summer', loc: '경기 가평군', img: 'sokcho', map: { label: '가평', x: 84, y: 52 }, sort: 270 },
  { id: 'summer-taean', name: '충남(태안)', type: 'summer', loc: '충남 태안군', img: 'yeosu', map: { label: '태안', x: 28.2, y: 113.4 }, sort: 280 },

  // 이벤트(동계) 6곳
  { id: 'winter-muju', name: '무주', type: 'winter', loc: '전북 무주군', img: 'win-1', map: { label: '무주', x: 89.3, y: 154.3 }, sort: 310 },
  { id: 'winter-goseong', name: '고성', type: 'winter', loc: '강원 고성군', img: 'win-2', map: { label: '고성', x: 125.5, y: 22.9 }, sort: 320 },
  { id: 'winter-pyeongchang', name: '평창', type: 'winter', loc: '강원 평창군', img: 'win-1', map: { label: '평창', x: 122, y: 78.8 }, sort: 330 },
  { id: 'winter-gapyeong', name: '가평', type: 'winter', loc: '경기 가평군', img: 'win-2', map: { label: '가평', x: 84, y: 52 }, sort: 340 },
  { id: 'winter-hongcheon', name: '홍천', type: 'winter', loc: '강원 홍천군', img: 'win-1', map: { label: '홍천', x: 99.5, y: 60.7 }, sort: 350 },
  { id: 'winter-chungnam', name: '충남', type: 'winter', loc: '충남', img: 'win-2', map: { label: '충남', x: 44.4, y: 121.4 }, sort: 360 },
];

// 이름(별칭 포함) → 휴양소. resort-data.js 의 ResortAPI.load() 가 서버(또는 시드) 데이터로 채운다
const RESORT = {};

// 이름(별칭 포함) → 정식 데이터. 후기 조회는 항상 r.name(정식명)으로 한다
function resolveResort(name) {
  return RESORT[String(name || '').trim()] || null;
}

// 편의시설 이름 → [Material 아이콘, 색 톤]. 전체보기 팝업(detail.js featureSectionsHtml)에서 쓴다
const FEATURE_META = {
  '바다': ['waves', 'sky'], '산': ['landscape', 'mint'], '숲': ['forest', 'mint'],
  '호텔형': ['apartment', 'lilac'], '독채': ['villa', 'lilac'],
  '와이파이': ['wifi', 'sky'], '주방': ['soup_kitchen', 'peach'], '바베큐': ['outdoor_grill', 'coral'],
  '주차': ['local_parking', 'mint'], '세탁기': ['local_laundry_service', 'teal'],
  '에어컨': ['ac_unit', 'sky'], 'TV': ['tv', 'lilac'],
  '해수욕': ['pool', 'sky'], '트레킹': ['hiking', 'peach'], '일출': ['wb_sunny', 'cream'], '전통시장': ['storefront', 'pink'],
  // 회사 안내 PDF(이벤트 세부안내 · 이용 가이드)에서 넣은 이름들
  '강': ['water', 'sky'],
  '펜션': ['cottage', 'lilac'], '리조트': ['apartment', 'lilac'], '풀빌라': ['villa', 'lilac'],
  '한옥': ['house', 'lilac'], '레지던스': ['apartment', 'lilac'],
  '수영장': ['pool', 'sky'], '스파': ['hot_tub', 'peach'], '히노끼탕': ['hot_tub', 'peach'], '온천': ['hot_tub', 'peach'],
  '워터파크': ['pool', 'sky'], '캠핑장': ['camping', 'mint'], '불멍': ['local_fire_department', 'coral'],
  '렌터카': ['directions_car', 'teal'],
  '스키': ['downhill_skiing', 'sky'], '바다낚시': ['phishing', 'sky'], '해루질': ['set_meal', 'teal'],
};
const FEATURE_ORDER = ['환경', '숙소 유형', '편의시설', '주변 활동'];

// 서버(server/db.js)가 초기값을 읽어갈 수 있게 내보낸다. 브라우저에서는 module 이 없어 건너뛴다
if (typeof module !== 'undefined' && module.exports) module.exports = { RESORT_SEED };
