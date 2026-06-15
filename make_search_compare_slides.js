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
  slide.addText("SoBee / 검색 아키텍처", { x: 0, y: 0, w: 9.6, h: 0.72, fontSize: 10, color: "90AAC8", align: "right", valign: "middle", margin: 0 });
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

  slide.addShape(pres.shapes.LINE, { x: 0.8, y: 2.12, w: 3.2, h: 0, line: { color: "0EA5E9", width: 2 } });
  slide.addText("상품 검색 아키텍처", { x: 0.8, y: 1.5, w: 8.4, h: 0.5, fontSize: 16, color: "90AAC8", bold: true, margin: 0 });
  slide.addText("검색 방식 비교 및 설계 결정", { x: 0.8, y: 2.22, w: 8.4, h: 1.1, fontSize: 32, bold: true, color: "FFFFFF", margin: 0 });
  slide.addText("Gemini만  ·  ES만  ·  병렬 (현재 방식)  ·  벡터 DB vs Gemini", {
    x: 0.8, y: 3.37, w: 8.4, h: 0.45, fontSize: 13, color: "CADCFC", margin: 0
  });
  slide.addText("SoBee 프로젝트", { x: 0.8, y: 4.85, w: 8.4, h: 0.4, fontSize: 11, color: "90AAC8", margin: 0 });
}

