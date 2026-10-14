// 전국 휴양소 지도 마커
// 휴양소 데이터(resorts 테이블의 map_label · map_x · map_y)로 resort-data.js 의 buildMapMarkers() 가 채운다.
// 한 항목: { type: 'basic'|'summer'|'winter'|'both', label, mx, my, places: [휴양소 이름...] }
//   mx/my 는 실제 위경도를 지도 SVG(viewBox 200x280)로 투영한 좌표
const SENI_MARKERS = [];
