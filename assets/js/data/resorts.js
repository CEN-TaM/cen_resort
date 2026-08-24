// 휴양소 상세 데이터
// type: 'regular'(정규) | 'summer'(하계 이벤트) | 'winter'(동계 이벤트)
function R(name, loc, type, rating, reviews, img) {
  return { name, loc, type, rating, reviews, img };
}
const _sokchoHills = R('속초(힐스) 휴양소', '강원 속초시', 'regular', 4.8, 32, 'sokcho');
const _jocheon = R('조천 휴양소', '제주 제주시 조천읍', 'regular', 4.8, 24, 'jocheon');
const _yeosu = R('여수휴양소', '전남 여수시', 'regular', 4.6, 19, 'yeosu');
const _gwa1001 = R('과천휴양소(1001호)', '경기 과천시', 'regular', 4.5, 12, 'gwacheon');
const _aewol1 = R('애월 1호점', '제주 제주시 애월읍', 'regular', 4.7, 28, 'aewol');

const RESORT = {
  // 정기 휴양소 12곳
  '부산휴양소(해운대)': R('부산휴양소(해운대)', '부산 해운대구', 'regular', 4.7, 21, 'yeosu'),
  '부산휴양소(기장)': R('부산휴양소(기장)', '부산 기장군', 'regular', 4.5, 14, 'aewol'),
  '속초(힐스) 휴양소': _sokchoHills,
  '속초 (힐스)': _sokchoHills,
  '속초(서희) 휴양소': R('속초(서희) 휴양소', '강원 속초시', 'regular', 4.6, 17, 'sokcho'),
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
