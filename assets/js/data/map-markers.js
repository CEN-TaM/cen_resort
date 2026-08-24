// 전국 휴양소 지도 마커 좌표 데이터
// 휴양소 위치 데이터 — mx/my 는 실제 위경도를 지도 SVG(viewBox 200x280)로 투영한 좌표
const SENI_MARKERS = [
  // 정기 휴양소 (12곳)
  { type: 'basic', label: '속초', mx: 131, my: 32.5, places: ['속초(힐스) 휴양소', '속초(서희) 휴양소'] },
  { type: 'basic', label: '과천', mx: 59.1, my: 75.6, places: ['과천휴양소(1001호)', '과천휴양소(504호)'] },
  { type: 'basic', label: '보령', mx: 42.3, my: 136.2, places: ['보령 휴양소'] },
  { type: 'basic', label: '여수', mx: 89.3, my: 223.3, places: ['여수휴양소'] },
  { type: 'basic', label: '부산', mx: 152.7, my: 200.1, places: ['부산휴양소(해운대)', '부산휴양소(기장)'] },
  { type: 'basic', label: '경주', mx: 140, my: 178, places: ['경주휴양소'] },
  { type: 'basic', label: '제주', mx: 38.6, my: 293.1, places: ['조천 휴양소', '애월 1호점', '애월 2호점'] },
  // 동계 이벤트 휴양소 (6곳)
  { type: 'winter', label: '고성', mx: 125.5, my: 22.9, places: ['고성 동계 휴양소'] },
  { type: 'winter', label: '홍천', mx: 99.5, my: 60.7, places: ['홍천 동계 휴양소'] },
  { type: 'winter', label: '평창', mx: 122, my: 78.8, places: ['평창 동계 휴양소'] },
  { type: 'both', label: '가평', mx: 84, my: 52, places: ['경기(가평) 하계 휴양소', '가평 동계 휴양소'] },
  { type: 'winter', label: '무주', mx: 89.3, my: 154.3, places: ['무주 동계 휴양소'] },
  { type: 'winter', label: '충남', mx: 44.4, my: 121.4, places: ['충남 동계 휴양소'] },
  // 하계 이벤트 휴양소 (8곳)
  { type: 'summer', label: '강화', mx: 36.7, my: 58, places: ['인천(강화) 하계 휴양소'] },
  { type: 'summer', label: '영흥도', mx: 36.7, my: 85.7, places: ['인천(영흥도) 하계 휴양소'] },
  { type: 'summer', label: '포천', mx: 64, my: 50, places: ['경기(포천) 하계 휴양소'] },
  { type: 'summer', label: '태안', mx: 28.2, my: 113.4, places: ['충남(태안) 하계 휴양소'] },
  { type: 'summer', label: '금오도', mx: 94.6, my: 234.9, places: ['여수(금오도) 하계 휴양소'] },
  { type: 'summer', label: '송도', mx: 150.1, my: 205.8, places: ['부산(송도) 하계 휴양소'] },
  { type: 'summer', label: '서귀포', mx: 39.9, my: 306.7, places: ['제주(서귀포) 하계 휴양소'] },
];
