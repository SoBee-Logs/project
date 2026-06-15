const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";

const NAV = "1B2E4B";
const BG = "F0F4F8";

const makeShadow = () => ({
  type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.10
});

function addHeader(slide, title) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.72, fill: { color: NAV }, line: { color: NAV } });
  slide.addText(title, { x: 0.4, y: 0, w: 8.8, h: 0.72, fontSize: 19, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
  slide.addText("SoBee / A파트", { x: 0, y: 0, w: 9.6, h: 0.72, fontSize: 10, color: "90AAC8", align: "right", valign: "middle", margin: 0 });
}

function addFooter(slide, text) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.33, w: 10, h: 0.3, fill: { color: NAV }, line: { color: NAV } });
  slide.addText(text, { x: 0, y: 5.33, w: 10, h: 0.3, fontSize: 8, color: "90AAC8", align: "center", valign: "middle", margin: 0 });
}

// ─────────────────────────────────────────
// SLIDE 1: 섹션 커버
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: NAV };

  slide.addShape(pres.shapes.LINE, { x: 0.8, y: 2.1, w: 3.2, h: 0, line: { color: "0EA5E9", width: 2 } });

  slide.addText("A파트", { x: 0.8, y: 1.5, w: 8.4, h: 0.5, fontSize: 16, color: "90AAC8", bold: true, margin: 0 });
  slide.addText("데이터 파이프라인 및 로직", { x: 0.8, y: 2.2, w: 8.4, h: 1.1, fontSize: 34, bold: true, color: "FFFFFF", margin: 0 });
  slide.addText("스케줄러  ·  CODEF API  ·  데이터 처리  ·  관리자 페이지", {
    x: 0.8, y: 3.35, w: 8.4, h: 0.45, fontSize: 13.5, color: "CADCFC", margin: 0
  });
  slide.addText("SoBee 프로젝트", { x: 0.8, y: 4.85, w: 8.4, h: 0.4, fontSize: 11, color: "90AAC8", margin: 0 });
}

