# So-Bee 통합 프로젝트

`diary`와 `report_product` 두 레포지토리를 하나의 모노레포로 통합한 결과물입니다.

## 구조

```
project/
├── frontend/          ← React SPA (Vite + TailwindCSS)
├── backend/
│   ├── spring/        ← Spring Boot (diary 레포 기반)
│   └── fastapi/       ← FastAPI (report_product 기반 + diary VLM 병합)
├── docker-compose.yml ← 로컬 전체 스택 실행
└── .env.example       ← 환경변수 템플릿
```

## 로컬 실행

### 1. 환경변수 설정

```bash
cp .env.example .env
# .env 파일을 열어 실제 값으로 채워주세요
```

### 2. 전체 스택 실행

```bash
docker-compose up --build
```

| 서비스 | URL |
|---|---|
| 프론트엔드 | http://localhost:3000 |
| Spring Boot | http://localhost:8080 |
| FastAPI | http://localhost:8000 |

### 3. 개발 모드 (핫 리로드)

```bash
# 프론트엔드
cd frontend && npm install && npm run dev

# Spring Boot
cd backend/spring && ./gradlew bootRun

# FastAPI
cd backend/fastapi && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## 기술 스택

- **Frontend**: React 19, Vite, TailwindCSS v4, React Router v7, Recharts, jwt-decode
- **Backend (Spring Boot)**: Java 17, Spring Boot 3, Spring Security, JPA, MySQL, JWT
- **Backend (FastAPI)**: Python 3.12, FastAPI, aiomysql, OpenAI, LightGBM, scikit-learn

## 주요 기능

| 기능 | 경로 | 출처 |
|---|---|---|
| 로그인 / 회원가입 | `/login`, `/register` | diary |
| 홈 (페르소나 + 피드) | `/home` | 통합 |
| 소비 리포트 | `/report` | report_product |
| 피드 | `/feed` | diary |
| 카메라 소비 기록 | `/camera` | diary |
| 소비 로그 | `/consumption-log` | diary |
| 금융상품 검색 | `/search` | report_product |

## AWS 인프라

- **RDS**: 두 레포가 공유하는 MySQL (단일 인스턴스 유지)
- **S3**: 사진 업로드 (`sobee-prd-s3-media`)
- **CloudFront**: 프론트엔드 배포
- **ALB**: Spring Boot 로드 밸런서
- **ECS**: Spring Boot / FastAPI 컨테이너 실행
# project
