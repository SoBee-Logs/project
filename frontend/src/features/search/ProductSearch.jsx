import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getUserId } from "../../common/hooks/useAuth";
import beeImage from "../../assets/image 61.png";

const WOORI_NAVY = "#042C53";
const WOORI_GREEN = "#1D9E75";
const WOORI_BLUE = "#1A6FBF";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const FASTAPI_BASE = import.meta.env.VITE_FASTAPI_BASE_URL || "http://localhost:8000";

let _searchStateCache = null;

export function clearSearchCache() {
  _searchStateCache = null
}

const api = {
    search: (searchInput, signal) =>
        fetch(`${BASE_URL}/api/search`, {
            method: "POST",
            signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
                search_input: searchInput,
                user_id: getUserId(),
            }),
        }).then((r) => r.json()),
};

const FALLBACK_SUGGEST = [
    "실적 채울 카드 추천해줘",
    "내 패턴에 맞는 카드 뭐야?",
    "나 여행 갈 건데 어떤 트래블 카드 써야 해?",
    "카페 혜택 좋은 카드는 뭐야?",
    "금리 좋은 적금 상품 알려줘",
];

// ─── Company Logo ─────────────────────────────────────────────────────────────
const COMPANY_DOMAIN_MAP = [
    // 은행
    ["카카오뱅크",    "kakaobank.com"],
    ["케이뱅크",      "kbanknow.com"],
    ["토스뱅크",      "tossbank.com"],
    ["KB국민",        "kbstar.com"],
    ["신한",          "shinhan.com"],
    ["우리",          "wooribank.com"],
    ["하나",          "hanabank.com"],
    ["NH농협",        "nonghyup.com"],
    ["농협",          "nonghyup.com"],
    ["IBK기업",       "ibk.co.kr"],
    ["기업은행",      "ibk.co.kr"],
    ["SC제일",        "standardchartered.co.kr"],
    ["씨티",          "citibank.co.kr"],
    ["수협",          "suhyup.co.kr"],
    ["전북",          "jbbank.co.kr"],
    ["광주",          "kjbank.com"],
    ["제주",          "jejubank.co.kr"],
    ["경남",          "knbank.co.kr"],
    ["대구",          "dgb.co.kr"],
    ["부산",          "busanbank.co.kr"],
    ["산업은행",      "kdb.co.kr"],
    ["우체국",        "epostbank.go.kr"],
    ["신협",          "cu.co.kr"],
    ["SBI저축",       "sbibank.co.kr"],
    // 보험
    ["삼성화재",      "samsungfire.com"],
    ["삼성생명",      "samsunglife.com"],
    ["현대해상",      "hi.co.kr"],
    ["DB손해",        "db-ins.com"],
    ["DB생명",        "dblife.co.kr"],
    ["KB손해",        "kbinsure.co.kr"],
    ["KB생명",        "kblife.co.kr"],
    ["롯데손해",      "lotteins.co.kr"],
    ["메리츠",        "meritzfire.com"],
    ["한화손해",      "hwgeneralins.com"],
    ["한화생명",      "hanwhalife.com"],
    ["흥국화재",      "hkfire.co.kr"],
    ["흥국생명",      "hklife.co.kr"],
    ["교보",          "kyobo.co.kr"],
    ["신한라이프",    "shinhanlife.co.kr"],
    ["NH농협생명",    "nhlife.co.kr"],
    ["동양생명",      "myangel.co.kr"],
    ["미래에셋",      "miraeassetlife.com"],
    ["AXA",           "axa.co.kr"],
    ["MG손해",        "mggeneralins.com"],
];

const getCompanyDomain = (company) => {
    if (!company) return null;
    const entry = COMPANY_DOMAIN_MAP.find(([key]) => company.includes(key));
    return entry ? entry[1] : null;
};