// ─────────────────────────────────────────
// SLIDE 2: 전체 데이터 흐름
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "전체 데이터 흐름 개요");
  addFooter(slide, "CODEF → FastAPI → MySQL → Airflow → AI 분석");

  const boxes = [
    { label: "CODEF API", sub: "카드·은행\n마이데이터 수집", color: "E8511A" },
    { label: "FastAPI\nsync_service", sub: "거래내역 수집\n& UPSERT", color: "0EA5E9" },
    { label: "MySQL RDS", sub: "bank/card\ntransactions 저장", color: "10B981" },
    { label: "Airflow DAG", sub: "매일 02:00\n전체 유저 트리거", color: "017CEE" },
    { label: "AI 분석 엔진", sub: "카테고리 매핑\n생애주기 · 아바타", color: "10A37F" },
  ];

  const boxW = 1.55, boxH = 1.2, arrowW = 0.22;
  const totalW = boxes.length * boxW + (boxes.length - 1) * arrowW;
  const startX = (10 - totalW) / 2;
  const boxY = 1.75;

  boxes.forEach((box, i) => {
    const x = startX + i * (boxW + arrowW);
    slide.addShape(pres.shapes.RECTANGLE, { x, y: boxY, w: boxW, h: boxH, fill: { color: box.color }, line: { color: box.color }, shadow: makeShadow() });
    slide.addText(box.label, { x, y: boxY + 0.08, w: boxW, h: 0.48, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(box.sub, { x, y: boxY + 0.6, w: boxW, h: 0.55, fontSize: 8, color: "E8F0FE", align: "center", margin: 0 });
    if (i < boxes.length - 1) {
      slide.addText("→", { x: x + boxW, y: boxY + 0.4, w: arrowW, h: 0.4, fontSize: 13, color: "94A3B8", align: "center", valign: "middle", margin: 0 });
    }
  });

  // Description cards
  const descs = [
    { step: "①", text: "유저 금융기관 인증(connected_id)으로 CODEF에서 카드·은행 거래내역 수집", color: "E8511A" },
    { step: "②", text: "FastAPI sync_service가 raw 데이터 → MySQL 4개 테이블(bank/card_accounts, bank/card_transactions) UPSERT", color: "0EA5E9" },
    { step: "③", text: "Airflow가 매일 02:00 KST 전체 유저 동기화 트리거 (회원가입 시 즉시 트리거 가능)", color: "017CEE" },
    { step: "④", text: "거래 데이터를 카테고리 매핑 → 생애주기 예측 → 주간 아바타 생성으로 AI 처리", color: "10A37F" },
  ];

  descs.forEach((d, i) => {
    const y = 3.3 + i * 0.46;
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y, w: 0.35, h: 0.35, fill: { color: d.color }, line: { color: d.color } });
    slide.addText(d.step, { x: 0.3, y, w: 0.35, h: 0.35, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(d.text, { x: 0.75, y: y + 0.03, w: 9.0, h: 0.3, fontSize: 9, color: "334155", valign: "middle", margin: 0 });
  });
}

// ─────────────────────────────────────────
// SLIDE 3: CODEF 온보딩
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "CODEF 연동 온보딩 (최초 1회)");
  addFooter(slide, "loginId / loginPw는 CODEF에만 전달 — 서버에 저장되지 않음");

  const steps = [
    { num: "1", title: "인증 정보 입력", desc: "유저가 loginId / loginPw\n직접 입력" },
    { num: "2", title: "OAuth 토큰 발급", desc: "client_id:secret → Base64\nCODEF 토큰 서버 인증" },
    { num: "3", title: "RSA 암호화", desc: "CODEF 공개키로\n비밀번호 RSA 암호화" },
    { num: "4", title: "connected_id 발급", desc: "/v1/account/create\n신규 connected_id 반환" },
    { num: "5", title: "Secrets Manager 저장", desc: "sobee/codef/{user_id}\n기관별 cid 맵 저장" },
  ];

  const boxW = 1.63, boxH = 1.5, arrowW = 0.16;
  const totalW = steps.length * boxW + (steps.length - 1) * arrowW;
  const startX = (10 - totalW) / 2;
  const boxY = 1.1;

  steps.forEach((step, i) => {
    const x = startX + i * (boxW + arrowW);
    slide.addShape(pres.shapes.RECTANGLE, { x, y: boxY, w: boxW, h: boxH, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
    slide.addShape(pres.shapes.OVAL, { x: x + 0.62, y: boxY + 0.12, w: 0.38, h: 0.38, fill: { color: "E8511A" }, line: { color: "E8511A" } });
    slide.addText(step.num, { x: x + 0.62, y: boxY + 0.12, w: 0.38, h: 0.38, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(step.title, { x: x + 0.08, y: boxY + 0.6, w: boxW - 0.16, h: 0.36, fontSize: 10, bold: true, color: "1B2E4B", align: "center", valign: "middle", margin: 0 });
    slide.addShape(pres.shapes.LINE, { x: x + 0.12, y: boxY + 1.0, w: boxW - 0.24, h: 0, line: { color: "E2E8F0", width: 0.5 } });
    slide.addText(step.desc, { x: x + 0.08, y: boxY + 1.06, w: boxW - 0.16, h: 0.38, fontSize: 8.5, color: "475569", align: "center", margin: 0 });
    if (i < steps.length - 1) {
      slide.addText("→", { x: x + boxW, y: boxY + 0.56, w: arrowW, h: 0.38, fontSize: 12, color: "94A3B8", align: "center", valign: "middle", margin: 0 });
    }
  });

  // 기관 추가 설명
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 2.95, w: 9.4, h: 0.06, fill: { color: "0EA5E9" }, line: { color: "0EA5E9" } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 3.0, w: 9.4, h: 1.6, fill: { color: "EFF6FF" }, line: { color: "BFDBFE", width: 0.5 } });
  slide.addText("기관 추가 등록 — 동일 인증수단으로 여러 기관 묶기 (/v1/account/add)", { x: 0.5, y: 3.08, w: 9.0, h: 0.28, fontSize: 10, bold: true, color: "1D4ED8", margin: 0 });

  const notes = [
    "• 같은 loginId/loginPw로 여러 기관 등록 시 /v1/account/add 호출 → 기존 connected_id에 기관 추가",
    "• CODEF 스펙: connected_id 1개 → 기관 N개 (예: 동일 인증서로 KB은행 + 국민카드)",
    "• 기관별 connected_id 맵은 AWS Secrets Manager에 JSON으로 저장\n  예: { \"cid_abc\": [{\"businessType\":\"BK\",\"organization\":\"0020\"}, {\"businessType\":\"CD\",\"organization\":\"0301\"}] }",
    "• 구형 포맷({BK: {0020: cid}}) 자동 마이그레이션 지원",
  ];
  slide.addText(notes.map((n, i) => ({ text: n, options: { breakLine: i < notes.length - 1 } })), {
    x: 0.5, y: 3.4, w: 9.0, h: 1.1, fontSize: 9, color: "1E3A5F", margin: 0
  });
}

// ─────────────────────────────────────────
// SLIDE 4: CODEF 거래 수집 로직
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "CODEF 거래내역 수집 로직");
  addFooter(slide, "은행: 계좌 목록 → 병렬 조회  /  카드: 승인내역 일괄 조회");

  const colW = 4.4, colY = 0.85, colH = 3.85;

  // Bank
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: colY, w: colW, h: colH, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: colY, w: colW, h: 0.4, fill: { color: "0EA5E9" }, line: { color: "0EA5E9" } });
  slide.addText("은행 거래내역", { x: 0.3, y: colY, w: colW, h: 0.4, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });

  const bankSteps = [
    { title: "① 계좌 목록 조회", code: "/v1/kr/bank/p/account/account-list", desc: "organization + connected_id 전달\n→ resAccountList 반환" },
    { title: "② 병렬 거래내역 조회", code: "asyncio.gather(*[fetch_one(acc) for acc in accounts])", desc: "각 계좌를 병렬로 동시 조회\n→ /account/transaction-list\n조회 기간: startDate ~ endDate" },
    { title: "③ DB 저장", code: "bank_accounts UPSERT\nbank_transactions DELETE→INSERT", desc: "잔액·최근거래일 갱신\n기간 내 기존 데이터 삭제 후 재적재\n5000건 초과 시 WARNING 로깅" },
  ];
  bankSteps.forEach(({ title, code, desc }, i) => {
    const y = colY + 0.52 + i * 1.06;
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.45, y, w: colW - 0.3, h: 0.95, fill: { color: "F0F9FF" }, line: { color: "BAE6FD", width: 0.5 } });
    slide.addText(title, { x: 0.55, y: y + 0.05, w: colW - 0.5, h: 0.24, fontSize: 9.5, bold: true, color: "0369A1", margin: 0 });
    slide.addText(code, { x: 0.55, y: y + 0.28, w: colW - 0.5, h: 0.28, fontSize: 7.5, color: "0C4A6E", margin: 0, fontFace: "Consolas" });
    slide.addText(desc, { x: 0.55, y: y + 0.54, w: colW - 0.5, h: 0.36, fontSize: 7.5, color: "475569", margin: 0 });
  });

  // Card
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.3, y: colY, w: colW, h: colH, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.3, y: colY, w: colW, h: 0.4, fill: { color: "E8511A" }, line: { color: "E8511A" } });
  slide.addText("카드 승인내역", { x: 5.3, y: colY, w: colW, h: 0.4, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });

  const cardSteps = [
    { title: "① 카드 목록 조회", code: "/v1/kr/card/p/account/card-list", desc: "organization + connected_id 전달\n→ 보유 카드 목록 확인" },
    { title: "② 승인내역 일괄 조회", code: "/v1/kr/card/p/account/approval-list", desc: "memberStoreInfoType: '1' (가맹점명 포함)\norderBy: '0' (최신순)\nstartDate ~ endDate 기간 조회" },
    { title: "③ DB 저장", code: "cards UPSERT\ncard_transactions DELETE→INSERT", desc: "카드명·상태 갱신\n기간 내 기존 데이터 삭제 후 재적재\n기관 코드(_org) 태그 부착" },
  ];
  cardSteps.forEach(({ title, code, desc }, i) => {
    const y = colY + 0.52 + i * 1.06;
    slide.addShape(pres.shapes.RECTANGLE, { x: 5.45, y, w: colW - 0.3, h: 0.95, fill: { color: "FFF7ED" }, line: { color: "FED7AA", width: 0.5 } });
    slide.addText(title, { x: 5.55, y: y + 0.05, w: colW - 0.5, h: 0.24, fontSize: 9.5, bold: true, color: "C2410C", margin: 0 });
    slide.addText(code, { x: 5.55, y: y + 0.28, w: colW - 0.5, h: 0.28, fontSize: 7.5, color: "7C2D12", margin: 0, fontFace: "Consolas" });
    slide.addText(desc, { x: 5.55, y: y + 0.54, w: colW - 0.5, h: 0.36, fontSize: 7.5, color: "475569", margin: 0 });
  });

  // Middle divider with merge arrow
  slide.addText("→ transactions\n테이블 병합", { x: 4.72, y: 2.6, w: 0.56, h: 0.8, fontSize: 7.5, color: "94A3B8", align: "center", margin: 0 });
}

