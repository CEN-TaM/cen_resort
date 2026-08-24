// 공지사항 데이터 · 첨부파일 아이콘 매핑
const NOTICES = {
  n1: {
    pinned: true, category: '예약', categoryTone: 'sky',
    title: '2026년 하계 휴양소 예약이 오픈됩니다',
    author: '인사복지팀', authorInitial: '인', date: '2026.05.19', views: '2,184',
    body: `<p><strong>5/27(화) 오전 10시</strong>부터 7~8월 하계 휴양소 예약이 오픈됩니다. 올해는 신규 오픈된 조천 휴양소 2호점이 추가되어 총 9개 휴양소를 이용하실 수 있습니다.</p>
    <h4>예약 일정</h4>
    <ul>
      <li>5/27(화) 10:00 — 일반 예약 오픈</li>
      <li>5/27(화) 14:00 — 인기 시즌 추첨제 신청 시작</li>
      <li>6/3(화) — 추첨 결과 사내 메일 발송</li>
    </ul>
    <h4>인기 시즌 추첨제</h4>
    <p>8월 1주차(7/31~8/4)는 신청자가 매년 정원의 5배를 초과해 <strong>전사번 기반 추첨제</strong>로 진행됩니다. 가족 동반(2인 이상)일 경우 가중치가 적용됩니다.</p>
    <div class="callout">예약 변경/취소는 출발 7일 전까지 패널티 없이 가능합니다. 7일 이내 취소 시 복지포인트 차감(20%)이 있으니 유의 바랍니다.</div>
    <p>문의: 인사복지팀 ☎ 02-XXX-1234</p>`,
    files: [
      { name: '하계_휴양소_예약_안내.pdf', size: '1.2MB', type: 'pdf', date: '2026.05.19' },
      { name: '예약_신청서.docx', size: '184KB', type: 'doc', date: '2026.05.19' },
      { name: '휴양소_시설정보.xlsx', size: '436KB', type: 'xls', date: '2026.05.18' }
    ]
  },
  n2: {
    pinned: true, category: '복지포인트', categoryTone: 'mint',
    title: '2분기 복지포인트 적립 안내 (+50,000P)',
    author: '총무팀', authorInitial: '총', date: '2026.05.17', views: '1,756',
    body: `<p>4월 1일자로 <strong>분기 복지포인트 50,000P</strong>가 일괄 적립되었습니다.</p>
    <h4>사용 가능처</h4>
    <ul>
      <li>사내 휴양소 예약 (객실 추가 옵션 포함)</li>
      <li>사내 카페테리아 결제</li>
      <li>제휴 서점 도서 구입</li>
      <li>온라인 강의 플랫폼 (사내 학습조직 지정)</li>
    </ul>
    <div class="callout">미사용 포인트는 <strong>매년 12/31 일괄 소멸</strong>됩니다. 연말까지 사용 계획을 미리 세우세요.</div>
    <p>잔여 포인트는 [나의페이지 → 복지포인트] 에서 실시간으로 확인할 수 있습니다.</p>`,
    files: [
      { name: '복지포인트_사용가이드.pdf', size: '892KB', type: 'pdf', date: '2026.05.17' },
      { name: '제휴처_목록.xlsx', size: '312KB', type: 'xls', date: '2026.05.17' }
    ]
  },
  n3: {
    pinned: false, category: '이용수칙', categoryTone: 'peach',
    title: '휴양소 이용 수칙 개정 안내 (5/15 시행)',
    author: '총무팀', authorInitial: '총', date: '2026.05.15', views: '982',
    body: `<p>휴양소 이용 수칙이 5/15부로 개정됩니다. 주요 변경 사항은 아래와 같습니다.</p>
    <h4>주요 개정 사항</h4>
    <ul>
      <li><strong>반려동물 동반 가능 휴양소 확대</strong>: 기존 가평 1곳 → <strong>조천·가평 2곳</strong>으로 확대</li>
      <li><strong>흡연 구역 일원화</strong>: 외부 흡연 부스로만 이용 가능 (객실/베란다/공용공간 전면 금연)</li>
      <li>체크인 시간 16:00 → <strong>15:00</strong> 조정 (단, 동절기 11~2월은 기존 유지)</li>
      <li>퇴실 청결도 평가제 도입 (별점 5점 이상 시 +500P 적립)</li>
    </ul>
    <div class="callout">이번 개정은 동료들의 의견을 반영한 결과입니다. 5/15 이후 예약 건부터 신규 수칙이 적용되니 참고 바랍니다.</div>`,
    files: [
      { name: '이용수칙_개정안.pdf', size: '2.1MB', type: 'pdf', date: '2026.05.15' },
      { name: '개정요약본.hwp', size: '76KB', type: 'hwp', date: '2026.05.15' }
    ]
  },
  n4: {
    pinned: false, category: '이벤트', categoryTone: 'coral',
    title: '첫 리뷰 작성하고 +500P 받기 이벤트',
    author: '인사복지팀', authorInitial: '인', date: '2026.05.13', views: '1,341',
    body: `<p>아직 휴양소 리뷰를 한 번도 작성하지 않으셨나요? 지금이 기회입니다!</p>
    <h4>참여 조건</h4>
    <ul>
      <li>사진 <strong>4장 이상</strong> 첨부</li>
      <li>본문 <strong>200자 이상</strong> 상세 후기</li>
      <li>이용일 기준 2주 이내 작성</li>
    </ul>
    <h4>적립 혜택</h4>
    <p>위 조건 충족 시 <strong>첫 1회에 한해 +500P</strong>가 즉시 적립됩니다. 이미 리뷰를 작성하신 분도 이번 기회에 한 번 더!</p>
    <div class="callout">이벤트 기간: ~ 2026.06.30 / 동료들의 솔직한 후기가 모두의 휴가를 더 빛나게 합니다.</div>`,
    files: [
      { name: '이벤트_포스터.png', size: '1.8MB', type: 'img', date: '2026.05.13' }
    ]
  },
  n5: {
    pinned: false, category: '시설', categoryTone: 'lilac',
    title: '조천 휴양소 정기 시설 점검 (5/22 ~ 5/24)',
    author: '시설관리팀', authorInitial: '시', date: '2026.05.13', views: '614',
    body: `<p>조천 휴양소 1호점이 정기 시설 점검을 위해 일시 이용이 중단됩니다.</p>
    <h4>점검 일정 및 항목</h4>
    <ul>
      <li>2026.05.22(목) ~ 05.24(토) 3일간</li>
      <li>보일러·온수 시스템 점검</li>
      <li>에어컨 필터 및 냉매 충전</li>
      <li>주방 가스레인지·후드 안전 점검</li>
    </ul>
    <div class="callout">해당 기간 기존 예약자께는 개별 안내드렸으며, 일정 변경 시 <strong>+1,000P 보상</strong>이 지급됩니다. 대체 휴양소(애월·여수) 예약은 잔여 정원 한도 내 가능합니다.</div>`,
    files: [
      { name: '시설점검_일정안내.pdf', size: '742KB', type: 'pdf', date: '2026.05.13' }
    ]
  },
  n6: {
    pinned: false, category: '예약', categoryTone: 'sky',
    title: '추석 연휴 휴양소 예약 가이드',
    author: '인사복지팀', authorInitial: '인', date: '2026.05.06', views: '1,108',
    body: `<p>추석 연휴(9/26~9/29) 휴양소 예약은 신청자가 폭주하는 시기로, 전년도와 같이 <strong>사번 기반 추첨제</strong>로 진행됩니다.</p>
    <h4>신청 방법</h4>
    <ul>
      <li>신청 기간: 7/1(월) ~ 7/31(수)</li>
      <li>신청 채널: 인트라넷 → 복지 → 휴양소 → 추석 추첨 신청</li>
      <li>1인 1신청, 동반자 정보 입력 필수</li>
    </ul>
    <h4>가중치 적용 기준</h4>
    <ul>
      <li>가족 동반(배우자+자녀) 신청 — 가중치 ×2</li>
      <li>직전 1년간 휴양소 미이용자 — 가중치 ×1.5</li>
      <li>장기근속자(10년 이상) — 가중치 ×1.3</li>
    </ul>
    <div class="callout">추첨 결과는 8/5(월) 사내 메일 + 본 앱 알림으로 발송됩니다.</div>`,
    files: [
      { name: '추석연휴_신청서.docx', size: '208KB', type: 'doc', date: '2026.05.06' },
      { name: '휴양소_위치도.pdf', size: '3.2MB', type: 'pdf', date: '2026.05.05' },
      { name: '연휴_운영일정.xlsx', size: '94KB', type: 'xls', date: '2026.05.05' }
    ]
  },
  n7: {
    pinned: false, category: '예약', categoryTone: 'sky',
    title: '하계 휴양소 2차 예약 접수 안내 (6/8~6/17)',
    author: '인사복지팀', authorInitial: '인', date: '2026.06.05', views: '1,427',
    body: `<p>1차 예약에서 마감되지 않은 잔여 객실을 대상으로 <strong>2차 예약 접수</strong>를 진행합니다. 1차에서 신청하지 못하셨거나 일정을 변경하고 싶으신 분들께서는 이 기간을 이용해 주세요.</p>
    <h4>접수 기간</h4>
    <ul>
      <li><strong>2026.06.08(월) 10:00 ~ 06.17(수) 18:00</strong></li>
      <li>선착순 접수 (잔여 객실 소진 시 조기 마감)</li>
    </ul>
    <h4>대상 휴양소</h4>
    <ul>
      <li>1차 예약 후 잔여 객실이 남은 전 휴양소</li>
      <li>잔여 현황은 [홈 → 휴양소 예약] 화면에서 실시간 확인 가능</li>
    </ul>
    <div class="callout">2차 접수는 추첨 없이 <strong>선착순</strong>으로 진행됩니다. 인기 일정은 빠르게 마감될 수 있으니 서둘러 신청해 주세요. 예약 변경/취소는 출발 7일 전까지 패널티 없이 가능합니다.</div>
    <p>문의: 인사복지팀 ☎ 02-XXX-1234</p>`,
    files: [
      { name: '2차_예약_안내.pdf', size: '968KB', type: 'pdf', date: '2026.06.05' },
      { name: '잔여객실_현황.xlsx', size: '256KB', type: 'xls', date: '2026.06.05' }
    ]
  }
};

const FILE_ICON = {
  pdf: { ico: 'picture_as_pdf', tone: 'tone-coral', label: 'PDF' },
  doc: { ico: 'description', tone: 'tone-sky', label: 'DOC' },
  xls: { ico: 'table_chart', tone: 'tone-mint', label: 'XLSX' },
  zip: { ico: 'folder_zip', tone: 'tone-peach', label: 'ZIP' },
  img: { ico: 'image', tone: 'tone-lilac', label: 'IMG' },
  hwp: { ico: 'description', tone: 'tone-cream', label: 'HWP' }
};
