// 회원가입 · 회원정보 수정
// ===== 회원가입: 사번인증 및 비밀번호 설정 =====
let signupState = { code: '', verified: false };

function openSignup() {
  // 초기화
  signupState = { code: '', verified: false };
  ['su-empno', 'su-email', 'su-code', 'su-pw1', 'su-pw2', 'su-phone', 'su-name', 'su-position'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['su-step1-error', 'su-step2-error', 'su-step3-error'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });
  document.getElementById('su-code-sent').classList.remove('show');
  document.getElementById('su-code-row').style.display = 'none';
  const vtag = document.getElementById('su-verified');
  vtag.classList.remove('show');
  vtag.innerHTML = '<i class="ti ti-shield-check"></i>이메일 인증이 완료되었습니다';
  document.getElementById('su-send-btn').disabled = false;
  document.getElementById('su-next1').disabled = true;
  signupGoStep(1);
  showScreen('device1', 'signup');
}

function goSignupBack() {
  showScreen('device1', 'login');
}

function signupGoStep(n) {
  // 단계 패널 토글
  document.querySelectorAll('#device1 [data-screen="signup"] .signup-step').forEach(s => {
    s.classList.toggle('active', s.getAttribute('data-step') === String(n));
  });
  // 인디케이터 갱신
  for (let i = 1; i <= 3; i++) {
    const step = document.getElementById('si-' + i);
    if (!step) continue;
    step.classList.toggle('active', i === n);
    step.classList.toggle('done', i < n);
  }
  const b1 = document.getElementById('si-bar1');
  const b2 = document.getElementById('si-bar2');
  if (b1) b1.classList.toggle('done', n >= 2);
  if (b2) b2.classList.toggle('done', n >= 3);
  const sb = document.querySelector('#device1 [data-screen="signup"] .scroll-body');
  if (sb) sb.scrollTop = 0;
}

function sendAuthCode() {
  const empno = (document.getElementById('su-empno').value || '').trim();
  const email = (document.getElementById('su-email').value || '').trim();
  const errEl = document.getElementById('su-step1-error');
  if (!empno) { errEl.textContent = '사번을 입력해주세요.'; return; }
  if (!/^[^\s@]+@itcen\.com$/i.test(email)) {
    errEl.textContent = '회사 개인 이메일(@itcen.com)을 정확히 입력해주세요.';
    return;
  }
  errEl.textContent = '';
  // 데모: 6자리 인증코드 생성 (시연 편의를 위해 화면에 표시)
  const code = String(((empno.length * 7919 + email.length * 104729) % 900000) + 100000);
  signupState.code = code;
  signupState.verified = false;
  const sent = document.getElementById('su-code-sent');
  sent.innerHTML = '인증코드가 <b>' + email + '</b> 으로 발송되었습니다.<br>(데모용 코드: <b>' + code + '</b>)';
  sent.classList.add('show');
  document.getElementById('su-code-row').style.display = 'flex';
  document.getElementById('su-verified').classList.remove('show');
  document.getElementById('su-next1').disabled = true;
  document.getElementById('su-send-btn').textContent = '재발급';
  showToast('인증코드를 발송했습니다');
}

function confirmAuthCode() {
  const code = (document.getElementById('su-code').value || '').trim();
  const errEl = document.getElementById('su-step1-error');
  if (!signupState.code) { errEl.textContent = '먼저 인증코드를 발급받아주세요.'; return; }
  if (code !== signupState.code) { errEl.textContent = '인증코드가 일치하지 않습니다.'; return; }
  errEl.textContent = '';
  signupState.verified = true;

  // 사번 인증 완료 → 인사정보(이름·직급) 자동 조회 후 채움
  const empno = (document.getElementById('su-empno').value || '').trim();
  const hr = lookupHR(empno);
  signupState.hr = hr;
  const nameEl = document.getElementById('su-name');
  const posEl = document.getElementById('su-position');
  if (nameEl) nameEl.value = hr ? hr.name : '';
  if (posEl) posEl.value = hr ? hr.position : '';

  const vtag = document.getElementById('su-verified');
  vtag.innerHTML = '<i class="ti ti-shield-check"></i>' +
    (hr ? `${hr.name} ${hr.position}님, ` : '') + '인증이 완료되었습니다';
  vtag.classList.add('show');
  document.getElementById('su-next1').disabled = false;
  showToast('이메일 인증이 완료되었습니다');
}

