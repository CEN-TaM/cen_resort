// 관리자 페이지 — 휴양소 정보 (목록 · 찾기 · 추가 · 고치기 · 숨기기 · 사진 여러 장)
// API: /api/admin/resorts · /api/admin/resort-photos (server/admin-resorts.js). 공용 함수($ · esc · api · toast · handleErr · go · backTo)는 admin.js
// 주소: #resorts (목록) · #resorts/new · #resorts/<id> — 쓰기 화면은 공지처럼 한 화면 (저장 안 하고 나가면 묻는다, admin.js route)

let resortData = { resorts: [], featureChoices: {}, mapLabels: [] };
let editingResort = null;     // 고치는 휴양소 id (새로 만들면 null)
let rPhotos = [];             // 쓰기 화면의 사진 주소 목록 — 첫 장이 대표 사진 (저장할 때 photos 로 보낸다). 올리는 중이면 { uploading: true }
const R_PHOTO_LIMIT = 10;
let rFeatures = {};           // { 분류: Set(이름) }

const RTYPE = { regular: '정기', summer: '하계', winter: '동계' };
MENUS.resorts = () => loadResorts();
FIRST_VIEW.resorts = 'resort-list-view';
SUB_VIEWS.resorts = { view: 'resort-edit-view', render: sub => renderResortEditor(sub === 'new' ? null : sub) };

async function loadResorts() {
  try { resortData = await api('/api/admin/resorts'); renderResortRows(); } catch (e) { handleErr(e); }
}
// 목록 사진 칸 — 대표(첫 장) + 여러 장이면 장 수
const thumbHtml = r => r.photo
  ? `<span class="r-thumb" style="background-image:url('${esc(r.photo)}')" title="사진 ${r.photos.length}장">${r.photos.length > 1 ? `<em>${r.photos.length}</em>` : ''}</span>`
  : '<span class="r-thumb none"><i class="ms">image</i></span>';

function resortList() {
  const q = $('resort-q').value.trim().toLowerCase();
  const t = $('resort-type').value;
  const pf = $('resort-photo').value;
  const n = r => r.photos.length;
  return resortData.resorts.filter(r => (!t || r.type === t) &&
    (!pf || (pf === 'none' && !n(r)) || (pf === 'one' && n(r) === 1) || (pf === 'many' && n(r) > 1)) &&
    (!q || [r.name, r.loc, r.address, r.facilityName, ...r.aliases].join(' ').toLowerCase().includes(q)));
}
function renderResortRows() {
  const all = resortData.resorts;
  const list = resortList();
  $('resort-count').textContent = `${list.length}곳 / 전체 ${all.length}곳 · 숨김 ${all.filter(r => !r.active).length}`;
  if (!list.length) paged('resorts', list, 'resort-pager', renderResortRows);   // 비면 쪽 번호도 지운다
  $('resort-rows').innerHTML = list.length ? paged('resorts', list, 'resort-pager', renderResortRows).map(r => `
    <tr class="${r.active ? '' : 'off'}">
      <td class="c">${thumbHtml(r)}</td>
      <td class="title" data-redit="${esc(r.id)}">${esc(r.name)}${r.facilityName ? `<div class="muted">${esc(r.facilityName)}</div>` : ''}</td>
      <td class="c"><span class="chip type-${esc(r.type)}">${RTYPE[r.type] || esc(r.type)}</span></td>
      <td>${esc(r.loc)}</td>
      <td class="num">${r.reviews.toLocaleString('ko-KR')}</td>
      <td class="num">${r.rating != null ? r.rating.toFixed(1) : '-'}</td>
      <td class="c"><span class="chip ${r.active ? 'on' : 'off'}">${r.active ? '보임' : '숨김'}</span></td>
      <td><div class="acts">
        <button class="btn sm" data-redit="${esc(r.id)}">수정</button>
        <button class="btn sm" data-rtoggle="${esc(r.id)}">${r.active ? '숨기기' : '보이기'}</button>
      </div></td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty">${all.length ? '조건에 맞는 휴양소가 없습니다.' : '휴양소가 없습니다.'}</td></tr>`;
}
$('resort-q').addEventListener('input', () => { resetPage('resorts'); renderResortRows(); });
$('resort-type').addEventListener('change', () => { resetPage('resorts'); renderResortRows(); });
$('resort-photo').addEventListener('change', () => { resetPage('resorts'); renderResortRows(); });
$('resort-new-btn').addEventListener('click', () => go('#resorts/new'));
$('resort-rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-redit],[data-rtoggle]');
  if (!b) return;
  if (b.dataset.redit) return go('#resorts/' + encodeURIComponent(b.dataset.redit));
  const r = resortData.resorts.find(x => x.id === b.dataset.rtoggle);
  if (r.active && !confirm(`'${r.name}' 을(를) 앱에서 숨길까요?\n\n목록 · 지도 · 검색 · 후기 쓰기에서 빠져요. 후기 ${r.reviews}개는 지워지지 않아요.`)) return;
  try {
    await api(`/api/admin/resorts/${encodeURIComponent(r.id)}`, { method: 'PUT', body: JSON.stringify({ active: !r.active }) });
    toast(r.active ? `'${r.name}' 을(를) 앱에서 숨겼습니다` : `'${r.name}' 이(가) 앱에 다시 보입니다`);
    loadResorts();
  } catch (err) { handleErr(err); }
});

