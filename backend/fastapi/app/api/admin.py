from fastapi import APIRouter
from pydantic import BaseModel
from app.db.connection import get_pool
from app.core.prompt_store import list_prompts, set_prompt, reset_prompt, get_prompt_history, add_prompt_history, get_prompt

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview")
async def overview():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            stats = {}
            queries = {
                "users": "SELECT COUNT(*) FROM users",
                "transactions": "SELECT COUNT(*) FROM transactions",
                "photos": "SELECT COUNT(*) FROM photos",
                "diaries": "SELECT COUNT(*) FROM diary",
                "avatars": "SELECT COUNT(*) FROM avatar",
                "vlm_count": "SELECT COUNT(*) FROM photo_vlm_results",
                "cards": "SELECT COUNT(*) FROM cards",
                "bank_accounts": "SELECT COUNT(*) FROM bank_accounts",
                "card_transactions": "SELECT COUNT(*) FROM card_transactions",
                "bank_transactions": "SELECT COUNT(*) FROM bank_transactions",
            }
            for key, q in queries.items():
                await cur.execute(q)
                stats[key] = (await cur.fetchone())[0]

            await cur.execute("SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()")
            row = await cur.fetchone()
            stats["new_users_today"] = row[0] if row else 0

            await cur.execute("""
                SELECT DATE(created_at) as d, COUNT(*) as cnt
                FROM diary
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY d ORDER BY d
            """)
            stats["diary_trend"] = [{"date": str(r[0]), "count": r[1]} for r in await cur.fetchall()]

            await cur.execute("""
                SELECT DATE(created_at) as d, COUNT(*) as cnt
                FROM users
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY d ORDER BY d
            """)
            stats["user_trend"] = [{"date": str(r[0]), "count": r[1]} for r in await cur.fetchall()]

            stats["vlm_missing"] = max(0, stats["photos"] - stats["vlm_count"])
            stats["vlm_success_rate"] = (
                round(stats["vlm_count"] / stats["photos"] * 100, 1) if stats["photos"] else 0
            )

    return stats


