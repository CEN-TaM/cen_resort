// 관리자 페이지 — 배지 (기준 고치기 · 켜기/끄기 · 새 배지)
// API: /api/admin/badges (server/badges.js). 공용 함수($ · esc · api · toast · handleErr)는 admin.js
// '무엇을 셀지' 는 서버가 주는 목록(metrics)에서만 고른다. 새 셈법은 server/badges.js METRICS 에 더한다.

let badgeData = { badges: [], metrics: [], icons: [], tones: [], members: 0 };
let editingBadge = null;
const bgPick = { icon: '', tone: '' };

MENUS.badges = () => loadBadges();
FIRST_VIEW.badges = 'badge-view';

async function loadBadges() {
  try { badgeData = await api('/api/admin/badges'); renderBadgeRows(); } catch (e) { handleErr(e); }
}
const metricOf = id => badgeData.metrics.find(m => m.id === id) || { label: id, unit: '' };
const TYPE_LABEL = { regular: '정기', summer: '하계', winter: '동계' };
// 목록의 '받는 기준' 한 줄 — 예: 후기 수 3편 이상 · 지역별 후기 수 (제주, 서귀포) 2편 이상
function ruleText(b) {
  const m = metricOf(b.metric);
  const p = b.param ? ` (${b.metric === 'type_reviews' ? (TYPE_LABEL[b.param] || b.param) : b.param.split(',').join(', ')})` : '';
  return `${m.label}${p} ${b.goal}${m.unit} 이상`;
}
const iconHtml = (b, size = 20) => `<span class="b-ico tone-${esc(b.tone)}" style="width:${size + 16}px;height:${size + 16}px"><i class="ms" style="font-size:${size}px">${esc(b.icon)}</i></span>`;

function renderBadgeRows() {
  const all = badgeData.badges;
  const q = $('badge-q').value.trim().toLowerCase();
  const f = $('badge-filter').value;
  const list = all.filter(b => (!f || (f === 'active' ? b.active : !b.active)) &&
    (!q || [b.name, b.description, ruleText(b)].join(' ').toLowerCase().includes(q)));
  $('badge-count').textContent = `${list.length}개 / 전체 ${all.length}개 · 숨김 ${all.filter(b => !b.active).length}`;
  if (!list.length) paged('badges', list, 'badge-pager', renderBadgeRows);   // 비면 쪽 번호도 지운다
  $('badge-rows').innerHTML = list.length ? paged('badges', list, 'badge-pager', renderBadgeRows).map(b => `
    <tr class="${b.active ? '' : 'off'}">
      <td class="c">${iconHtml(b)}</td>
      <td><b>${esc(b.name)}</b><div class="muted">${esc(b.description)}</div></td>
      <td>${esc(ruleText(b))}</td>
      <td class="num">${b.awarded.toLocaleString('ko-KR')}명</td>
      <td class="c"><span class="chip ${b.active ? 'on' : 'off'}">${b.active ? '보임' : '숨김'}</span></td>
      <td><div class="acts">
        <button class="btn sm" data-bedit="${esc(b.id)}">수정</button>
        <button class="btn sm" data-btoggle="${esc(b.id)}">${b.active ? '숨기기' : '보이기'}</button>
      </div></td>
    </tr>`).join('') : `<tr><td colspan="6" class="empty">${all.length ? '조건에 맞는 배지가 없습니다.' : '배지가 없습니다.'}</td></tr>`;
}
$('badge-q').addEventListener('input', () => { resetPage('badges'); renderBadgeRows(); });
$('badge-filter').addEventListener('change', () => { resetPage('badges'); renderBadgeRows(); });
$('badge-rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-bedit],[data-btoggle]');
  if (!b) return;
  const badge = badgeData.badges.find(x => x.id === (b.dataset.bedit || b.dataset.btoggle));
  if (b.dataset.bedit) return openBadgeModal(badge);
  try {
    await api(`/api/admin/badges/${encodeURIComponent(badge.id)}`, { method: 'PUT', body: JSON.stringify({ active: !badge.active }) });
    toast(badge.active ? `'${badge.name}' 배지를 앱에서 숨겼습니다 (받은 기록은 남아요)` : `'${badge.name}' 배지를 다시 보이게 했습니다`);
    loadBadges();
  } catch (err) { handleErr(err); }
});