// ─────────────────────────────────────────
// SLIDE 2: 3가지 방식 개요
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "세 가지 검색 방식 개요");
  addFooter(slide, "Gemini(의도 파악) + ES(실제 검색) 병렬 조합이 현재 방식");

  const cols = [
    {
      num: "1",
      title: "Gemini만",
      subtitle: "의도 파악 O / 상품 반환 X",
      color: "4285F4",
      flow: "입력 → Gemini 분석 → JSON 반환",
      good: ["검색 의도 완벽 파악", "AI 안내 문구 생성", "카테고리·타입 구조화"],
      bad: ["실제 DB 접근 불가", "상품 목록 반환 불가", "단독으로는 반쪽짜리"],
      verdict: "분석 결과만 있고\n실제 상품이 없음",
      verdictColor: "EF4444",
    },
    {
      num: "2",
      title: "ES만",
      subtitle: "상품 반환 O / 의도 파악 X",
      color: "F59E0B",
      flow: "입력 → ES 텍스트 매칭 → 결과",
      good: ["실제 DB 상품 반환", "오타 허용 (fuzziness)", "매우 빠른 응답"],
      bad: ["키워드 정확히 맞아야 함", "의도 파악 불가", "무관 상품 혼재"],
      verdict: "키워드 불일치 시\n관련 상품 누락",
      verdictColor: "EF4444",
    },
    {
      num: "3",
      title: "병렬 (현재)",
      subtitle: "의도 파악 O / 상품 반환 O",
      color: "10A37F",
      flow: "입력 → Gemini+ES 동시 → 합치기",
      good: ["완전한 의도 파악", "정확한 상품 검색", "3단계 정렬로 최적 순서"],
      bad: ["Gemini 비용 발생", "Gemini 장애 시 ES만으로 동작 (허용)"],
      verdict: "둘의 장점을 모두\n가져가는 현재 방식",
      verdictColor: "10A37F",
    },
  ];

  cols.forEach((col, i) => {
    const x = 0.28 + i * 3.25;
    const y = 0.85;
    const w = 3.1, h = 4.45;

    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.55, fill: { color: col.color }, line: { color: col.color } });

    // Number badge
    slide.addShape(pres.shapes.OVAL, { x: x + 0.12, y: y + 0.1, w: 0.35, h: 0.35, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" } });
    slide.addText(col.num, { x: x + 0.12, y: y + 0.1, w: 0.35, h: 0.35, fontSize: 12, bold: true, color: col.color, align: "center", valign: "middle", margin: 0 });
    slide.addText(col.title, { x: x + 0.55, y: y + 0.1, w: w - 0.65, h: 0.22, fontSize: 12, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
    slide.addText(col.subtitle, { x: x + 0.55, y: y + 0.32, w: w - 0.65, h: 0.18, fontSize: 8, color: "E8F0FE", margin: 0 });

    // Flow
    slide.addShape(pres.shapes.RECTANGLE, { x: x + 0.12, y: y + 0.65, w: w - 0.24, h: 0.28, fill: { color: "F8FAFC" }, line: { color: "E2E8F0", width: 0.5 } });
    slide.addText(col.flow, { x: x + 0.15, y: y + 0.65, w: w - 0.3, h: 0.28, fontSize: 8, color: "475569", align: "center", valign: "middle", margin: 0, fontFace: "Consolas" });

    // Good
    slide.addText("장점", { x: x + 0.12, y: y + 1.02, w: 0.5, h: 0.22, fontSize: 8.5, bold: true, color: "059669", margin: 0 });
    col.good.forEach((g, j) => {
      slide.addText("+ " + g, { x: x + 0.12, y: y + 1.24 + j * 0.27, w: w - 0.22, h: 0.24, fontSize: 8.5, color: "166534", margin: 0 });
    });

    slide.addShape(pres.shapes.LINE, { x: x + 0.12, y: y + 2.09, w: w - 0.24, h: 0, line: { color: "E2E8F0", width: 0.5 } });

    // Bad
    slide.addText("한계", { x: x + 0.12, y: y + 2.16, w: 0.5, h: 0.22, fontSize: 8.5, bold: true, color: "DC2626", margin: 0 });
    col.bad.forEach((b, j) => {
      slide.addText("- " + b, { x: x + 0.12, y: y + 2.38 + j * 0.27, w: w - 0.22, h: 0.24, fontSize: 8.5, color: "991B1B", margin: 0 });
    });

    slide.addShape(pres.shapes.LINE, { x: x + 0.12, y: y + 3.2, w: w - 0.24, h: 0, line: { color: "E2E8F0", width: 0.5 } });

    // Verdict
    slide.addShape(pres.shapes.RECTANGLE, { x: x + 0.12, y: y + 3.28, w: w - 0.24, h: 0.97, fill: { color: col.verdictColor === "10A37F" ? "ECFDF5" : "FEF2F2" }, line: { color: col.verdictColor === "10A37F" ? "A7F3D0" : "FECACA", width: 0.5 } });
    slide.addText(col.verdict, { x: x + 0.16, y: y + 3.33, w: w - 0.32, h: 0.87, fontSize: 9, bold: true, color: col.verdictColor, align: "center", valign: "middle", margin: 0 });
  });
}

// ─────────────────────────────────────────
// SLIDE 3: 병렬 방식 상세 — Gemini로 ES 결과 보정
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "병렬 방식 (현재) — Gemini로 ES 결과 보정");
  addFooter(slide, '예시 입력: "여행 갈 때 쓸 카드 추천해줘"');

  // Flow diagram
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 9.4, h: 0.95, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addText('사용자 입력: "여행 갈 때 쓸 카드 추천해줘"', { x: 0.45, y: 0.88, w: 9.1, h: 0.4, fontSize: 10.5, bold: true, color: NAV, valign: "middle", margin: 0 });

  // Fork
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.45, y: 1.28, w: 4.1, h: 0.44, fill: { color: "EEF2FF" }, line: { color: "C7D2FE", width: 0.5 } });
  slide.addText("Gemini 동시 시작  →  product_types:[card]  category:여행  ai_text:...", { x: 0.5, y: 1.28, w: 4.0, h: 0.44, fontSize: 8.5, color: "4338CA", valign: "middle", margin: 0 });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 1.28, w: 4.5, h: 0.44, fill: { color: "FEF3C7" }, line: { color: "FDE68A", width: 0.5 } });
  slide.addText('ES 동시 시작  →  "여행" 포함 카드·적금·보험 텍스트 매칭', { x: 5.15, y: 1.28, w: 4.4, h: 0.44, fontSize: 8.5, color: "92400E", valign: "middle", margin: 0 });

  // 두 박스 (보정 로직)
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 2.05, w: 4.55, h: 3.15, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 2.05, w: 0.06, h: 3.15, fill: { color: "4285F4" }, line: { color: "4285F4" } });
  slide.addText("Gemini 결과로 ES 결과 보정", { x: 0.45, y: 2.12, w: 4.2, h: 0.3, fontSize: 11, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 0.38, y: 2.47, w: 4.4, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const corrections = [
    {
      gemini: 'product_types = ["card"]',
      action: "ES가 가져온 예적금·보험 결과 전부 제거 → 카드만 남김",
    },
    {
      gemini: 'category = "여행"',
      action: '카테고리 맵으로 변환:\n["여행/숙박","항공권","호텔","리조트","항공마일리지"]\n→ 이 카테고리 카드 ES 2차 검색 → 텍스트엔 "여행" 없어도 포함',
    },
    {
      gemini: 'company = null',
      action: "특정 회사 필터 없음 → 전체 카드사 대상 검색",
    },
  ];

  corrections.forEach((c, i) => {
    const y = 2.54 + i * 0.88;
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.42, y, w: 4.3, h: 0.78, fill: { color: i === 1 ? "EFF6FF" : "F8FAFC" }, line: { color: "E2E8F0", width: 0.5 } });
    slide.addText("Gemini: " + c.gemini, { x: 0.5, y: y + 0.05, w: 4.1, h: 0.2, fontSize: 8.5, bold: true, color: "1D4ED8", fontFace: "Consolas", margin: 0 });
    slide.addText(c.action, { x: 0.5, y: y + 0.27, w: 4.1, h: 0.46, fontSize: 8.5, color: "334155", margin: 0 });
  });

  // 3단계 정렬
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 2.05, w: 4.6, h: 3.15, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 2.05, w: 0.06, h: 3.15, fill: { color: "10A37F" }, line: { color: "10A37F" } });
  slide.addText("3단계 정렬 — 최적 순서 결정", { x: 5.25, y: 2.12, w: 4.3, h: 0.3, fontSize: 11, bold: true, color: NAV, margin: 0 });
  slide.addShape(pres.shapes.LINE, { x: 5.18, y: 2.47, w: 4.45, h: 0, line: { color: "E2E8F0", width: 0.5 } });

  const ranks = [
    {
      rank: "1순위",
      cond: "텍스트 매칭 O + 카테고리 O",
      example: '"트래블로그 카드"',
      note: "이름에 여행 단어 + 여행/숙박 혜택 카테고리",
      color: "10A37F",
      bg: "ECFDF5",
      border: "A7F3D0",
    },
    {
      rank: "2순위",
      cond: "텍스트 매칭 X + 카테고리 O",
      example: '"항공 마일리지 카드"',
      note: 'ES 혼자였으면 "여행" 단어 없어 못 찾음 → 카테고리 매핑 덕분에 포함',
      color: "0EA5E9",
      bg: "EFF6FF",
      border: "BFDBFE",
    },
    {
      rank: "3순위",
      cond: "텍스트 매칭 O + 카테고리 X",
      example: '"신한 Deep Dream"',
      note: '이름에 "여행" 포함 but 여행 혜택 카테고리 없음',
      color: "F59E0B",
      bg: "FFFBEB",
      border: "FDE68A",
    },
  ];

  ranks.forEach((r, i) => {
    const y = 2.55 + i * 0.88;
    slide.addShape(pres.shapes.RECTANGLE, { x: 5.22, y, w: 4.35, h: 0.78, fill: { color: r.bg }, line: { color: r.border, width: 0.5 } });
    slide.addShape(pres.shapes.RECTANGLE, { x: 5.22, y: y + 0.06, w: 0.6, h: 0.22, fill: { color: r.color }, line: { color: r.color } });
    slide.addText(r.rank, { x: 5.22, y: y + 0.06, w: 0.6, h: 0.22, fontSize: 8, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(r.cond, { x: 5.87, y: y + 0.06, w: 3.6, h: 0.22, fontSize: 8.5, bold: true, color: r.color, margin: 0 });
    slide.addText(r.example, { x: 5.28, y: y + 0.32, w: 4.2, h: 0.2, fontSize: 9, bold: true, color: NAV, fontFace: "Consolas", margin: 0 });
    slide.addText(r.note, { x: 5.28, y: y + 0.52, w: 4.2, h: 0.22, fontSize: 8, color: "475569", margin: 0 });
  });
}

// ─────────────────────────────────────────
// SLIDE 4: 비교표
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "세 가지 방식 비교표");
  addFooter(slide, "병렬 방식은 Gemini 장애 시에도 ES 결과만으로 동작 — 장애 허용 설계");

  const headers = ["항목", "Gemini만", "ES만", "병렬 (현재)"];
  const colWidths = [3.0, 2.1, 2.1, 2.4];
  const headerColors = [NAV, "4285F4", "F59E0B", "10A37F"];
  const startX = 0.3;
  const tableY = 0.88;

  // Header row
  let cx = startX;
  headers.forEach((h, i) => {
    slide.addShape(pres.shapes.RECTANGLE, { x: cx, y: tableY, w: colWidths[i], h: 0.4, fill: { color: headerColors[i] }, line: { color: "FFFFFF", width: 0.5 } });
    slide.addText(h, { x: cx, y: tableY, w: colWidths[i], h: 0.4, fontSize: i === 0 ? 9.5 : 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    cx += colWidths[i];
  });

  const rows = [
    ["실제 상품 목록 반환", "X 불가", "O 가능", "O 가능"],
    ["카드/예적금 타입 필터", "O 가능", "X 불가", "O 가능"],
    ['"항공마일리지"="여행" 연결', "O 가능", "X 단어 다름", "O 가능"],
    ['오타 허용 ("여랭"→"여행")', "X", "O fuzziness", "O fuzziness"],
    ["AI 안내 문구 생성", "O 가능", "X 불가", "O 가능"],
    ["응답 속도", "빠름", "매우 빠름", "빠름 (동시 실행)"],
    ["Gemini 장애 시", "전체 실패", "정상 작동", "ES 결과만으로 동작"],
  ];

  const OBG = "ECFDF5", OBD = "A7F3D0", XBG = "FEF2F2", XBD = "FECACA";

  rows.forEach((row, ri) => {
    const rowY = tableY + 0.4 + ri * 0.61;
    const bg = ri % 2 === 0 ? "FFFFFF" : "F8FAFC";
    cx = startX;

    row.forEach((cell, ci) => {
      const isO = cell.startsWith("O");
      const isX = cell.startsWith("X");
      const cellBg = ci === 0 ? bg : (isO ? OBG : isX ? XBG : bg);
      const cellBorder = ci === 0 ? "E2E8F0" : (isO ? OBD : isX ? XBD : "E2E8F0");
      const cellColor = ci === 0 ? "334155" : (isO ? "166534" : isX ? "991B1B" : "334155");
      const cellBold = ci === 0 || isO || isX;
      const cellSize = ci === 0 ? 9 : 9;

      slide.addShape(pres.shapes.RECTANGLE, { x: cx, y: rowY, w: colWidths[ci], h: 0.58, fill: { color: cellBg }, line: { color: cellBorder, width: 0.5 } });
      slide.addText(cell, { x: cx + 0.08, y: rowY, w: colWidths[ci] - 0.1, h: 0.58, fontSize: cellSize, bold: cellBold && ci !== 0, color: cellColor, align: ci === 0 ? "left" : "center", valign: "middle", margin: 0 });
      cx += colWidths[ci];
    });
  });

  // Summary box
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 5.0, w: 9.4, h: 0.28, fill: { color: "ECFDF5" }, line: { color: "A7F3D0", width: 0.5 } });
  slide.addText('핵심 요약: Gemini는 "뭘 원하는지" 를 알고, ES는 "어디서 찾는지" 를 압니다. 둘 중 하나만 쓰면 반쪽짜리입니다.', {
    x: 0.4, y: 5.0, w: 9.2, h: 0.28, fontSize: 9, bold: true, color: "166534", align: "center", valign: "middle", margin: 0
  });
}