@router.get("/avatars")
async def avatars():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT u.user_id, u.name, u.age, u.gender, u.life_stage_code,
                       a.avatar_name, a.avatar_img_url, a.avatar_explain, a.avatar_created_at
                FROM users u
                LEFT JOIN avatar a ON u.user_id = a.user_id
                ORDER BY a.avatar_created_at DESC
            """)
            rows = await cur.fetchall()
            cols = [d[0] for d in cur.description]
            avatars_list = [dict(zip(cols, r)) for r in rows]

            result = []
            for av in avatars_list:
                uid = av["user_id"]
                await cur.execute("""
                    SELECT payment_category, SUM(payment_out) as total
                    FROM transactions WHERE user_id=%s AND payment_out > 0
                    GROUP BY payment_category ORDER BY total DESC LIMIT 3
                """, (uid,))
                top_cats = await cur.fetchall()
                av["top_categories"] = [{"category": r[0], "amount": int(r[1])} for r in top_cats]

                await cur.execute("SELECT COUNT(*) FROM persona_transaction WHERE user_id=%s", (uid,))
                av["persona_tx_count"] = (await cur.fetchone())[0]

                if av.get("avatar_created_at"):
                    av["avatar_created_at"] = str(av["avatar_created_at"])
                result.append(av)

    return result


@router.get("/user-data")
async def user_data():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT user_id, name, age, gender, life_stage_code FROM users ORDER BY user_id")
            users = await cur.fetchall()
            result = []
            for u in users:
                uid = u[0]
                await cur.execute("SELECT COUNT(*) FROM cards WHERE user_id=%s", (uid,))
                card_count = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM bank_accounts WHERE user_id=%s", (uid,))
                bank_count = (await cur.fetchone())[0]
                await cur.execute("""
                    SELECT COUNT(*) FROM card_transactions ct
                    JOIN cards c ON ct.card_id = c.card_id WHERE c.user_id=%s
                """, (uid,))
                card_tx = (await cur.fetchone())[0]
                await cur.execute("""
                    SELECT COUNT(*) FROM bank_transactions bt
                    JOIN bank_accounts ba ON bt.bank_account_id = ba.id WHERE ba.user_id=%s
                """, (uid,))
                bank_tx = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM photos WHERE user_id=%s", (uid,))
                photo_count = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM diary WHERE user_id=%s", (uid,))
                diary_count = (await cur.fetchone())[0]
                await cur.execute("SELECT MAX(created_at) FROM diary WHERE user_id=%s", (uid,))
                last_diary = (await cur.fetchone())[0]

                result.append({
                    "user_id": uid, "name": u[1], "age": u[2],
                    "gender": u[3], "life_stage_code": u[4],
                    "card_count": card_count, "bank_count": bank_count,
                    "card_tx": card_tx, "bank_tx": bank_tx,
                    "photo_count": photo_count, "diary_count": diary_count,
                    "last_diary": str(last_diary) if last_diary else None,
                })
    return result


@router.get("/user-detail/{user_id}")
async def user_detail(user_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT user_id, name, age, gender, life_stage_code FROM users WHERE user_id=%s",
                (user_id,)
            )
            u = await cur.fetchone()
            if not u:
                return {"error": "not found"}

            # 최근 일기 10건
            await cur.execute("""
                SELECT diary_id, diary_content, created_at
                FROM diary WHERE user_id=%s ORDER BY created_at DESC LIMIT 10
            """, (user_id,))
            diaries = [
                {"id": r[0], "content": r[1] or "", "created_at": str(r[2])}
                for r in await cur.fetchall()
            ]

            # 소비 카테고리 top 8
            await cur.execute("""
                SELECT payment_category, COUNT(*) as cnt, SUM(payment_out) as total
                FROM transactions WHERE user_id=%s AND payment_out > 0
                GROUP BY payment_category ORDER BY total DESC LIMIT 8
            """, (user_id,))
            top_cats = [
                {"category": r[0], "count": r[1], "total": int(r[2])}
                for r in await cur.fetchall()
            ]

            # 최근 거래 10건
            await cur.execute("""
                SELECT payment_place, payment_category, payment_out, payment_date
                FROM transactions WHERE user_id=%s AND payment_out > 0
                ORDER BY payment_date DESC, payment_id DESC LIMIT 10
            """, (user_id,))
            recent_tx = [
                {"place": r[0], "category": r[1], "amount": int(r[2]), "date": str(r[3])}
                for r in await cur.fetchall()
            ]

            # VLM 분석된 사진
            await cur.execute("""
                SELECT p.photo_id, p.image_url, v.vlm_category, v.vlm_item_name,
                       v.vlm_price_estimate, v.vlm_confidence
                FROM photos p
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                WHERE p.user_id=%s ORDER BY p.photo_id DESC LIMIT 12
            """, (user_id,))
            photos = [
                {
                    "photo_id": r[0], "url": r[1], "category": r[2],
                    "item": r[3], "price_estimate": r[4], "confidence": r[5]
                }
                for r in await cur.fetchall()
            ]

            # 카드 목록
            await cur.execute("""
                SELECT c.card_id, c.res_card_name, c.res_card_type,
                       COUNT(ct.card_transaction_id) as tx_count,
                       SUM(ct.used_amount) as total
                FROM cards c
                LEFT JOIN card_transactions ct ON c.card_id = ct.card_id AND ct.cancel_yn='0'
                WHERE c.user_id=%s
                GROUP BY c.card_id, c.res_card_name, c.res_card_type
            """, (user_id,))
            cards = [
                {"card_id": r[0], "name": r[1], "type": r[2], "tx_count": r[3], "total": float(r[4] or 0)}
                for r in await cur.fetchall()
            ]

    return {
        "user_id": u[0], "name": u[1], "age": u[2],
        "gender": u[3], "life_stage_code": u[4],
        "recent_diaries": diaries,
        "top_categories": top_cats,
        "recent_transactions": recent_tx,
        "recent_photos": photos,
        "cards": cards,
    }


@router.get("/vlm-stats")
async def vlm_stats():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM photo_vlm_results")
            total_vlm = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(*) FROM photos")
            total_photos = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(DISTINCT photo_id) FROM persona_transaction")
            mapped_count = (await cur.fetchone())[0]

            vlm_missing = max(0, total_photos - total_vlm)

            await cur.execute("""
                SELECT vlm_category, COUNT(*) as cnt
                FROM photo_vlm_results
                WHERE vlm_category IS NOT NULL
                GROUP BY vlm_category ORDER BY cnt DESC LIMIT 10
            """)
            categories = [{"category": r[0], "count": r[1]} for r in await cur.fetchall()]

            await cur.execute("SELECT COUNT(*) FROM photo_vlm_results WHERE vlm_category IS NULL")
            null_category_count = (await cur.fetchone())[0]

            await cur.execute("""
                SELECT u.age, v.vlm_item_name, COUNT(*) as cnt
                FROM photo_vlm_results v
                JOIN photos p ON v.photo_id = p.photo_id
                JOIN users u ON p.user_id = u.user_id
                WHERE v.vlm_item_name IS NOT NULL AND u.age IS NOT NULL
                GROUP BY u.age, v.vlm_item_name
                ORDER BY u.age, cnt DESC
            """)
            rows = await cur.fetchall()
            age_items: dict = {}
            for age, item, cnt in rows:
                age_key = str(age)
                if age_key not in age_items:
                    age_items[age_key] = []
                if len(age_items[age_key]) < 5:
                    age_items[age_key].append({"item": item, "count": cnt})

            await cur.execute("""
                SELECT u.name, COUNT(p.photo_id) as total,
                       COUNT(v.photo_id) as analyzed
                FROM users u
                LEFT JOIN photos p ON u.user_id = p.user_id
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                GROUP BY u.user_id, u.name
            """)
            per_user_vlm = [
                {"name": r[0], "total": r[1], "analyzed": r[2], "missing": max(0, r[1]-r[2])}
                for r in await cur.fetchall()
            ]

    return {
        "total_vlm": total_vlm,
        "total_photos": total_photos,
        "mapped_count": mapped_count,
        "mapping_rate": round(mapped_count / total_photos * 100, 1) if total_photos else 0,
        "vlm_missing": vlm_missing,
        "null_category_count": null_category_count,
        "vlm_success_rate": round(total_vlm / total_photos * 100, 1) if total_photos else 0,
        "categories": categories,
        "age_items": age_items,
        "per_user_vlm": per_user_vlm,
    }


@router.get("/vlm-category/{category}")
async def vlm_category_detail(category: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT v.photo_id, p.image_url, v.vlm_item_name, v.vlm_price_estimate,
                       v.vlm_confidence, v.vlm_store_name, v.vlm_description, u.name
                FROM photo_vlm_results v
                JOIN photos p ON v.photo_id = p.photo_id
                JOIN users u ON p.user_id = u.user_id
                WHERE v.vlm_category = %s
                ORDER BY v.vlm_confidence DESC LIMIT 30
            """, (category,))
            rows = await cur.fetchall()
            photos = [
                {
                    "photo_id": r[0], "url": r[1], "item": r[2],
                    "price_estimate": r[3], "confidence": r[4],
                    "store": r[5], "description": r[6], "user": r[7],
                }
                for r in rows
            ]

            # 이 카테고리 내 품목 분포
            await cur.execute("""
                SELECT vlm_item_name, COUNT(*) as cnt
                FROM photo_vlm_results
                WHERE vlm_category = %s AND vlm_item_name IS NOT NULL
                GROUP BY vlm_item_name ORDER BY cnt DESC LIMIT 10
            """, (category,))
            items = [{"item": r[0], "count": r[1]} for r in await cur.fetchall()]

    return {"category": category, "photos": photos, "items": items}


