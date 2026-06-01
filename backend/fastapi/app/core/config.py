import json
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Sobee FastAPI"

    OPENAI_API_KEY: str = ""
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

    # 팀원 로컬 테스트용 계정 정보 (ENV 모드)
    # loginId/loginPw는 connected_id 최초 발급 시에만 사용되며 어디에도 저장되지 않음
    # 같은 loginId끼리는 하나의 connected_id로 묶임 (CODEF 스펙: connected_id 1 : 기관 N)
    # 예: [{"organization":"0301","loginId":"myid","loginPw":"mypw","cardName":"신한카드"}]
    CODEF_CARD_ACCOUNTS: str = "[]"

    # 예: [{"organization":"0020","loginId":"myid","loginPw":"mypw","account":"1234567890","bankName":"우리은행"}]
    CODEF_BANK_ACCOUNTS: str = "[]"

    def get_codef_card_accounts(self) -> list[dict]:
        """CODEF_CARD_ACCOUNTS JSON 파싱. 실패 시 명확한 에러 발생."""
        try:
            result = json.loads(self.CODEF_CARD_ACCOUNTS)
            if not isinstance(result, list):
                raise ValueError("JSON 배열이어야 합니다.")
            return result
        except json.JSONDecodeError as e:
            raise ValueError(f"CODEF_CARD_ACCOUNTS JSON 파싱 실패: {e}") from e

    def get_codef_bank_accounts(self) -> list[dict]:
        """CODEF_BANK_ACCOUNTS JSON 파싱. 실패 시 명확한 에러 발생."""
        try:
            result = json.loads(self.CODEF_BANK_ACCOUNTS)
            if not isinstance(result, list):
                raise ValueError("JSON 배열이어야 합니다.")
            return result
        except json.JSONDecodeError as e:
            raise ValueError(f"CODEF_BANK_ACCOUNTS JSON 파싱 실패: {e}") from e

    def get_codef_accounts(self) -> list[dict]:
        """하위 호환용 — CODEF_ACCOUNT_N 낱개 변수 파싱 (레거시)."""
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