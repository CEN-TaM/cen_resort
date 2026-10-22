// 아이콘 변환 적용 · 화면 전환
function tiToMs(el) {
  const tiClass = Array.from(el.classList).find(c => c.startsWith('ti-'));
  if (!tiClass || !TI_TO_MS[tiClass]) return;
  const other = Array.from(el.classList).filter(c => c !== 'ti' && !c.startsWith('ti-'));
  const OUTLINE_DEFAULT = new Set(['ti-star', 'ti-heart', 'ti-message-circle', 'ti-bell', 'ti-bookmark', 'ti-bulb']);
  const outline = tiClass.endsWith('-filled') ? false : OUTLINE_DEFAULT.has(tiClass);
  el.className = ['ms', ...other, outline ? 'outline' : ''].filter(Boolean).join(' ');
  el.textContent = TI_TO_MS[tiClass];
}
document.querySelectorAll('i.ti, span.ti').forEach(tiToMs);

// 화면별 스크롤 위치 저장소 (뒤로가기 시 보던 위치 복원용)
const scrollPos = {};
function saveScreenScroll(screenEl) {
  if (!screenEl) return;
  const name = screenEl.getAttribute('data-screen');
  const sb = screenEl.querySelector('.scroll-body');
  scrollPos[name] = { top: screenEl.scrollTop || 0, body: sb ? sb.scrollTop : 0 };
}
// 화면별 "직전에 어디서 왔는지" (뒤로가기 목적지용)
// 예: 휴양소 목록 → 상세 로 들어왔으면 prevScreen['detail'] = 'resorts'
const prevScreen = {};

// ===== 화면 주소 (#/화면) =====
// 화면을 바꿀 때마다 주소를 남겨서 새로고침 · 링크 공유 · 폰 뒤로가기가 그 화면으로 동작하게 한다.
//   #/home  #/resorts  #/map ...       화면 이름 그대로
//   #/resort/<휴양소 id>                휴양소 상세   (예: #/resort/gyeongju)
//   #/notice/<공지 id>                  공지 상세
// 로그인 · 사번인증 화면은 주소를 남기지 않는다 (로그인 전에 받은 링크 주소를 그대로 두었다가 로그인 후 연다).
const NO_ROUTE = new Set(['login', 'signup']);
let navIdx = (history.state && history.state.idx) || 0;   // 앱 안에서 쌓은 기록 수 (뒤로가기 판단)
let routingFromHistory = false;                            // 뒤로/앞으로 가기로 화면을 바꾸는 중

function routeFor(screen, param) {
  if (screen === 'detail' && param) return '#/resort/' + encodeURIComponent(param);
  if (screen === 'notice-detail' && param) return '#/notice/' + encodeURIComponent(param);
  return '#/' + screen;
}
function parseRoute(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (parts[0] === 'resort' && parts[1]) return { screen: 'detail', param: parts[1] };
  if (parts[0] === 'notice' && parts[1]) return { screen: 'notice-detail', param: parts[1] };
  return { screen: parts[0] || '', param: null };
}
function recordRoute(screenName, from, opts) {
  if (NO_ROUTE.has(screenName)) return;
  const h = routeFor(screenName, opts && opts.param);
  if (location.hash === h) return;
  // 로그인 직후 첫 화면 · replace 요청은 기록을 쌓지 않고 바꾼다 (뒤로가기로 로그인 화면에 돌아가지 않게)
  if ((opts && opts.replace) || NO_ROUTE.has(from)) history.replaceState({ idx: navIdx }, '', h);
  else history.pushState({ idx: ++navIdx }, '', h);
}