@router.get("/diary-mapping")
async def diary_mapping():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM photos")
            total_photos = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(DISTINCT photo_id) FROM diary_photos")
            photos_in_diary = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(*) FROM diary")
            total_diaries = (await cur.fetchone())[0]
            await cur.execute("SELECT COUNT(DISTINCT photo_id) FROM persona_transaction")
            tx_mapped = (await cur.fetchone())[0]

            await cur.execute("""
                SELECT u.name, u.user_id,
                       COUNT(DISTINCT p.photo_id) as total_photos,
                       COUNT(DISTINCT dp.photo_id) as diary_photos,
                       COUNT(DISTINCT pt.photo_id) as mapped_photos
                FROM users u
                LEFT JOIN photos p ON u.user_id = p.user_id
                LEFT JOIN diary_photos dp ON p.photo_id = dp.photo_id
                LEFT JOIN persona_transaction pt ON p.photo_id = pt.photo_id
                GROUP BY u.user_id, u.name
                ORDER BY u.user_id
            """)
            per_user = await cur.fetchall()

    return {
        "total_photos": total_photos,
        "photos_in_diary": photos_in_diary,
        "diary_rate": round(photos_in_diary / total_photos * 100, 1) if total_photos else 0,
        "total_diaries": total_diaries,
        "tx_mapped": tx_mapped,
        "tx_mapping_rate": round(tx_mapped / total_photos * 100, 1) if total_photos else 0,
        "per_user": [
            {
                "name": r[0], "user_id": r[1],
                "total_photos": r[2], "diary_photos": r[3], "mapped_photos": r[4]
            } for r in per_user
        ],
    }


