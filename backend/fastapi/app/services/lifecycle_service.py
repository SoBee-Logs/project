import pickle
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text
from app.models.schemas import LifecycleRequest, LifecycleResponse
try:
    from ml.lifecycle_model import lifecycle_model
    ML_AVAILABLE = True
except Exception:
    lifecycle_model = None
    ML_AVAILABLE = False
from app.core.config import settings
from google import genai
from google.genai import types

_MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "model.pkl"


def _load_model():
    with open(_MODEL_PATH, "rb") as f:
        saved = pickle.load(f)
    lifecycle_model.pipeline   = saved["pipeline"]
    lifecycle_model.le         = saved["label_encoder"]
    lifecycle_model.is_trained = True

engine = create_engine(
    f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
)

LIFECYCLE_KO = {
    'TEEN':       '십대',
    'UNI':        '대학생',
    'NEW_JOB':    '사회초년생',
    'NEW_WED':    '신혼',
    'CHILD_BABY': '자녀영유아',
    'CHILD_TEEN': '자녀의무교육',
    'CHILD_UNI':  '자녀대학생',
    'GOLLIFE':    '중년기타',
    'SECLIFE':    '2nd Life',
    'RETIR':      '은퇴',
}


def _generate_lifecycle_description(lifecycle_label: str, top_categories: list) -> str:
    """Gemini를 사용해 생애주기 설명 1~2문장 생성. 실패 시 fallback 반환."""
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        top_str = ", ".join(top_categories)
        prompt = (
            f"사용자의 주요 소비 카테고리는 {top_str}야. "
            f"금액은 절대 언급하지 말고, 이 소비 패턴을 보고 왜 '{lifecycle_label}'인지 "
            f"1~2문장으로 친근하게 설명해줘. "
            f"마지막은 반드시 '~{lifecycle_label}으로 분석됐어요!' 로 끝내줘. "
            f"예시: '친구들과 돈 주고받을 때 펌뱅킹이나 FB이체를 많이 활용하고, 든든한 한식을 즐겨 먹는 전형적인 소비 패턴이라 대학생으로 분석됐어요!'"
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            ),
        )
        return response.text.strip()
    except Exception:
        top_str = "과 ".join(top_categories[:2]) if top_categories else "일상 소비"
        return f"주요 소비가 {top_str}에 집중되어 있어 '{lifecycle_label}'으로 분석됐어요!"


# ─────────────────────────────────────────
# POST /api/lifecycle
# 로그인 시 호출 → 예측 후 users.life_stage_code 저장
# ─────────────────────────────────────────
async def predict_lifecycle(request: LifecycleRequest) -> LifecycleResponse:
    if not ML_AVAILABLE:
        return LifecycleResponse(
            life_stage_code="생애주기 없음",
            description="ML 모델을 불러올 수 없습니다."
        )
    _load_model()

    user_id = request.user_id

    # DB에서 트랜잭션 가져오기 (payment_date 추가)
    # 나이 조회
    with engine.connect() as conn:
        row = conn.execute(text("SELECT age FROM users WHERE user_id = :uid"), {"uid": user_id}).fetchone()
    age = int(row[0]) if row and row[0] else 0

    df_tx = pd.read_sql(text("""
        SELECT payment_category_id,
               payment_category,
               payment_out,
               payment_date,
               payment_place,
               payment_time
        FROM transactions
        WHERE user_id = :user_id
          AND payment_out > 0
          AND payment_category_id IS NOT NULL
    """), engine, params={"user_id": user_id})

    # 트랜잭션 없으면 fallback
    if df_tx.empty:
        return LifecycleResponse(
            life_stage_code="생애주기가 없습니다",
            description="트랜잭션 데이터가 없습니다."
        )

    # LightGBM 예측
    result = lifecycle_model.predict_from_transactions(
        user_transactions=df_tx.to_dict('records'),
        age=age,
    )

    # 예측 결과 → users.life_stage_code 저장
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE users
            SET life_stage_code = :life_stage_code
            WHERE user_id = :user_id
        """), {
            "life_stage_code": result["lifecycle_code"],
            "user_id":         user_id
        })

    # 카테고리별 지출 TOP 3 분석
    cat_col = 'payment_category' if 'payment_category' in df_tx.columns else 'payment_category_id'
    category_summary = df_tx.groupby(cat_col)['payment_out'].sum()
    top3 = category_summary.nlargest(3)
    top3_names = [str(cat) for cat, _ in top3.items()]

    # Gemini로 자연어 설명 생성
    description = _generate_lifecycle_description(result['lifecycle_label'], top3_names)

    return LifecycleResponse(
        life_stage_code=result["lifecycle_label"],
        description=description,
        confidence=result["confidence"],
    )


# ─────────────────────────────────────────
# GET /api/lifecycle/{user_id}
# 리포트 화면 진입 시 호출 → 저장된 생애주기 조회만
# ─────────────────────────────────────────
async def get_lifecycle(user_id: int) -> LifecycleResponse:

    # users 테이블에서 life_stage_code 조회
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT life_stage_code
            FROM users
            WHERE user_id = :user_id
        """), {"user_id": user_id}).fetchone()

    # 유저 없음
    if row is None:
        return LifecycleResponse(
            life_stage_code="생애주기 없음",
            description="유저 정보를 찾을 수 없어요."
        )

    life_stage_code = row[0]

    # life_stage_code 없음 → 최초 예측 트리거 (ML + Gemini 호출)
    if not life_stage_code:
        try:
            predicted = await predict_lifecycle(LifecycleRequest(user_id=user_id))
            return predicted
        except Exception:
            return LifecycleResponse(
                life_stage_code="생애주기 없음",
                description="아직 생애주기 분석이 완료되지 않았어요."
            )

    # 저장된 값 있으면 바로 반환 (LLM 호출 없음)
    lifecycle_label = LIFECYCLE_KO.get(life_stage_code, life_stage_code)
    return LifecycleResponse(
        life_stage_code=lifecycle_label,
        description=f"'{lifecycle_label}' 패턴으로 분류된 소비 성향을 가지고 있어요."
    )


async def get_lifecycle_peers(user_id: int) -> list:
    """같은 생애주기를 가진 다른 유저 중 아바타가 있는 랜덤 3명 반환."""
    with engine.connect() as conn:
        # 현재 유저의 life_stage_code 조회
        row = conn.execute(text(
            "SELECT life_stage_code FROM users WHERE user_id = :uid"
        ), {"uid": user_id}).fetchone()

        if not row or not row[0]:
            return []

        life_stage_code = row[0]

        # 같은 생애주기 + avatar 테이블에 아바타 있는 다른 유저 랜덤 3명
        rows = conn.execute(text("""
            SELECT a.avatar_name, a.avatar_img_url
            FROM users u
            JOIN avatar a ON u.user_id = a.user_id
            WHERE u.life_stage_code = :code
              AND u.user_id != :uid
              AND a.avatar_img_url IS NOT NULL
              AND a.avatar_img_url != ''
            ORDER BY RAND()
            LIMIT 3
        """), {"code": life_stage_code, "uid": user_id}).fetchall()

    return [
        {"avatar_name": r[0] or "익명", "avatar_img_url": r[1]}
        for r in rows
    ]