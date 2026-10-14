// 사번 로그인 / 로그아웃
//
// 서버가 있으면 서버 회원(DB users 테이블)으로 로그인한다. 비밀번호 확인과 "누구인지" 판단은 서버가 하고,
// 로그인 상태는 서버가 내려준 HttpOnly 쿠키(세션)로 유지된다 — 화면 코드는 쿠키를 읽을 수도 없다.
// 서버가 없으면(GitHub Pages 시연) 시연 계정 하나로만 들어간다 (DEMO_LOGIN).
//
// getProfile() 은 로그인한 회원 정보의 표시용 사본이다 (이름 · 직급 · 사번).
// 화면이 "내 글인지" 같은 표시를 정할 때만 쓰고, 권한은 언제나 서버가 세션으로 다시 판단한다.

const PROFILE_KEY = 'centam_profile';
const DEMO_AUTH_KEY = 'centam_demo_auth';

// 시연 계정 — 서버 없이 열었을 때만 쓴다. 서버에는 이 계정이 없다
const DEMO_LOGIN = {
  empno: '11223', pw: '0000',
  profile: { empno: '11223', name: '관리자', position: '', phone: '', email: '', role: 'user' },
};

// 이름 + 직급을 합쳐 표시용 이름 생성
function composeDisplayName(p) {
  if (!p) return DEMO_LOGIN.profile.name;
  return [p.name, p.position].filter(Boolean).join(' ').trim() || DEMO_LOGIN.profile.name;
}

function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return null;
}
function saveProfileData(p) {
  try {
    if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PROFILE_KEY);
  } catch (e) { }
}

// 'server' | 'demo'. file:// 로 열면 쿠키가 서버로 가지 않아 서버 로그인을 쓸 수 없다
async function authMode() {
  if (location.protocol === 'file:') return 'demo';
  return (await hasReviewServer()) ? 'server' : 'demo';
}

// ===== 로그인 창구 — 화면 코드는 여기로만 로그인·사번인증·정보수정을 한다 =====
const AuthAPI = {
  // 지금 로그인한 직원 (없으면 null)
  async me() {
    if (await authMode() === 'server') {
      try { return (await apiFetch('/api/auth/me')).user; }
      catch (e) { return null; }
    }
    let on = false;
    try { on = !!(sessionStorage.getItem(DEMO_AUTH_KEY) || localStorage.getItem(DEMO_AUTH_KEY)); } catch (e) { }
    return on ? DEMO_LOGIN.profile : null;
  },
  async login(empno, password, keep) {
    if (await authMode() === 'server') {
      return (await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ empno, password, keep }) })).user;
    }
    if (empno !== DEMO_LOGIN.empno || password !== DEMO_LOGIN.pw) {
      throw new Error('사번 또는 비밀번호가 올바르지 않습니다.');
    }
    try {
      sessionStorage.setItem(DEMO_AUTH_KEY, '1');
      if (keep) localStorage.setItem(DEMO_AUTH_KEY, '1');
    } catch (e) { }
    return DEMO_LOGIN.profile;
  },
  async logout() {
    if (await authMode() === 'server') {
      try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* 이미 끊긴 세션 */ }
    }
    try { sessionStorage.removeItem(DEMO_AUTH_KEY); localStorage.removeItem(DEMO_AUTH_KEY); } catch (e) { }
  },
  // 사번인증 · 정보수정은 서버가 있어야 한다 (직원 명단이 서버에 있다)
  async requireServer() {
    if (await authMode() !== 'server') throw new Error('서버에 연결되어 있지 않아 지금은 할 수 없어요.');
  },
  // 사번인증 1) 사번 + 회사 메일 → 인증코드 발급 → { devCode? }
  async verifyCode(empno, email) {
    await this.requireServer();
    return apiFetch('/api/auth/verify/code', { method: 'POST', body: JSON.stringify({ empno, email }) });
  },
  // 사번인증 2) 코드 확인 → { name, position } (직원 명단의 값)
  async verifyCheck(empno, code) {
    await this.requireServer();
    return apiFetch('/api/auth/verify/check', { method: 'POST', body: JSON.stringify({ empno, code }) });
  },
  // 사번인증 3) 비밀번호 설정
  async activate(body) {
    await this.requireServer();
    return apiFetch('/api/auth/activate', { method: 'POST', body: JSON.stringify(body) });
  },
  async updateMe(body) {
    await this.requireServer();
    return (await apiFetch('/api/auth/me', { method: 'PUT', body: JSON.stringify(body) })).user;
  },
};