// ─────────────────────────────────────────
// SLIDE 5: Airflow DAG 구조
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "Airflow DAG 구조 (sobee_transaction_sync)");
  addFooter(slide, "DAG: sync_transactions >> check_persona >> persona_all");

  // Schedule banner
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.82, w: 9.4, h: 0.45, fill: { color: "EFF6FF" }, line: { color: "BFDBFE", width: 0.5 } });
  slide.addText("schedule: '0 17 * * *'  (KST 02:00)   |   catchup: False   |   tags: sobee, transaction, persona", {
    x: 0.3, y: 0.82, w: 9.4, h: 0.45, fontSize: 9.5, color: "1D4ED8", align: "center", valign: "middle", margin: 0
  });

  // DAG tasks
  const tasks = [
    { id: "sync_transactions", desc: "전체 유저\n거래내역 수집\n(CODEF 병렬 호출)", color: "0EA5E9" },
    { id: "check_persona", desc: "아바타 생성\n실행 조건 확인\nShortCircuitOperator", color: "F59E0B" },
    { id: "persona_all", desc: "아바타 생성\n지난주 사진 있는\n유저 대상", color: "10A37F" },
  ];
  const taskW = 2.4, taskH = 1.15, taskGap = 0.55;
  const totalTW = tasks.length * taskW + (tasks.length - 1) * taskGap;
  const taskStartX = (10 - totalTW) / 2;

  tasks.forEach((task, i) => {
    const x = taskStartX + i * (taskW + taskGap);
    slide.addShape(pres.shapes.RECTANGLE, { x, y: 1.48, w: taskW, h: taskH, fill: { color: task.color }, line: { color: task.color }, shadow: makeShadow() });
    slide.addText(task.id, { x, y: 1.5, w: taskW, h: 0.3, fontSize: 9, bold: true, color: "FFFFFF", align: "center", margin: 0 });
    slide.addText(task.desc, { x, y: 1.82, w: taskW, h: 0.75, fontSize: 8.5, color: "E8F0FE", align: "center", valign: "top", margin: 0 });
    if (i < tasks.length - 1) {
      slide.addText(">>", { x: x + taskW + 0.05, y: 1.82, w: taskGap - 0.1, h: 0.38, fontSize: 13, color: "94A3B8", align: "center", valign: "middle", margin: 0 });
    }
  });

  // 3 trigger modes
  slide.addText("실행 모드 (3가지)", { x: 0.3, y: 2.88, w: 3, h: 0.32, fontSize: 11, bold: true, color: NAV, margin: 0 });

  const modes = [
    {
      title: "스케줄 실행 (기본)",
      badge: "매일 02:00 KST",
      badgeColor: "017CEE",
      items: [
        "전체 유저 3일치(DAILY_SYNC_DAYS=3) 동기화",
        "월요일에만: 사진 있는 유저 아바타 생성",
        "conf 없이 자동 실행",
      ],
    },
    {
      title: "트리거 A — 초기 sync",
      badge: "회원가입 시",
      badgeColor: "10B981",
      items: [
        "conf: {\"user_id\": 1, \"days\": 90}",
        "해당 유저만 90일치 수집 (INITIAL_SYNC_DAYS)",
        "아바타 생성 없음 (skip_avatar: true)",
        "Airflow 실패 시 로컬 FastAPI fallback 실행",
      ],
    },
    {
      title: "트리거 B — 강제 아바타",
      badge: "수동 실행",
      badgeColor: "EC4899",
      items: [
        "conf: {\"force_persona\": true}",
        "전체 유저 sync + 아바타 강제 생성",
        "사진 없는 유저도 아바타 생성 (force=True)",
        "관리자 페이지에서 수동 트리거 가능",
      ],
    },
  ];

  const modeW = 3.07, modeH = 2.04, modeGap = 0.07;
  modes.forEach((mode, i) => {
    const x = 0.3 + i * (modeW + modeGap);
    const y = 3.2;
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: modeW, h: modeH, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: modeW, h: 0.06, fill: { color: mode.badgeColor }, line: { color: mode.badgeColor } });
    slide.addText(mode.title, { x: x + 0.12, y: y + 0.1, w: modeW - 0.95, h: 0.28, fontSize: 9.5, bold: true, color: NAV, margin: 0 });
    slide.addShape(pres.shapes.RECTANGLE, { x: x + modeW - 0.86, y: y + 0.1, w: 0.8, h: 0.24, fill: { color: mode.badgeColor }, line: { color: mode.badgeColor } });
    slide.addText(mode.badge, { x: x + modeW - 0.86, y: y + 0.1, w: 0.8, h: 0.24, fontSize: 7, color: "FFFFFF", bold: true, align: "center", valign: "middle", margin: 0 });
    slide.addShape(pres.shapes.LINE, { x: x + 0.12, y: y + 0.44, w: modeW - 0.24, h: 0, line: { color: "E2E8F0", width: 0.5 } });
    slide.addText(mode.items.map((it, j) => ({ text: "• " + it, options: { breakLine: j < mode.items.length - 1 } })), {
      x: x + 0.12, y: y + 0.51, w: modeW - 0.22, h: 1.44, fontSize: 8.5, color: "475569", valign: "top", margin: 0
    });
  });
}

