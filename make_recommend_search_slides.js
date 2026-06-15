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
  slide.addText("SoBee / 리포트 페이지", { x: 0, y: 0, w: 9.6, h: 0.72, fontSize: 10, color: "90AAC8", align: "right", valign: "middle", margin: 0 });
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

  slide.addShape(pres.shapes.LINE, { x: 0.8, y: 2.12, w: 3.2, h: 0, line: { color: "10A37F", width: 2 } });
  slide.addText("리포트 페이지", { x: 0.8, y: 1.5, w: 8.4, h: 0.5, fontSize: 16, color: "90AAC8", bold: true, margin: 0 });
  slide.addText("AI 상품 추천 & 상품 검색 로직", { x: 0.8, y: 2.22, w: 8.4, h: 1.1, fontSize: 32, bold: true, color: "FFFFFF", margin: 0 });
  slide.addText("생애주기 기반 카드·적금 추천  ·  Gemini 자연어 검색 파싱", {
    x: 0.8, y: 3.37, w: 8.4, h: 0.45, fontSize: 13, color: "CADCFC", margin: 0
  });
  slide.addText("SoBee 프로젝트", { x: 0.8, y: 4.85, w: 8.4, h: 0.4, fontSize: 11, color: "90AAC8", margin: 0 });
}

// ─────────────────────────────────────────
// SLIDE 2: AI 상품 추천 전체 흐름
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "AI 상품 추천 — 전체 흐름");
  addFooter(slide, "report_service에서 계산된 category_price를 입력받아 카드·적금 각 1개 추천");

  // Flow boxes
  const boxes = [
    { label: "category_price\n입력", sub: "report_service에서\n계산된 카테고리별 지출", color: "6366F1" },
    { label: "생애주기\n코드 조회", sub: "users 테이블\nlife_stage_code", color: "0EA5E9" },
    { label: "카드 추천\n로직", sub: "지출 상위 카테고리\n→ 혜택 매칭 카드", color: "10A37F" },
    { label: "적금 추천\n로직", sub: "생애주기 기간 매핑\n→ 금리 상위 상품", color: "F59E0B" },
    { label: "AI Insight\n응답", sub: "카드 + 적금 각 1개\n추천 이유 포함", color: "E8511A" },
  ];

  const boxW = 1.55, boxH = 1.2, arrowW = 0.22;
  const totalW = boxes.length * boxW + (boxes.length - 1) * arrowW;
  const startX = (10 - totalW) / 2;
  const boxY = 1.6;

  boxes.forEach((box, i) => {
    const x = startX + i * (boxW + arrowW);
    slide.addShape(pres.shapes.RECTANGLE, { x, y: boxY, w: boxW, h: boxH, fill: { color: box.color }, line: { color: box.color }, shadow: makeShadow() });
    slide.addText(box.label, { x, y: boxY + 0.08, w: boxW, h: 0.48, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(box.sub, { x, y: boxY + 0.6, w: boxW, h: 0.55, fontSize: 8, color: "E8F0FE", align: "center", margin: 0 });
    if (i < boxes.length - 1) {
      slide.addText("→", { x: x + boxW, y: boxY + 0.4, w: arrowW, h: 0.4, fontSize: 13, color: "94A3B8", align: "center", valign: "middle", margin: 0 });
    }
  });

  // Two result cards
  const cards = [
    {
      title: "카드 추천 결과",
      color: "10A37F",
      fields: [
        ["product_type", "'card'"],
        ["product_name", "카드명"],
        ["product_company", "카드사"],
        ["product_img_url", "카드 이미지 URL"],
        ["reason", "지출 기반 추천 이유 (템플릿)"],
        ["content.benefitGroups", "카드 혜택 목록"],
        ["content.annualFeeDetail", "연회비 상세"],
        ["content.url", "카드고릴라 링크"],
      ],
    },
    {
      title: "적금 추천 결과",
      color: "F59E0B",
      fields: [
        ["product_type", "'savings'"],
        ["product_name", "상품명"],
        ["product_company", "금융기관명"],
        ["product_img_url", "기관 로고 URL"],
        ["reason", "생애주기 기반 추천 이유 (템플릿)"],
        ["content.intrRate", "기본 금리"],
        ["content.header", "우대금리 최대"],
        ["content.joinWay", "가입 방법"],
      ],
    },
  ];

  cards.forEach((card, i) => {
    const x = 0.3 + i * 4.9;
    const y = 3.1;
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.65, h: 2.0, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.65, h: 0.06, fill: { color: card.color }, line: { color: card.color } });
    slide.addText(card.title, { x: x + 0.12, y: y + 0.1, w: 4.4, h: 0.28, fontSize: 11, bold: true, color: NAV, margin: 0 });
    slide.addShape(pres.shapes.LINE, { x: x + 0.12, y: y + 0.44, w: 4.4, h: 0, line: { color: "E2E8F0", width: 0.5 } });
    card.fields.forEach(([key, val], j) => {
      const col = j % 2, row = Math.floor(j / 2);
      const colW = 2.1;
      slide.addText(key + ": ", { x: x + 0.15 + col * colW, y: y + 0.5 + row * 0.3, w: colW - 0.02, h: 0.26, fontSize: 7.5, color: "94A3B8", bold: true, margin: 0 });
      slide.addText(val, { x: x + 0.15 + col * colW, y: y + 0.5 + row * 0.3 + 0.13, w: colW - 0.02, h: 0.16, fontSize: 7.5, color: "334155", margin: 0 });
    });
  });
}

