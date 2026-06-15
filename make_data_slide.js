const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";

const slide = pres.addSlide();
slide.background = { color: "F0F4F8" };

// Header bar
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 10, h: 0.72,
  fill: { color: "1B2E4B" },
  line: { color: "1B2E4B" }
});

slide.addText("사용 데이터", {
  x: 0.4, y: 0, w: 9, h: 0.72,
  fontSize: 22, bold: true, color: "FFFFFF",
  valign: "middle", margin: 0
});

slide.addText("SoBee 프로젝트", {
  x: 0, y: 0, w: 9.6, h: 0.72,
  fontSize: 11, color: "90AAC8",
  align: "right", valign: "middle", margin: 0
});

const dataItems = [
  {
    name: "사용자 정보",
    category: "USER",
    tables: "users · avatar",
    desc: "프로필, 성별, 나이,\n아바타 이미지 및 설명",
    accent: "6366F1",
    catColor: "6366F1",
  },
  {
    name: "금융 거래 내역",
    category: "TRANSACTION",
    tables: "transactions",
    desc: "CODEF 수집 카드·은행\n거래일시, 금액, 가맹점",
    accent: "E8511A",
    catColor: "E8511A",
  },
  {
    name: "카드 상품",
    category: "PRODUCT",
    tables: "card_info · card_benefits\ncard_brands · card_top_benefits",
    desc: "카드사, 혜택, 브랜드,\n연회비, 주요 혜택",
    accent: "0EA5E9",
    catColor: "0EA5E9",
  },
  {
    name: "예적금·보험 상품",
    category: "PRODUCT",
    tables: "savings_products\ninsurance_products · coverages",
    desc: "금리, 가입 조건,\n보장 항목, 보험료",
    accent: "10B981",
    catColor: "10B981",
  },
  {
    name: "소비 일기·사진",
    category: "B-LOG",
    tables: "diary · photo · photo_metadata\nphoto_vlm_results · emotions_text",
    desc: "소비 일기, 사진 VLM 분석,\n감정 텍스트, 태그",
    accent: "F59E0B",
    catColor: "D97706",
  },
  {
    name: "그룹·모임",
    category: "GROUP",
    tables: "groupss · user_group",
    desc: "모임방 테마, 참여 멤버,\n그룹 거래 공유",
    accent: "EC4899",
    catColor: "EC4899",
  },
  {
    name: "AI 분석 결과",
    category: "AI / ML",
    tables: "persona_transaction\nlifecycle ML model",
    desc: "소비 페르소나, 생애주기\n코드, 카테고리 매핑 결과",
    accent: "10A37F",
    catColor: "10A37F",
  },
];

const makeShadow = () => ({
  type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.10
});

const cardW = 2.1;
const cardH = 1.55;
const gapX = 0.2;
const row1Y = 0.88;
const row2Y = row1Y + cardH + 0.25;

const row1StartX = (10 - (4 * cardW + 3 * gapX)) / 2;
const row2TotalW = 3 * cardW + 2 * gapX;
const row2StartX = (10 - row2TotalW) / 2;

dataItems.forEach((item, i) => {
  const row = i < 4 ? 0 : 1;
  const col = i < 4 ? i : i - 4;
  const startX = row === 0 ? row1StartX : row2StartX;
  const y = row === 0 ? row1Y : row2Y;
  const x = startX + col * (cardW + gapX);

  // Card background
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: cardW, h: cardH,
    fill: { color: "FFFFFF" },
    line: { color: "E2E8F0", width: 0.5 },
    shadow: makeShadow()
  });

  // Left accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 0.06, h: cardH,
    fill: { color: item.accent },
    line: { color: item.accent }
  });

  // Category label
  slide.addText(item.category, {
    x: x + 0.13, y: y + 0.12, w: cardW - 0.18, h: 0.22,
    fontSize: 8, color: item.catColor, bold: true,
    margin: 0
  });

  // Data name
  slide.addText(item.name, {
    x: x + 0.13, y: y + 0.34, w: cardW - 0.18, h: 0.38,
    fontSize: 13, bold: true, color: "1B2E4B",
    margin: 0
  });

  // Divider line
  slide.addShape(pres.shapes.LINE, {
    x: x + 0.13, y: y + 0.74, w: cardW - 0.26, h: 0,
    line: { color: "E2E8F0", width: 0.5 }
  });

  // Description
  slide.addText(item.desc, {
    x: x + 0.13, y: y + 0.82, w: cardW - 0.18, h: 0.65,
    fontSize: 9, color: "475569",
    margin: 0
  });
});

// Footer
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 5.33, w: 10, h: 0.3,
  fill: { color: "1B2E4B" },
  line: { color: "1B2E4B" }
});

slide.addText("MySQL (RDS) · Elasticsearch · AWS S3", {
  x: 0, y: 5.33, w: 10, h: 0.3,
  fontSize: 8, color: "90AAC8",
  align: "center", valign: "middle", margin: 0
});

pres.writeFile({ fileName: "sobee_data.pptx" });
console.log("Done: sobee_data.pptx");
