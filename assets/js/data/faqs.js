// 고객센터 / FAQ 예시 — 지어낸 내용이다 (실제 규정 · 연락처가 아님).
// 서버: 처음 켤 때 한 번만 DB faqs · settings('support') 에 넣는다 (server/db.js seedFaqs). 그 뒤로는 관리자 페이지 '고객센터 · FAQ' 에서 고친다.
// 서버 없이 열었을 때(시연)는 이 값을 그대로 보여준다 (assets/js/faq.js).

const SUPPORT_SEED = {
  team: '인사복지팀 휴양소 담당',
  phone: '02-000-0000',
  email: 'resort-help@example.com',
  hours: '평일 09:00 ~ 18:00 (점심시간 12:00 ~ 13:00 · 주말 · 공휴일 휴무)',
  note: '예약 · 취소는 회사 예약 시스템에서 해 주세요. 이 앱에서는 휴양소 소개와 후기만 볼 수 있어요.',
};

const FAQ_SEED = [
  { category: '예약 · 이용', question: '휴양소 예약은 어디서 하나요?',
    answer: '예약은 회사 예약 시스템에서 합니다.\n이 앱은 휴양소 소개 · 후기 · 꿀팁을 보는 곳이라 예약 기능은 없어요.' },
  { category: '예약 · 이용', question: '함께 갈 수 있는 사람은 누구인가요?',
    answer: '본인과 직계가족이 이용할 수 있어요.\n자세한 기준은 공지사항 > 이용가이드를 확인해 주세요.' },
  { category: '예약 · 이용', question: '입실 · 퇴실 시간이 궁금해요.',
    answer: '휴양소마다 다릅니다. 휴양소 상세 화면의 \'휴양소 정보 전체보기\' 에서 확인할 수 있어요.' },
  { category: '포인트', question: '휴양소 포인트는 어떻게 모으나요?',
    answer: '앱에서 후기를 1건 쓸 때마다 10P 가 적립돼요.\n적립 내역은 나의 페이지 > 내 휴양소 포인트 > 적립내역에서 볼 수 있어요.' },
  { category: '포인트', question: '후기를 지우면 포인트는 어떻게 되나요?',
    answer: '그 후기로 받은 포인트도 같이 빠져요.' },
  { category: '후기 · 꿀팁', question: '내가 쓴 후기를 고치거나 지우고 싶어요.',
    answer: '나의 페이지 > 내가 쓴 후기에서 지울 수 있어요.\n고치려면 지운 뒤 다시 써 주세요.' },
  { category: '후기 · 꿀팁', question: '후기나 댓글이 안 보여요.',
    answer: '운영 기준에 맞지 않는 글은 관리자가 숨기거나 삭제할 수 있어요.\n궁금한 점은 아래 고객센터로 문의해 주세요.' },
  { category: '계정', question: '비밀번호를 잊어버렸어요.',
    answer: '고객센터로 연락해 비밀번호 초기화를 요청해 주세요.\n초기화한 뒤 로그인 화면의 \'사번인증 및 비밀번호 설정\' 에서 다시 정할 수 있어요.' },
  { category: '계정', question: '연락처 · 비밀번호는 어디서 바꾸나요?',
    answer: '나의 페이지 > 회원정보 수정에서 바꿀 수 있어요.' },
];

// 서버(server/db.js)가 초기값을 읽어갈 수 있게 내보낸다. 브라우저에서는 module 이 없어 건너뛴다
if (typeof module !== 'undefined' && module.exports) module.exports = { FAQ_SEED, SUPPORT_SEED };