// ─────────────────────────────────────────
// SLIDE 3: 카드 추천 로직 상세
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "AI 상품 추천 — 카드 추천 로직 상세");
  addFooter(slide, "지출 상위 카테고리 → CATEGORY_TO_CATE → card_benefits 매핑 → 추천 이유 템플릿 생성");

  // Step 1: category mapping
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 4.4, h: 2.1, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 0.06, h: 2.1, fill: { color: "10A37F" }, line: { color: "10A37F" } });
  slide.addText("① 카테고리 → 카드 혜택 매핑", { x: 0.45, y: 0.95, w: 4.1, h: 0.3, fontSize: 10.5, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 0.38, y: 1.3, w: 4.25, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const catMap = [
    ["식비", "일반음식점, 푸드, 패밀리레스토랑, 배달앱"],
    ["카페/간식", "카페, 카페/디저트, 베이커리"],
    ["교통", "교통, 대중교통, 택시, 기차, 하이패스"],
    ["여행/숙박", "여행/숙박, 항공권, 호텔, 면세점"],
    ["생활", "대형마트, 마트/편의점, 편의점, SSM"],
    ["기타", "모든가맹점 (폴백)"],
  ];
  catMap.forEach(([cat, mapping], i) => {
    slide.addText(cat, { x: 0.45, y: 1.38 + i * 0.24, w: 0.95, h: 0.22, fontSize: 8.5, bold: true, color: "10A37F", margin: 0 });
    slide.addText("→ " + mapping, { x: 1.42, y: 1.38 + i * 0.24, w: 3.2, h: 0.22, fontSize: 8, color: "475569", margin: 0 });
  });

  // Step 2: DB query
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 3.15, w: 4.4, h: 2.02, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 3.15, w: 0.06, h: 2.02, fill: { color: "10A37F" }, line: { color: "10A37F" } });
  slide.addText("② card_benefits DB 조회 로직", { x: 0.45, y: 3.22, w: 4.1, h: 0.3, fontSize: 10.5, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 0.38, y: 3.57, w: 4.25, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const dbSteps = [
    "지출 상위 카테고리부터 순서대로 시도 (sorted by amount DESC)",
    "card_benefits.cate_name IN (매핑된 cate_names) 조건으로 카드 조회",
    "card_img_url NOT NULL + is_discontinued = 0 필터 → RAND() LIMIT 1",
    "매칭 실패 시 다음 카테고리로 넘어감 (모든 카테고리 실패 시 '모든가맹점' 폴백)",
    "매칭된 카드의 card_benefits 전체 조회 → benefitGroups 생성",
  ];
  dbSteps.forEach((s, i) => {
    slide.addText("• " + s, { x: 0.45, y: 3.65 + i * 0.28, w: 4.1, h: 0.26, fontSize: 8.5, color: "334155", margin: 0 });
  });

  // Step 3: reason template
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 0.88, w: 4.6, h: 4.29, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 0.88, w: 0.06, h: 4.29, fill: { color: "10A37F" }, line: { color: "10A37F" } });
  slide.addText("③ 추천 이유 자동 생성 (템플릿)", { x: 5.25, y: 0.95, w: 4.3, h: 0.3, fontSize: 10.5, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 5.18, y: 1.3, w: 4.45, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const templates = [
    {
      case: "지출 카테고리 = 혜택 카테고리 + 금액 + 혜택명",
      ex: '"식비에 32,000원 쓰셨는데, \'배달앱 5% 캐시백\' 혜택으로 알뜰하게 되돌려 받을 수 있어요."',
    },
    {
      case: "지출 카테고리 ≠ 혜택 카테고리 (연결 문구)",
      ex: '"교통에 쓰신 만큼, 대중교통 혜택으로 \'주유 할인\'까지 한 번에 받을 수 있어요."',
    },
    {
      case: "혜택명만 있는 경우",
      ex: '"카페 자주 쓰신다면, \'스타벅스 30% 할인\' 혜택으로 매번 실속을 챙길 수 있어요."',
    },
    {
      case: "금액만 있는 경우",
      ex: '"식비에 45,000원이나 쓰셨군요. 혜택 없이 그냥 쓰기엔 아까운 금액이에요."',
    },
    {
      case: "매칭 없는 경우 (기본)",
      ex: '"식비 지출이 있으시다면, 관련 혜택으로 쓸 때마다 조금씩 돌려받을 수 있어요."',
    },
  ];

  templates.forEach((t, i) => {
    const y = 1.38 + i * 0.74;
    slide.addShape(pres.shapes.RECTANGLE, { x: 5.25, y, w: 4.3, h: 0.68, fill: { color: "F0FDF4" }, line: { color: "BBF7D0", width: 0.5 } });
    slide.addText("Case: " + t.case, { x: 5.32, y: y + 0.04, w: 4.15, h: 0.2, fontSize: 7.5, bold: true, color: "166534", margin: 0 });
    slide.addText(t.ex, { x: 5.32, y: y + 0.26, w: 4.15, h: 0.38, fontSize: 8, color: "334155", margin: 0 });
  });
}

// ─────────────────────────────────────────
// SLIDE 4: 적금 추천 로직 상세
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "AI 상품 추천 — 적금 추천 로직 상세");
  addFooter(slide, "생애주기 코드 → 적정 기간 매핑 → 금리 상위 5개 중 RAND 선택 → 친근한 추천 이유 생성");

  // Life stage table
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 4.55, h: 4.32, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 0.06, h: 4.32, fill: { color: "F59E0B" }, line: { color: "F59E0B" } });
  slide.addText("생애주기별 추천 적금 기간 (LIFE_STAGE_SAVE_TRM)", { x: 0.45, y: 0.95, w: 4.25, h: 0.3, fontSize: 10, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 0.38, y: 1.3, w: 4.4, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  // Table header
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.42, y: 1.35, w: 4.3, h: 0.27, fill: { color: "FEF3C7" }, line: { color: "FDE68A", width: 0.5 } });
  slide.addText("코드", { x: 0.45, y: 1.35, w: 0.85, h: 0.27, fontSize: 8.5, bold: true, color: "92400E", align: "center", valign: "middle", margin: 0 });
  slide.addText("단계", { x: 1.32, y: 1.35, w: 1.7, h: 0.27, fontSize: 8.5, bold: true, color: "92400E", align: "center", valign: "middle", margin: 0 });
  slide.addText("기간", { x: 3.04, y: 1.35, w: 0.7, h: 0.27, fontSize: 8.5, bold: true, color: "92400E", align: "center", valign: "middle", margin: 0 });
  slide.addText("비고", { x: 3.76, y: 1.35, w: 0.93, h: 0.27, fontSize: 8.5, bold: true, color: "92400E", align: "center", valign: "middle", margin: 0 });

  const stages = [
    ["TEEN", "십대", "6개월", ""],
    ["UNI", "대학생", "12개월", ""],
    ["NEW_JOB", "사회초년생", "12개월", ""],
    ["NEW_WED", "신혼부부", "24개월", ""],
    ["CHILD_BABY", "영유아 자녀", "36개월", "키즈 상품 우선"],
    ["CHILD_TEEN", "자녀 의무교육", "36개월", "키즈 상품 우선"],
    ["CHILD_UNI", "자녀 대학생", "24개월", "키즈 상품 우선"],
    ["GOLLIFE", "중년", "24개월", ""],
    ["SECLIFE", "2nd Life", "12개월", ""],
    ["RETIR", "은퇴", "12개월", ""],
  ];

  stages.forEach(([code, name, trm, note], i) => {
    const y = 1.66 + i * 0.25;
    const bg = i % 2 === 0 ? "FFFFFF" : "FAFAFA";
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.42, y, w: 4.3, h: 0.24, fill: { color: bg }, line: { color: "F3F4F6", width: 0.3 } });
    slide.addText(code, { x: 0.45, y, w: 0.85, h: 0.24, fontSize: 7.8, color: "D97706", bold: true, align: "center", valign: "middle", margin: 0 });
    slide.addText(name, { x: 1.32, y, w: 1.7, h: 0.24, fontSize: 8, color: "334155", align: "center", valign: "middle", margin: 0 });
    slide.addText(trm, { x: 3.04, y, w: 0.7, h: 0.24, fontSize: 8, color: "0369A1", bold: true, align: "center", valign: "middle", margin: 0 });
    slide.addText(note, { x: 3.76, y, w: 0.93, h: 0.24, fontSize: 7.5, color: "6B7280", align: "center", valign: "middle", margin: 0 });
  });

  // Right column: DB query + reason
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 0.88, w: 4.5, h: 2.15, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 0.88, w: 0.06, h: 2.15, fill: { color: "F59E0B" }, line: { color: "F59E0B" } });
  slide.addText("savings_products DB 조회 로직", { x: 5.35, y: 0.95, w: 4.2, h: 0.3, fontSize: 10.5, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 5.28, y: 1.3, w: 4.35, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const dbSteps = [
    "생애주기 코드로 save_trm(개월 수) 결정",
    "save_trm 일치 상품 중 intr_max_rate DESC 상위 5개 선택",
    "자녀 단계(CHILD_*·TEEN): 키즈 키워드 상품 우선 포함",
    "비자녀 단계: 키즈 키워드(키즈|아이|어린이 등) 상품 제외",
    "상위 5개 중 RAND() LIMIT 1 → 매번 다른 상품 추천",
  ];
  dbSteps.forEach((s, i) => {
    slide.addText("• " + s, { x: 5.35, y: 1.38 + i * 0.29, w: 4.2, h: 0.26, fontSize: 8.5, color: "334155", margin: 0 });
  });

  // Reason template examples
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 3.2, w: 4.5, h: 2.0, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 3.2, w: 0.06, h: 2.0, fill: { color: "F59E0B" }, line: { color: "F59E0B" } });
  slide.addText("생애주기별 추천 이유 템플릿 (예시)", { x: 5.35, y: 3.27, w: 4.2, h: 0.3, fontSize: 10.5, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 5.28, y: 3.62, w: 4.35, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const examples = [
    ["NEW_JOB", '"첫 월급이잖아요! 이참에 적금 하나 만들어보는 거 어때요? 12개월에 최고 연 4.5%예요."'],
    ["CHILD_BABY", '"아이 이름으로 하나 만들어두면 나중에 정말 든든하더라고요! 36개월에 최고 연 5.0%예요."'],
    ["RETIR", '"여유롭게 지내려면 이런 안정적인 상품이 딱이에요! 12개월에 최고 연 3.8%예요."'],
    ["+ 우대금리", '"... 비과세 가입 조건 맞추면 우대금리도 챙길 수 있어요!" (spcl_cnd 50자 이내 시 추가)'],
  ];
  examples.forEach(([code, ex], i) => {
    const y = 3.7 + i * 0.36;
    slide.addText(code + ": ", { x: 5.35, y, w: 0.9, h: 0.14, fontSize: 7.5, bold: true, color: "D97706", margin: 0 });
    slide.addText(ex, { x: 5.35, y: y + 0.13, w: 4.25, h: 0.22, fontSize: 7.5, color: "475569", margin: 0 });
  });
}

// ─────────────────────────────────────────
// SLIDE 5: 상품 검색 전체 흐름
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "상품 검색 — 전체 흐름");
  addFooter(slide, "자연어 검색어 → Gemini 파싱 → Elasticsearch 검색 → 결과 반환");

  // Flow
  const boxes = [
    { label: "자연어\n검색어 입력", sub: '예) "카페 할인 많은 카드"\n"스타벅스 혜택"', color: "4285F4" },
    { label: "고유명사\n사전 매핑", sub: "스타벅스→카페\n롯데월드→영화 등\n80여개 패턴", color: "6366F1" },
    { label: "Gemini\n2.5 Flash 파싱", sub: "product_types\ncompany / category\nkeywords / ai_text", color: "10A37F" },
    { label: "Elasticsearch\n검색", sub: "파싱 결과로\n상품 인덱스 검색\n(Spring 처리)", color: "0EA5E9" },
    { label: "결과 +\nAI 문구 반환", sub: "검색 상품 목록\n+ ai_text 안내\n문구 함께 반환", color: "E8511A" },
  ];

  const boxW = 1.55, boxH = 1.25, arrowW = 0.22;
  const totalW = boxes.length * boxW + (boxes.length - 1) * arrowW;
  const startX = (10 - totalW) / 2;
  const boxY = 1.55;

  boxes.forEach((box, i) => {
    const x = startX + i * (boxW + arrowW);
    slide.addShape(pres.shapes.RECTANGLE, { x, y: boxY, w: boxW, h: boxH, fill: { color: box.color }, line: { color: box.color }, shadow: makeShadow() });
    slide.addText(box.label, { x, y: boxY + 0.06, w: boxW, h: 0.46, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(box.sub, { x, y: boxY + 0.57, w: boxW, h: 0.62, fontSize: 8, color: "E8F0FE", align: "center", margin: 0 });
    if (i < boxes.length - 1) {
      slide.addText("→", { x: x + boxW, y: boxY + 0.43, w: arrowW, h: 0.4, fontSize: 13, color: "94A3B8", align: "center", valign: "middle", margin: 0 });
    }
  });

  // ParseSearchResponse schema
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 3.05, w: 9.4, h: 2.15, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 3.05, w: 0.06, h: 2.15, fill: { color: "10A37F" }, line: { color: "10A37F" } });
  slide.addText("ParseSearchResponse — Gemini 파싱 결과 스키마", { x: 0.45, y: 3.12, w: 9.0, h: 0.3, fontSize: 11, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 0.38, y: 3.47, w: 9.25, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const fields = [
    { field: "product_types", type: "List[str]", desc: '검색 의도에 맞는 상품 타입 (card / savings / insurance). 언급 없으면 3개 모두 포함', ex: '["card"]' },
    { field: "company", type: "Optional[str]", desc: '금융기관 브랜드명만 추출. 일반 브랜드(스타벅스 등)는 null', ex: '"신한", "롯데"' },
    { field: "category", type: "Optional[str]", desc: '카드 혜택 카테고리 15개 중 하나 (음식점/카페/교통/주유/마트/편의점/영화/여행 등)', ex: '"카페"' },
    { field: "keywords", type: "List[str]", desc: '핵심 한국어 키워드 1~3개 (짧을수록 좋음)', ex: '["카페", "할인"]' },
    { field: "ai_text", type: "str", desc: '사용자에게 보여줄 3~4문장 친근한 분석 문구 (검색의도 파악 → 추천 기준 → 실용 팁)', ex: '"카페 할인 카드를 찾고 계시는군요! ..."' },
  ];

  fields.forEach((f, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    const x = col === 0 ? 0.42 : 5.15;
    const y = 3.55 + row * 0.48;
    const w = 4.55;
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.42, fill: { color: "F0FDF4" }, line: { color: "BBF7D0", width: 0.5 } });
    slide.addText(f.field, { x: x + 0.08, y: y + 0.03, w: 1.3, h: 0.18, fontSize: 8.5, bold: true, color: "166534", fontFace: "Consolas", margin: 0 });
    slide.addText(f.type, { x: x + 1.4, y: y + 0.04, w: 1.4, h: 0.16, fontSize: 7.5, color: "6B7280", margin: 0 });
    slide.addText(f.desc, { x: x + 0.08, y: y + 0.22, w: w - 0.16, h: 0.17, fontSize: 7.5, color: "334155", margin: 0 });
  });
}