// ─────────────────────────────────────────
// SLIDE 6: 일별 동기화 처리 흐름
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "일별 동기화 처리 흐름");
  addFooter(slide, "Airflow가 매일 02:00 트리거 → 순차 처리 (월요일만 아바타 생성 실행)");

  const steps = [
    { num: "1", color: "0EA5E9", title: "CODEF 거래 수집", desc: "connected_id 별 병렬 호출\n3일치 기본 (초기: 90일)\n은행·카드 동시 수집" },
    { num: "2", color: "10B981", title: "DB 적재 (UPSERT)", desc: "bank/card_accounts 계좌 갱신\nbank/card_transactions\n기간 DELETE → INSERT" },
    { num: "3", color: "F59E0B", title: "transactions 병합", desc: "은행·카드 raw 테이블을\ntransactions 통합 테이블로 merge\n(정규화·통일 포맷)" },
    { num: "4", color: "6366F1", title: "카테고리 매핑", desc: "미매핑 건 일괄 처리\n룰베이스 → Gemini LLM\n→ VLM Fallback" },
    { num: "5", color: "E8511A", title: "생애주기 예측", desc: "ML 모델로 소비 패턴 분석\n유저 생애주기 코드 예측\n결과 DB 저장" },
    { num: "6", color: "10A37F", title: "아바타 생성 (월요일)", desc: "지난주 사진 있는 유저 대상\nOpenAI DALL-E로 이미지 생성\nS3 업로드 → DB 저장" },
  ];

  const boxW = 2.9, boxH = 1.65;
  const gapX = 0.19, gapY = 0.22;
  const startX = 0.3, startY = 0.88;

  steps.forEach((step, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = startX + col * (boxW + gapX);
    const y = startY + row * (boxH + gapY);

    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: boxW, h: boxH, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.06, h: boxH, fill: { color: step.color }, line: { color: step.color } });
    slide.addShape(pres.shapes.OVAL, { x: x + 0.16, y: y + 0.15, w: 0.36, h: 0.36, fill: { color: step.color }, line: { color: step.color } });
    slide.addText(step.num, { x: x + 0.16, y: y + 0.15, w: 0.36, h: 0.36, fontSize: 11, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(step.title, { x: x + 0.62, y: y + 0.15, w: boxW - 0.76, h: 0.38, fontSize: 11, bold: true, color: NAV, valign: "middle", margin: 0 });
    slide.addShape(pres.shapes.LINE, { x: x + 0.15, y: y + 0.59, w: boxW - 0.3, h: 0, line: { color: "E2E8F0", width: 0.5 } });
    slide.addText(step.desc, { x: x + 0.15, y: y + 0.66, w: boxW - 0.25, h: 0.9, fontSize: 9, color: "475569", valign: "top", margin: 0 });

    // Row 1: arrows between cols
    if (row === 0 && col < 2) {
      slide.addText("→", { x: x + boxW + 0.01, y: y + 0.7, w: gapX, h: 0.35, fontSize: 12, color: "94A3B8", align: "center", valign: "middle", margin: 0 });
    }
    // Row 2: arrows between cols
    if (row === 1 && col < 2) {
      slide.addText("→", { x: x + boxW + 0.01, y: y + 0.7, w: gapX, h: 0.35, fontSize: 12, color: "94A3B8", align: "center", valign: "middle", margin: 0 });
    }
    // Row 0 col 2 → Row 1 col 2 (down arrow on right side)
    if (row === 0 && col === 2) {
      slide.addText("↓", { x: x + boxW - 0.25, y: y + boxH + 0.02, w: 0.3, h: gapY - 0.04, fontSize: 13, color: "94A3B8", align: "center", valign: "middle", margin: 0 });
    }
  });
}

