from app.models.schemas import LifecycleRequest, LifecycleResponse
from ml.lifecycle_model import lifecycle_model
from sqlalchemy import create_engine, text
from app.core.config import settings
import pandas as pd

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


# ─────────────────────────────────────────
# POST /api/lifecycle
# 로그인 시 호출 → 예측 후 users.life_stage_code 저장
# ─────────────────────────────────────────
async def predict_lifecycle(request: LifecycleRequest) -> LifecycleResponse:

    user_id = request.user_id

    # DB에서 트랜잭션 가져오기 (payment_date 추가)
    df_tx = pd.read_sql(text("""
        SELECT payment_category,
               payment_out,
               payment_date
        FROM transactions
        WHERE user_id = :user_id
        AND payment_out > 0
    """), engine, params={"user_id": user_id})

    # DB에서 나이/성별 가져오기
    df_user = pd.read_sql(text("""
        SELECT age, gender
        FROM users
        WHERE user_id = :user_id
    """), engine, params={"user_id": user_id})

    # users 데이터 파싱 (없으면 request 값 사용)
    if not df_user.empty:
        age    = int(df_user['age'].iloc[0])
        gender = 1 if str(df_user['gender'].iloc[0]).lower() == 'm' else 2
    else:
        age    = request.age or 0
        gender = 0

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
        gender=gender
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
    category_summary = df_tx.groupby('payment_category')['payment_out'].sum()
    top3     = category_summary.nlargest(3)
    top3_str = ", ".join([f"{cat}({int(amt):,}원)" for cat, amt in top3.items()])

    # 설명 생성
    description = (
        f"주요 소비가 {top3_str}에 집중되어 있어 "
        f"'{result['lifecycle_label']}' 패턴으로 분류되었습니다. "
        f"(확신도 {result['confidence']*100:.0f}%)"
    )

    return LifecycleResponse(
        life_stage_code=result["lifecycle_label"],
        description=description
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

    # life_stage_code 비어있음 (아직 예측 전)
    if not life_stage_code:
        return LifecycleResponse(
            life_stage_code="생애주기 없음",
            description="아직 생애주기 분석이 완료되지 않았어요."
        )

    # 한글 라벨 변환
    lifecycle_label = LIFECYCLE_KO.get(life_stage_code, life_stage_code)

    return LifecycleResponse(
        life_stage_code=lifecycle_label,
        description=f"'{lifecycle_label}' 패턴으로 분류된 소비 성향을 가지고 있어요."
    )