// ─────────────────────────────────────────
// SLIDE 6: Gemini 파싱 로직 상세
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "상품 검색 — Gemini 파싱 로직 상세");
  addFooter(slide, "고유명사 사전 + Gemini 2.5 Flash JSON 파싱 + 폴백 처리");

  // Left: proper noun dict
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 4.45, h: 4.32, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 0.06, h: 4.32, fill: { color: "6366F1" }, line: { color: "6366F1" } });
  slide.addText("고유명사 사전 (_PROPER_NOUN_CATEGORIES)", { x: 0.45, y: 0.95, w: 4.15, h: 0.3, fontSize: 10, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 0.38, y: 1.3, w: 4.3, h: 0, line: { color: "E2E8F0", width: 0.5 } });
  slide.addText("Gemini 파싱 전 검색어에 포함된 고유명사를 먼저 카테고리로 변환.\n결과가 있으면 Gemini의 category를 덮어씀 (정확도 보정).", { x: 0.45, y: 1.36, w: 4.15, h: 0.4, fontSize: 8.5, color: "475569", margin: 0 });

  const nouns = [
    ["카페", "스타벅스, 이디야, 투썸플레이스, 메가커피, 빽다방, 할리스, 폴바셋, 컴포즈커피"],
    ["음식점", "맥도날드, 버거킹, 롯데리아, KFC, 맘스터치, 배달의민족, 쿠팡이츠, 요기요"],
    ["마트", "이마트, 홈플러스, 코스트코, 롯데마트"],
    ["편의점", "CU, GS25, 세븐일레븐, 미니스톱, emart24"],
    ["영화", "넷플릭스, 왓챠, 웨이브, 티빙, CGV, 메가박스, 롯데시네마, 롯데월드, 에버랜드"],
    ["여행", "야놀자, 여기어때, 에어비앤비"],
    ["교통", "—  (버스/지하철 등은 텍스트 직접 매핑)"],
    ["통신", "SKT, KT, LG유플러스, LGU+"],
    ["온라인", "카카오페이, 네이버페이, 쿠팡, 11번가, 지마켓, 옥션"],
    ["주유", "SK에너지, GS칼텍스, 현대오일뱅크, S오일"],
  ];
  nouns.forEach(([cat, brands], i) => {
    const y = 1.82 + i * 0.33;
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.42, y: y + 0.02, w: 0.78, h: 0.22, fill: { color: "EEF2FF" }, line: { color: "C7D2FE", width: 0.5 } });
    slide.addText(cat, { x: 0.42, y: y + 0.02, w: 0.78, h: 0.22, fontSize: 7.8, bold: true, color: "4338CA", align: "center", valign: "middle", margin: 0 });
    slide.addText(brands, { x: 1.25, y: y + 0.04, w: 3.4, h: 0.22, fontSize: 7.5, color: "334155", margin: 0 });
  });

  // Right: Gemini call + fallback
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 0.88, w: 4.6, h: 2.55, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 0.88, w: 0.06, h: 2.55, fill: { color: "10A37F" }, line: { color: "10A37F" } });
  slide.addText("Gemini 2.5 Flash 호출 설정", { x: 5.25, y: 0.95, w: 4.3, h: 0.3, fontSize: 10.5, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 5.18, y: 1.3, w: 4.45, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const geminiOpts = [
    ["model", "gemini-2.5-flash"],
    ["response_mime_type", "application/json  (구조화 출력 강제)"],
    ["temperature", "0.3  (일관성 확보)"],
    ["thinking_budget", "0  (빠른 응답 우선)"],
    ["system_prompt", "product_types / company / category /\nkeywords / ai_text 5개 필드 JSON 규칙 명시"],
  ];
  geminiOpts.forEach(([k, v], i) => {
    slide.addText(k + ":", { x: 5.25, y: 1.38 + i * 0.37, w: 1.3, h: 0.16, fontSize: 8.5, bold: true, color: "166534", fontFace: "Consolas", margin: 0 });
    slide.addText(v, { x: 5.25, y: 1.54 + i * 0.37, w: 4.3, h: 0.22, fontSize: 8.5, color: "334155", margin: 0 });
  });

  // Fallback
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 3.6, w: 4.6, h: 1.6, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 3.6, w: 0.06, h: 1.6, fill: { color: "E8511A" }, line: { color: "E8511A" } });
  slide.addText("폴백 처리 (Gemini 실패 시)", { x: 5.25, y: 3.67, w: 4.3, h: 0.3, fontSize: 10.5, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 5.18, y: 4.02, w: 4.45, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const fbSteps = [
    "product_types: ['card', 'savings', 'insurance'] (전체)",
    "company: null",
    "category: 고유명사 사전 매핑 결과 (있으면) or null",
    "keywords: [검색어 원문]",
    'ai_text: "\'{query}\' 관련 상품을 찾았어요."',
  ];
  fbSteps.forEach((s, i) => {
    slide.addText("• " + s, { x: 5.25, y: 4.1 + i * 0.21, w: 4.3, h: 0.19, fontSize: 8.5, color: "334155", margin: 0 });
  });
}

pres.writeFile({ fileName: "sobee_recommend_search.pptx" });
console.log("Done: sobee_recommend_search.pptx (6 slides)");