function CompanyLogo({ src, company, fallbackEmoji, size, bg }) {
    const domain = getCompanyDomain(company);
    const [stage, setStage] = useState(0);

    // apple-touch-icon(180×180) → 백엔드 URL(faviconV2) → Google faviconV2 순으로 시도, 중복 제거
    const srcs = [
        domain && `https://www.${domain}/apple-touch-icon.png`,
        src,
        domain && `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.${domain}&size=256`,
    ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);

    if (srcs.length === 0 || stage >= srcs.length) {
        return (
            <div style={{ width: size, height: size, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: Math.floor(size * 0.1) }}>
                <img src={beeImage} alt="company" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
        );
    }
    return (
        <div style={{ width: size, height: size, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: Math.floor(size * 0.12) }}>
            <img src={srcs[stage]} alt={company} style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={() => setStage(s => s + 1)} />
        </div>
    );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
const TYPE_ICON = {
    card:      { emoji: "💳", bg: "linear-gradient(135deg, #2A7FD8, #0E3F78)" },
    savings:   { emoji: "🏦", bg: "linear-gradient(135deg, #1D9E75, #0A6B4E)" },
    insurance: { emoji: "🛡️", bg: "linear-gradient(135deg, #7B5EA7, #4A3570)" },
};

function CardImage({ src, alt, containerW, containerH }) {
    const [landscape, setLandscape] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.onload = () => setLandscape(img.naturalWidth > img.naturalHeight);
        img.src = src;
    }, [src]);

    if (error) {
        return (
            <div style={{ width: containerW, height: containerH, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <img src={beeImage} alt="상품 이미지" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
        );
    }

    return landscape ? (
        // 가로 이미지: layout은 portrait(containerW×containerH)로 잡고,
        // 내부에 landscape 컨테이너를 중앙 배치 후 90도 회전
        <div style={{ width: containerW, height: containerH, flexShrink: 0, overflow: "hidden", position: "relative" }}>
            <div style={{
                width: containerH, height: containerW,
                position: "absolute",
                left: (containerW - containerH) / 2,
                top: (containerH - containerW) / 2,
                transform: "rotate(90deg)",
                transformOrigin: "center center",
                overflow: "hidden",
            }}>
                <img
                    src={src} alt={alt}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={() => setError(true)}
                />
            </div>
        </div>
    ) : (
        <div style={{ width: containerW, height: containerH, overflow: "hidden", flexShrink: 0 }}>
            <img
                src={src} alt={alt}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={() => setError(true)}
            />
        </div>
    );
}

function ProductCard({ item, onClick, matchedCateNames = [] }) {
    const { product_name, product_company, product_img_url, product_type, is_discontinued, content } = item;
    const typeStyle = TYPE_ICON[product_type] || TYPE_ICON.card;

    return (
        <div
            onClick={() => !is_discontinued && onClick(item)}
            style={{
                position: "relative",
                background: "#fff",
                borderRadius: 16,
                padding: "16px",
                display: "flex",
                gap: 14,
                cursor: is_discontinued ? "default" : "pointer",
                border: "1.5px solid #EEF1F5",
                transition: "box-shadow 0.2s, transform 0.2s",
                marginBottom: 12,
                overflow: "hidden",
            }}
            onMouseEnter={(e) => {
                if (!is_discontinued) {
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(4,44,83,0.1)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
            }}
        >
            {is_discontinued && (
                <div style={{
                    position: "absolute", inset: 0, zIndex: 10,
                    backdropFilter: "blur(1px)",
                    background: "rgba(255,255,255,0.3)",
                    borderRadius: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <span style={{
                        fontSize: 12, fontWeight: 700, color: "#fff",
                        background: "rgba(60,60,60,0.65)",
                        borderRadius: 99, padding: "6px 14px",
                    }}>
                        현재 신규 발급이 불가능한 상품이에요
                    </span>
                </div>
            )}
            <div style={{ borderRadius: 8, overflow: "hidden", flexShrink: 0, alignSelf: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                {product_type !== "card" ? (
                    <CompanyLogo src={product_img_url} company={product_company} fallbackEmoji={typeStyle.emoji} size={72} bg={typeStyle.bg} />
                ) : product_img_url ? (
                    <CardImage src={product_img_url} alt={product_name} containerW={72} containerH={110} />
                ) : (
                    <div style={{ width: 72, height: 110, background: typeStyle.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                        {typeStyle.emoji}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: WOORI_NAVY, margin: "0 0 2px" }}>{product_name}</p>
                <p style={{ fontSize: 12, color: "#8494A8", margin: "0 0 4px" }}>{product_company}</p>
                {product_type === "savings" ? (
                    (content?.header || content?.middle) && (
                        <p style={{ fontSize: 13, fontWeight: 600, color: WOORI_BLUE, margin: 0 }}>
                            {[content.header, content.middle].filter(Boolean).join(" / ")}
                        </p>
                    )
                ) : (
                    <>
                        {product_type === "card" && content?.benefitGroups?.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                                {content.benefitGroups.map((g, i) => {
                                    const isMatched = matchedCateNames.includes(g.cateName);
                                    return (
                                        <span key={i} style={{
                                            fontSize: 11, fontWeight: isMatched ? 700 : 500,
                                            color: isMatched ? WOORI_BLUE : "#8494A8",
                                            background: isMatched ? "#E8F0FA" : "#F4F7FB",
                                            borderRadius: 6,
                                            padding: "2px 7px",
                                        }}>
                                            {g.cateName}
                                        </span>
                                    );
                                })}
                            </div>
                        ) : content?.header ? (
                            <p style={{ fontSize: 13, fontWeight: 600, color: WOORI_BLUE, margin: 0 }}>
                                {content.header}
                            </p>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── AI Insight Box ───────────────────────────────────────────────────────────
function AIInsightBox({ text }) {
    if (!text) return null;
    const formatted = text.replace(/([!?.])\s+/g, "$1\n");
    return (
        <div
            style={{
                background: "linear-gradient(135deg, #EAF7F2, #E8F0FA)",
                borderRadius: 14,
                padding: "12px 10px",
                border: "1px solid #C8E6D8",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>🤖</span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: WOORI_GREEN }}>AI 분석 결과</p>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: WOORI_NAVY, lineHeight: 1.65, wordBreak: "break-all", overflowWrap: "break-word", whiteSpace: "pre-line", width: "100%" }}>{formatted}</p>
        </div>
    );
}

// ─── Detail Sections Builder ──────────────────────────────────────────────────
function buildDetailSections(productType, content) {
    if (!content) return [];
    const tx = { fontSize: 13, color: "#4A5F75", lineHeight: 1.7, margin: 0 };
    const lbl = { fontSize: 11, color: "#8494A8", margin: "0 0 4px" };
    const pill = { fontSize: 12, background: "#EEF1F5", borderRadius: 6, padding: "4px 10px", color: "#4A5F75" };

    if (productType === "card") {
        const sections = [];
        if (content.benefitGroups?.length > 0) {
            sections.push({
                label: "카테고리별 혜택", icon: "🎁",
                render: () => (
                    <div>
                        {content.benefitGroups.map((group, gi) => (
                            <div key={gi} style={{ marginBottom: 14 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: WOORI_BLUE, margin: "0 0 6px", borderLeft: `3px solid ${WOORI_BLUE}`, paddingLeft: 8 }}>{group.cateName}</p>
                                {group.lines?.map((line, li) => (
                                    <div key={li} style={{ marginBottom: 8, paddingLeft: 11 }}>
                                        {line.title && <p style={{ fontSize: 13, fontWeight: 600, color: WOORI_NAVY, margin: "0 0 2px" }}>{line.title}</p>}
                                        {line.comment && <p style={{ ...tx, fontSize: 12, color: "#6A7F93" }}>{line.comment}</p>}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ),
            });
        }
        if (content.annualFeeDetail || content.middle) {
            sections.push({
                label: "연회비 · 실적 조건", icon: "💳",
                render: () => (
                    <div>
                        {content.annualFeeDetail && <p style={tx}>{content.annualFeeDetail}</p>}
                        {content.middle && <p style={{ ...tx, marginTop: content.annualFeeDetail ? 8 : 0, color: "#8494A8" }}>{content.middle}</p>}
                    </div>
                ),
            });
        }
        if (content.small) {
            sections.push({
                label: "추가 혜택", icon: "✨",
                render: () => (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {content.small.split(", ").map((t, i) => <span key={i} style={pill}>{t}</span>)}
                    </div>
                ),
            });
        }
        return sections;
    }

    if (productType === "savings") {
        const sections = [];
        sections.push({
            label: "금리 정보", icon: "📈",
            render: () => (
                <div>
                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                        {content.intrRate && (
                            <div style={{ flex: 1, background: "#F4F7FB", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                                <p style={lbl}>기본금리</p>
                                <p style={{ fontSize: 22, fontWeight: 800, color: WOORI_NAVY, margin: 0 }}>{content.intrRate}</p>
                            </div>
                        )}
                        {content.header && (
                            <div style={{ flex: 1, background: "#EAF7F2", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                                <p style={{ ...lbl, color: WOORI_GREEN }}>우대금리 최대</p>
                                <p style={{ fontSize: 22, fontWeight: 800, color: WOORI_GREEN, margin: 0 }}>
                                    {content.header.replace("우대금리 최대 ", "")}
                                </p>
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {content.middle && <span style={pill}>📅 {content.middle}</span>}
                        {content.intrRateType && <span style={pill}>{content.intrRateType}</span>}
                    </div>
                </div>
            ),
        });
        if (content.small) {
            sections.push({ label: "우대 조건", icon: "⭐", render: () => <p style={tx}>{content.small}</p> });
        }
        if (content.joinWay || content.joinMember) {
            sections.push({
                label: "가입 방법 · 대상", icon: "📝",
                render: () => (
                    <div>
                        {content.joinWay && <div style={{ marginBottom: content.joinMember ? 10 : 0 }}><p style={lbl}>가입 방법</p><p style={tx}>{content.joinWay}</p></div>}
                        {content.joinMember && <div><p style={lbl}>가입 대상</p><p style={tx}>{content.joinMember}</p></div>}
                    </div>
                ),
            });
        }
        if (content.etcNote || content.mtrtInt) {
            sections.push({
                label: "유의사항", icon: "⚠️",
                render: () => (
                    <div>
                        {content.mtrtInt && <div style={{ marginBottom: content.etcNote ? 10 : 0 }}><p style={lbl}>만기 후 이율</p><p style={tx}>{content.mtrtInt}</p></div>}
                        {content.etcNote && <p style={tx}>{content.etcNote}</p>}
                    </div>
                ),
            });
        }
        return sections;
    }

    if (productType === "insurance") {
        const sections = [];
        if (content.description) {
            sections.push({ label: "상품 설명", icon: "📋", render: () => <p style={tx}>{content.description}</p> });
        }
        if (content.coverages?.length > 0) {
            sections.push({
                label: `보장 내용 (${content.coverages.length}개)`, icon: "🛡️",
                render: () => (
                    <div>
                        {content.coverages.map((cov, ci) => (
                            <div key={ci} style={{ borderBottom: ci < content.coverages.length - 1 ? "1px solid #EEF1F5" : "none", paddingBottom: 10, marginBottom: 10 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: WOORI_NAVY, margin: "0 0 4px" }}>{cov.itemName}</p>
                                {cov.conditionText && <p style={{ ...tx, fontSize: 12 }}>{cov.conditionText}</p>}
                                {cov.exclusionText && <p style={{ fontSize: 11, color: "#B0BEC5", margin: "4px 0 0" }}>※ {cov.exclusionText}</p>}
                            </div>
                        ))}
                    </div>
                ),
            });
        }
        if (content.ageRange || content.gender || content.small) {
            sections.push({
                label: "가입 조건", icon: "👤",
                render: () => (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {content.ageRange && <span style={{ ...pill, background: "#EAF7F2", color: WOORI_GREEN }}>👤 {content.ageRange}</span>}
                        {content.gender && content.gender !== "all" && <span style={pill}>{content.gender === "M" ? "남성" : content.gender === "F" ? "여성" : content.gender}</span>}
                        {content.small && <span style={pill}>⏱ {content.small}</span>}
                    </div>
                ),
            });
        }
        if (content.middle) {
            sections.push({
                label: "추천 상황", icon: "💡",
                render: () => (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {content.middle.split(/[,，、]/).map((t, i) => <span key={i} style={pill}>{t.trim()}</span>)}
                    </div>
                ),
            });
        }
        if (content.notes) {
            sections.push({ label: "유의사항", icon: "⚠️", render: () => <p style={tx}>{content.notes}</p> });
        }
        return sections;
    }

    return [
        content.header && { label: "주요 혜택", icon: "💡", render: () => <p style={tx}>{content.header}</p> },
        content.middle && { label: "조건 / 태그", icon: "📋", render: () => <p style={tx}>{content.middle}</p> },
        content.small  && { label: "상세 조건",  icon: "📌", render: () => <p style={tx}>{content.small}</p> },
    ].filter(Boolean);
}

// ─── Detail Page ──────────────────────────────────────────────────────────────
function DetailPage({ item, onBack }) {
    const [expanded, setExpanded] = useState(null);
    const { product_name, product_company, product_img_url, product_type, content } = item;

    const headerBg =
        product_type === "savings"   ? "linear-gradient(135deg, #1D9E75, #0A6B4E)" :
        product_type === "insurance" ? "linear-gradient(135deg, #7B5EA7, #4A3570)" :
                                       "linear-gradient(135deg, #042C53, #1A6FBF)";
    const headerEmoji = product_type === "savings" ? "🏦" : product_type === "insurance" ? "🛡️" : "💳";

    const sections = buildDetailSections(product_type, content);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #EEF1F5", flexShrink: 0 }}>
                <button
                    onClick={onBack}
                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                    style={{ border: "none", cursor: "pointer", background: "none" }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            <div className="hide-scrollbar" style={{ flex: 1, overflowY: "scroll", padding: "16px 20px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                <div style={{ background: headerBg, borderRadius: 18, padding: "20px", display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
                    <div style={{ borderRadius: 8, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                        {product_type !== "card"
                            ? <CompanyLogo src={product_img_url} company={product_company} fallbackEmoji={headerEmoji} size={100} bg="rgba(255,255,255,0.15)" />
                            : product_img_url
                                ? <CardImage src={product_img_url} alt={product_name} containerW={100} containerH={154} />
                                : <div style={{ width: 100, height: 154, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{headerEmoji}</div>
                        }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{product_company}</p>
                        <p style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 800, color: "#fff" }}>{product_name}</p>
                        {product_type === "card" && content?.benefitGroups?.length > 0
                            ? <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", lineHeight: 1.6, wordBreak: "keep-all" }}>{content.benefitGroups.map(g => g.cateName).join(" · ")}</p>
                            : content?.header && <p style={{ margin: "0 0 8px", fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{content.header}</p>
                        }
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {content?.onlyOnline && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, padding: "3px 8px" }}>온라인 전용</span>}
                            {content?.isImpend   && <span style={{ fontSize: 11, background: "rgba(255,200,0,0.25)", color: "#FFD700", borderRadius: 6, padding: "3px 8px" }}>단종 임박</span>}
                        </div>
                        {content?.url && (
                            <a href={content.url} target="_blank" rel="noopener noreferrer"
                               style={{ display: "inline-block", marginTop: 10, background: WOORI_GREEN, borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, padding: "8px 20px", textDecoration: "none" }}>
                                신청
                            </a>
                        )}
                    </div>
                </div>

                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: WOORI_NAVY }}>상품 상세</h3>
                {sections.length === 0 && (
                    <p style={{ fontSize: 13, color: "#8494A8", textAlign: "center", padding: "20px 0" }}>상세 정보가 없어요</p>
                )}
                {sections.map((s, i) => (
                    <div key={i} style={{ background: "#fff", borderRadius: 12, border: "1.5px solid #EEF1F5", marginBottom: 8, overflow: "hidden" }}>
                        <button
                            onClick={() => setExpanded(expanded === i ? null : i)}
                            style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        >
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 18 }}>{s.icon}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: WOORI_NAVY }}>{s.label}</span>
                            </span>
                            <span style={{ fontSize: 12, color: "#8494A8", transform: expanded === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
                        </button>
                        {expanded === i && (
                            <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #EEF1F5" }}>
                                {s.render()}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProductSearch() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        if (!getUserId()) navigate('/login')
    }, [])
    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [isSearched, setIsSearched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const searchAbortRef = useRef(null);
    const scrollRef = useRef(null);
    const [activePage, setActivePage] = useState(searchParams.get("detail") ? "detail" : "search");
    const [selectedItem, setSelectedItem] = useState(() => {
        if (searchParams.get("detail")) {
            const saved = sessionStorage.getItem("searchSelectedItem");
            return saved ? JSON.parse(saved) : null;
        }
        return null;
    });

    const [suggestedQuestions, setSuggestedQuestions] = useState([]);
    const [questionsLoading, setQuestionsLoading] = useState(true);
    const recentQuestionsKey = `recentQuestions_${getUserId()}`
    const [recentQuestions, setRecentQuestions] = useState(
        () => JSON.parse(localStorage.getItem(recentQuestionsKey) || "[]")
    );
    const [aiText, setAiText] = useState("");
    const [products, setProducts] = useState([]);
    const [matchedCateNames, setMatchedCateNames] = useState([]);
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "card");
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        const userId = getUserId();
        fetch(`/api/report/recommend-questions?user_id=${userId}`, { signal: controller.signal })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data?.questions) && data.questions.length > 0) {
                    setSuggestedQuestions(data.questions);
                } else {
                    setSuggestedQuestions(FALLBACK_SUGGEST);
                }
            })
            .catch((e) => {
                if (e.name !== "AbortError") setSuggestedQuestions(FALLBACK_SUGGEST);
            })
            .finally(() => {
                if (!controller.signal.aborted) setQuestionsLoading(false);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        const initialQuery = searchParams.get("q");
        if (!initialQuery) return;

        // 같은 쿼리의 캐시가 있으면 복원 (재검색 방지)
        if (_searchStateCache && _searchStateCache.q === initialQuery) {
            setProducts(_searchStateCache.products);
            setAiText(_searchStateCache.aiText);
            setMatchedCateNames(_searchStateCache.matchedCateNames || []);
            setActiveTab(_searchStateCache.tab);
            setIsSearched(true);
            return;
        }
        handleSearch(initialQuery);
    }, []);

    const handleSearch = async (q) => {
        const searchQuery = q || query;
        if (!searchQuery.trim()) return;

        // 이전 요청 취소
        if (searchAbortRef.current) searchAbortRef.current.abort();
        const controller = new AbortController();
        searchAbortRef.current = controller;

        setQuery(searchQuery);
        setSearchParams({ q: searchQuery, tab: activeTab });
        setIsLoading(true);
        setError(null);
        setAiText("");
        setProducts([]);

        // 최근 질문 localStorage 저장 (중복 제거 + 최대 5개)
        const updated = [searchQuery, ...recentQuestions.filter((r) => r !== searchQuery)].slice(0, 5);
        setRecentQuestions(updated);
        localStorage.setItem(recentQuestionsKey, JSON.stringify(updated));

        try {
            const data = await api.search(searchQuery, controller.signal);
            if (controller.signal.aborted) return;
            setAiText(data.AI_text || data.ai_text || "");
            const fetched = data.products || [];
            const cateNames = data.matched_cate_names || [];
            setProducts(fetched);
            setMatchedCateNames(cateNames);
            setIsSearched(true);
            const firstTab = ["card", "savings", "insurance"].find(t => fetched.some(p => p.product_type === t)) || "card";
            setActiveTab(firstTab);
            setSearchParams({ q: searchQuery, tab: firstTab });
            _searchStateCache = { q: searchQuery, products: fetched, aiText: data.AI_text || data.ai_text || "", matchedCateNames: cateNames, tab: firstTab };
        } catch (e) {
            if (e.name === "AbortError") return;
            setError("검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
        } finally {
            if (!controller.signal.aborted) setIsLoading(false);
        }
    };

    // 언마운트 시 진행 중인 검색 요청 취소
    useEffect(() => {
        return () => { if (searchAbortRef.current) searchAbortRef.current.abort(); };
    }, []);

    // 탭 전환 시 스크롤 초기화
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [activeTab]);

    const handleBack = () => {
        if (activePage === "detail") {
            setActivePage("search");
            sessionStorage.removeItem("searchSelectedItem");
            setSearchParams({ q: query, tab: activeTab });
        } else if (isSearched) {
            setIsSearched(false);
            setQuery("");
            setProducts([]);
            setAiText("");
            setSearchParams({});
        } else {
            navigate("/home");
        }
    };

    const TABS = [
        { key: "card",      label: "💳 카드" },
        { key: "savings",   label: "🏦 예적금" },
        { key: "insurance", label: "🛡️ 미니보험" },
    ];
    const tabProducts = products
        .filter(p => p.product_type === activeTab)
        .sort((a, b) => (a.is_discontinued ? 1 : 0) - (b.is_discontinued ? 1 : 0));

    const getQuestionText = (q) =>
        typeof q === "string" ? q : q.question || q.text || q.content || "";

    if (activePage === "detail" && selectedItem) {
        return <DetailPage item={selectedItem} onBack={() => {
            setActivePage("search");
            sessionStorage.removeItem("searchSelectedItem");
            setSearchParams({ q: query, tab: activeTab });
        }} />;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F4F7FB", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", position: "relative" }}>

            {/* Header */}
            <div style={{ padding: "16px 20px 0", background: "#fff", flexShrink: 0 }}>
                <button
                    onClick={handleBack}
                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                    style={{ border: "none", cursor: "pointer", background: "none", marginBottom: 8 }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800, color: WOORI_NAVY, letterSpacing: "-0.5px" }}>
                    상품 찾기
                </h1>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#8494A8" }}>AI가 내 소비 패턴으로 추천해요</p>

                <div
                    style={{
                        display: "flex", alignItems: "center",
                        background: isSearched ? "#fff" : "#F0F4FA",
                        borderRadius: 12, padding: "10px 14px", marginBottom: 14,
                        border: isSearched ? `1.5px solid ${WOORI_BLUE}` : "1.5px solid transparent",
                        gap: 8, transition: "all 0.2s",
                    }}
                >
                    <span style={{ fontSize: 18, color: "#8494A8" }}>🔍</span>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="궁금한 걸 자유롭게 물어보세요!"
                        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: WOORI_NAVY, fontFamily: "inherit" }}
                    />
                    {query && (
                        <button
                            onClick={() => handleSearch()}
                            style={{ background: WOORI_BLUE, border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px", cursor: "pointer" }}
                        >
                            검색
                        </button>
                    )}
                </div>
            </div>

            {/* 탭 바 - 스크롤 영역 밖 고정 */}
            {isSearched && (
                <div style={{ display: "flex", gap: 8, padding: "10px 20px", background: "#fff", borderBottom: "1px solid #EEF1F5", flexShrink: 0 }}>
                    {TABS.map(({ key, label }) => {
                        const count = products.filter(p => p.product_type === key).length;
                        const isActive = activeTab === key;
                        return (
                            <button
                                key={key}
                                onClick={() => { setActiveTab(key); setSearchParams({ q: query, tab: key }); }}
                                style={{
                                    flex: 1, padding: "8px 0", borderRadius: 10,
                                    background: isActive ? WOORI_BLUE : "#fff",
                                    color: isActive ? "#fff" : "#8494A8",
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: 12, cursor: "pointer",
                                    border: isActive ? "none" : "1.5px solid #EEF1F5",
                                    transition: "all 0.15s",
                                }}
                            >
                                {label}
                                {count > 0 && (
                                    <span style={{
                                        marginLeft: 4, fontSize: 10,
                                        background: isActive ? "rgba(255,255,255,0.3)" : "#EEF1F5",
                                        color: isActive ? "#fff" : "#8494A8",
                                        borderRadius: 99, padding: "1px 5px",
                                    }}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Body */}
            <div ref={scrollRef} className="hide-scrollbar" style={{ flex: 1, overflowY: "scroll", padding: "16px 20px", paddingBottom: isSearched && aiText ? "90px" : "16px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {isLoading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${WOORI_GREEN}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                        <p style={{ fontSize: 13, color: "#8494A8", margin: 0 }}>AI가 분석 중이에요...</p>
                    </div>
                ) : error ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#8494A8", fontSize: 14 }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
                        {error}
                        <br />
                        <button
                            onClick={() => handleSearch()}
                            style={{ marginTop: 12, background: WOORI_BLUE, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, padding: "8px 16px", cursor: "pointer" }}
                        >
                            다시 시도
                        </button>
                    </div>
                ) : isSearched ? (
                    <>
                        {/* 탭 콘텐츠 */}
                        {tabProducts.length > 0 ? (
                            tabProducts.map((item, i) => (
                                <ProductCard
                                    key={i}
                                    item={item}
                                    matchedCateNames={matchedCateNames}
                                    onClick={(it) => {
                        sessionStorage.setItem("searchSelectedItem", JSON.stringify(it));
                        setSearchParams({ q: query, tab: activeTab, detail: "1" });
                        setSelectedItem(it);
                        setActivePage("detail");
                    }}
                                />
                            ))
                        ) : (
                            <div>
                                <div style={{ textAlign: "center", padding: "40px 0 24px", color: "#8494A8", fontSize: 14 }}>
                                    <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                                    이 카테고리에 결과가 없어요<br />
                                    <span style={{ fontSize: 12 }}>다른 탭을 확인해보세요</span>
                                </div>
                                {suggestedQuestions.length > 0 && (
                                    <div style={{ marginBottom: 24 }}>
                                        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: WOORI_NAVY }}>추천 질문</p>
                                        {suggestedQuestions.map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSearch(getQuestionText(q))}
                                                style={{ width: "100%", background: "#fff", border: "1.5px solid #EEF1F5", borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 13, color: WOORI_NAVY, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
                                            >
                                                <span style={{ fontSize: 14, color: WOORI_BLUE }}>✦</span>
                                                {getQuestionText(q)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* 추천 질문 */}
                        <div style={{ marginBottom: 24 }}>
                            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: WOORI_NAVY }}>추천 질문</p>
                            {questionsLoading ? (
                                <>
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <div key={i} style={{ height: 44, borderRadius: 12, background: "#EEF1F5", marginBottom: 8 }} />
                                    ))}
                                </>
                            ) : (
                                <>
                                    {suggestedQuestions.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSearch(getQuestionText(q))}
                                            style={{ width: "100%", background: "#fff", border: "1.5px solid #EEF1F5", borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 13, color: WOORI_NAVY, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
                                        >
                                            <span style={{ fontSize: 14, color: WOORI_BLUE }}>✦</span>
                                            {getQuestionText(q)}
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* 최근 질문 - 있을 때만 표시 */}
                        {recentQuestions.length > 0 && (
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: WOORI_NAVY }}>최근 질문</p>
                                    <button
                                        onClick={() => {
                                            setRecentQuestions([]);
                                            localStorage.removeItem(recentQuestionsKey);
                                        }}
                                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#8494A8", padding: 0 }}
                                    >
                                        전체 삭제
                                    </button>
                                </div>
                                {recentQuestions.map((q, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                        <button
                                            onClick={() => handleSearch(q)}
                                            style={{ flex: 1, background: "#fff", border: "1.5px solid #EEF1F5", borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 13, color: WOORI_NAVY, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}
                                        >
                                            <span style={{ fontSize: 14, color: "#8494A8" }}>🕐</span>
                                            {q}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updated = recentQuestions.filter((_, idx) => idx !== i);
                                                setRecentQuestions(updated);
                                                localStorage.setItem(recentQuestionsKey, JSON.stringify(updated));
                                            }}
                                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#B0BEC5", padding: "4px", flexShrink: 0 }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* AI 분석 결과 - 하단 오버레이 */}
            {isSearched && aiText && (
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 8px", background: "transparent", pointerEvents: "none", zIndex: 10 }}>
                    <div style={{ pointerEvents: "auto" }}>
                        <AIInsightBox text={aiText} />
                    </div>
                </div>
            )}
        </div>
    );
}