from fastapi import APIRouter, Query
from app.services.report_service import get_transaction_report
from app.services.ai_insight_service import get_ai_insight
from app.services.lifecycle_service import get_lifecycle
from app.services.question_service import generate_recommend_questions
from app.models.schemas import AiInsightResponse

router = APIRouter()


@router.get("/report/mydata/transaction")
def get_transaction(
    user_id: int = Query(...),
    year:    int = Query(None),
    month:   int = Query(None),
):
    return get_transaction_report(user_id, year, month)


@router.get("/report/ai-insight", response_model=AiInsightResponse)
async def ai_insight(
    user_id: int = Query(...),
    year:    int = Query(None),
    month:   int = Query(None),
):
    # ✅ report_service에서 해당 월 트랜잭션 집계
    tx_data = get_transaction_report(user_id, year, month)

    # ✅ 집계된 category_price만 넘겨줌 — ai_insight_service는 DB 재조회 안 함
    return await get_ai_insight(user_id, tx_data.get("category_price", {}))


@router.get("/report/recommend-questions")
async def recommend_questions(user_id: int = Query(...)):
    tx_data = get_transaction_report(user_id)
    category_price = tx_data.get("category_price", {})

    lifecycle_resp = await get_lifecycle(user_id)
    lifecycle_label = lifecycle_resp.life_stage_code

    questions = await generate_recommend_questions(category_price, lifecycle_label)
    return {"questions": questions}
