# Sobee FastAPI - B조 서버

> B조 AI 기능 전용 FastAPI 서버입니다.
> 아바타 생성, 금융상품 추천, 생애주기 예측 기능을 담당합니다.

---

## 📁 폴더 구조

```
sobee_fastapi/
├── app/
│   ├── main.py              # FastAPI 앱 진입점, 라우터 등록
│   ├── api/                 # 라우터 (엔드포인트 정의)
│   │   ├── avatar.py        # 아바타 생성 API
│   │   ├── recommend.py     # 금융상품 추천 API
│   │   └── lifecycle.py     # 생애주기 예측 API
│   ├── services/            # 비즈니스 로직
│   │   ├── avatar_service.py
│   │   ├── recommend_service.py
│   │   └── lifecycle_service.py
│   ├── models/
│   │   └── schemas.py       # Pydantic 요청/응답 모델
│   └── core/
│       └── config.py        # 환경변수 설정
├── ml/
│   └── lifecycle_model.py   # KNN 생애주기 모델 학습/추론
├── .env                     # 환경변수 (Git 업로드 금지)
├── .gitignore
├── requirements.txt
└── Dockerfile
```

---

## 🔁 요청 흐름

```
클라이언트 요청
    ↓
app/main.py         # 라우터 등록 및 앱 설정
    ↓
app/api/*.py        # 엔드포인트 정의, 요청/응답 형식 지정
    ↓
app/services/*.py   # 실제 비즈니스 로직 처리 (LLM 호출, ML 추론 등)
    ↓
응답 반환
```

---

## 📌 담당 기능 및 API

### 1. 아바타 생성 (`/api/avatar`) - 소영
- 사용자 결제 데이터를 기반으로 LLM 프롬프트를 활용해 소비 페르소나 아바타 생성
- 요청: `user_id`, `transaction_summary`
- 응답: `avatar_title`, `avatar_description`

### 2. 금융상품 추천 (`/api/recommend`) - 석빈
- 사용자 소비 패턴과 생애주기를 기반으로 예적금/미니보험 추천
- 임베딩 기반 문맥 검색(Contextual Search) 활용
- 요청: `user_id`, `query`, `lifecycle_stage`
- 응답: `product_id`, `product_name`, `reason`

### 3. 생애주기 예측 (`/api/lifecycle`) - 하은
- 우리카드 900만건 데이터로 학습한 KNN 모델로 사용자 생애주기 예측
- 예측 결과는 리포트 및 금융상품 추천에 활용
- 요청: `user_id`, `age`, `monthly_spend`, `top_category`
- 응답: `lifecycle_stage`, `description`

---

## ⚙️ 역할 분리 (Spring Boot vs FastAPI)

| 역할 | Spring Boot | FastAPI |
|------|------------|---------|
| DB CRUD | ✅ | ❌ |
| 인증/인가 | ✅ | ❌ |
| 비즈니스 로직 | ✅ | ❌ |
| LLM 호출 | ❌ | ✅ |
| ML 추론 | ❌ | ✅ |
| 임베딩 검색 | ❌ | ✅ |

---

## 🚀 로컬 실행 방법

**1. 가상환경 생성 및 활성화**
```bash
python -m venv .venv
source .venv/bin/activate
```

**2. 패키지 설치**
```bash
pip install -r requirements.txt
```

**3. 환경변수 설정**
```bash
# .env 파일에 아래 내용 입력
APP_NAME=Sobee FastAPI
OPENAI_API_KEY=your_api_key
MYSQL_URL=your_mysql_url
```

**4. 서버 실행**
```bash
uvicorn app.main:app --reload
```

**5. 동작 확인**
- 헬스체크: `http://localhost:8000/health`
- API 문서: `http://localhost:8000/docs`

---

## 📝 개발 규칙

- 새 기능 추가 시 `api/` → `services/` → `schemas.py` 순서로 작성
- 엔드포인트는 담당자 파일에만 추가할 것
- LLM API 키, DB URL 등 민감 정보는 반드시 `.env`에 보관 (코드에 직접 작성 금지)
- 타 담당자 파일 수정 시 반드시 사전 공유할 것
- `main` 브랜치 직접 push 금지, PR 필수

---

문의사항은 총팀장(소영)에게 연락주세요 🙌