// ───────── 추가 · 고치기 ─────────
async function renderResortEditor(id) {
  editingResort = id ? decodeURIComponent(id) : null;
  // 주소로 바로 들어오면(새로고침 등) 목록이 아직 없다
  if (!resortData.resorts.length) { try { resortData = await api('/api/admin/resorts'); } catch (e) { return handleErr(e); } }
  const r = editingResort ? resortData.resorts.find(x => x.id === editingResort) : {
    name: '', type: 'regular', loc: '', address: '', facilityName: '', summary: '', season: '', roomType: '',
    capacity: null, capacityBase: null, phone: '', website: '', photo: '', photos: [], details: [], nearby: [], notices: [],
    features: {}, mapLabel: '', active: true, aliases: [],
  };
  if (!r) { toast('없는 휴양소입니다'); history.replaceState(null, '', '#resorts'); return route(); }
  $('resort-edit-title').textContent = editingResort ? `'${r.name}' 수정` : '휴양소 추가';
  $('resort-edit-sub').textContent = editingResort
    ? `후기 ${r.reviews}개 · 사진 ${r.photos.length}장${r.aliases.length ? ` · 옛 이름: ${r.aliases.join(', ')} (이 이름으로 쓴 후기도 이 휴양소 후기로 셉니다)` : ''}`
    : '저장하면 바로 앱에 나와요. 아직 준비 중이면 아래 \'앱에 보이기\' 를 끄고 저장하세요.';
  $('r-map').innerHTML = '<option value="">지도에 안 나옴</option>' + resortData.mapLabels.map(m => `<option${m === r.mapLabel ? ' selected' : ''}>${esc(m)}</option>`).join('');
  const set = (id, v) => { $(id).value = v ?? ''; };
  set('r-name', r.name); set('r-type', r.type); set('r-loc', r.loc); set('r-address', r.address);
  set('r-facility', r.facilityName); set('r-season', r.season); set('r-summary', r.summary); set('r-room', r.roomType);
  set('r-cap-base', r.capacityBase); set('r-cap', r.capacity); set('r-phone', r.phone); set('r-website', r.website);
  set('r-nearby', r.nearby.join(', ')); set('r-notices', r.notices.join('\n'));
  $('r-active').checked = r.active;
  rPhotos = [...(r.photos || (r.photo ? [r.photo] : []))]; renderResortPhotos();
  rFeatures = {};
  Object.entries(r.features).forEach(([k, v]) => { rFeatures[k] = new Set(v); });
  renderFeaturePick();
  $('r-details').innerHTML = '';
  (r.details.length ? r.details : [{ label: '', value: '' }]).forEach(addDetailRow);
  $('resort-err').textContent = '';
  dirty = false;
  $('r-name').focus();
}