// ─────────────────────────────────────────
// SLIDE 7: 카테고리 매핑 로직
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "카테고리 매핑 로직");
  addFooter(slide, "16개 표준 카테고리 · 룰베이스 → Gemini LLM → VLM Fallback 3단계");

  const tiers = [
    {
      num: "1", color: "10B981",
      title: "Tier 1 — 룰베이스 매핑",
      items: [
        "DB category_mapping 테이블에서 (payment_category, payment_place) 키로 조회",
        "pair_cache로 동일 패턴 중복 API 호출 방지",
        "matched_by: 'tier2' (유형+가맹점명) 또는 'tier_place' (가맹점명 정규화)",
        "빠른 응답 · AI 비용 없음 · 대부분의 반복 거래 처리",
      ],
    },
    {
      num: "2", color: "4285F4",
      title: "Tier 2 — Gemini LLM 매핑",
      items: [
        "룰베이스 미매핑 시 Google Gemini API 호출 (GEMINI_API_KEY)",
        "16개 표준 카테고리 + 상세 판단 기준 프롬프트로 분류 요청",
        "LLM 결과를 DB에 캐싱 → 이후 동일 패턴 룰베이스로 처리",
        "matched_by 결과가 'etc'(16)이면 자동으로 VLM Fallback 파이프라인으로 넘김",
      ],
    },
    {
      num: "3", color: "EC4899",
      title: "VLM Fallback",
      items: [
        "기타(16번)로 매핑된 건 중 연결된 사진이 있는 거래 대상",
        "VLM(Visual Language Model)으로 사진 내용 분석하여 카테고리 재분류",
        "vlm_category_fallback() → photo_vlm_results 참조",
        "matched_by: 'vlm_fallback' 로 저장",
      ],
    },
  ];

  const tierW = 9.4, tierH = 1.18, tierGap = 0.14;

  tiers.forEach((tier, i) => {
    const y = 0.88 + i * (tierH + tierGap);
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y, w: tierW, h: tierH, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y, w: 0.06, h: tierH, fill: { color: tier.color }, line: { color: tier.color } });
    slide.addShape(pres.shapes.OVAL, { x: 0.44, y: y + 0.1, w: 0.38, h: 0.38, fill: { color: tier.color }, line: { color: tier.color } });
    slide.addText(tier.num, { x: 0.44, y: y + 0.1, w: 0.38, h: 0.38, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(tier.title, { x: 0.93, y: y + 0.12, w: 4.2, h: 0.36, fontSize: 11, bold: true, color: NAV, valign: "middle", margin: 0 });
    slide.addShape(pres.shapes.LINE, { x: 0.38, y: y + 0.55, w: tierW - 0.16, h: 0, line: { color: "E2E8F0", width: 0.5 } });

    const colW2 = (tierW - 0.4) / 2;
    tier.items.forEach((item, j) => {
      const col = j % 2, rowN = Math.floor(j / 2);
      slide.addText("• " + item, {
        x: 0.42 + col * colW2, y: y + 0.62 + rowN * 0.24, w: colW2 - 0.08, h: 0.22,
        fontSize: 8.5, color: "334155", margin: 0
      });
    });

    if (i < tiers.length - 1) {
      slide.addText("↓  미매핑 / 기타(16번) 발생 시 다음 단계로", {
        x: 0.42, y: y + tierH + 0.01, w: 4, h: tierGap - 0.02, fontSize: 7.5, color: "94A3B8", valign: "middle", margin: 0
      });
    }
  });

  // 16 categories
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 4.95, w: 9.4, h: 0.37, fill: { color: "F1F5F9" }, line: { color: "CBD5E1", width: 0.5 } });
  slide.addText("16개 표준 카테고리: 식비 · 카페/간식 · 온라인쇼핑 · 패션/쇼핑 · 교통 · 여행/숙박 · 문화/여가 · 술/유흥 · 의료/건강 · 뷰티/미용 · 주거/통신 · 교육/학습 · 금융 · 경조/선물 · 생활 · 기타", {
    x: 0.38, y: 4.95, w: 9.2, h: 0.37, fontSize: 7.8, color: "475569", align: "center", valign: "middle", margin: 0
  });
}

