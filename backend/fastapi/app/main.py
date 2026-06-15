from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from app.api import avatar, recommend, lifecycle, report, internal, category_mapping, vlm, diary_generate, admin, diary_test
from app.db.connection import close_pool
from app.core.config import settings
from app.api import mapping


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()


app = FastAPI(
    title="Sobee FastAPI",
    version="0.1.0",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
    schema.setdefault("components", {})["securitySchemes"] = {
        "InternalSecret": {"type": "apiKey", "in": "header", "name": "X-Internal-Secret"}
    }
    schema["security"] = [{"InternalSecret": []}]
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi

# 허용할 출처(도메인) 리스트
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",  # 로컬 개발 환경용 (Vite 등)
    "https://sobee-logs.duckdns.org",  # ✅ 프론트엔드의 실제 배포 도메인 추가!
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, OPTIONS 등 모든 메서드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)


@app.middleware("http")
async def internal_auth_middleware(request: Request, call_next):
    if request.url.path.startswith("/internal/"):
        token = request.headers.get("X-Internal-Secret")
        if not token or token != settings.INTERNAL_SECRET_KEY:
            return JSONResponse(
                status_code=403,
                content={"detail": "접근 불가"},
                headers={"Access-Control-Allow-Origin": "*"},
            )
    return await call_next(request)

app.include_router(avatar.router, prefix="/api/avatar", tags=["avatar"])
app.include_router(recommend.router, prefix="/api/recommend", tags=["recommend"])
app.include_router(lifecycle.router, prefix="/api/lifecycle", tags=["lifecycle"])
app.include_router(report.router, prefix="/api/report", tags=["report"])
app.include_router(internal.router)
app.include_router(category_mapping.router, prefix="/api/category", tags=["category-mapping"])
app.include_router(vlm.router, prefix="/api/vlm", tags=["vlm"])
app.include_router(diary_generate.router, prefix="/api/diary", tags=["diary-generate"])
app.include_router(mapping.router, prefix="/api/mapping")
app.include_router(admin.router)
app.include_router(diary_test.router, prefix="/api/diary-test", tags=["Diary Tone Test"])


@app.get("/health")
def health_check():
    return {"status": "ok"}