// 사진 목록 — 순서대로 카드. ◀ ▶ 로 순서 바꾸기, × 로 빼기. 첫 장에 '대표' 표시
function renderResortPhotos() {
  const n = rPhotos.length;
  $('r-photos').innerHTML = n ? rPhotos.map((u, i) => u.uploading
    ? '<div class="ph-card uploading"><div class="ph-img"><i class="ms">hourglass_top</i></div><div class="ph-bar">올리는 중…</div></div>'
    : `<div class="ph-card">
      <div class="ph-img" style="background-image:url('${esc(u)}')">${i === 0 ? '<span class="ph-main">대표</span>' : ''}<span class="ph-no">${i + 1}</span></div>
      <div class="ph-bar">
        <button type="button" class="ph-btn" data-pmove="${i}" data-dir="-1" title="앞으로" aria-label="${i + 1}번 사진 앞으로"${i === 0 ? ' disabled' : ''}><i class="ms">chevron_left</i></button>
        <button type="button" class="ph-btn" data-pmove="${i}" data-dir="1" title="뒤로" aria-label="${i + 1}번 사진 뒤로"${i === n - 1 ? ' disabled' : ''}><i class="ms">chevron_right</i></button>
        <span style="flex:1"></span>
        <button type="button" class="x-btn" data-pdel="${i}" title="빼기" aria-label="${i + 1}번 사진 빼기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div></div>`).join('')
    : '<div class="ph-empty"><i class="ms">image</i>사진 없음 — 앱은 기본 그림을 보여줘요</div>';
  $('r-photo-drop').hidden = n >= R_PHOTO_LIMIT;
}
$('r-photos').addEventListener('click', e => {
  const mv = e.target.closest('[data-pmove]'), del = e.target.closest('[data-pdel]');
  if (mv && !mv.disabled) {
    const i = Number(mv.dataset.pmove), j = i + Number(mv.dataset.dir);
    [rPhotos[i], rPhotos[j]] = [rPhotos[j], rPhotos[i]];
  } else if (del) rPhotos.splice(Number(del.dataset.pdel), 1);
  else return;
  dirty = true; renderResortPhotos();
});
// 편의시설 — 분류별 칩. 고른 것은 진하게
function renderFeaturePick() {
  $('r-features').innerHTML = Object.entries(resortData.featureChoices).map(([cat, names]) => `
    <div class="feat-row"><span class="feat-cat">${esc(cat)}</span><div class="feat-chips">
      ${names.map(n => `<button type="button" class="feat${rFeatures[cat] && rFeatures[cat].has(n) ? ' on' : ''}" data-fcat="${esc(cat)}" data-fname="${esc(n)}">${esc(n)}</button>`).join('')}
    </div></div>`).join('');
}
$('r-features').addEventListener('click', e => {
  const b = e.target.closest('[data-fname]');
  if (!b) return;
  const s = rFeatures[b.dataset.fcat] = rFeatures[b.dataset.fcat] || new Set();
  s.has(b.dataset.fname) ? s.delete(b.dataset.fname) : s.add(b.dataset.fname);
  b.classList.toggle('on');
  dirty = true;
});
// 상세 정보 — 항목 · 내용 한 줄씩
function addDetailRow(d) {
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML = `<input class="kv-k" maxlength="20" placeholder="항목 (예: 입·퇴실)" value="${esc(d.label)}">
    <input class="kv-v" maxlength="300" placeholder="내용" value="${esc(d.value)}">
    <button type="button" class="x-btn" title="이 줄 빼기" aria-label="이 줄 빼기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  $('r-details').appendChild(row);
  return row;
}
$('r-detail-add').addEventListener('click', () => { addDetailRow({ label: '', value: '' }).querySelector('input').focus(); });
$('r-details').addEventListener('click', e => {
  const b = e.target.closest('.x-btn');
  if (b) { b.closest('.kv-row').remove(); dirty = true; }
});

// 사진 — 긴 쪽 1600px 가 넘으면 줄여서 JPG 로 올린다 (폰 원본 사진도 수백 KB 로)
const PHOTO_EDGE = 1600;
function shrinkPhoto(file) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const k = Math.min(1, PHOTO_EDGE / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => fail(new Error('사진을 열 수 없습니다. JPG · PNG · WEBP 사진을 골라 주세요.'));
    img.src = URL.createObjectURL(file);
  });
}
// 여러 장 — 고른 순서대로 한 장씩 올려서 목록 끝에 붙인다
async function uploadResortPhotos(list) {
  const files = [...list];
  $('resort-err').textContent = '';
  const room = R_PHOTO_LIMIT - rPhotos.length;
  if (files.length > room) { $('resort-err').textContent = `사진은 ${R_PHOTO_LIMIT}장까지예요. ${room}장만 올렸어요.`; files.length = Math.max(0, room); }
  for (const file of files) {
    const slot = { uploading: true };
    rPhotos.push(slot); renderResortPhotos();
    try {
      const { url } = await api('/api/admin/resort-photos', { method: 'POST', body: JSON.stringify({ data: await shrinkPhoto(file) }) });
      rPhotos[rPhotos.indexOf(slot)] = url; dirty = true;
    } catch (err) {
      rPhotos.splice(rPhotos.indexOf(slot), 1);
      $('resort-err').textContent = err.message;
      if (err.status === 401 || err.status === 403) { handleErr(err); break; }
    }
    renderResortPhotos();
  }
}
$('r-photo-input').addEventListener('change', e => { uploadResortPhotos(e.target.files); e.target.value = ''; });
const rDrop = $('r-photo-drop');
['dragenter', 'dragover'].forEach(t => rDrop.addEventListener(t, e => { e.preventDefault(); rDrop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => rDrop.addEventListener(t, e => { e.preventDefault(); rDrop.classList.remove('over'); }));
rDrop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) uploadResortPhotos(e.dataTransfer.files); });

function resortFormValue() {
  const features = {};
  Object.entries(rFeatures).forEach(([k, s]) => { if (s.size) features[k] = (resortData.featureChoices[k] || []).filter(n => s.has(n)); });
  return {
    name: $('r-name').value.trim(), type: $('r-type').value, loc: $('r-loc').value, address: $('r-address').value,
    mapLabel: $('r-map').value, facilityName: $('r-facility').value, season: $('r-season').value, summary: $('r-summary').value,
    roomType: $('r-room').value, capacityBase: $('r-cap-base').value, capacity: $('r-cap').value,
    phone: $('r-phone').value, website: $('r-website').value.trim(), photos: rPhotos.filter(u => typeof u === 'string'), features,
    details: [...document.querySelectorAll('#r-details .kv-row')].map(row => ({ label: row.querySelector('.kv-k').value, value: row.querySelector('.kv-v').value })),
    nearby: $('r-nearby').value.split(/[,，\n]/).map(s => s.trim()).filter(Boolean),
    notices: $('r-notices').value.split('\n').map(s => s.trim()).filter(Boolean),
    active: $('r-active').checked,
  };
}
$('resort-form').addEventListener('input', () => { dirty = true; });
$('resort-form').addEventListener('change', () => { dirty = true; });
$('resort-cancel').addEventListener('click', () => backTo('#resorts'));
$('resort-save').addEventListener('click', async () => {
  const v = resortFormValue();
  $('resort-err').textContent = '';
  if (!v.name) { $('resort-err').textContent = '이름은 꼭 입력해야 합니다.'; return; }
  if (rPhotos.some(u => typeof u !== 'string')) { $('resort-err').textContent = '사진을 올리는 중이에요. 다 올라간 뒤 저장해 주세요.'; return; }
  const cur = editingResort && resortData.resorts.find(x => x.id === editingResort);
  if (cur && cur.name !== v.name && !confirm(`이름을 '${cur.name}' → '${v.name}' 로 바꿀까요?\n\n'${cur.name}' 으로 쓴 후기도 계속 이 휴양소 후기로 셉니다.`)) return;
  $('resort-save').disabled = true;
  try {
    if (editingResort) await api(`/api/admin/resorts/${encodeURIComponent(editingResort)}`, { method: 'PUT', body: JSON.stringify(v) });
    else await api('/api/admin/resorts', { method: 'POST', body: JSON.stringify(v) });
    toast(editingResort ? '저장했습니다' : `'${v.name}' 휴양소를 만들었습니다` + (v.active ? '' : ' (숨김 상태)'));
    resortData.resorts = [];   // 목록을 새로 받게
    dirty = false;
    backTo('#resorts');
  } catch (err) { $('resort-err').textContent = err.message; if (err.status === 401 || err.status === 403) handleErr(err); }
  finally { $('resort-save').disabled = false; }
});
