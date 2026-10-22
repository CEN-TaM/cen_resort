// 고객센터 / FAQ — 나의 페이지 → '고객센터 / FAQ' (screens/faq.html)
//
// 서버가 있으면 GET /api/faqs (DB faqs · settings 'support'). 고치기는 관리자 페이지 '고객센터 · FAQ'.
// 서버가 없으면(시연) data/faqs.js 의 예시 (FAQ_SEED · SUPPORT_SEED).

const FaqAPI = {
  async load() {
    if (await authMode() === 'server') return apiFetch('/api/faqs');
    return {
      faqs: (typeof FAQ_SEED !== 'undefined' ? FAQ_SEED : []).map((f, i) => ({ id: 's' + i, ...f })),
      support: typeof SUPPORT_SEED !== 'undefined' ? SUPPORT_SEED : {},
    };
  },
};

let faqItems = [];
let faqCat = '전체';

// 화면을 열 때마다 새로 읽는다 (core.js showScreen)
async function renderFaq() {
  let data = { faqs: [], support: {} };
  try { data = await FaqAPI.load(); } catch (e) { console.error('FAQ 로드 실패:', e); }
  faqItems = data.faqs || [];
  renderSupport(data.support || {});
  // 분류 칩 — 전체 + FAQ 에 있는 분류 (FAQ 순서대로)
  const cats = ['전체', ...new Set(faqItems.map(f => f.category))];
  if (!cats.includes(faqCat)) faqCat = '전체';
  document.getElementById('faq-cats').innerHTML = cats.map(c =>
    `<span class="notice-cat${c === faqCat ? ' active' : ''}" onclick="selectFaqCat(this)">${escapeHtml(c)}</span>`).join('');
  filterFaqs();
}

function renderSupport(s) {
  const row = (ico, label, value) => value ? `
    <div class="cs-row"><span class="ms outline">${ico}</span><span class="cs-label">${label}</span><span class="cs-value">${value}</span></div>` : '';
  const tel = String(s.phone || '').replace(/[^\d+]/g, '');
  document.getElementById('faq-support').innerHTML = `
    <div class="cs-head">
      <div class="cs-ico"><span class="ms">support_agent</span></div>
      <div>
        <div class="cs-title">고객센터</div>
        <div class="cs-team">${escapeHtml(s.team || '')}</div>
      </div>
    </div>
    ${row('call', '전화', s.phone ? `<a href="tel:${escapeHtml(tel)}">${escapeHtml(s.phone)}</a>` : '')}
    ${row('mail', '메일', s.email ? `<a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a>` : '')}
    ${row('schedule', '운영시간', escapeHtml(s.hours || ''))}
    ${s.note ? `<div class="cs-note">${escapeHtml(s.note)}</div>` : ''}`;
}

function selectFaqCat(el) {
  faqCat = el.textContent.trim();
  el.parentElement.querySelectorAll('.notice-cat').forEach(c => c.classList.toggle('active', c === el));
  filterFaqs();
}

function filterFaqs() {
  const q = (document.getElementById('faq-search-input').value || '').trim().toLowerCase();
  const list = faqItems.filter(f => (faqCat === '전체' || f.category === faqCat) &&
    (!q || (f.question + ' ' + f.answer).toLowerCase().includes(q)));
  const box = document.getElementById('faq-list');
  if (!faqItems.length) { box.innerHTML = '<div class="faq-none">등록된 질문이 없어요.</div>'; return; }
  if (!list.length) { box.innerHTML = `<div class="faq-none">${q ? '🔍 검색 결과가 없어요.' : '이 분류에는 질문이 없어요.'}</div>`; return; }
  box.innerHTML = list.map(f => `
    <div class="faq-item">
      <button type="button" class="faq-q" onclick="toggleFaq(this)" aria-expanded="false">
        <span class="faq-mark">Q</span>
        <span class="faq-qtext">${escapeHtml(f.question)}<span class="faq-cat">${escapeHtml(f.category)}</span></span>
        <span class="ms faq-arrow">expand_more</span>
      </button>
      <div class="faq-a" hidden><span class="faq-mark a">A</span><div>${escapeHtml(f.answer).replace(/\n/g, '<br>')}</div></div>
    </div>`).join('');
}

function toggleFaq(btn) {
  const a = btn.nextElementSibling;
  a.hidden = !a.hidden;
  btn.setAttribute('aria-expanded', String(!a.hidden));
  btn.parentElement.classList.toggle('open', !a.hidden);
}
