# 🔍 SoBee 검색 기능 완전 해설서

> **목표:** 초등학생도 이해할 수 있게, 코드의 모든 역할을 단계별로 설명합니다.

---

## 📌 한 줄 요약

> 사용자가 말하듯 검색어를 입력하면, **AI가 의도를 파악**하고 **검색엔진이 상품을 찾아서** 카드·예적금·보험으로 나눠 보여줍니다.

---

## 🗂 관련 파일 목록

| 역할 | 파일 경로 |
|---|---|
| 화면 (검색 UI) | `frontend/src/features/search/ProductSearch.jsx` |
| 검색 요청 처리 (Spring) | `backend/spring/…/service/SearchService.java` |
| Elasticsearch 검색 | `backend/spring/…/service/ProductSearchService.java` |
| AI 파싱 (FastAPI) | `backend/fastapi/app/services/search_parse_service.py` |
| 검색 API 엔드포인트 | `backend/spring/…/controller/SearchController.java` |
| Elasticsearch 설정 | `elasticsearch/Dockerfile` |

---

## 🧩 구성 요소 소개 (각 파트가 뭘 하는지)

### 1️⃣ 프론트엔드 — `ProductSearch.jsx`
사용자가 실제로 보는 화면입니다.

### 2️⃣ Spring Boot — `SearchService.java` + `ProductSearchService.java`
검색의 두뇌입니다. AI 파싱과 Elasticsearch 검색을 **동시에** 실행합니다.

### 3️⃣ FastAPI — `search_parse_service.py`
Google Gemini AI를 이용해 "검색어가 뭘 원하는지" 분석합니다.

### 4️⃣ Elasticsearch
상품 데이터가 저장된 빠른 검색 전용 데이터베이스입니다.

---

## 🚶 단계별 흐름 완전 해설

### STEP 1 — 화면에서 검색어 입력

파일: `frontend/src/features/search/ProductSearch.jsx` (641번 줄)

```js
const handleSearch = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    ...
}
```

- 사용자가 **"카페 혜택 카드 추천해줘"** 라고 입력하고 Enter를 누릅니다.
- 빈 칸이면 아무 것도 하지 않습니다 (`trim()` 체크).
- 이전 검색이 진행 중이면 **취소**하고 새 검색을 시작합니다 (`AbortController`).

---

### STEP 2 — 최근 질문 저장

파일: `frontend/src/features/search/ProductSearch.jsx` (658번 줄)

```js
const updated = [searchQuery, ...recentQuestions.filter((r) => r !== searchQuery)].slice(0, 5);
localStorage.setItem(recentQuestionsKey, JSON.stringify(updated));
```

- 검색어를 **브라우저 저장소(localStorage)** 에 저장합니다.
- 같은 질문이 이미 있으면 제거하고 맨 앞에 추가합니다 (중복 제거).
- 최대 **5개**까지만 저장합니다.
- 저장 키는 `recentQuestions_사용자ID` 형태라서 **사람마다 따로** 저장됩니다.

---

### STEP 3 — Spring 서버에 요청 전송

파일: `frontend/src/features/search/ProductSearch.jsx` (19번 줄)

```js
const api = {
    search: (searchInput, signal) =>
        fetch(`${BASE_URL}/api/search`, {
            method: "POST",
            body: JSON.stringify({
                search_input: searchInput,
                user_id: getUserId(),
            }),
        })
}
```

- `POST /api/search` 로 검색어와 사용자 ID를 보냅니다.
- JWT 토큰을 헤더에 담아 **로그인 인증**도 함께 합니다.
- `signal`은 "취소 신호"입니다. 검색 도중 새 검색을 시작하면 이전 HTTP 요청이 자동 취소됩니다.

---

### STEP 4 — Spring이 두 가지를 **동시에** 실행

파일: `backend/spring/…/service/SearchService.java` (101번 줄)

```java
CompletableFuture<ParsedSearchDto> parseFuture = CompletableFuture
        .supplyAsync(() -> callParseSearch(keyword));  // AI 파싱

CompletableFuture<SearchResultDto> searchFuture = CompletableFuture
        .supplyAsync(() -> productSearchService.search(keyword));  // ES 검색

CompletableFuture.allOf(parseFuture, searchFuture).join();  // 둘 다 끝날 때까지 대기
```

- **순서대로 하면 느리니까** 두 작업을 동시에 시작합니다.
- `CompletableFuture` = "이 작업을 백그라운드에서 실행해줘" 라는 명령어입니다.
- 두 작업이 모두 완료되면 결과를 합칩니다.

