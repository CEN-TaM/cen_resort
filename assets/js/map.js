// 전국 휴양소 지도 렌더링 · 확대/이동 · 마커 선택
let seniMapZoom = 1;
let seniMapType = 'all';
const SVG_NS = 'http://www.w3.org/2000/svg';
const ZOOM_MIN = 1, ZOOM_MAX = 3;

// 가까운 마커끼리 묶는다(겹침 완화용 클러스터)
function buildClusters(T) {
  const n = SENI_MARKERS.length, parent = Array.from({ length: n }, (_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = SENI_MARKERS[i].mx - SENI_MARKERS[j].mx, dy = SENI_MARKERS[i].my - SENI_MARKERS[j].my;
    if (Math.hypot(dx, dy) < T) parent[find(i)] = find(j);
  }
  const groups = {};
  for (let i = 0; i < n; i++) { const r = find(i); (groups[r] = groups[r] || []).push(i); }
  return Object.values(groups);
}

// 각 마커의 표시 좌표 계산 — 가까운 것들은 부채꼴로 펼쳐 겹침을 줄인다
function computeMarkerLayout() {
  const pos = new Array(SENI_MARKERS.length);
  buildClusters(16).forEach(idxs => {
    if (idxs.length === 1) {
      const m = SENI_MARKERS[idxs[0]];
      pos[idxs[0]] = { x: m.mx, y: m.my, ox: 0, oy: -1, single: true };
      return;
    }
    const cx = idxs.reduce((s, i) => s + SENI_MARKERS[i].mx, 0) / idxs.length;
    const cy = idxs.reduce((s, i) => s + SENI_MARKERS[i].my, 0) / idxs.length;
    const R = 11 + (idxs.length - 2) * 3.5;
    idxs.forEach((i, k) => {
      const ang = -Math.PI / 2 + k * (2 * Math.PI / idxs.length);
      pos[i] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), ox: Math.cos(ang), oy: Math.sin(ang), single: false };
    });
  });
  return pos;
}

// 마커를 지도 SVG 좌표계에 그린다 (지도와 동일 좌표계라 항상 정확히 정렬)
function renderSeniMap() {
  const layer = document.getElementById('seni-markers');
  if (!layer) return;
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  const layout = computeMarkerLayout();

  // ----- 라벨 겹침 회피 -----
  const placed = [];                       // 이미 차지한 사각형 영역들
  // 모든 점(dot) 영역을 먼저 등록해 라벨이 점을 덮지 않게 한다
  layout.forEach(p => placed.push({ x1: p.x - 5, y1: p.y - 5, x2: p.x + 5, y2: p.y + 5 }));
  const LH = 10;                           // 라벨 높이(대략)
  const estW = t => {                      // 라벨 너비 추정
    let w = 0;
    for (const ch of t) w += /[가-힣]/.test(ch) ? 9.5 : (ch === ' ' ? 3 : 5.5);
    return w;
  };
  const hits = r => placed.some(q => r.x1 < q.x2 && r.x2 > q.x1 && r.y1 < q.y2 && r.y2 > q.y1);
  function labelCandidates(p, w) {
    const up = { anchor: 'middle', x: 0, y: -8, rect: { x1: p.x - w / 2, y1: p.y - 8 - LH, x2: p.x + w / 2, y2: p.y - 8 } };
    const down = { anchor: 'middle', x: 0, y: 13, rect: { x1: p.x - w / 2, y1: p.y + 13 - LH, x2: p.x + w / 2, y2: p.y + 13 } };
    const right = { anchor: 'start', x: 7, y: 3, rect: { x1: p.x + 7, y1: p.y + 3 - LH, x2: p.x + 7 + w, y2: p.y + 3 } };
    const left = { anchor: 'end', x: -7, y: 3, rect: { x1: p.x - 7 - w, y1: p.y + 3 - LH, x2: p.x - 7, y2: p.y + 3 } };
    if (p.single) return [up, down, right, left];
    const horiz = p.ox >= 0 ? right : left;
    const vert = p.oy >= 0 ? down : up;
    return [horiz, vert, up, down, right, left];
  }

  SENI_MARKERS.forEach((m, i) => {
    const p = layout[i];
    const g = document.createElementNS(SVG_NS, 'g');
    const vis = seniMapType === 'all' || m.type === seniMapType || (m.type === 'both' && (seniMapType === 'summer' || seniMapType === 'winter'));
    g.setAttribute('class', 'marker ' + m.type + (vis ? '' : ' hide'));
    g.dataset.type = m.type;
    g.dataset.idx = i;                    // 탭 판정 시 마커 식별용
    g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);

    // 투명 클릭 영역 — 라벨/핀 어디를 눌러도 클릭됨
    const hit = document.createElementNS(SVG_NS, 'rect');
    hit.setAttribute('x', '-18'); hit.setAttribute('y', '-19');
    hit.setAttribute('width', '36'); hit.setAttribute('height', '30');
    hit.setAttribute('fill', 'transparent');
    g.appendChild(hit);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'pin-dot');
    dot.setAttribute('r', '4.5');
    g.appendChild(dot);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'pin-label');
    label.textContent = (m.places.length > 1 && m.type !== 'both') ? `${m.label} ${m.places.length}` : m.label;

    // 빈 방향을 골라 라벨 배치(겹침 회피)
    const cands = labelCandidates(p, estW(label.textContent));
    let chosen = cands[0];
    for (const c of cands) { if (!hits(c.rect)) { chosen = c; break; } }
    placed.push(chosen.rect);
    label.setAttribute('text-anchor', chosen.anchor);
    label.setAttribute('x', String(chosen.x));
    label.setAttribute('y', String(chosen.y));
    g.appendChild(label);

    // 클릭 처리는 뷰포트 탭 판정(setupMapPan)에서 일괄 수행
    layer.appendChild(g);
  });
}

