# Merge Plan — diary + report_product → project

## 1. 분석 요약: 발견된 중복·충돌 항목

### 프론트엔드

| 항목 | diary | report_product | 충돌 여부 |
|---|---|---|---|
| 앱 이름 | sobee-log | sobee-log | ✅ 동일 |
| 빌드 도구 | Vite + TailwindCSS v4 | Vite + TailwindCSS v4 | ✅ 동일 |
| 라우터 | react-router-dom v7 | react-router-dom v7 | ✅ 동일 |
| 차트 | ❌ 없음 | recharts | 🔄 병합 필요 |
| JWT | jwt-decode, axios | ❌ 없음 | 🔄 병합 필요 |
| 홈 경로 | `/home` | `/` (루트) | ⚠️ 충돌 |
| 인증 여부 | JWT 로그인 있음 | 인증 없음 (USER_ID=1 하드코딩) | ⚠️ 충돌 |
| Home.jsx | 실제 API + MyData 팝업 | 페르소나 이미지 + 검색바 | ⚠️ 구조 다름 |
| Report.jsx | 기본 버전 | 풍부한 recharts 시각화 | 🔄 report 채택 |
| AppBar.jsx | 동일 | 동일 | ✅ 동일 |
| BottomNav.jsx | 3탭 (리포트/홈/피드) | 3탭 (리포트/홈/피드) | ✅ 거의 동일 |
| StatusBar.jsx | 동일 | 동일 | ✅ 동일 |
| RoomTabs.jsx | diary 전용 | ❌ 없음 | diary 이식 |
| Login/Register | 있음 | ❌ 없음 | diary 이식 |
| ProductSearch | ❌ 없음 | 있음 | report 이식 |
| ProductDetail | ❌ 없음 | 있음 | report 이식 |

### 백엔드

| 항목 | diary | report_product | 결정 |
|---|---|---|---|
| Spring Boot | 있음 (도메인: user, group, b_log, diary, report, product) | ❌ 없음 | diary 그대로 이식 |
| FastAPI | 간단 (vlm, diary 2개 라우터) | 완성형 (avatar, recommend, lifecycle, report, internal, category, 등) | report 기반 + diary 라우터 병합 |
| DB | MySQL (RDS 공유) | MySQL (동일 RDS) | ✅ 동일 |
| JWT secret | 하드코딩 문자열 | ❌ (FastAPI는 JWT 미사용) | 환경변수로 이전 |

---

## 2. 통합 결정 내역

| 항목 | 채택 | 이유 |
|---|---|---|
| **Frontend 기반** | diary | axios, jwt-decode, react-calendar 의존성 포함; 인증 흐름 완성 |
| **recharts 추가** | report_product | Report 페이지 차트 라이브러리 |
| **홈 경로** | `/home` (diary 방식) | 인증 후 리다이렉트 흐름과 일치; `/`는 login redirect로 사용 |
| **Home.jsx** | 통합 작성 | report의 페르소나 섹션(위) + diary의 카메라/피드 섹션(아래) 조합 |
| **Report.jsx** | report_product | recharts 기반 풍부한 시각화 (생애주기, 카테고리 도넛, 주별 바차트, 시간대 에리어차트) |
| **BottomNav** | 통합 (4탭) | 기존 3탭에 `검색(/search)` 탭 추가 |
| **Feed.jsx** | diary | 실제 API 연동 (groupId 기반 일기 목록 조회, 좋아요) |
| **FastAPI** | report_product 기반 | ML(LightGBM), Airflow 연동, 완성된 라우터 구조; diary의 vlm, diary_generate 라우터 추가 이식 |
| **Spring Boot** | diary | 유일한 Spring Boot; User/Auth/Group/Diary/Photo 전 도메인 포함 |
| **JWT secret** | 환경변수(`${JWT_SECRET}`)로 변경 | 하드코딩된 secret을 application.yml에서 제거 |
| **SecurityConfig CORS** | 환경변수(`${CORS_ALLOWED_ORIGINS}`)로 변경 | 배포 시 도메인 유연하게 설정 가능 |

---

## 3. 미완료 작업 목록 (수동 확인 필요)

### 프론트엔드

