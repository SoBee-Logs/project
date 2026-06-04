from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Sobee FastAPI"

    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "sobee"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-northeast-2"
    S3_BUCKET_NAME: str = "sobee-prd-s3-media"

    csv_path: str = ""
    model_path: str = "ml/model.pkl"

    FASTAPI_BASE_URL: str = "http://localhost:8000"
    INTERNAL_SECRET_KEY: str = ""

    CODEF_CLIENT_ID: str = ""
    CODEF_CLIENT_SECRET: str = ""
    CODEF_PUBLIC_KEY: str = ""
    CODEF_BASE_URL: str = "https://development.codef.io"  # prod: https://api.codef.io

    def get_codef_accounts(self) -> list[dict]:
        """
        .env의 CODEF_ACCOUNT_N 파싱.
        형식: user_id,business_type,org_code,login_id,login_pw
        예시: CODEF_ACCOUNT_1=1,BK,0020,myid,mypw
        """
        import os
        accounts = []
        for i in range(1, 100):
            raw = os.environ.get(f"CODEF_ACCOUNT_{i}")
            if not raw:
                break
            parts = [p.strip() for p in raw.split(",")]
            if len(parts) != 5:
                continue
            user_id, business_type, org_code, login_id, login_pw = parts
            accounts.append({
                "user_id": int(user_id),
                "business_type": business_type,
                "org_code": org_code,
                "login_id": login_id,
                "login_pw": login_pw,
            })
        return accounts

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()