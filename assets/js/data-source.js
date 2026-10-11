// 후기 데이터 창구 — 화면 코드는 후기를 여기(ReviewAPI)로만 읽고 쓴다.
// 서버가 있으면(개발서버·로컬 npm start) 서버 API, 없으면(GitHub Pages) 샘플(data/reviews-sample.js)을 쓴다.
// 서버가 있어도 그 휴양소 후기가 0건이면 샘플을 보여준다 (예전 loadServerReviews 와 같은 동작).
// 후기마다 _source('server' | 'sample') 를 붙여, 좋아요·댓글·삭제를 알맞은 곳으로 보낸다.
// 쓰기 요청이 실패해도 샘플로 몰래 바꾸지 않는다 — 실패는 호출한 쪽이 토스트로 알린다.

// ===== 서버 감지 (처음 한 번, 2초 제한) =====
let _serverCheck = null;
function hasReviewServer() {
  if (!_serverCheck) {
    _serverCheck = (async () => {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 2000) : null;
      try {
        const res = await fetch(API_BASE + '/api/health', ctrl ? { signal: ctrl.signal } : undefined);
        return res.ok;
      } catch (e) {
        return false;
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();
  }
  return _serverCheck;
}

function myEmpno() {
  const p = (typeof getProfile === 'function' ? getProfile() : null) || {};
  return p.empno || '';
}

// ===== 샘플 저장소 — 브라우저 메모리. 서버 규칙(본인 확인, 답글 1단계, 답글 함께 삭제)을 따른다 =====
const SampleDB = (() => {
  const copy = o => JSON.parse(JSON.stringify(o));
  const db = copy(REVIEW_SEED);
  const generic = {};                 // 휴양소 이름 → GENERIC 사본 (휴양소마다 따로 좋아요·댓글)
  const liked = new Set();            // 내가 누른 샘플 후기 id
  let seq = 1000;
  const fail = (status, error) => Object.assign(new Error(error), { status });
  const all = () => [...db, ...Object.values(generic).flat()];
  const find = id => all().find(r => String(r.id) === String(id));
  const view = r => Object.assign(copy(r), { liked: liked.has(r.id), _source: 'sample' });
  return {
    // own: 그 휴양소 전용 샘플이면 true, 공용(GENERIC)이면 false
    list(resortName) {
      let rows = db.filter(r => r.resortName === resortName);
      let own = true;
      if (!rows.length) {
        if (!generic[resortName]) {
          generic[resortName] = copy(REVIEW_SEED_GENERIC).map(r => Object.assign(r, {
            id: `${r.id}-${resortName}`, resortName,
          }));
        }
        rows = generic[resortName];
        own = false;
      }
      const reviews = rows
        .slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(view);
      return { reviews, own };
    },
    like(id, on) {
      const r = find(id);
      if (!r) throw fail(404, '후기를 찾을 수 없습니다.');
      if (on && !liked.has(r.id)) { liked.add(r.id); r.likes += 1; }
      if (!on && liked.has(r.id)) { liked.delete(r.id); r.likes = Math.max(0, r.likes - 1); }
      return { likes: r.likes };
    },
    addComment(id, body) {
      const r = find(id);
      if (!r) throw fail(404, '후기를 찾을 수 없습니다.');
      const text = String(body.text || '').trim();
      if (!text) throw fail(400, '댓글 내용을 입력해주세요.');
      const parentId = body.parentId ? Number(body.parentId) : null;
      if (parentId) {
        const parent = r.comments.find(c => c.id === parentId);
        if (!parent) throw fail(400, '원 댓글을 찾을 수 없습니다.');
        if (parent.parentId) throw fail(400, '답글에는 다시 답글을 달 수 없습니다.');
      }
      r.comments.push(sampleComment(++seq, parentId, body.empno || null, body.author || '나', text, new Date().toISOString()));
      return { comments: copy(r.comments) };
    },
    deleteReview(id, empno) {
      const r = find(id);
      if (!r) throw fail(404, '후기를 찾을 수 없습니다.');
      if (!empno || String(r.empno) !== String(empno)) throw fail(403, '본인 후기만 삭제할 수 있습니다.');
      const i = db.indexOf(r);
      if (i >= 0) db.splice(i, 1);
      Object.values(generic).forEach(list => { const j = list.indexOf(r); if (j >= 0) list.splice(j, 1); });
      return { ok: true };
    },
  };
})();

// ===== 서버 호출 =====
async function apiFetch(path, opts) {
  const res = await fetch(API_BASE + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
  let body = {};
  try { body = await res.json(); } catch (e) { /* 본문 없는 응답 */ }
  if (!res.ok) throw Object.assign(new Error(body.error || '요청에 실패했어요'), { status: res.status });
  return body;
}

// ===== 화면이 부르는 창구 =====
// rv: 화면에 떠 있는 후기 객체 (_source 로 서버/샘플을 가른다)
const ReviewAPI = {
  // → { reviews, real }  real: 서버 후기 또는 그 휴양소 전용 샘플이면 true (총계를 이 값으로 맞춘다)
  async list(resortName) {
    if (await hasReviewServer()) {
      const { reviews } = await apiFetch('/api/reviews?resort=' + encodeURIComponent(resortName));
      if (reviews && reviews.length) {
        return { reviews: reviews.map(r => Object.assign(r, { _source: 'server' })), real: true };
      }
    }
    const { reviews, own } = SampleDB.list(resortName);
    return { reviews, real: own };
  },
  // POST /api/reviews/:id/like { liked } → { likes }  (서버는 숫자만 더하고 뺀다)
  async like(rv, on) {
    if (rv._source === 'sample') return SampleDB.like(rv.id, on);
    return apiFetch(`/api/reviews/${rv.id}/like`, { method: 'POST', body: JSON.stringify({ liked: on }) });
  },
  // POST /api/reviews/:id/comments { empno, author, parentId, text } → { comments }
  async addComment(rv, parentId, text) {
    const p = (typeof getProfile === 'function' ? getProfile() : null) || {};
    const author = (typeof composeDisplayName === 'function' ? composeDisplayName(p) : p.name) || '나';
    const body = { empno: p.empno || '', author, parentId: parentId || null, text };
    if (rv._source === 'sample') return SampleDB.addComment(rv.id, body);
    return apiFetch(`/api/reviews/${rv.id}/comments`, { method: 'POST', body: JSON.stringify(body) });
  },
  // DELETE /api/reviews/:id?empno= → { ok }
  async deleteReview(rv) {
    if (rv._source === 'sample') return SampleDB.deleteReview(rv.id, myEmpno());
    return apiFetch(`/api/reviews/${rv.id}?empno=${encodeURIComponent(myEmpno())}`, { method: 'DELETE' });
  },
};