- [ ] **CameraPage.jsx의 API 엔드포인트 확인**: `/api/vlm/analyze`가 FastAPI로 프록시되는지 로컬 테스트 필요
- [ ] **ConsumptionLog.jsx의 `react-calendar` CSS 경로**: `import 'react-calendar/dist/Calendar.css'` — Vite 빌드 환경에서 정상 동작 확인 필요
- [ ] **DiaryResult.jsx의 ROOMS 데이터**: 현재 static mock이며, 실제 API에서 그룹 목록을 받아오도록 업데이트 권장
- [ ] **report_product Home.jsx의 `roomFeedPreviews` mock 데이터**: 프로덕션에서 실제 API로 교체 (현재 `common/utils/mockDiaries.js` 의존)
- [ ] **ProductDetail.jsx**: `useLocation` state로 item 수신 — ProductSearch에서 navigate 시 state 전달 정상 작동 확인 필요
- [ ] **MyDataConnect.jsx**: diary 레포에서 이식됐으나 현재 App.jsx 라우터에 `/mydata` 경로 미등록 — 필요 시 추가
- [ ] **basicSsl 플러그인**: 와이파이 환경 모바일 테스트용이므로 프로덕션 Dockerfile에서 제거됨. 개발 시에만 동작

### 백엔드

- [ ] **Spring Boot `application.yaml.example`**: 기존 파일이 `application.yaml.example`로 남아있음. 실제 운영은 `application.yml`을 사용하므로 혼동 없도록 정리 권장
- [ ] **Spring Boot 도메인 패키지 정리**: `domain/b_log`와 `domain/diary`가 중복으로 보임 — 원본 레포 히스토리 확인 후 정리 권장
- [ ] **FastAPI `.env` 파일**: `backend/fastapi/.env`에 실제 환경변수가 들어있을 수 있음. 커밋 전 반드시 `.gitignore` 확인
- [ ] **diary FastAPI의 `app/models/__init__.py` 부재**: report_product 구조에서 `app/models/`는 있지만 diary의 `app/schemas/` 구조와 다름 — `diary_generate.py`는 이미 `app/models/schemas`로 경로 수정 완료
- [ ] **Spring Boot `build.gradle`**: `cors.allowed-origins` 환경변수가 `application.yml`에 추가됐으나 실제 배포 환경변수 키(`CORS_ALLOWED_ORIGINS`)를 Spring의 `${cors.allowed-origins}` 매핑과 맞춰야 함 → `--spring.web.cors.allowed-origins` 방식으로 전달하거나 Spring 환경변수 이름 규칙(`CORS_ALLOWED_ORIGINS` → `cors.allowed-origins`) 동작 확인 필요
- [ ] **Airflow / Elasticsearch**: `report_product`의 Airflow DAG와 Elasticsearch Dockerfile은 `project/` 구조에 미포함. 필요 시 `project/infra/` 등으로 별도 이식 권장

### 공통

- [ ] **user_id localStorage 저장**: 로그인 시 JWT 디코딩 후 `user_id` 저장 로직 추가 완료. 단, 기존 사용자 세션에 `user_id`가 없을 경우 fallback (`|| 1`)이 적용됨 — 프로덕션에서는 재로그인 유도 필요

---

## 4. 로컬 실행 방법

### 전체 스택 한 번에 실행

```bash
# 1. 환경변수 파일 준비
cp .env.example .env
# .env 파일에 DB 접속 정보, API KEY 등 실제 값 입력

# 2. 전체 스택 빌드 및 실행
docker-compose up --build
```

| 서비스 | URL |
|---|---|
| 프론트엔드 | http://localhost:3000 |
| Spring Boot | http://localhost:8080 |
| FastAPI (Docs) | http://localhost:8000/docs |

### 개발 모드 (핫 리로드)

```bash
# 프론트엔드 (포트 5173, HTTPS 자체서명 인증서)
cd frontend && npm install && npm run dev

# Spring Boot (포트 8080)
cd backend/spring && ./gradlew bootRun -Dspring.profiles.active=local

# FastAPI (포트 8000)
cd backend/fastapi && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
```

> **Note**: 개발 모드에서는 `frontend/vite.config.js`의 proxy 설정이 `/api` → Spring Boot(8080), `/api/vlm` → FastAPI(8000), `/report` `/search` → FastAPI(8000)으로 각각 분기합니다.