function seniFilterMap(type, btn) {
  seniMapType = type;
  document.querySelectorAll('#seni-map-filter .map-chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('#seni-map-canvas .marker').forEach(m => {
    const t = m.dataset.type;
    // 'both'(하계+동계 겸용) 마커는 하계/동계 필터 모두에서 표시
    const visible = type === 'all' || t === type || (t === 'both' && (type === 'summer' || type === 'winter'));
    m.classList.toggle('hide', !visible);
  });
}

// ===== 확대/이동(패닝) + 마커 탭 선택 =====
let panX = 0, panY = 0;
let downX = 0, downY = 0, startPanX = 0, startPanY = 0;
let moved = false, downMarker = null;

function applyMapTransform() {
  const canvas = document.getElementById('seni-map-canvas');
  if (canvas) canvas.style.transform = `translate(${panX}px,${panY}px) scale(${seniMapZoom})`;
  const vp = document.querySelector('.map-screen .map-viewport');
  if (vp) vp.classList.toggle('zoomed', seniMapZoom > 1);
}
function clampPan() {
  const vp = document.querySelector('.map-screen .map-viewport');
  if (!vp) return;
  const maxX = Math.max(0, (seniMapZoom - 1) * vp.clientWidth / 2);
  const maxY = Math.max(0, (seniMapZoom - 1) * vp.clientHeight / 2);
  panX = Math.min(maxX, Math.max(-maxX, panX));
  panY = Math.min(maxY, Math.max(-maxY, panY));
}
function seniZoomMap(delta) {
  seniMapZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +(seniMapZoom + delta).toFixed(2)));
  clampPan();
  applyMapTransform();
}
function setupMapPan() {
  const vp = document.querySelector('.map-screen .map-viewport');
  if (!vp || vp.dataset.panReady) return;
  vp.dataset.panReady = '1';
  vp.addEventListener('pointerdown', e => {
    moved = false;
    downX = e.clientX; downY = e.clientY;
    startPanX = panX; startPanY = panY;
    // 누른 대상이 마커면 기억(탭이면 선택). 캡처는 아직 걸지 않음 → click 가로채기 방지
    downMarker = e.target.closest ? e.target.closest('.marker') : null;
  });
  vp.addEventListener('pointermove', e => {
    if (downX === null) return;
    const dx = e.clientX - downX, dy = e.clientY - downY;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 4) {
      moved = true;                        // 실제 이동 시작 — 이때만 드래그 모드로 전환
      if (seniMapZoom > 1) { try { vp.setPointerCapture(e.pointerId); } catch (_) { } vp.classList.add('grabbing'); }
    }
    if (moved && seniMapZoom > 1) {
      panX = startPanX + dx; panY = startPanY + dy;
      clampPan(); applyMapTransform();
    }
  });
  const finish = e => {
    vp.classList.remove('grabbing');
    if (!moved && downMarker) {            // 움직이지 않은 누름 = 탭 → 마커 선택
      const m = SENI_MARKERS[+downMarker.dataset.idx];
      if (m) openMapPlace(m.label, m.places);
    }
    downMarker = null; downX = null;
  };
  vp.addEventListener('pointerup', finish);
  vp.addEventListener('pointercancel', () => { vp.classList.remove('grabbing'); downMarker = null; downX = null; });
  vp.addEventListener('wheel', e => { e.preventDefault(); seniZoomMap(e.deltaY < 0 ? 0.3 : -0.3); }, { passive: false });
}

// 마커 탭 → 바텀시트로 해당 위치 휴양소 목록 표시(여러 곳이면 선택)
function openMapPlace(label, places) {
  document.getElementById('map-sheet-title').textContent = '📍 ' + label;
  document.getElementById('map-sheet-sub').textContent = places.length > 1
    ? `이 지역에 휴양소 ${places.length}곳이 있어요 · 선택해서 휴양소 정보 상세 보기`
    : '선택해서 휴양소 정보 상세보기';
  const list = document.getElementById('map-sheet-list');
  list.innerHTML = '';
  places.forEach(p => {
    const item = document.createElement('div');
    item.className = 'map-place-item';
    item.innerHTML =
      '<i class="ti ti-building-cottage" style="color:var(--brand);font-size:18px"></i>' +
      '<span class="nm"></span>' +
      '<i class="ti ti-chevron-right" style="margin-left:auto;color:var(--text-3)"></i>';
    item.querySelector('.nm').textContent = p;
    item.addEventListener('click', () => goResortDetail(p));
    list.appendChild(item);
  });
  document.getElementById('map-sheet-backdrop').classList.add('show');
}

function closeMapSheet(e) {
  document.getElementById('map-sheet-backdrop').classList.remove('show');
}

// 선택한 휴양소로 상세 이동 (이름을 상세 화면에 반영)
function goResortDetail(name) {
  closeMapSheet();
  // 휴양소 데이터와 매칭되면 상세 내용을 채워서 이동
  if (name && typeof RESORT !== 'undefined') {
    const key = name.replace(/\s*(하계|동계)\s*휴양소$/, '').trim();
    if (RESORT[name]) { openResort(name); return; }
    if (RESORT[key]) { openResort(key); return; }
  }
  // 매칭 데이터가 없으면 이름만 반영
  if (name) {
    const h = document.getElementById('detail-resort-name');
    if (h) h.textContent = name;
  }
  showScreen('device1', 'detail', { reset: true });
}

renderSeniMap();
setupMapPan();
