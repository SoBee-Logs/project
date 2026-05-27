import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const WOORI_NAVY = "#042C53";
const WOORI_GREEN = "#1D9E75";
const WOORI_BLUE = "#1A6FBF";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const FASTAPI_BASE = import.meta.env.VITE_FASTAPI_BASE_URL || "http://localhost:8000";

const getUserId = () => Number(localStorage.getItem("user_id")) || 1;

const api = {
    search: (searchInput) =>
        fetch(`${BASE_URL}/search`, {
            method: "POST",
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

// ─── Product Card ─────────────────────────────────────────────────────────────
const TYPE_ICON = {
    card:      { emoji: "💳", bg: "linear-gradient(135deg, #2A7FD8, #0E3F78)" },
    savings:   { emoji: "🏦", bg: "linear-gradient(135deg, #1D9E75, #0A6B4E)" },
    insurance: { emoji: "🛡️", bg: "linear-gradient(135deg, #7B5EA7, #4A3570)" },
};

function ProductCard({ item, onClick }) {
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
            <div
                style={{
                    width: 52,
                    height: 80,
                    borderRadius: 8,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: typeStyle.bg,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                }}
            >
                {product_img_url ? (
                    <img
                        src={product_img_url}
                        alt={product_name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                        {typeStyle.emoji}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: WOORI_NAVY }}>{product_name}</span>
                    <span style={{ fontSize: 12, color: "#8494A8" }}>{product_company}</span>
                </div>
                {content?.header && (
                    <p style={{ fontSize: 13, fontWeight: 600, color: WOORI_BLUE, margin: "0 0 4px" }}>
                        {content.header}
                    </p>
                )}
                {content?.middle && (
                    <p style={{ fontSize: 12, color: "#3D5166", margin: "0 0 3px", lineHeight: 1.5 }}>
                        {content.middle}
                    </p>
                )}
                {content?.small && (
                    <p style={{ fontSize: 11, color: "#8494A8", margin: 0, lineHeight: 1.4 }}>
                        {content.small}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── AI Insight Box ───────────────────────────────────────────────────────────
function AIInsightBox({ text }) {
    if (!text) return null;
    return (
        <div
            style={{
                background: "linear-gradient(135deg, #EAF7F2, #E8F0FA)",
                borderRadius: 14,
                padding: "12px 16px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                border: "1px solid #C8E6D8",
            }}
        >
            <div
                style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${WOORI_GREEN}, ${WOORI_BLUE})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, fontSize: 16,
                }}
            >
                🤖
            </div>
            <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: WOORI_GREEN }}>AI 분석 결과</p>
                <p style={{ margin: 0, fontSize: 13, color: WOORI_NAVY, lineHeight: 1.6, whiteSpace: "pre-line" }}>{text}</p>
            </div>
        </div>
    );
}

// ─── Detail Page ──────────────────────────────────────────────────────────────
function DetailPage({ item, onBack }) {
    const [expanded, setExpanded] = useState(null);
    const { product_name, product_company, product_img_url, content } = item;

    const sections = [
        content?.header && { label: "주요 혜택", icon: "💡", detail: content.header },
        content?.middle && { label: "조건 / 태그", icon: "📋", detail: content.middle },
        content?.small && { label: "상세 조건", icon: "📌", detail: content.small },
    ].filter(Boolean);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5", flexShrink: 0 }}>
                <button
                    onClick={onBack}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: WOORI_NAVY, padding: 0 }}
                >
                    ←
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                <div
                    style={{
                        background: "linear-gradient(135deg, #042C53, #1A6FBF)",
                        borderRadius: 18, padding: "20px",
                        display: "flex", gap: 16, alignItems: "center", marginBottom: 20,
                    }}
                >
                    <div style={{ width: 52, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                        {product_img_url ? (
                            <img src={product_img_url} alt={product_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                            <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 24 }}>💳</span>
                            </div>
                        )}
                    </div>
                    <div>
                        <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{product_company}</p>
                        <p style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "#fff" }}>{product_name}</p>
                        {content?.header && (
                            <p style={{ margin: "0 0 8px", fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{content.header}</p>
                        )}
                        {content?.url && (
                            <a
                            href={content?.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                            display: "inline-block", marginTop: 4,
                            background: WOORI_GREEN, border: "none", borderRadius: 8,
                            color: "#fff", fontSize: 13, fontWeight: 700,
                            padding: "8px 20px", cursor: "pointer", textDecoration: "none",
                        }}
                            >
                            신청
                            </a>
                            )}
                    </div>
                </div>

                <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: WOORI_NAVY }}>상품 상세</h3>
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
                            <div style={{ padding: "10px 16px 14px", fontSize: 13, color: "#4A5F75", lineHeight: 1.7, borderTop: "1px solid #EEF1F5" }}>{s.detail}</div>
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
    const [query, setQuery] = useState("");
    const [isSearched, setIsSearched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [activePage, setActivePage] = useState("search");

    const [suggestedQuestions, setSuggestedQuestions] = useState([]);
    const [questionsLoading, setQuestionsLoading] = useState(true);
    // localStorage에서 최근 질문 불러오기 (없으면 빈 배열)
    const [recentQuestions, setRecentQuestions] = useState(
        () => JSON.parse(localStorage.getItem("recentQuestions") || "[]")
    );
    const [aiText, setAiText] = useState("");
    const [products, setProducts] = useState([]);
    const [activeTab, setActiveTab] = useState("card");
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        const userId = getUserId();
        fetch(`${FASTAPI_BASE}/report/recommend-questions?user_id=${userId}`, { signal: controller.signal })
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

    const handleSearch = async (q) => {
        const searchQuery = q || query;
        if (!searchQuery.trim()) return;
        setQuery(searchQuery);
        setIsLoading(true);
        setError(null);
        setAiText("");

        // 최근 질문 localStorage 저장 (중복 제거 + 최대 5개)
        const updated = [searchQuery, ...recentQuestions.filter((r) => r !== searchQuery)].slice(0, 5);
        setRecentQuestions(updated);
        localStorage.setItem("recentQuestions", JSON.stringify(updated));

        try {
            const data = await api.search(searchQuery);
            setAiText(data.AI_text || data.ai_text || "");
            const fetched = data.products || [];
            setProducts(fetched);
            setIsSearched(true);
            const firstTab = ["card", "savings", "insurance"].find(t => fetched.some(p => p.product_type === t)) || "card";
            setActiveTab(firstTab);
        } catch (e) {
            setError("검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (activePage === "detail") {
            setActivePage("search");
        } else if (isSearched) {
            setIsSearched(false);
            setQuery("");
            setProducts([]);
            setAiText("");
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
        return <DetailPage item={selectedItem} onBack={() => setActivePage("search")} />;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F4F7FB", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>

            {/* Header */}
            <div style={{ padding: "16px 20px 0", background: "#fff", borderBottom: "1px solid #EEF1F5", flexShrink: 0 }}>
                <button
                    onClick={handleBack}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: WOORI_NAVY, padding: "0 0 8px 0", display: "block" }}
                >
                    ←
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
                                onClick={() => setActiveTab(key)}
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
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
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
                                    onClick={(it) => { setSelectedItem(it); setActivePage("detail"); }}
                                />
                            ))
                        ) : (
                            <div style={{ textAlign: "center", padding: "40px 0", color: "#8494A8", fontSize: 14 }}>
                                <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                                이 카테고리에 결과가 없어요<br />
                                <span style={{ fontSize: 12 }}>다른 탭을 확인해보세요</span>
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
                                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: WOORI_NAVY }}>최근 질문</p>
                                {recentQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSearch(q)}
                                        style={{ width: "100%", background: "#fff", border: "1.5px solid #EEF1F5", borderRadius: 12, padding: "12px 14px", textAlign: "left", fontSize: 13, color: WOORI_NAVY, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
                                    >
                                        <span style={{ fontSize: 14, color: "#8494A8" }}>🕐</span>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* AI 분석 결과 - 하단 고정 */}
            {isSearched && aiText && (
                <div style={{ flexShrink: 0, padding: "12px 16px", background: "#fff", borderTop: "1px solid #EEF1F5" }}>
                    <AIInsightBox text={aiText} />
                </div>
            )}
        </div>
    );
}