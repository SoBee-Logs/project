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

slide.addText("사용 외부 API", {
  x: 0.4, y: 0, w: 9, h: 0.72,
  fontSize: 22, bold: true, color: "FFFFFF",
  valign: "middle", margin: 0
});

slide.addText("SoBee 프로젝트", {
  x: 0, y: 0, w: 9.6, h: 0.72,
  fontSize: 11, color: "90AAC8",
  align: "right", valign: "middle", margin: 0
});

const apis = [
  {
    name: "OpenAI API",
    category: "AI / LLM",
    desc: "카테고리 매핑, 일기 생성,\n아바타 서비스",
    accent: "10A37F",
    catColor: "10A37F",
  },
  {
    name: "Google Gemini",
    category: "AI / LLM",
    desc: "LLM 보조 기능\n(OpenAI 병행 사용)",
    accent: "4285F4",
    catColor: "4285F4",
  },
  {
    name: "CODEF API",
    category: "마이데이터",
    desc: "카드·은행 거래내역\n금융 마이데이터 수집",
    accent: "E8511A",
    catColor: "E8511A",
  },
  {
    name: "AWS S3",
    category: "클라우드 스토리지",
    desc: "미디어 파일 저장\n(아바타 이미지 등)",
    accent: "FF9900",
    catColor: "FF9900",
  },
  {
    name: "AWS RDS",
    category: "데이터베이스",
    desc: "MySQL 메인 DB\n(ap-northeast-2)",
    accent: "527FFF",
    catColor: "527FFF",
  },
  {
    name: "Apache Airflow",
    category: "데이터 파이프라인",
    desc: "DAG 트리거 및\n배치 작업 스케줄링",
    accent: "017CEE",
    catColor: "017CEE",
  },
  {
    name: "Elasticsearch",
    category: "검색 엔진",
    desc: "거래내역 검색\n파싱 및 인덱싱",
    accent: "FEC514",
    catColor: "005571",
  },
];

const makeShadow = () => ({
  type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.10
});

// Layout: row1 = 4 cards, row2 = 3 cards centered
const cardW = 2.1;
const cardH = 1.55;
const gapX = 0.2;
const row1Y = 0.88;
const row2Y = row1Y + cardH + 0.25;

const row1StartX = (10 - (4 * cardW + 3 * gapX)) / 2;
const row2TotalW = 3 * cardW + 2 * gapX;
const row2StartX = (10 - row2TotalW) / 2;

apis.forEach((api, i) => {
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
    fill: { color: api.accent },
    line: { color: api.accent }
  });

  // Category label
  slide.addText(api.category, {
    x: x + 0.13, y: y + 0.12, w: cardW - 0.18, h: 0.22,
    fontSize: 8, color: api.catColor, bold: true,
    margin: 0
  });

  // API name
  slide.addText(api.name, {
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
  slide.addText(api.desc, {
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

slide.addText("FastAPI (Backend) · Spring Boot (Backend) · Next.js (Frontend)", {
  x: 0, y: 5.33, w: 10, h: 0.3,
  fontSize: 8, color: "90AAC8",
  align: "center", valign: "middle", margin: 0
});

pres.writeFile({ fileName: "sobee_external_apis.pptx" });
console.log("Done: sobee_external_apis.pptx");
