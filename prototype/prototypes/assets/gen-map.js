// 실제 행정구역(시도) 경계 GeoJSON → 단순화 → 등거리 투영 → SVG 경로 + 마커 좌표 생성
// 지도와 마커가 동일 투영을 쓰므로 항상 정확히 정렬된다.
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const ROOT = path.join(DIR, '..');
const geo = JSON.parse(fs.readFileSync(path.join(DIR, '_skorea-provinces.json'), 'utf8'));

// ---- 마커: 실제 위경도 (lat, lng) ----
const MARKERS = [
  { type:'basic',  label:'속초', lat:38.207, lng:128.591, places:['속초(힐스) 휴양소','속초(서희) 휴양소'] },
  { type:'basic',  label:'과천', lat:37.429, lng:126.989, places:['과천휴양소(1001호)','과천휴양소(504호)'] },
  { type:'basic',  label:'보령', lat:36.333, lng:126.613, places:['보령 휴양소'] },
  { type:'basic',  label:'여수', lat:34.760, lng:127.662, places:['여수휴양소'] },
  { type:'basic',  label:'부산', lat:35.180, lng:129.075, places:['부산휴양소'] },
  { type:'basic',  label:'제주', lat:33.500, lng:126.530, places:['조천 휴양소','애월 1호점','애월 2호점'] },
  { type:'winter', label:'고성', lat:38.380, lng:128.468, places:['고성 동계 휴양소'] },
  { type:'winter', label:'홍천', lat:37.697, lng:127.889, places:['홍천 동계 휴양소'] },
  { type:'winter', label:'평창', lat:37.370, lng:128.390, places:['평창 동계 휴양소'] },
  { type:'winter', label:'가평', lat:37.831, lng:127.510, places:['가평 동계 휴양소'] },
  { type:'winter', label:'무주', lat:36.007, lng:127.661, places:['무주 동계 휴양소'] },
  { type:'winter', label:'충남', lat:36.601, lng:126.661, places:['충남 동계 휴양소'] },
  { type:'summer', label:'강화',   lat:37.747, lng:126.488, places:['인천(강화) 하계 휴양소'] },
  { type:'summer', label:'영흥도', lat:37.246, lng:126.489, places:['인천(영흥도) 하계 휴양소'] },
  { type:'summer', label:'포천',   lat:37.895, lng:127.200, places:['경기(포천) 하계 휴양소'] },
  { type:'summer', label:'태안',   lat:36.745, lng:126.298, places:['충남(태안) 하계 휴양소'] },
  { type:'summer', label:'금오도', lat:34.550, lng:127.780, places:['여수(금오도) 하계 휴양소'] },
  { type:'summer', label:'해운대', lat:35.163, lng:129.163, places:['부산(해운대) 하계 휴양소'] },
  { type:'summer', label:'송도',   lat:35.077, lng:129.018, places:['부산(송도) 하계 휴양소'] },
  { type:'summer', label:'월정리', lat:33.556, lng:126.794, places:['제주(월정리) 하계 휴양소'] },
  { type:'summer', label:'서귀포', lat:33.253, lng:126.560, places:['제주(서귀포) 하계 휴양소'] },
];

// ---- Douglas-Peucker 단순화 (경위도 평면 기준) ----
function perpDist(p, a, b){
  const dx=b[0]-a[0], dy=b[1]-a[1];
  const len2=dx*dx+dy*dy;
  if(len2===0) return Math.hypot(p[0]-a[0], p[1]-a[1]);
  let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy));
}
function dp(points, eps){
  if(points.length<3) return points;
  let dmax=0, idx=0;
  for(let i=1;i<points.length-1;i++){
    const d=perpDist(points[i], points[0], points[points.length-1]);
    if(d>dmax){dmax=d; idx=i;}
  }
  if(dmax>eps){
    const l=dp(points.slice(0,idx+1), eps);
    const r=dp(points.slice(idx), eps);
    return l.slice(0,-1).concat(r);
  }
  return [points[0], points[points.length-1]];
}
// 링 면적(shoelace, 경위도) — 작은 섬 제거용
function ringArea(ring){
  let a=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) a+=(ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1]);
  return Math.abs(a/2);
}

const EPS = 0.012;          // 단순화 강도(도). 클수록 단순
const MIN_ISLAND_AREA = 0.0015; // 이보다 작은 섬은 제거
// 본토+제주 중심으로 보기 위해 먼 섬(울릉도·독도·백령도 등) 제거하는 경위도 창
const WIN = { lngMin:125.7, lngMax:129.8, latMin:33.0, latMax:38.8 };
function ringCentroid(ring){
  let x=0,y=0; for(const c of ring){x+=c[0];y+=c[1];} return [x/ring.length, y/ring.length];
}

