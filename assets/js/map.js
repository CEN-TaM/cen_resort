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

// ===== 확대/이동(패닝) · 두 손가락 확대(핀치) + 마커 탭 선택 =====
// 지도 영역은 CSS touch-action: none 이라 폰에서도 브라우저가 터치를 스크롤로 가져가지 않는다 (map.css).
// 손가락(포인터)을 모두 기억해서 1개면 끌어 옮기기, 2개면 핀치로 확대·축소한다.
let panX = 0, panY = 0;
const mapPointers = new Map();   // pointerId → { x, y }
let gesture = null;              // { kind: 'pan' | 'pinch', ... } 시작 시점 값
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

// 확대 기준점(지도 영역 가운데)에서 본 좌표
function vpCenterOffset(vp, x, y) {
  const r = vp.getBoundingClientRect();
  return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) };
}
// 지금 손가락 상태로 제스처를 새로 시작한다 (손가락 수가 바뀔 때마다)
function startGesture(vp) {
  const pts = [...mapPointers.values()];
  if (pts.length >= 2) {
    const [a, b] = pts;
    const mid = vpCenterOffset(vp, (a.x + b.x) / 2, (a.y + b.y) / 2);
    gesture = {
      kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: seniMapZoom,
      // 두 손가락 가운데 아래에 있던 지도 지점 — 확대해도 그 지점이 손가락 아래에 남게 한다
      worldX: (mid.x - panX) / seniMapZoom, worldY: (mid.y - panY) / seniMapZoom,
    };
  } else if (pts.length === 1) {
    gesture = { kind: 'pan', x: pts[0].x, y: pts[0].y, panX, panY };
  } else {
    gesture = null;
  }
}

function setupMapPan() {
  const vp = document.querySelector('.map-screen .map-viewport');
  if (!vp || vp.dataset.panReady) return;
  vp.dataset.panReady = '1';

  vp.addEventListener('pointerdown', e => {
    mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mapPointers.size === 1) {
      moved = false;
      // 누른 대상이 마커면 기억(탭이면 선택)
      downMarker = e.target.closest ? e.target.closest('.marker') : null;
    } else {
      moved = true;          // 두 번째 손가락 = 핀치 → 마커 탭이 아니다
      downMarker = null;
    }
    startGesture(vp);
  });

  vp.addEventListener('pointermove', e => {
    if (!mapPointers.has(e.pointerId) || !gesture) return;
    mapPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.kind === 'pinch' && mapPointers.size >= 2) {
      const [a, b] = [...mapPointers.values()];
      const scale = Math.hypot(a.x - b.x, a.y - b.y) / gesture.dist;
      seniMapZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, gesture.zoom * scale));
      const mid = vpCenterOffset(vp, (a.x + b.x) / 2, (a.y + b.y) / 2);
      panX = mid.x - gesture.worldX * seniMapZoom;
      panY = mid.y - gesture.worldY * seniMapZoom;
      vp.classList.add('grabbing');
      clampPan(); applyMapTransform();
      return;
    }
    if (gesture.kind === 'pan') {
      const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 4) {
        moved = true;        // 실제 이동 시작 — 이때만 드래그 모드로 전환
        try { vp.setPointerCapture(e.pointerId); } catch (_) { }
        if (seniMapZoom > 1) vp.classList.add('grabbing');
      }
      // 기본 크기에서는 지도가 화면에 딱 맞아 옮길 곳이 없다 (clampPan 이 0 으로 묶는다)
      if (moved && seniMapZoom > 1) {
        panX = gesture.panX + dx; panY = gesture.panY + dy;
        clampPan(); applyMapTransform();
      }
    }
  });

  const release = e => {
    if (!mapPointers.has(e.pointerId)) return;
    mapPointers.delete(e.pointerId);
    if (e.type === 'pointerup' && mapPointers.size === 0 && !moved && downMarker) {
      const m = SENI_MARKERS[+downMarker.dataset.idx];   // 움직이지 않은 누름 = 탭 → 마커 선택
      if (m) openMapPlace(m.label, m.places);
    }
    if (mapPointers.size === 0) { vp.classList.remove('grabbing'); downMarker = null; }
    startGesture(vp);        // 핀치 중 한 손가락을 떼면 남은 손가락으로 이어서 옮긴다
  };
  vp.addEventListener('pointerup', release);
  vp.addEventListener('pointercancel', release);
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
    // 마커의 이름('경기(포천) 하계 휴양소')으로 휴양소 데이터를 찾아 종류 · 평점 · 후기 수 · 지역을 함께 보여준다
    const r = resolveResort(p) || resolveResort(p.replace(/\s*(하계|동계)\s*휴양소$/, '').trim());
    const item = document.createElement('div');
    item.className = 'map-place-item';
    item.innerHTML =
      '<i class="ti ti-building-cottage" style="color:var(--brand);font-size:18px"></i>' +
      '<div class="mp-text"><span class="nm"></span>' +
      (r ? `<span class="mp-meta">${typeBadgeHtml(r)}<span>${r.rating == null ? '후기 없음' : `평점 ${ratingText(r)} · 후기 ${r.reviews}`}${r.loc ? ' · ' + escapeHtml(r.loc) : ''}</span></span>` : '') +
      '</div>' +
      '<i class="ti ti-chevron-right" style="margin-left:auto;color:var(--text-3)"></i>';
    item.querySelector('.nm').textContent = r ? r.name : p;
    item.addEventListener('click', () => goResortDetail(p));
    list.appendChild(item);
  });
  document.getElementById('map-sheet-backdrop').classList.add('show');
  mapSheetOpenedAt = Date.now();
}

// 폰에서는 마커를 뗀 직후 브라우저가 같은 자리에 click 을 한 번 더 보낸다.
// 그 click 이 방금 뜬 시트의 어두운 배경에 떨어져 바로 닫히지 않도록, 열린 직후 잠깐은 배경 클릭을 무시한다
let mapSheetOpenedAt = 0;
function closeMapSheet(e) {
  if (e && Date.now() - mapSheetOpenedAt < 400) return;
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
