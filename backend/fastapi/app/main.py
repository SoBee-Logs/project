from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from app.api import avatar, recommend, lifecycle, report, internal, category_mapping, vlm, diary_generate, admin
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def internal_auth_middleware(request: Request, call_next):
    if request.url.path.startswith("/internal/"):
        token = request.headers.get("X-Internal-Secret")
        if not token or token != settings.INTERNAL_SECRET_KEY:
            return JSONResponse(status_code=403, content={"detail": "접근 불가"})
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


@app.get("/health")
def health_check():
    return {"status": "ok"}