---

### STEP 5 — FastAPI에서 AI가 검색어를 분석 (파싱)

파일: `backend/fastapi/app/services/search_parse_service.py` (78번 줄)

**"카페 혜택 카드 추천해줘"** 를 Gemini AI에게 보내면:

```json
{
  "product_types": ["card"],
  "company": null,
  "category": "카페",
  "keywords": ["카페", "혜택"],
  "ai_text": "카페 할인 카드를 찾고 계시는군요! 카페 혜택이 강한 카드들을 모아봤어요. 자주 갈수록 절약 효과가 커요. 연회비와 비교해 골라보세요."
}
```

| 항목 | 설명 |
|---|---|
| `product_types` | 카드/예적금/보험 중 어떤 걸 찾는지. "적금"이라고 하면 `["savings"]` |
| `company` | 금융기관 이름. "신한카드 추천"이면 `"신한"`. 스타벅스같은 가맹점은 `null` |
| `category` | 혜택 카테고리. 카페·교통·주유·쇼핑 등 15가지 중 하나 |
| `keywords` | 핵심 단어 1~3개 |
| `ai_text` | 화면 하단에 보여줄 AI 안내 문구 |

**고유명사 사전 처리** (9번 줄): AI 호출 전에 "스타벅스 → 카페", "배달의민족 → 음식점" 같은 변환을 미리 해둡니다. AI가 틀릴 수도 있으니 정확도를 높이기 위한 안전장치입니다.

---

### STEP 6 — Elasticsearch로 상품 텍스트 검색

파일: `backend/spring/…/service/ProductSearchService.java` (96번 줄)

```java
NativeQuery query = NativeQuery.builder()
    .withQuery(q -> q.multiMatch(m -> m
        .query(keyword)
        .fields("cardName^3", "corpName^3", "cateNames^2", "topBenefitTitles^2")
        .fuzziness("AUTO")
    ))
    .withPageable(PageRequest.of(0, 30))
    .build();
```

- **`^3`, `^2`**: 중요도 가중치입니다. 카드 이름(`cardName`)이 일치하면 점수를 3배 높게 줍니다.
- **`fuzziness("AUTO")`**: 오타를 자동으로 보정합니다. "스타박스"라고 쳐도 "스타벅스"를 찾아줍니다.
- 카드 30개, 예적금 20개, 보험 20개를 각각 검색합니다.
- **Nori 플러그인** (`elasticsearch/Dockerfile` 2번 줄): 한국어 형태소 분석기입니다. "카페혜택좋은카드" 같은 붙여쓰기도 "카페/혜택/좋은/카드"로 쪼개서 검색합니다.

**예적금 정렬**: 금리 높은 순서로 정렬합니다 (237번 줄).

---

### STEP 7 — AI 카테고리 결과를 텍스트 검색 결과와 합치기

파일: `backend/spring/…/service/SearchService.java` (116번 줄)

AI가 `category: "카페"` 를 반환하면, DB의 실제 카테고리 이름으로 변환합니다:

```java
// "카페" → ["카페", "카페/디저트", "베이커리"]
Map.entry("카페", List.of("카페", "카페/디저트", "베이커리"))
```

그 다음 카드를 **3가지 그룹**으로 나눠서 정렬합니다:

| 순위 | 그룹 | 설명 |
|---|---|---|
| 1순위 | 텍스트 + 카테고리 모두 매칭 | 검색어에도 있고 카페 혜택도 있는 카드 |
| 2순위 | 카테고리만 매칭 | 카페 혜택은 있지만 텍스트 검색에 없던 카드 |
| 3순위 | 텍스트만 매칭 | 텍스트는 걸렸지만 카페 혜택 없는 카드 |

---

### STEP 8 — 회사명 필터 적용

파일: `backend/spring/…/service/SearchService.java` (188번 줄)

"신한카드 추천해줘"처럼 **금융기관 이름**을 말하면 그 회사 상품만 남깁니다.

```java
// 허용된 금융기관 목록
List.of("신한", "삼성", "롯데", "현대", "KB", "우리", "하나", "NH", ...)
```

"스타벅스"처럼 가맹점 이름은 필터에 걸리지 않습니다. (AI가 `company: null` 로 반환하기 때문)

---

### STEP 9 — 캐시로 같은 검색 반복 방지

파일: `backend/spring/…/service/SearchService.java` (96번 줄)