// ─────────────────────────────────────────
// SLIDE 5: 벡터 DB vs Gemini — 작동 방식 비교
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "벡터 DB vs Gemini — 작동 방식 비교");
  addFooter(slide, '같은 문제를 다르게 푸는 두 방법: "항공마일리지" = "여행" 이라는 걸 어떻게 이해시키는가');

  // Left: Vector DB
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 4.5, h: 4.32, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 4.5, h: 0.42, fill: { color: "7C3AED" }, line: { color: "7C3AED" } });
  slide.addText("벡터 DB 방식", { x: 0.3, y: 0.88, w: 4.5, h: 0.42, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });

  slide.addText("사전 준비 (배포 전 배치 작업)", { x: 0.42, y: 1.38, w: 4.2, h: 0.26, fontSize: 9, bold: true, color: "6D28D9", margin: 0 });
  const vecPrep = [
    '"트래블로그 카드 - 해외여행 마일리지 적립"',
    '    → [0.82, 0.14, 0.67, 0.91, ...]',
    '"카페 할인 카드 - 스타벅스 30% 할인"',
    '    → [0.12, 0.95, 0.03, 0.21, ...]',
    '"여행자 보험 - 해외 사고 보장"',
    '    → [0.79, 0.08, 0.71, 0.88, ...]',
  ];
  vecPrep.forEach((t, i) => {
    slide.addText(t, { x: 0.42, y: 1.68 + i * 0.24, w: 4.2, h: 0.22, fontSize: 8, color: i % 2 === 1 ? "6D28D9" : "334155", fontFace: "Consolas", margin: 0 });
  });

  slide.addShape(pres.shapes.LINE, { x: 0.38, y: 3.16, w: 4.35, h: 0, line: { color: "E2E8F0", width: 0.5 } });
  slide.addText("검색 시 작동", { x: 0.42, y: 3.22, w: 4.2, h: 0.26, fontSize: 9, bold: true, color: "6D28D9", margin: 0 });
  const vecSearch = [
    '"여행 갈 때 쓸 카드 추천해줘"',
    '    → 쿼리도 벡터 변환: [0.81, 0.11, ...]',
    '    → 모든 상품 벡터와 코사인 유사도 계산',
    '    → 거리 가까운 순서대로 반환',
    '',
    '트래블로그 카드    → 거리 0.05  (매우 유사)',
    '항공 마일리지 카드 → 거리 0.11  (유사)',
    '카페 할인 카드     → 거리 0.89  (전혀 다름)',
  ];
  vecSearch.forEach((t, i) => {
    const isHighlight = t.includes("거리");
    slide.addText(t, { x: 0.42, y: 3.5 + i * 0.23, w: 4.2, h: 0.21, fontSize: 8, color: isHighlight ? "6D28D9" : "334155", fontFace: "Consolas", margin: 0 });
  });

  // Right: Gemini
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 0.88, w: 4.5, h: 4.32, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 0.88, w: 4.5, h: 0.42, fill: { color: "10A37F" }, line: { color: "10A37F" } });
  slide.addText("Gemini 방식 (현재)", { x: 5.2, y: 0.88, w: 4.5, h: 0.42, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });

  slide.addText("사전 준비 불필요", { x: 5.32, y: 1.38, w: 4.2, h: 0.26, fontSize: 9, bold: true, color: "059669", margin: 0 });
  slide.addText("ES에 상품 데이터만 있으면 됨. 벡터 변환·저장 작업 없음.", { x: 5.32, y: 1.65, w: 4.2, h: 0.3, fontSize: 8.5, color: "475569", margin: 0 });

  slide.addShape(pres.shapes.LINE, { x: 5.28, y: 2.0, w: 4.35, h: 0, line: { color: "E2E8F0", width: 0.5 } });
  slide.addText("검색 시 작동", { x: 5.32, y: 2.06, w: 4.2, h: 0.26, fontSize: 9, bold: true, color: "059669", margin: 0 });

  const gemSearch = [
    '"여행 갈 때 쓸 카드 추천해줘"',
    '    → Gemini API 전송 (실시간 추론)',
    '    → 구조화 JSON 반환:',
    '       product_types: ["card"]',
    '       category: "여행"',
    '       ai_text: "여행 특화 카드를..."',
    '    → ES 검색 조건으로 변환하여 검색',
  ];
  gemSearch.forEach((t, i) => {
    const isField = t.includes("product_types") || t.includes("category") || t.includes("ai_text");
    slide.addText(t, { x: 5.32, y: 2.35 + i * 0.26, w: 4.2, h: 0.24, fontSize: 8, color: isField ? "059669" : "334155", fontFace: "Consolas", margin: 0 });
  });

  slide.addShape(pres.shapes.LINE, { x: 5.28, y: 4.22, w: 4.35, h: 0, line: { color: "E2E8F0", width: 0.5 } });
  slide.addText("의미 연결 방법: 카테고리 맵 (CATEGORY_TO_CATE)", { x: 5.32, y: 4.28, w: 4.2, h: 0.22, fontSize: 8.5, bold: true, color: "0369A1", margin: 0 });
  slide.addText('"여행" → ["여행/숙박", "항공권", "항공마일리지", "호텔", "면세점"]', { x: 5.32, y: 4.51, w: 4.2, h: 0.2, fontSize: 8, color: "0369A1", fontFace: "Consolas", margin: 0 });
  slide.addText("→ 항공 마일리지 카드도 자동으로 포함됨", { x: 5.32, y: 4.73, w: 4.2, h: 0.2, fontSize: 8.5, color: "059669", margin: 0 });
}