// ─────────────────────────────────────────
// SLIDE 8: 관리자 페이지
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "관리자 페이지 기능");
  addFooter(slide, "FastAPI /admin/* 엔드포인트 · 실시간 DB 모니터링 · AI 프롬프트 관리 · Airflow 트리거");

  const features = [
    {
      title: "실시간 DB 현황",
      color: "0EA5E9",
      endpoint: "GET /admin/overview",
      items: [
        "users · transactions · photos · diaries · avatars 카운트",
        "vlm_count · cards · bank_accounts · card/bank_transactions",
        "오늘 신규 유저 수",
        "최근 7일 일기·유저 가입 트렌드 데이터",
      ],
    },
    {
      title: "데이터 품질 모니터링",
      color: "F59E0B",
      endpoint: "GET /admin/health",
      items: [
        "VLM 미처리 사진 수 (photo_vlm_results JOIN 미매핑)",
        "일기 없는 유저 수",
        "아바타 없는 유저 수",
        "프롬프트 스토어 상태 (전체 수 / 수정된 수)",
      ],
    },
    {
      title: "AI 프롬프트 관리",
      color: "6366F1",
      endpoint: "GET / PUT / DELETE  /admin/prompts/{key}",
      items: [
        "아바타·일기·추천 등 AI 프롬프트 실시간 조회",
        "프롬프트 수정 → 이력(history) 자동 저장",
        "DELETE → 기본 프롬프트로 리셋",
        "is_modified 플래그로 커스텀 여부 표시",
      ],
    },
    {
      title: "Airflow 수동 트리거",
      color: "EC4899",
      endpoint: "POST /admin/airflow/trigger-sync",
      items: [
        "전체 유저 sync 수동 실행",
        "force_persona: true → 강제 아바타 생성 (사진 없는 유저 포함)",
        "특정 유저 초기 sync (user_id + days 파라미터)",
        "Airflow REST API (BasicAuth) 연동 · 실패 시 로컬 fallback",
      ],
    },
  ];

  const cardW = 4.55, cardH = 2.1;
  const gapX = 0.2, gapY = 0.28;

  features.forEach((feat, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.3 + col * (cardW + gapX);
    const y = 0.87 + row * (cardH + gapY);

    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: cardH, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.06, h: cardH, fill: { color: feat.color }, line: { color: feat.color } });
    slide.addText(feat.title, { x: x + 0.15, y: y + 0.1, w: cardW - 0.25, h: 0.3, fontSize: 11, bold: true, color: NAV, valign: "middle", margin: 0 });
    slide.addText(feat.endpoint, { x: x + 0.15, y: y + 0.42, w: cardW - 0.25, h: 0.22, fontSize: 7.8, color: feat.color, bold: true, fontFace: "Consolas", margin: 0 });
    slide.addShape(pres.shapes.LINE, { x: x + 0.15, y: y + 0.68, w: cardW - 0.3, h: 0, line: { color: "E2E8F0", width: 0.5 } });
    slide.addText(feat.items.map((it, j) => ({ text: "• " + it, options: { breakLine: j < feat.items.length - 1 } })), {
      x: x + 0.15, y: y + 0.75, w: cardW - 0.25, h: 1.25, fontSize: 8.5, color: "475569", valign: "top", margin: 0
    });
  });
}

pres.writeFile({ fileName: "sobee_pipeline.pptx" });
console.log("Done: sobee_pipeline.pptx (8 slides)");