@router.get("/diary-user/{user_id}")
async def diary_user_detail(user_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT name FROM users WHERE user_id=%s", (user_id,))
            row = await cur.fetchone()
            if not row:
                return {"error": "not found"}
            name = row[0]

            # 사진별 매핑 상태
            await cur.execute("""
                SELECT p.photo_id, p.image_url,
                       MAX(CASE WHEN dp.photo_id IS NOT NULL THEN 1 ELSE 0 END) as in_diary,
                       MAX(CASE WHEN pt.photo_id IS NOT NULL THEN 1 ELSE 0 END) as tx_mapped,
                       v.vlm_category, v.vlm_item_name
                FROM photos p
                LEFT JOIN diary_photos dp ON p.photo_id = dp.photo_id
                LEFT JOIN persona_transaction pt ON p.photo_id = pt.photo_id
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                WHERE p.user_id = %s
                GROUP BY p.photo_id, p.image_url, v.vlm_category, v.vlm_item_name
                ORDER BY p.photo_id DESC
            """, (user_id,))
            photos = [
                {
                    "photo_id": r[0], "url": r[1],
                    "in_diary": bool(r[2]), "tx_mapped": bool(r[3]),
                    "category": r[4], "item": r[5],
                }
                for r in await cur.fetchall()
            ]

            # 일기 목록
            await cur.execute("""
                SELECT d.diary_id, d.diary_content, d.created_at,
                       COUNT(dp.photo_id) as photo_count
                FROM diary d
                LEFT JOIN diary_photos dp ON d.diary_id = dp.diary_id
                WHERE d.user_id = %s
                GROUP BY d.diary_id, d.diary_content, d.created_at
                ORDER BY d.created_at DESC
            """, (user_id,))
            diaries = [
                {"id": r[0], "content": (r[1] or "")[:120], "created_at": str(r[2]), "photo_count": r[3]}
                for r in await cur.fetchall()
            ]

    return {"user_id": user_id, "name": name, "photos": photos, "diaries": diaries}


@router.get("/lifecycle")
async def lifecycle():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT COALESCE(life_stage_code, '미분류') as stage, COUNT(*) as cnt
                FROM users GROUP BY stage ORDER BY cnt DESC
            """)
            distribution = [{"stage": r[0], "count": r[1]} for r in await cur.fetchall()]

            stage_labels = {
                "UNI": "대학생", "CHILD_BABY": "영유아 자녀", "NEW_WED": "신혼부부",
                "SINGLE": "1인 가구", "SENIOR": "시니어", "미분류": "미분류"
            }
            for d in distribution:
                d["label"] = stage_labels.get(d["stage"], d["stage"])

    return distribution


@router.get("/lifecycle/{stage}")
async def lifecycle_stage_detail(stage: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            condition = "life_stage_code IS NULL" if stage == "미분류" else "life_stage_code = %s"
            params = () if stage == "미분류" else (stage,)

            await cur.execute(f"""
                SELECT u.user_id, u.name, u.age, u.gender,
                       COUNT(DISTINCT p.photo_id) as photo_count,
                       COUNT(DISTINCT d.diary_id) as diary_count,
                       COUNT(DISTINCT t.payment_id) as tx_count,
                       SUM(CASE WHEN t.payment_out > 0 THEN t.payment_out ELSE 0 END) as total_spend
                FROM users u
                LEFT JOIN photos p ON u.user_id = p.user_id
                LEFT JOIN diary d ON u.user_id = d.user_id
                LEFT JOIN transactions t ON u.user_id = t.user_id
                WHERE {condition}
                GROUP BY u.user_id, u.name, u.age, u.gender
            """, params)

            users = [
                {
                    "user_id": r[0], "name": r[1], "age": r[2], "gender": r[3],
                    "photo_count": r[4], "diary_count": r[5],
                    "tx_count": r[6], "total_spend": int(r[7] or 0),
                }
                for r in await cur.fetchall()
            ]

            # 이 그룹의 소비 카테고리 top 5
            await cur.execute(f"""
                SELECT t.payment_category, COUNT(*) as cnt, SUM(t.payment_out) as total
                FROM transactions t
                JOIN users u ON t.user_id = u.user_id
                WHERE {condition} AND t.payment_out > 0
                GROUP BY t.payment_category ORDER BY total DESC LIMIT 5
            """, params)
            top_cats = [{"category": r[0], "count": r[1], "total": int(r[2])} for r in await cur.fetchall()]

    stage_labels = {
        "UNI": "대학생", "CHILD_BABY": "영유아 자녀", "NEW_WED": "신혼부부",
        "SINGLE": "1인 가구", "SENIOR": "시니어", "미분류": "미분류"
    }
    return {
        "stage": stage,
        "label": stage_labels.get(stage, stage),
        "users": users,
        "top_categories": top_cats,
    }


@router.get("/spending-detail/{category}")
async def spending_category_detail(category: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            # 최근 거래 30건
            await cur.execute("""
                SELECT t.payment_place, t.payment_out, t.payment_date, u.name
                FROM transactions t
                JOIN users u ON t.user_id = u.user_id
                WHERE t.payment_category = %s AND t.payment_out > 0
                ORDER BY t.payment_date DESC, t.payment_id DESC LIMIT 30
            """, (category,))
            transactions = [
                {"place": r[0], "amount": int(r[1]), "date": str(r[2]), "user": r[3]}
                for r in await cur.fetchall()
            ]

            # 유저별 이 카테고리 소비
            await cur.execute("""
                SELECT u.name, COUNT(*) as cnt, SUM(t.payment_out) as total
                FROM transactions t
                JOIN users u ON t.user_id = u.user_id
                WHERE t.payment_category = %s AND t.payment_out > 0
                GROUP BY u.user_id, u.name ORDER BY total DESC
            """, (category,))
            per_user = [
                {"name": r[0], "count": r[1], "total": int(r[2])}
                for r in await cur.fetchall()
            ]

            # 월별 추이
            await cur.execute("""
                SELECT DATE_FORMAT(payment_date, '%%Y-%%m') as month,
                       COUNT(*) as cnt, SUM(payment_out) as total
                FROM transactions
                WHERE payment_category = %s AND payment_out > 0
                GROUP BY month ORDER BY month DESC LIMIT 6
            """, (category,))
            monthly = [{"month": r[0], "count": r[1], "total": int(r[2])} for r in await cur.fetchall()]

    return {
        "category": category,
        "transactions": transactions,
        "per_user": per_user,
        "monthly": list(reversed(monthly)),
    }


@router.get("/system-health")
async def system_health():
    import time
    result = {}

    try:
        pool = await get_pool()
        t0 = time.monotonic()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
                await cur.fetchone()
        result["db"] = {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000, 1)}
    except Exception as e:
        result["db"] = {"status": "error", "error": str(e)}

    try:
        prompts = list_prompts()
        result["prompt_store"] = {"status": "ok", "count": len(prompts), "modified": sum(1 for p in prompts if p["is_modified"])}
    except Exception as e:
        result["prompt_store"] = {"status": "error", "error": str(e)}

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT COUNT(*) FROM photos p LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id WHERE v.photo_id IS NULL")
                vlm_unprocessed = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM users u LEFT JOIN diary d ON u.user_id = d.user_id WHERE d.user_id IS NULL")
                users_no_diary = (await cur.fetchone())[0]
                await cur.execute("SELECT COUNT(*) FROM users u LEFT JOIN avatar a ON u.user_id = a.user_id WHERE a.user_id IS NULL")
                users_no_avatar = (await cur.fetchone())[0]

        result["data_quality"] = {
            "vlm_unprocessed_photos": vlm_unprocessed,
            "users_without_diary": users_no_diary,
            "users_without_avatar": users_no_avatar,
        }
    except Exception as e:
        result["data_quality"] = {"status": "error", "error": str(e)}

    return result


class PromptUpdate(BaseModel):
    value: str


@router.get("/prompts")
async def get_prompts():
    return list_prompts()


@router.put("/prompts/{key}")
async def update_prompt(key: str, body: PromptUpdate):
    old_value = get_prompt(key)
    add_prompt_history(key, old_value)
    set_prompt(key, body.value)
    return {"key": key, "saved": True}


@router.delete("/prompts/{key}")
async def reset_prompt_endpoint(key: str):
    old_value = get_prompt(key)
    add_prompt_history(key, old_value)
    reset_prompt(key)
    return {"key": key, "reset": True}


@router.get("/prompts/{key}/history")
async def get_prompt_history_endpoint(key: str):
    return get_prompt_history(key)


class PromptTestInput(BaseModel):
    input: str
    prompt: str = ""


@router.post("/prompts/{key}/test")
async def test_prompt(key: str, body: PromptTestInput):
    import json, httpx, os
    prompt_text = body.prompt or get_prompt(key)
    try:
        user_input = json.loads(body.input)
    except Exception:
        user_input = body.input

    openai_key = os.getenv("OPENAI_API_KEY", "")
    if not openai_key:
        return {"error": "OPENAI_API_KEY가 설정되지 않았습니다."}

    messages = [
        {"role": "system", "content": prompt_text},
        {"role": "user", "content": json.dumps(user_input, ensure_ascii=False) if isinstance(user_input, dict) else str(user_input)},
    ]
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {openai_key}"},
            json={"model": "gpt-4o", "messages": messages},
        )
        data = resp.json()

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        parsed = json.loads(content)
        return {"result": parsed, "raw": content, "valid_json": True}
    except Exception:
        return {"result": content, "raw": content, "valid_json": False}


@router.get("/spending")
async def spending():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT payment_category, COUNT(*) as cnt, SUM(payment_out) as total
                FROM transactions
                WHERE payment_out > 0 AND payment_category IS NOT NULL
                GROUP BY payment_category ORDER BY cnt DESC LIMIT 15
            """)
            categories = [
                {"category": r[0], "count": r[1], "total": int(r[2])}
                for r in await cur.fetchall()
            ]

            await cur.execute("""
                SELECT member_store_type, COUNT(*) as cnt, SUM(used_amount) as total
                FROM card_transactions
                WHERE cancel_yn='0' AND member_store_type IS NOT NULL
                GROUP BY member_store_type ORDER BY cnt DESC LIMIT 10
            """)
            card_types = [
                {"type": r[0], "count": r[1], "total": float(r[2])}
                for r in await cur.fetchall()
            ]

            await cur.execute("""
                SELECT DATE_FORMAT(used_date, '%Y-%m') as month, SUM(used_amount) as total
                FROM card_transactions WHERE cancel_yn='0'
                GROUP BY month ORDER BY month DESC LIMIT 6
            """)
            monthly = [{"month": r[0], "total": float(r[1])} for r in await cur.fetchall()]

            await cur.execute("""
                SELECT u.life_stage_code,
                       COUNT(DISTINCT ct.card_transaction_id) as tx_count,
                       AVG(ct.used_amount) as avg_amount
                FROM card_transactions ct
                JOIN cards c ON ct.card_id = c.card_id
                JOIN users u ON c.user_id = u.user_id
                WHERE ct.cancel_yn='0' AND u.life_stage_code IS NOT NULL
                GROUP BY u.life_stage_code
            """)
            stage_labels = {
                "UNI": "대학생", "CHILD_BABY": "영유아 자녀", "NEW_WED": "신혼부부",
                "SINGLE": "1인 가구", "SENIOR": "시니어"
            }
            lifecycle_spending = [
                {
                    "stage": stage_labels.get(r[0], r[0]),
                    "tx_count": r[1],
                    "avg_amount": round(float(r[2]), 0) if r[2] else 0
                }
                for r in await cur.fetchall()
            ]

    return {
        "categories": categories,
        "card_types": card_types,
        "monthly": list(reversed(monthly)),
        "lifecycle_spending": lifecycle_spending,
    }


@router.get("/vlm-unprocessed")
async def vlm_unprocessed():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT p.photo_id, p.image_url, p.created_at, u.name, u.user_id
                FROM photos p
                JOIN users u ON p.user_id = u.user_id
                LEFT JOIN photo_vlm_results v ON p.photo_id = v.photo_id
                WHERE v.photo_id IS NULL
                ORDER BY p.created_at DESC
                LIMIT 50
            """)
            rows = await cur.fetchall()
    return [
        {"photo_id": r[0], "url": r[1], "created_at": str(r[2]), "user": r[3], "user_id": r[4]}
        for r in rows
    ]