// ─────────────────────────────────────────
// SLIDE 6: 벡터 DB vs Gemini 비교표 + 선택 이유
// ─────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: BG };
  addHeader(slide, "벡터 DB vs Gemini — 비교표 & 선택 이유");
  addFooter(slide, "구조화 필터 + AI 문구 + 즉시 반영이 모두 필요한 구조에서 Gemini가 더 적합");

  // Comparison table (left)
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 5.1, h: 4.32, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 0.88, w: 5.1, h: 0.38, fill: { color: NAV }, line: { color: NAV } });
  slide.addText("벡터 DB", { x: 0.3 + 1.72, y: 0.88, w: 1.72, h: 0.38, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
  slide.addText("Gemini (현재)", { x: 0.3 + 3.44, y: 0.88, w: 1.72, h: 0.38, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });

  const compareRows = [
    ["타입 필터 (카드만)", "X 별도 구현 필요", "O 명확히 분리"],
    ["회사 필터 (신한만)", "X 별도 구현 필요", "O company 필드"],
    ['"항공마일리지"="여행"', "O 벡터 거리 자동", "O 카테고리 맵"],
    ["AI 안내 문구 생성", "X 별도 LLM 호출", "O 동시에 생성"],
    ["상품 추가/변경 반영", "X 배치 재계산 필요", "O 즉시 반영"],
    ["오타 처리", "O 의미 기반", "O ES fuzziness"],
    ["비용", "변환 API + DB", "Gemini 호출만"],
    ["응답 속도", "매우 빠름 (미리 계산)", "보통 (실시간 추론)"],
  ];

  const OBG = "ECFDF5", OBD = "A7F3D0", XBG = "FEF2F2", XBD = "FECACA";

  compareRows.forEach((row, ri) => {
    const rowY = 0.88 + 0.38 + ri * 0.48;
    const bg = ri % 2 === 0 ? "FFFFFF" : "F8FAFC";
    const colW = [1.72, 1.72, 1.72];
    const colX = [0.3, 0.3 + 1.72, 0.3 + 3.44];
    row.forEach((cell, ci) => {
      const isO = cell.startsWith("O");
      const isX = cell.startsWith("X");
      const cellBg = ci === 0 ? bg : (isO ? OBG : isX ? XBG : bg);
      const border = ci === 0 ? "E2E8F0" : (isO ? OBD : isX ? XBD : "E2E8F0");
      const color = ci === 0 ? "334155" : (isO ? "166534" : isX ? "991B1B" : "334155");
      slide.addShape(pres.shapes.RECTANGLE, { x: colX[ci], y: rowY, w: colW[ci], h: 0.46, fill: { color: cellBg }, line: { color: border, width: 0.5 } });
      slide.addText(cell, { x: colX[ci] + 0.06, y: rowY, w: colW[ci] - 0.1, h: 0.46, fontSize: 8.5, bold: ci > 0 && (isO || isX), color, align: ci === 0 ? "left" : "center", valign: "middle", margin: 0 });
    });
  });

  // Right: 3 reasons
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.7, y: 0.88, w: 4.0, h: 4.32, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.7, y: 0.88, w: 4.0, h: 0.38, fill: { color: "10A37F" }, line: { color: "10A37F" } });
  slide.addText("Gemini 선택의 핵심 이유 3가지", { x: 5.7, y: 0.88, w: 4.0, h: 0.38, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });

  const reasons = [
    {
      num: "1",
      title: "구조화된 필터를 뽑아냄",
      body: '벡터 DB는 "비슷한 것"을 찾지만 "카드만", "신한만" 같은 명확한 조건은 따로 구현해야 합니다.\n\nGemini는 product_types·company 필드로 바로 분리 → ES 검색 조건이 단순해짐',
    },
    {
      num: "2",
      title: "AI 문구를 한 번에 생성",
      body: '벡터 DB: 검색 후 안내 문구를 위해 별도 LLM 호출 필요 (추가 비용·시간)\n\nGemini: 분석 + 문구 생성을 한 번의 API 호출로 동시에 처리',
    },
    {
      num: "3",
      title: "상품 변경에 즉시 대응",
      body: "벡터 DB: 새 상품 추가 시 벡터 재계산 배치 작업 필요\n\nGemini: ES에 데이터 추가만 하면 즉시 검색 가능. Gemini는 상품 데이터 저장 안 함",
    },
  ];

  reasons.forEach((r, i) => {
    const y = 1.35 + i * 1.27;
    slide.addShape(pres.shapes.OVAL, { x: 5.82, y: y + 0.04, w: 0.32, h: 0.32, fill: { color: "10A37F" }, line: { color: "10A37F" } });
    slide.addText(r.num, { x: 5.82, y: y + 0.04, w: 0.32, h: 0.32, fontSize: 11, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    slide.addText(r.title, { x: 6.2, y: y + 0.06, w: 3.4, h: 0.28, fontSize: 10, bold: true, color: NAV, valign: "middle", margin: 0 });
    slide.addShape(pres.shapes.LINE, { x: 5.78, y: y + 0.42, w: 3.85, h: 0, line: { color: "E2E8F0", width: 0.5 } });
    slide.addText(r.body, { x: 5.82, y: y + 0.49, w: 3.8, h: 0.72, fontSize: 8.5, color: "334155", margin: 0 });
  });

  // Caveat
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.7, y: 4.83, w: 4.0, h: 0.37, fill: { color: "FEF3C7" }, line: { color: "FDE68A", width: 0.5 } });
  slide.addText('벡터 DB가 더 나은 케이스: "돈 아끼고 싶어" 같은 추상적 의도는 Gemini가 카테고리를 잡기 어렵고 ES 키워드 매칭도 실패. 벡터 유사도가 자동으로 연결.', {
    x: 5.76, y: 4.83, w: 3.9, h: 0.37, fontSize: 7.5, color: "92400E", valign: "middle", margin: 0
  });
}

pres.writeFile({ fileName: "sobee_search_compare.pptx" });
console.log("Done: sobee_search_compare.pptx (6 slides)");