// ───────── 추가 · 고치기 ─────────
function openBadgeModal(b) {
  editingBadge = b ? b.id : null;
  $('badge-modal-title').textContent = b ? `'${b.name}' 배지 수정` : '배지 추가';
  $('bg-metric').innerHTML = badgeData.metrics.map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('');
  $('bg-name').value = b ? b.name : ''; $('bg-desc').value = b ? b.description : '';
  $('bg-metric').value = b ? b.metric : 'reviews';
  $('bg-param').value = b ? b.param : '';
  $('bg-goal').value = b ? b.goal : 1;
  $('bg-active').checked = b ? b.active : true;
  bgPick.icon = b ? b.icon : badgeData.icons[0]; bgPick.tone = b ? b.tone : badgeData.tones[0];
  $('bg-icons').innerHTML = badgeData.icons.map(i => `<button type="button" class="ip" data-icon="${esc(i)}" title="${esc(i)}"><i class="ms">${esc(i)}</i></button>`).join('');
  $('bg-tones').innerHTML = badgeData.tones.map(t => `<button type="button" class="tp tone-${esc(t)}" data-tone="${esc(t)}" title="${esc(t)}"></button>`).join('');
  $('badge-err').textContent = '';
  syncBadgeForm();
  $('badge-modal').hidden = false;
  $('bg-name').focus();
}
// 고른 셈법에 따라 조건 칸 · 단위를 바꾸고, 위 미리보기를 새로 그린다
function syncBadgeForm() {
  const m = metricOf($('bg-metric').value);
  $('bg-param-wrap').hidden = !m.param;
  $('bg-param-label').textContent = m.param || '';
  $('bg-param').placeholder = $('bg-metric').value === 'type_reviews' ? 'summer' : '제주,서귀포';
  $('bg-goal-hint').textContent = `이 숫자(${m.unit}) 이상이면 받아요`;
  document.querySelectorAll('#bg-icons .ip').forEach(x => x.classList.toggle('on', x.dataset.icon === bgPick.icon));
  document.querySelectorAll('#bg-tones .tp').forEach(x => x.classList.toggle('on', x.dataset.tone === bgPick.tone));
  const prev = { icon: bgPick.icon, tone: bgPick.tone };
  $('bg-preview').innerHTML = `${iconHtml(prev, 26)}<div><b>${esc($('bg-name').value || '배지 이름')}</b><div class="muted">${esc($('bg-desc').value || '설명')}</div>
    <div class="hint">받는 기준: ${esc(ruleText({ metric: $('bg-metric').value, param: m.param ? $('bg-param').value.trim() : '', goal: Number($('bg-goal').value) || 0 }))}</div></div>`;
}
$('badge-form').addEventListener('input', syncBadgeForm);
$('badge-form').addEventListener('change', syncBadgeForm);
$('bg-icons').addEventListener('click', e => { const b = e.target.closest('[data-icon]'); if (b) { bgPick.icon = b.dataset.icon; syncBadgeForm(); } });
$('bg-tones').addEventListener('click', e => { const b = e.target.closest('[data-tone]'); if (b) { bgPick.tone = b.dataset.tone; syncBadgeForm(); } });
$('badge-new-btn').addEventListener('click', () => openBadgeModal(null));
$('badge-form').addEventListener('submit', async () => {
  const m = metricOf($('bg-metric').value);
  const body = {
    name: $('bg-name').value, description: $('bg-desc').value, metric: $('bg-metric').value,
    param: m.param ? $('bg-param').value.trim() : '', goal: Number($('bg-goal').value),
    icon: bgPick.icon, tone: bgPick.tone, active: $('bg-active').checked,
  };
  const cur = editingBadge && badgeData.badges.find(x => x.id === editingBadge);
  // 기준 숫자를 낮추면 다음에 앱을 열 때 새로 받는 사람이 생긴다. 올려도 이미 받은 사람은 그대로
  if (cur && body.goal !== cur.goal && !confirm(`기준을 ${cur.goal} → ${body.goal} 로 바꿀까요?\n\n이미 받은 ${cur.awarded}명은 그대로 유지돼요.${body.goal < cur.goal ? ' 새 기준을 넘는 사람은 다음에 앱을 열 때 받아요.' : ''}`)) return;
  $('badge-err').textContent = '';
  $('badge-save').disabled = true;
  try {
    if (editingBadge) await api(`/api/admin/badges/${encodeURIComponent(editingBadge)}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/admin/badges', { method: 'POST', body: JSON.stringify(body) });
    $('badge-modal').hidden = true;
    toast(editingBadge ? '저장했습니다' : `'${body.name}' 배지를 만들었습니다`);
    loadBadges();
  } catch (err) { $('badge-err').textContent = err.message; if (err.status === 401 || err.status === 403) handleErr(err); }
  finally { $('badge-save').disabled = false; }
});
