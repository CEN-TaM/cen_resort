// 관리자 페이지 — 고객센터 · FAQ (고객센터 안내 고치기 · 질문 목록 / 추가 / 고치기 / 숨기기 / 삭제)
// API: /api/admin/faqs · /api/admin/support (server/admin.js). 앱 화면은 screens/faq.html · assets/js/faq.js
// 공용 함수($ · esc · api · toast · fmtDate · handleErr · paged)는 admin.js

let faqs = [], faqCategories = [];
let faqEditing = null;   // 고치는 중인 질문 (새로 쓰면 null)

MENUS.faq = () => loadFaqs();

async function loadFaqs() {
  try {
    const r = await api('/api/admin/faqs');
    faqs = r.faqs; faqCategories = r.categories;
    const sel = $('faq-cat'); const keep = sel.value;
    sel.innerHTML = '<option value="">분류 전체</option>' + faqCategories.map(c => `<option${c === keep ? ' selected' : ''}>${esc(c)}</option>`).join('');
    fillSupport(r.support || {});
    renderFaqs();
  } catch (e) { handleErr(e); }
}

// ───────── 고객센터 안내 ─────────
const SUPPORT_KEYS = ['team', 'phone', 'email', 'hours', 'note'];
function fillSupport(s) {
  SUPPORT_KEYS.forEach(k => { $('s-' + k).value = s[k] || ''; });
  $('support-err').textContent = '';
}
$('support-form').addEventListener('submit', async () => {
  const v = Object.fromEntries(SUPPORT_KEYS.map(k => [k, $('s-' + k).value.trim()]));
  $('support-err').textContent = '';
  $('support-save').disabled = true;
  try {
    fillSupport((await api('/api/admin/support', { method: 'PUT', body: JSON.stringify(v) })).support);
    toast('고객센터 안내를 저장했습니다');
  } catch (err) { $('support-err').textContent = err.message; if (err.status === 401 || err.status === 403) handleErr(err); }
  finally { $('support-save').disabled = false; }
});

// ───────── 질문 목록 ─────────
function renderFaqs() {
  const q = $('faq-q').value.trim().toLowerCase();
  const cat = $('faq-cat').value;
  const f = $('faq-filter').value;
  const list = faqs.filter(x =>
    (!cat || x.category === cat) &&
    (!f || (f === 'active' && x.active) || (f === 'hidden' && !x.active)) &&
    (!q || (x.question + ' ' + x.answer).toLowerCase().includes(q)));
  $('faq-count').textContent = `${list.length}개 / 전체 ${faqs.length}개 · 숨김 ${faqs.filter(x => !x.active).length}`;
  if (!list.length) paged('faq', list, 'faq-pager', renderFaqs);   // 비면 쪽 번호도 지운다
  $('faq-rows').innerHTML = list.length ? paged('faq', list, 'faq-pager', renderFaqs).map(x => `
    <tr class="${x.active ? '' : 'off'}">
      <td class="num">${x.sortOrder}</td>
      <td class="c"><span class="chip">${esc(x.category)}</span></td>
      <td class="snip" data-fedit="${esc(x.id)}"><b>${esc(x.question)}</b><span>${esc(x.answer.replace(/\s+/g, ' '))}</span></td>
      <td class="c"><span class="chip ${x.active ? 'on' : 'off'}">${x.active ? '보임' : '숨김'}</span></td>
      <td class="c">${fmtDate(x.updatedAt)}</td>
      <td><div class="acts">
        <button class="btn sm" data-fedit="${esc(x.id)}">수정</button>
        <button class="btn sm" data-ftoggle="${esc(x.id)}">${x.active ? '숨기기' : '보이기'}</button>
        <button class="btn sm danger" data-fdel="${esc(x.id)}">삭제</button>
      </div></td>
    </tr>`).join('') : `<tr><td colspan="6" class="empty">${faqs.length ? '조건에 맞는 질문이 없습니다.' : '아직 질문이 없습니다. 오른쪽 위 \'+ 질문 추가\' 로 첫 질문을 넣어 보세요.'}</td></tr>`;
}
$('faq-q').addEventListener('input', () => { resetPage('faq'); renderFaqs(); });
['faq-cat', 'faq-filter'].forEach(id => $(id).addEventListener('change', () => { resetPage('faq'); renderFaqs(); }));

$('faq-rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-fedit],[data-ftoggle],[data-fdel]');
  if (!b) return;
  const x = faqs.find(i => i.id === (b.dataset.fedit || b.dataset.ftoggle || b.dataset.fdel));
  if (!x) return;
  if (b.dataset.fedit) return openFaqModal(x);
  try {
    if (b.dataset.ftoggle) {
      await api(`/api/admin/faqs/${x.id}`, { method: 'PUT', body: JSON.stringify({ active: !x.active }) });
      toast(x.active ? '앱에서 숨겼습니다' : '앱에 다시 보입니다');
    }
    if (b.dataset.fdel) {
      if (!confirm(`'${x.question}' 질문을 삭제할까요?\n\n되돌릴 수 없습니다. 잠깐 내리려면 '숨기기' 를 쓰세요.`)) return;
      await api(`/api/admin/faqs/${x.id}`, { method: 'DELETE' });
      toast('삭제했습니다');
    }
    loadFaqs();
  } catch (err) { handleErr(err); }
});

// ───────── 추가 · 고치기 ─────────
function openFaqModal(x) {
  faqEditing = x || null;
  $('faq-modal-title').textContent = x ? '질문 수정' : '질문 추가';
  $('q-category').innerHTML = faqCategories.map(c => `<option${x && c === x.category ? ' selected' : ''}>${esc(c)}</option>`).join('');
  $('q-sort').value = x ? x.sortOrder : '';
  $('q-question').value = x ? x.question : '';
  $('q-answer').value = x ? x.answer : '';
  $('q-active').checked = x ? x.active : true;
  $('faq-err').textContent = '';
  $('faq-modal').hidden = false;
  $('q-question').focus();
}
$('faq-new-btn').addEventListener('click', () => openFaqModal(null));
$('faq-form').addEventListener('submit', async () => {
  const v = {
    category: $('q-category').value, question: $('q-question').value.trim(), answer: $('q-answer').value.trim(), active: $('q-active').checked,
    ...($('q-sort').value !== '' ? { sortOrder: Number($('q-sort').value) } : {}),
  };
  $('faq-err').textContent = '';
  if (!v.question || !v.answer) { $('faq-err').textContent = '질문과 답변을 입력해주세요.'; return; }
  $('faq-save').disabled = true;
  try {
    if (faqEditing) await api(`/api/admin/faqs/${faqEditing.id}`, { method: 'PUT', body: JSON.stringify(v) });
    else await api('/api/admin/faqs', { method: 'POST', body: JSON.stringify(v) });
    toast(faqEditing ? '저장했습니다' : '질문을 추가했습니다' + (v.active ? '' : ' (숨김 상태)'));
    $('faq-modal').hidden = true;
    loadFaqs();
  } catch (err) { $('faq-err').textContent = err.message; if (err.status === 401 || err.status === 403) handleErr(err); }
  finally { $('faq-save').disabled = false; }
});
