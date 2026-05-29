import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const WOORI_NAVY  = "#042C53"
const WOORI_GREEN = "#1D9E75"
const WOORI_BLUE  = "#1A6FBF"

function buildDetailSections(productType, content) {
    if (!content) return [];
    const tx  = { fontSize: 13, color: "#4A5F75", lineHeight: 1.7, margin: 0 };
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
                                        {line.title   && <p style={{ fontSize: 13, fontWeight: 600, color: WOORI_NAVY, margin: "0 0 2px" }}>{line.title}</p>}
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
                        {content.middle       && <span style={pill}>📅 {content.middle}</span>}
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
                        {content.joinWay    && <div style={{ marginBottom: content.joinMember ? 10 : 0 }}><p style={lbl}>가입 방법</p><p style={tx}>{content.joinWay}</p></div>}
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
                        {content.small  && <span style={pill}>⏱ {content.small}</span>}
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

export default function ProductDetail() {
    const navigate = useNavigate()
    const { state } = useLocation()
    const [expanded, setExpanded] = useState(null)

    const item = (() => {
        if (state?.item) {
            sessionStorage.setItem('productDetail', JSON.stringify(state.item))
            return state.item
        }
        const saved = sessionStorage.getItem('productDetail')
        return saved ? JSON.parse(saved) : null
    })()

    if (!item) {
        navigate(-1)
        return null
    }

    const { product_name, product_company, product_img_url, product_type, content } = item

    const headerBg =
        product_type === "savings"   ? "linear-gradient(135deg, #1D9E75, #0A6B4E)" :
        product_type === "insurance" ? "linear-gradient(135deg, #7B5EA7, #4A3570)" :
                                       "linear-gradient(135deg, #042C53, #1A6FBF)";
    const headerEmoji = product_type === "savings" ? "🏦" : product_type === "insurance" ? "🛡️" : "💳";

    const sections = buildDetailSections(product_type, content);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#F4F7FB", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>

            <div style={{ padding: "12px 20px", background: "#fff", borderBottom: "1px solid #EEF1F5", flexShrink: 0 }}>
                <button
                    onClick={() => navigate(-1)}
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
                    <div style={{ width: 100, height: 154, borderRadius: 8, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                        {product_img_url
                            ? <img src={product_img_url} alt={product_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{headerEmoji}</div>
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
                                신청하기
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
    )
}