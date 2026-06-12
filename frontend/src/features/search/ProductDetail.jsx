import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import beeImage from '../../assets/so-bee.png'

const WOORI_NAVY  = "#042C53"
const WOORI_GREEN = "#1D9E75"
const WOORI_BLUE  = "#1A6FBF"

function CardImage({ src, alt, containerW, containerH }) {
    const [landscape, setLandscape] = useState(false)
    const [error, setError] = useState(false)
    useEffect(() => {
        const img = new Image()
        img.onload = () => setLandscape(img.naturalWidth > img.naturalHeight)
        img.src = src
    }, [src])

    if (error) {
        return (
            <div style={{ width: containerW, height: containerH, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={beeImage} alt="상품 이미지" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
        )
    }

    return landscape ? (
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
                <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={() => setError(true)} />
            </div>
        </div>
    ) : (
        <div style={{ width: containerW, height: containerH, overflow: "hidden", flexShrink: 0 }}>
            <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={() => setError(true)} />
        </div>
    )
}

const COMPANY_DOMAIN_MAP = [
    ["카카오뱅크","kakaobank.com"],["케이뱅크","kbanknow.com"],["토스뱅크","tossbank.com"],
    ["KB국민","kbstar.com"],["신한","shinhan.com"],["우리","wooribank.com"],
    ["하나","hanabank.com"],["NH농협","nonghyup.com"],["농협","nonghyup.com"],
    ["IBK기업","ibk.co.kr"],["기업은행","ibk.co.kr"],["SC제일","standardchartered.co.kr"],
    ["씨티","citibank.co.kr"],["수협","suhyup.co.kr"],["전북","jbbank.co.kr"],
    ["광주","kjbank.com"],["제주","jejubank.co.kr"],["경남","knbank.co.kr"],
    ["대구","dgb.co.kr"],["부산","busanbank.co.kr"],["산업은행","kdb.co.kr"],
    ["우체국","epostbank.go.kr"],["신협","cu.co.kr"],
    ["삼성화재","samsungfire.com"],["삼성생명","samsunglife.com"],
    ["현대해상","hi.co.kr"],["DB손해","db-ins.com"],["DB생명","dblife.co.kr"],
    ["KB손해","kbinsure.co.kr"],["KB생명","kblife.co.kr"],["롯데손해","lotteins.co.kr"],
    ["메리츠","meritzfire.com"],["한화손해","hwgeneralins.com"],["한화생명","hanwhalife.com"],
    ["교보","kyobo.co.kr"],["신한라이프","shinhanlife.co.kr"],["NH농협생명","nhlife.co.kr"],
    ["동양생명","myangel.co.kr"],["AXA","axa.co.kr"],
]

function CompanyLogo({ src, company, fallbackEmoji, size, bg }) {
    const domain = COMPANY_DOMAIN_MAP.find(([key]) => (company || "").includes(key))?.[1]
    const [stage, setStage] = useState(0)
    const srcs = [
        domain && `https://www.${domain}/apple-touch-icon.png`,
        src,
        domain && `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.${domain}&size=256`,
    ].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i)

    if (srcs.length === 0 || stage >= srcs.length) {
        return (
            <div style={{ width: size, height: size, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: Math.floor(size * 0.1) }}>
                <img src={beeImage} alt="company" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
        )
    }
    return (
        <div style={{ width: size, height: size, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: Math.floor(size * 0.12) }}>
            <img src={srcs[stage]} alt={company} style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={() => setStage(s => s + 1)} />
        </div>
    )
}

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

            <div className="px-5 pt-1 pb-3 shrink-0" style={{ background: "#fff", borderBottom: "1px solid #EEF1F5" }}>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center w-8 h-8 -ml-2 text-gray-800"
                    style={{ border: "none", cursor: "pointer", background: "none" }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
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