// feature → 단순화된 polygon ring 모음 수집
const provinces = []; // { name, rings:[ [ [lng,lat],... ], ... ] }
for(const f of geo.features){
  const name = (f.properties && (f.properties.name || f.properties.name_eng)) || '';
  const g = f.geometry; if(!g) continue;
  const polys = g.type==='Polygon' ? [g.coordinates] : g.type==='MultiPolygon' ? g.coordinates : [];
  const rings=[];
  for(const poly of polys){
    const outer = poly[0]; // 외곽 링만 사용(구멍 무시)
    if(!outer) continue;
    if(ringArea(outer) < MIN_ISLAND_AREA) continue; // 작은 섬 제거
    const ct = ringCentroid(outer);                 // 먼 섬 제거(본토+제주 창 밖)
    if(ct[0]<WIN.lngMin||ct[0]>WIN.lngMax||ct[1]<WIN.latMin||ct[1]>WIN.latMax) continue;
    const simp = dp(outer, EPS);
    if(simp.length>=4) rings.push(simp);
  }
  if(rings.length) provinces.push({ name, rings });
}

// ---- 투영 경계 계산 ----
let lngMin=Infinity,lngMax=-Infinity,latMin=Infinity,latMax=-Infinity;
for(const p of provinces) for(const r of p.rings) for(const c of r){
  if(c[0]<lngMin)lngMin=c[0]; if(c[0]>lngMax)lngMax=c[0];
  if(c[1]<latMin)latMin=c[1]; if(c[1]>latMax)latMax=c[1];
}
const PAD=10, TARGET_H=300;
const midLat=(latMin+latMax)/2;
const kx=Math.cos(midLat*Math.PI/180);       // 경도 거리 보정
const S=TARGET_H/(latMax-latMin);             // 위도 1도 당 픽셀
const W=(lngMax-lngMin)*kx*S;
const VBW=Math.round(W+PAD*2), VBH=Math.round(TARGET_H+PAD*2);
function px(lng){ return +(PAD+(lng-lngMin)*kx*S).toFixed(1); }
function py(lat){ return +(PAD+(latMax-lat)*S).toFixed(1); }

// ---- SVG province paths ----
const paths = provinces.map(p=>{
  const d = p.rings.map(r=> 'M'+r.map(c=> px(c[0])+' '+py(c[1])).join(' L')+'Z').join(' ');
  return `                <path class="map-land" d="${d}"/>`;
}).join('\n');

const svg =
`<svg class="korea-map" viewBox="0 0 ${VBW} ${VBH}" aria-label="전국 휴양소 지도" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="landGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#eef4ff"/>
                    <stop offset="1" stop-color="#dbe9fc"/>
                  </linearGradient>
                </defs>
                <!-- 실제 대한민국 시도 경계 (KOSTAT 2018, 등거리 투영) -->
                <g class="map-land-group">
${paths}
                </g>
                <text class="map-sea-label" x="${VBW-20}" y="${Math.round(VBH*0.42)}" text-anchor="middle">동해</text>
                <!-- 마커는 renderSeniMap()이 채웁니다 -->
                <g id="seni-markers"></g>
              </svg>`;

// ---- 마커 좌표 투영 ----
const markersJs = MARKERS.map(m=>{
  const mx=px(m.lng), my=py(m.lat);
  const places = JSON.stringify(m.places).replace(/"/g,"'");
  return `    { type:'${m.type}', label:'${m.label}', mx:${mx}, my:${my}, places:${places} },`;
}).join('\n');
const markersBlock = `const SENI_MARKERS = [\n${markersJs}\n  ];`;

// ---- index.html 주입 ----
const idxPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(idxPath, 'utf8');

const svgRe = /<svg class="korea-map"[\s\S]*?<\/svg>/;
if(!svgRe.test(html)) throw new Error('korea-map svg block not found');
html = html.replace(svgRe, svg);

const mkRe = /const SENI_MARKERS = \[[\s\S]*?\];/;
if(!mkRe.test(html)) throw new Error('SENI_MARKERS block not found');
html = html.replace(mkRe, markersBlock);

fs.writeFileSync(idxPath, html, 'utf8');

console.log('provinces:', provinces.length, provinces.map(p=>p.name).join(', '));
console.log('bounds lng', lngMin.toFixed(2), lngMax.toFixed(2), 'lat', latMin.toFixed(2), latMax.toFixed(2));
console.log('viewBox', VBW, VBH, 'paths bytes', paths.length);
console.log('sample markers 속초/부산/서귀포:',
  JSON.stringify({속초:[px(128.591),py(38.207)], 부산:[px(129.075),py(35.180)], 서귀포:[px(126.560),py(33.253)]}));