```java
@Cacheable(value = "searchCache", key = "#request.search_input.trim().toLowerCase()")
```

- **한 번 검색한 결과는 저장**해 둡니다.
- 같은 검색어가 다시 오면 AI 호출 없이 저장된 결과를 즉시 반환합니다.
- 대소문자 구분 없이 캐시 키를 만듭니다 (`toLowerCase()`).

프론트엔드에도 별도 캐시가 있습니다 (13번 줄):

```js
let _searchStateCache = null;
// 같은 쿼리의 캐시가 있으면 복원 (재검색 방지)
```

---

### STEP 10 — 화면에 결과 표시

파일: `frontend/src/features/search/ProductSearch.jsx` (663번 줄)

```js
const data = await api.search(searchQuery, controller.signal);
setAiText(data.AI_text || data.ai_text || "");
setProducts(data.products || []);
setMatchedCateNames(data.matched_cate_names || []);
```

- **탭 3개** (💳 카드, 🏦 예적금, 🛡️ 보험)로 나눠서 보여줍니다.
- **단종된 상품**은 뿌옇게 처리하고 클릭이 안 됩니다 (201번 줄).
- **카테고리 매칭 태그**는 파란색으로 강조됩니다 (271번 줄).
- **AI 분석 결과 박스**는 화면 하단에 고정됩니다 (946번 줄).
- 로딩 중에는 **스켈레톤 카드** (빛나는 회색 박스)가 4개 나타납니다 (125번 줄).

---

## 🖼 화면 구성 요소 설명

### 검색 전 화면

| 요소 | 설명 |
|---|---|
| 추천 질문 | `/api/report/recommend-questions` 에서 받아옵니다. 실패하면 하드코딩된 5개 질문이 표시됩니다 |
| 최근 질문 | localStorage에서 불러옵니다. × 버튼으로 각각 삭제, "전체 삭제" 버튼도 있습니다 |

### 검색 후 화면

| 요소 | 설명 |
|---|---|
| 탭 바 | 각 탭에 결과 개수 표시. 결과 없는 탭은 `0` |
| 상품 카드 | 카드(세로 이미지), 예적금·보험(회사 로고) 표시 방식이 다름 |
| AI 분석 박스 | 하단 고정 오버레이. 스크롤해도 항상 보임 |

---

## 🏢 회사 로고 표시 방법

파일: `frontend/src/features/search/ProductSearch.jsx` (99번 줄)

로고를 찾는 순서:

1. **apple-touch-icon** (각 회사 홈페이지의 고화질 아이콘 180×180px)
2. **백엔드에서 받은 이미지 URL**
3. **Google faviconV2** (구글이 수집한 파비콘)
4. 모두 실패하면 **SoBee 벌 이미지**로 대체

---

## ⚠️ 에러 처리

| 상황 | 동작 |
|---|---|
| 검색 API 실패 | "검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." + "다시 시도" 버튼 표시 |
| 탭에 결과 없음 | "이 카테고리에 결과가 없어요. 다른 탭을 확인해보세요" + 추천 질문 표시 |
| AI 파싱 실패 | AI 없이 ES 검색 결과만 사용 (graceful degradation) |
| 로고 이미지 실패 | 순서대로 다음 URL 시도, 모두 실패 시 벌 이미지 |
| 로그인 안 됨 | `/login` 페이지로 리다이렉트 |

---

## 🔄 뒤로가기 3단계

파일: `frontend/src/features/search/ProductSearch.jsx` (696번 줄)

```
상품 상세 → 검색 결과 → 검색 전 화면 → /home
```

상품 상세 페이지의 선택된 상품은 `sessionStorage`에 저장해서, 뒤로갔다가 다시 와도 유지됩니다.

---

## 💡 핵심 기술 정리

| 기술 | 왜 사용하나요? |
|---|---|
| **Elasticsearch + Nori** | 한국어 형태소 분석 + 빠른 풀텍스트 검색 |
| **Gemini AI** | 자연어 의도 파악 (단순 키워드 검색의 한계 극복) |
| **CompletableFuture** | AI 파싱과 ES 검색을 동시에 실행해서 응답 속도 향상 |
| **@Cacheable** | 동일 검색어 반복 시 AI 비용·시간 절약 |
| **AbortController** | 검색 도중 새 검색 시작 시 이전 HTTP 요청 취소 |
| **fuzziness AUTO** | 오타 허용 (1~2글자 틀려도 검색됨) |
