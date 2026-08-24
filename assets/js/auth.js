// 사번 인증 로그인 / 로그아웃 (더미: localStorage)
// ===== 사번 인증 로그인 / 회원가입 / 로그아웃 (더미: localStorage 기반) =====
const AUTH_KEY = 'centam_auth';        // 현재 로그인 세션
const USERS_KEY = 'centam_users';      // 가입한 계정 저장소 (사번 → 정보)
const PROFILE_KEY = 'centam_profile';  // 현재 로그인 사용자의 표시 정보
// 시연용 기본 계정 정보 (실제 DB 연동 없음)
const DEMO_USER = { name: '관리자', position: '', dept: '전략기획팀', short: '관' };

// 이름 + 직급을 합쳐 표시용 이름 생성
function composeDisplayName(p) {
  if (!p) return DEMO_USER.name + ' ' + DEMO_USER.position;
  return [p.name, p.position].filter(Boolean).join(' ').trim() || DEMO_USER.name;
}


// 사번으로 인사정보(이름·직급) 조회.
// 등록되지 않은 사번도 인사 시스템엔 존재한다는 가정 하에, 결정적 더미 데이터를 생성한다.
function lookupHR(empno) {
  const key = String(empno || '').trim();
  if (!key) return null;
  if (HR_DIRECTORY[key]) return HR_DIRECTORY[key];
  const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
  const POSITIONS = ['사원', '선임', '책임', '매니저', '수석'];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return { name: SURNAMES[h % SURNAMES.length] + 'OO', position: POSITIONS[(h >> 3) % POSITIONS.length] };
}
// 시연용 기본 인증 계정 (사번 / 비밀번호)
const VALID_EMPNO = '11223';
const VALID_PW = '0000';

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) { }
}
// 사번에 해당하는 유효 비밀번호 (가입 계정 우선 → 개발용 임시 계정 → 기본 데모 계정)
function getValidPw(empno) {
  const u = getUsers()[empno];
  if (u) return u.pw;
  if (DEMO_ACCOUNTS[empno]) return DEMO_ACCOUNTS[empno].pw;
  if (empno === VALID_EMPNO) return VALID_PW;
  return null;
}

function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function isLoggedIn() { return !!getAuth(); }

function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return null;
}
function saveProfileData(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { }
}
// 로그인한 사번 기준으로 표시용 프로필 구성/저장
function buildProfile(empno) {
  const u = getUsers()[empno];   // localStorage에 저장된 (수정된) 계정
  const demo = DEMO_ACCOUNTS[empno]; // 개발용 임시 계정
  const hr = lookupHR(empno) || {};
  let p;
  if (u) {
    // localStorage 우선 (개인정보 수정 후 저장된 값)
    p = { empno, name: hr.name || u.name || DEMO_USER.name, position: hr.position !== undefined ? hr.position : (u.position || ''), phone: u.phone || '', email: u.email || '' };
  } else if (demo) {
    // 개발용 임시 계정 기본값
    p = { empno, name: demo.name, position: demo.position, phone: demo.phone, email: demo.email };
  } else {
    // 기본 데모 계정
    p = { empno, name: hr.name || DEMO_USER.name, position: hr.position !== undefined ? hr.position : DEMO_USER.position, phone: '010-1234-5678', email: VALID_EMPNO + '@itcen.com' };
  }
  saveProfileData(p);
  return p;
}

function applyUserInfo() {
  const p = getProfile() || { name: DEMO_USER.name, position: DEMO_USER.position };
  const dispName = composeDisplayName(p);
  const nameEl = document.getElementById('us-name');
  const avaEl = document.getElementById('us-ava');
  const myNameEl = document.getElementById('my-name');
  if (nameEl) nameEl.textContent = dispName;
  if (avaEl) avaEl.textContent = (dispName.trim()[0]) || '박';
  if (myNameEl) myNameEl.textContent = dispName;
}

function doLogin(event) {
  if (event) event.preventDefault();
  const empno = (document.getElementById('login-empno').value || '').trim();
  const pw = document.getElementById('login-pw').value || '';
  const keep = document.getElementById('login-keep').checked;
  const errEl = document.getElementById('login-error');

  if (!empno || !pw) {
    errEl.textContent = '사번과 비밀번호를 모두 입력해주세요.';
    return false;
  }
  // 가입 계정 또는 기본 데모 계정으로 인증
  const validPw = getValidPw(empno);
  if (validPw === null || pw !== validPw) {
    errEl.textContent = '사번 또는 비밀번호가 올바르지 않습니다.';
    return false;
  }
  errEl.textContent = '';

  const auth = { empno, ts: Date.now() };
  try {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    if (keep) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_KEY);
  } catch (e) { }

  buildProfile(empno);
  applyUserInfo();
  showScreen('device1', 'home');
  showScrollTooltip();
  return false;
}

function openLogoutConfirm() {
  document.getElementById('logout-modal').classList.add('show');
}
function closeLogoutConfirm(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('logout-modal').classList.remove('show');
}

function doLogout() {
  try {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
  } catch (e) { }
  document.getElementById('logout-modal').classList.remove('show');
  const empnoEl = document.getElementById('login-empno');
  const pwEl = document.getElementById('login-pw');
  const keepEl = document.getElementById('login-keep');
  const errEl = document.getElementById('login-error');
  if (empnoEl) empnoEl.value = '';
  if (pwEl) pwEl.value = '';
  if (keepEl) keepEl.checked = false;
  if (errEl) errEl.textContent = '';
  showScreen('device1', 'login');
}