// 주소 → 화면. 상세처럼 값이 필요한 화면은 그 화면을 여는 함수로 연다
const ROUTE_OPENERS = {
  detail: p => openResort(p),
  'notice-detail': p => openNoticeDetail(p),
  search: () => openSearch(),
  'edit-profile': () => openEditProfile(),
};
async function openRoute(route, opts) {
  let { screen, param } = route || {};
  const asked = screen;
  if (!screen || NO_ROUTE.has(screen) || !document.querySelector(`#device1 [data-screen="${screen}"]`)) screen = 'home';
  if (screen === 'detail' && typeof ResortAPI !== 'undefined') await ResortAPI.load();   // 휴양소 이름 · id 를 알아야 연다
  if (screen === 'detail' && !(param && resolveResort(param))) screen = 'resorts';
  if (screen === 'notice-detail' && !param) screen = 'tips';   // 없는 공지 번호는 openNoticeDetail 이 목록으로 돌린다
  // 없는 화면 · 휴양소 주소였으면 주소도 실제로 연 화면으로 바꿔 둔다
  if (screen !== asked) history.replaceState({ idx: navIdx }, '', routeFor(screen));
  const opener = ROUTE_OPENERS[screen];
  if (opener && (param || !['detail', 'notice-detail'].includes(screen))) opener(param);
  else showScreen('device1', screen, opts);
}
// 로그인한 뒤 들어갈 화면 — 주소에 화면이 있으면 그 화면(공유받은 링크 등), 없으면 홈
function openStartRoute() {
  const r = parseRoute(location.hash);
  if (!r.screen) { showScreen('device1', 'home', { replace: true }); return; }
  history.replaceState({ idx: navIdx }, '', location.href);
  openRoute(r, { replace: true });
}
// 폰 · 브라우저 뒤로가기/앞으로가기
window.addEventListener('popstate', e => {
  navIdx = (e.state && e.state.idx) || 0;
  if (typeof getProfile === 'function' && !getProfile()) return;   // 로그인 전에는 로그인 화면 그대로
  routingFromHistory = true;
  Promise.resolve(openRoute(parseRoute(location.hash), { back: true })).finally(() => { routingFromHistory = false; });
});

function showScreen(deviceId, screenName, opts) {
  if (routingFromHistory) opts = Object.assign({}, opts, { back: true });
  const device = document.getElementById(deviceId);
  const leaving = device.querySelector('.screen.active');
  // 떠나는 화면의 스크롤 위치 저장
  saveScreenScroll(leaving);
  // 어디서 왔는지 기록 (뒤로가기로 이동할 때는 기록하지 않는다 — 서로 되돌아가며 갇힌다)
  const from = leaving ? leaving.getAttribute('data-screen') : null;
  if (from && from !== screenName && !(opts && opts.back)) prevScreen[screenName] = from;
  const screens = device.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));
  const target = device.querySelector(`[data-screen="${screenName}"]`);
  if (target) {
    target.classList.add('active');
    const sh = target.querySelector('.sticky-header');
    const sb = target.querySelector('.scroll-body');
    const saved = scrollPos[screenName];
    if (saved && !(opts && opts.reset)) {
      // 뒤로가기 등 재진입: 보던 위치 복원
      const apply = () => { target.scrollTop = saved.top; if (sb) sb.scrollTop = saved.body; };
      apply();
      requestAnimationFrame(apply); // 레이아웃 이후 한 번 더 (안전)
      if (sh) sh.classList.toggle('scrolled', (saved.top || saved.body) > 4);
    } else {
      // 새로 여는 화면: 맨 위로
      target.scrollTop = 0;
      if (sh) sh.classList.remove('scrolled');
      if (sb) sb.scrollTop = 0;
    }
  }
  // '내가 쓴 후기' 진입 시 서버에서 내 후기 로드
  if (screenName === 'my-reviews' && typeof loadMyReviews === 'function') loadMyReviews();
  // '내가 쓴 꿀팁' 진입 시 목록 갱신
  if (screenName === 'my-tips' && typeof renderMyTips === 'function') renderMyTips();
  // 나의페이지 진입 시 후기 개수 갱신
  if (screenName === 'my' && typeof updateMyReviewsCount === 'function') updateMyReviewsCount();
  if (screenName === 'my' && typeof refreshMyPoints === 'function') refreshMyPoints();
  if (screenName === 'tips' && typeof renderNotices === 'function') renderNotices();
  if (screenName === 'faq' && typeof renderFaq === 'function') renderFaq();
  if (screenName === 'my' && typeof updateMyTipsCount === 'function') updateMyTipsCount();
  if (screenName === 'my' && typeof refreshBadgeCount === 'function') refreshBadgeCount();
  if (screenName === 'badges' && typeof renderBadges === 'function') renderBadges();
  // 후기 작성: 휴양소 상세에서 왔으면 그 휴양소로 고정, 그 밖(하단 + 버튼 등)은 고를 수 있게
  if (screenName === 'write' && typeof applyWriteResortLock === 'function') applyWriteResortLock(opts && opts.fixedResort);
  if (target && !routingFromHistory) recordRoute(screenName, from, opts);
}

// 뒤로가기(화면 왼쪽 위 ←): 앱 안에서 넘어온 기록이 있으면 브라우저 뒤로가기와 똑같이 움직인다.
// 링크로 바로 들어와 기록이 없으면 들어왔던 화면(prevScreen) → fallback(기본 홈)으로.
function goBack(deviceId, screenName, fallback) {
  if (navIdx > 0) { history.back(); return; }
  const prev = prevScreen[screenName];
  showScreen(deviceId, (prev && !NO_ROUTE.has(prev) ? prev : null) || fallback || 'home', { back: true, replace: true });
}
