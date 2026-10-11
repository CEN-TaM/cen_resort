// 휴양소 상세 데이터
// type: 'regular'(정규) | 'summer'(하계 이벤트) | 'winter'(동계 이벤트)
// ext: 상세 '휴양소 정보' 3줄과 편의시설 팝업에 쓰는 값 (없으면 그 줄을 숨긴다)
//   id       고유키
//   address  주소 (없으면 loc 를 보여준다)
//   roomType, capacity  객실 · 정원
//   features 분류별 편의시설 { 환경, 숙소 유형, 편의시설, 주변 활동 }
function R(name, loc, type, rating, reviews, img, ext) {
  return Object.assign({ name, loc, type, rating, reviews, img }, ext || {});
}
const _sokchoHills = R('속초(힐스)', '강원 속초시', 'regular', 4.8, 32, 'sokcho', {
  id: 'sokcho-hills',
  address: '강원특별자치도 속초시 OO로 00, 힐스 OOO호',   // 더미 — 실제 주소 데이터 연동 필요
  roomType: '4인실',
  capacity: 4,
  features: {
    '환경': ['바다', '산'],
    '숙소 유형': ['호텔형'],
    '편의시설': ['와이파이', '주방', '바베큐', '주차', '세탁기', '에어컨', 'TV'],
    '주변 활동': ['해수욕', '트레킹', '일출', '전통시장'],
  },
});
const _sokchoSeohee = R('속초(서희)', '강원 속초시', 'regular', 4.6, 17, 'sokcho');
const _jocheon = R('조천 휴양소', '제주 제주시 조천읍', 'regular', 4.8, 24, 'jocheon');
const _yeosu = R('여수휴양소', '전남 여수시', 'regular', 4.6, 19, 'yeosu');
const _gwa1001 = R('과천휴양소(1001호)', '경기 과천시', 'regular', 4.5, 12, 'gwacheon');
const _aewol1 = R('애월 1호점', '제주 제주시 애월읍', 'regular', 4.7, 28, 'aewol');

const RESORT = {
  // 정기 휴양소 12곳
  '부산휴양소(해운대)': R('부산휴양소(해운대)', '부산 해운대구', 'regular', 4.7, 21, 'yeosu'),
  '부산휴양소(기장)': R('부산휴양소(기장)', '부산 기장군', 'regular', 4.5, 14, 'aewol'),
  '속초(힐스)': _sokchoHills,
  '속초(서희)': _sokchoSeohee,
  // 옛 표기 — 예전에 저장된 후기·즐겨찾기가 이 이름을 쓰고 있어 함께 받아준다
  '속초(힐스) 휴양소': _sokchoHills,
  '속초 (힐스)': _sokchoHills,
  '속초(서희) 휴양소': _sokchoSeohee,
  '경주휴양소': R('경주휴양소', '경북 경주시', 'regular', 4.5, 11, 'gwacheon'),
  '조천 휴양소': _jocheon,
  '조천': _jocheon,
  '애월 1호점': _aewol1,
  '애월 2호점': R('애월 2호점', '제주 제주시 애월읍', 'regular', 4.9, 22, 'aewol'),
  '보령 휴양소': R('보령 휴양소', '충남 보령시', 'regular', 4.4, 9, 'yeosu'),
  '여수휴양소': _yeosu,
  '여수': _yeosu,
  '여수 휴양소': _yeosu,
  '과천휴양소(1001호)': _gwa1001,
  '과천 1001호': _gwa1001,
  '과천휴양소(504호)': R('과천휴양소(504호)', '경기 과천시', 'regular', 4.4, 8, 'gwacheon'),
  // 이벤트(하계) 8곳
  '제주(서귀포)': R('제주(서귀포)', '제주 서귀포시', 'summer', 4.8, 15, 'jocheon'),
  '부산(송도)': R('부산(송도)', '부산 서구', 'summer', 4.6, 12, 'aewol'),
  '여수(금오도)': R('여수(금오도)', '전남 여수시', 'summer', 4.7, 10, 'yeosu'),
  '인천(영흥도)': R('인천(영흥도)', '인천 옹진군', 'summer', 4.5, 8, 'aewol'),
  '인천(강화)': R('인천(강화)', '인천 강화군', 'summer', 4.4, 7, 'yeosu'),
  '경기(포천)': R('경기(포천)', '경기 포천시', 'summer', 4.6, 9, 'sokcho'),
  '경기(가평)': R('경기(가평)', '경기 가평군', 'summer', 4.5, 11, 'sokcho'),
  '충남(태안)': R('충남(태안)', '충남 태안군', 'summer', 4.7, 13, 'yeosu'),
  // 이벤트(동계) 6곳
  '무주': R('무주', '전북 무주군', 'winter', 4.7, 14, 'win-1'),
  '고성': R('고성', '강원 고성군', 'winter', 4.6, 9, 'win-2'),
  '평창': R('평창', '강원 평창군', 'winter', 4.8, 16, 'win-1'),
  '가평': R('가평', '경기 가평군', 'winter', 4.5, 10, 'win-2'),
  '홍천': R('홍천', '강원 홍천군', 'winter', 4.6, 8, 'win-1'),
  '충남': R('충남', '충남', 'winter', 4.4, 6, 'win-2')
};

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
};
const FEATURE_ORDER = ['환경', '숙소 유형', '편의시설', '주변 활동'];
