// 사번인증 및 비밀번호 설정 · 회원정보 수정
// ===== 사번인증 및 비밀번호 설정 (회원가입은 없다 — 직원 명단에 있는 사람만, 처음 한 번) =====
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

async function sendAuthCode() {
  const empno = (document.getElementById('su-empno').value || '').trim();
  const email = (document.getElementById('su-email').value || '').trim();
  const errEl = document.getElementById('su-step1-error');
  if (!empno) { errEl.textContent = '사번을 입력해주세요.'; return; }
  if (!/^[^\s@]+@itcen\.com$/i.test(email)) {
    errEl.textContent = '회사 개인 이메일(@itcen.com)을 정확히 입력해주세요.';
    return;
  }
  let res;
  try {
    res = await AuthAPI.verifyCode(empno, email);
  } catch (e) {
    errEl.textContent = e.message;
    return;
  }
  errEl.textContent = '';
  signupState.verified = false;
  const sent = document.getElementById('su-code-sent');
  // 메일 발송 서버가 붙기 전까지는 서버가 코드를 응답에 담아 준다 (server/auth.js AUTH_SHOW_CODE)
  sent.innerHTML = '인증코드가 <b>' + escapeHtml(email) + '</b> 으로 발송되었습니다.' +
    (res.devCode ? '<br>(개발용 코드: <b>' + res.devCode + '</b>)' : '');
  sent.classList.add('show');
  document.getElementById('su-code-row').style.display = 'flex';
  document.getElementById('su-verified').classList.remove('show');
  document.getElementById('su-next1').disabled = true;
  document.getElementById('su-send-btn').textContent = '재발급';
  showToast('인증코드를 발송했습니다');
}

async function confirmAuthCode() {
  const empno = (document.getElementById('su-empno').value || '').trim();
  const code = (document.getElementById('su-code').value || '').trim();
  const errEl = document.getElementById('su-step1-error');
  let hr;
  try {
    hr = await AuthAPI.verifyCheck(empno, code);
  } catch (e) {
    errEl.textContent = e.message;
    return;
  }
  errEl.textContent = '';
  signupState.verified = true;
  signupState.code = code;

  // 인증 완료 → 직원 명단의 이름·직급을 자동으로 채운다 (읽기 전용)
  const nameEl = document.getElementById('su-name');
  const posEl = document.getElementById('su-position');
  if (nameEl) nameEl.value = hr.name || '';
  if (posEl) posEl.value = hr.position || '';

  const vtag = document.getElementById('su-verified');
  vtag.innerHTML = '<i class="ti ti-shield-check"></i>' +
    escapeHtml([hr.name, hr.position].filter(Boolean).join(' ')) + '님, 인증이 완료되었습니다';
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

async function completeSignup() {
  const empno = (document.getElementById('su-empno').value || '').trim();
  const pw = document.getElementById('su-pw1').value || '';
  const phone = (document.getElementById('su-phone').value || '').trim();
  const errEl = document.getElementById('su-step3-error');
  if (!signupState.verified) { errEl.textContent = '사번 인증을 먼저 완료해주세요.'; return; }
  if (!phone) { errEl.textContent = '핸드폰 번호를 입력해주세요.'; return; }
  try {
    await AuthAPI.activate({ empno, code: signupState.code, password: pw, phone });
  } catch (e) {
    errEl.textContent = e.message;
    return;
  }
  errEl.textContent = '';

  showToast('비밀번호 설정이 완료되었습니다. 로그인해주세요.');
  showScreen('device1', 'login');
  // 로그인 화면에 사번 미리 채우기
  const le = document.getElementById('login-empno');
  if (le) le.value = empno;
  const lp = document.getElementById('login-pw');
  if (lp) lp.value = '';
}

// ===== 회원정보 수정 =====
function openEditProfile() {
  const p = getProfile() || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('ep-empno', p.empno);
  // 이름·직급은 회원 정보 그대로 (읽기 전용 — 바꾸려면 관리자에게)
  set('ep-name', p.name);
  set('ep-position', p.position);
  set('ep-phone', p.phone);
  set('ep-email', p.email);
  set('ep-pw-cur', '');
  set('ep-pw-new', '');
  set('ep-pw-new2', '');
  document.getElementById('ep-error').textContent = '';
  showScreen('device1', 'edit-profile');
}

async function saveProfile() {
  const phone = (document.getElementById('ep-phone').value || '').trim();
  const email = (document.getElementById('ep-email').value || '').trim();
  const cur = document.getElementById('ep-pw-cur').value || '';
  const npw = document.getElementById('ep-pw-new').value || '';
  const npw2 = document.getElementById('ep-pw-new2').value || '';
  const errEl = document.getElementById('ep-error');

  if (!phone) { errEl.textContent = '핸드폰 번호를 입력해주세요.'; return; }
  // 비밀번호 변경을 시도하는 경우에만 검증 (현재 비밀번호 확인은 서버가 한다)
  if (cur || npw || npw2) {
    if (!cur) { errEl.textContent = '현재 비밀번호를 입력해주세요.'; return; }
    if (npw.length < 4) { errEl.textContent = '새 비밀번호는 4자리 이상으로 설정해주세요.'; return; }
    if (npw !== npw2) { errEl.textContent = '새 비밀번호가 일치하지 않습니다.'; return; }
  }
  let user;
  try {
    user = await AuthAPI.updateMe({ phone, email, currentPassword: cur || undefined, newPassword: npw || undefined });
  } catch (e) {
    errEl.textContent = e.message;
    return;
  }
  errEl.textContent = '';
  saveProfileData(user);
  applyUserInfo();
  showToast('회원정보가 저장되었습니다');
  showScreen('device1', 'my');
}

// 첫 진입 시 로그인 상태에 따라 시작 화면 결정 — 서버 세션을 확인한다.
// 다른 스크립트(data-source.js 의 서버 감지 등)가 모두 읽힌 뒤에 돌아야 해서 DOMContentLoaded 에서 시작한다
window.addEventListener('DOMContentLoaded', async function initAuthGate() {
  const user = await AuthAPI.me();
  if (user) {
    enterAsUser(user);
  } else {
    saveProfileData(null);
    showScreen('device1', 'login');
  }
});
