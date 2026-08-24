// 시연용 HR(인사) 디렉터리 · 개발용 임시 계정
// ===== 시연용 HR(인사) 디렉터리 =====
// 실제로는 사번으로 인사 시스템을 조회해 이름·직급을 받아오지만,
// 지금은 연동이 불가하므로 더미 매핑으로 대체한다.
const HR_DIRECTORY = {
  '11223': { name: '관리자', position: '' },
  '20451': { name: '김OO', position: '선임' },
  '33102': { name: '이OO', position: '매니저' },
  '40876': { name: '최OO', position: '수석' },
  '51234': { name: '정OO', position: '사원' },
  // ===== 개발용 임시 계정 (실명) =====
  '11343': { name: '김효정', position: '책임' },
  '11750': { name: '임소미', position: '수석' },
  '11865': { name: '김솔이', position: '책임' },
  '11875': { name: '박가연', position: '책임' },
  '11887': { name: '김자경', position: '책임' }
};

// ===== 개발용 임시 계정 전체 정보 (사번 → {비번, 이름, 직급, 전화, 이메일}) =====
// 초기 비밀번호: 0000 (공통)
const DEMO_ACCOUNTS = {
  '11343': { pw: '0000', name: '김효정', position: '책임', phone: '010-6233-9617', email: 'hjkim4@itcen.com' },
  '11750': { pw: '0000', name: '임소미', position: '수석', phone: '010-4416-5333', email: 'smlim@itcen.com' },
  '11865': { pw: '0000', name: '김솔이', position: '책임', phone: '010-7743-2602', email: 'kimsolyi@itcen.com' },
  '11875': { pw: '0000', name: '박가연', position: '책임', phone: '010-4922-7098', email: 'gypark@itcen.com' },
  '11887': { pw: '0000', name: '김자경', position: '책임', phone: '010-4576-8556', email: 'jk_kim@itcen.com' }
};