function applyUserInfo() {
  const p = getProfile() || DEMO_LOGIN.profile;
  const dispName = composeDisplayName(p);
  const nameEl = document.getElementById('us-name');
  const avaEl = document.getElementById('us-ava');
  const myNameEl = document.getElementById('my-name');
  if (nameEl) nameEl.textContent = dispName;
  if (avaEl) avaEl.textContent = (dispName.trim()[0]) || '박';
  if (myNameEl) myNameEl.textContent = dispName;
  // 나의 페이지 이름 아래: 부서 · 회사 (모르면 '사번 인증 완료')
  const roleEl = document.getElementById('my-role');
  if (roleEl) roleEl.textContent = [p.department, p.company].filter(Boolean).join(' · ') || '사번 인증 완료';
  // 후기 작성 화면 '사번 인증 완료' 아래
  const vEl = document.getElementById('write-verify-sub');
  if (vEl) vEl.textContent = `${dispName} 님 이름으로 등록돼요`;
}

// 로그인 직후 · 첫 진입 시 공통
function enterAsUser(user) {
  saveProfileData(user);
  applyUserInfo();
  openStartRoute();   // 주소에 화면이 있으면(공유받은 링크 · 새로고침) 그 화면, 없으면 홈 (core.js)
  // 로그인 전에는 사번이 없어 내 알림을 못 받아온다. 이제 다시 맞춘다.
  if (typeof refreshNotiBadge === 'function') refreshNotiBadge();
  if (typeof loadFavorites === 'function') loadFavorites();
}

async function doLogin(event) {
  if (event) event.preventDefault();
  const empno = (document.getElementById('login-empno').value || '').trim();
  const pw = document.getElementById('login-pw').value || '';
  const keep = document.getElementById('login-keep').checked;
  const errEl = document.getElementById('login-error');

  if (!empno || !pw) {
    errEl.textContent = '사번과 비밀번호를 모두 입력해주세요.';
    return false;
  }
  try {
    const user = await AuthAPI.login(empno, pw, keep);
    errEl.textContent = '';
    enterAsUser(user);
    showScrollTooltip();
  } catch (e) {
    errEl.textContent = e.message || '로그인에 실패했어요.';
  }
  return false;
}

function openLogoutConfirm() {
  document.getElementById('logout-modal').classList.add('show');
}
function closeLogoutConfirm(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('logout-modal').classList.remove('show');
}

async function doLogout() {
  await AuthAPI.logout();
  saveProfileData(null);
  if (typeof loadFavorites === 'function') loadFavorites();   // 로그아웃 → 별 모두 끔
  document.getElementById('logout-modal').classList.remove('show');
  const empnoEl = document.getElementById('login-empno');
  const pwEl = document.getElementById('login-pw');
  const keepEl = document.getElementById('login-keep');
  const errEl = document.getElementById('login-error');
  if (empnoEl) empnoEl.value = '';
  if (pwEl) pwEl.value = '';
  if (keepEl) keepEl.checked = false;
  if (errEl) errEl.textContent = '';
  // 로그아웃하면 주소도 비운다 (다음 사람이 로그인했을 때 이전 사람의 화면으로 가지 않게)
  history.replaceState(null, '', location.pathname + location.search);
  navIdx = 0;
  showScreen('device1', 'login');
}