// 1 → 2 검증, 2 → 3 검증을 signupGoStep 호출 전에 수행
(function wrapSignupSteps() {
  const orig = signupGoStep;
  signupGoStep = function (n) {
    // 다음 단계로 진행할 때만 검증 (이전 버튼은 자유 이동)
    const cur = currentSignupStep();
    if (n > cur) {
      if (cur === 1 && n === 2) {
        if (!signupState.verified) {
          document.getElementById('su-step1-error').textContent = '사번 인증을 먼저 완료해주세요.';
          return;
        }
      }
      if (cur === 2 && n === 3) {
        const pw1 = document.getElementById('su-pw1').value || '';
        const pw2 = document.getElementById('su-pw2').value || '';
        const e2 = document.getElementById('su-step2-error');
        if (pw1.length < 4) { e2.textContent = '비밀번호는 4자리 이상으로 설정해주세요.'; return; }
        if (pw1 !== pw2) { e2.textContent = '1차·2차 비밀번호가 일치하지 않습니다.'; return; }
        e2.textContent = '';
      }
    }
    orig(n);
  };
})();

function currentSignupStep() {
  const active = document.querySelector('#device1 [data-screen="signup"] .signup-step.active');
  return active ? parseInt(active.getAttribute('data-step'), 10) : 1;
}

function completeSignup() {
  const empno = (document.getElementById('su-empno').value || '').trim();
  const email = (document.getElementById('su-email').value || '').trim();
  const pw = document.getElementById('su-pw1').value || '';
  const phone = (document.getElementById('su-phone').value || '').trim();
  const name = (document.getElementById('su-name').value || '').trim();
  const position = (document.getElementById('su-position').value || '').trim();
  const errEl = document.getElementById('su-step3-error');
  if (!name) { errEl.textContent = '사번 인증을 먼저 완료해주세요. (인사정보 미조회)'; return; }
  if (!phone) { errEl.textContent = '핸드폰 번호를 입력해주세요.'; return; }
  errEl.textContent = '';

  const users = getUsers();
  users[empno] = { pw, name, position, phone, email };
  saveUsers(users);

  showToast('가입이 완료되었습니다. 로그인해주세요.');
  showScreen('device1', 'login');
  // 로그인 화면에 사번 미리 채우기
  const le = document.getElementById('login-empno');
  if (le) le.value = empno;
  const lp = document.getElementById('login-pw');
  if (lp) lp.value = '';
}

// ===== 회원정보 수정 =====
function openEditProfile() {
  const auth = getAuth();
  const empno = auth ? auth.empno : VALID_EMPNO;
  const p = getProfile() || buildProfile(empno);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('ep-empno', p.empno || empno);
  // 이름·직급은 인사정보(HR)에서 조회한 값을 사용 (읽기 전용)
  const hr = lookupHR(p.empno || empno) || {};
  set('ep-name', hr.name || p.name);
  set('ep-position', hr.position !== undefined ? hr.position : (p.position || ''));
  set('ep-phone', p.phone);
  set('ep-email', p.email);
  set('ep-pw-cur', '');
  set('ep-pw-new', '');
  set('ep-pw-new2', '');
  document.getElementById('ep-error').textContent = '';
  showScreen('device1', 'edit-profile');
}

function saveProfile() {
  const auth = getAuth();
  const empno = auth ? auth.empno : VALID_EMPNO;
  const name = (document.getElementById('ep-name').value || '').trim();
  const position = (document.getElementById('ep-position').value || '').trim();
  const phone = (document.getElementById('ep-phone').value || '').trim();
  const email = (document.getElementById('ep-email').value || '').trim();
  const cur = document.getElementById('ep-pw-cur').value || '';
  const npw = document.getElementById('ep-pw-new').value || '';
  const npw2 = document.getElementById('ep-pw-new2').value || '';
  const errEl = document.getElementById('ep-error');

  if (!name) { errEl.textContent = '이름을 입력해주세요.'; return; }
  if (!phone) { errEl.textContent = '핸드폰 번호를 입력해주세요.'; return; }

  const users = getUsers();
  const existing = users[empno] || { pw: getValidPw(empno) };
  let newPw = existing.pw;

  // 비밀번호 변경을 시도하는 경우에만 검증
  if (cur || npw || npw2) {
    if (cur !== getValidPw(empno)) { errEl.textContent = '현재 비밀번호가 올바르지 않습니다.'; return; }
    if (npw.length < 4) { errEl.textContent = '새 비밀번호는 4자리 이상으로 설정해주세요.'; return; }
    if (npw !== npw2) { errEl.textContent = '새 비밀번호가 일치하지 않습니다.'; return; }
    newPw = npw;
  }
  errEl.textContent = '';

  users[empno] = { pw: newPw, name, position, phone, email };
  saveUsers(users);
  saveProfileData({ empno, name, position, phone, email });
  applyUserInfo();
  showToast('회원정보가 저장되었습니다');
  showScreen('device1', 'my');
}

// 첫 진입 시 인증 상태에 따라 시작 화면 결정
(function initAuthGate() {
  if (isLoggedIn()) {
    const auth = getAuth();
    if (!getProfile() && auth) buildProfile(auth.empno);
    applyUserInfo();
    showScreen('device1', 'home');
  } else {
    showScreen('device1', 'login');
  }
})();
