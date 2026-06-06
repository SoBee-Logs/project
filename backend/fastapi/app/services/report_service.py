from app.services.lifecycle_service import engine
from sqlalchemy import text
import pandas as pd
from datetime import datetime, timedelta
import calendar

# category_master의 category_name 기준 색상 매핑
CATEGORY_COLORS = {
    '교통':        '#60a5fa',
    '카페/음료':   '#38BDF8',
    '식사':        '#1e73be',
    '편의점':      '#93c5fd',
    '쇼핑/온라인': '#2563eb',
    '제과/베이커리':'#0ea5e9',
    '선물/상품권': '#7dd3fc',
    '의료/약국':   '#1d4ed8',
    '완구/취미':   '#6366f1',
    '서적':        '#a5b4fc',
    '기타':        '#94a3b8',
}


def get_transaction_report(user_id: int, year: int = None, month: int = None):
    now = datetime.now()

    target_year  = year  if year  else now.year
    target_month = month if month else now.month

    first_day_obj  = datetime(target_year, target_month, 1)
    last_day_num   = calendar.monthrange(target_year, target_month)[1]
    last_day_obj   = datetime(target_year, target_month, last_day_num)
    first_weekday  = first_day_obj.weekday()
    adjusted_first = first_weekday  # 월=0 ... 일=6

    df = pd.read_sql(text("""
        SELECT
            COALESCE(cm.category_name, '기타') AS payment_category,
            t.payment_time,
            t.payment_date,
            t.payment_out,
            t.payment_place
        FROM transactions t
        LEFT JOIN category_master cm
            ON t.payment_category_id = cm.payment_category_id
        WHERE t.user_id = :user_id
          AND t.payment_date BETWEEN :start AND :end
          AND t.payment_out > 0
    """), engine, params={
        "user_id": user_id,
        "start": first_day_obj.strftime("%Y-%m-%d"),
        "end":   last_day_obj.strftime("%Y-%m-%d"),
    })

    df_month = df

    if df.empty:
        return {
            "payment_out":              0,
            "payment_total_num":        0,
            "payment_days":             0,
            "category_price":           {},
            "category_transactions":    {},
            "timepattern_price":        {},
            "weekly_price":             [],
            "weekly_categories":        [],
            "week_order":               [],
            "weekly_category_price":    {},
            "weekly_timepattern_price": {},
        }

    # 5시간씩 균등 분할
    def classify_time(t):
        if t is None:
            return '기타'
        if isinstance(t, timedelta):
            hour = int(t.total_seconds() // 3600)
        else:
            try:
                hour = int(str(t)[:2])
            except (ValueError, TypeError):
                return '기타'
        if 0 <= hour < 5:    return '새벽'
        elif 5 <= hour < 10: return '아침'
        elif 10 <= hour < 15: return '점심'
        elif 15 <= hour < 20: return '저녁'
        else:                 return '심야'

    def classify_week(d):
        if d is None:
            return '기타'
        if not hasattr(d, 'day'):
            try:
                d = datetime.strptime(str(d)[:10], "%Y-%m-%d")
            except (ValueError, TypeError):
                return '기타'
        week_num = (d.day + adjusted_first - 1) // 7 + 1
        return f'{week_num}주'

    df['time_label'] = df['payment_time'].apply(classify_time)
    df['week_label'] = df['payment_date'].apply(classify_week)

    total_weeks = (last_day_num + adjusted_first - 1) // 7 + 1
    week_order  = [f'{i}주' for i in range(1, total_weeks + 1)]

    top3_categories = (
        df.groupby('payment_category')['payment_out']
        .sum().nlargest(3).index.tolist()
    )

    df_top3 = df[df['payment_category'].isin(top3_categories)]
    weekly_pivot = (
        df_top3.groupby(['week_label', 'payment_category'])['payment_out']
        .sum().astype(int).unstack(fill_value=0)
    )

    weekly_price = []
    for week in week_order:
        if week in weekly_pivot.index:
            row = {'week': week}
            for cat in top3_categories:
                row[cat] = int(weekly_pivot.loc[week, cat]) if cat in weekly_pivot.columns else 0
            weekly_price.append(row)

    # 카테고리별 상세 거래 내역 생성 (당월만)
    category_transactions = {}
    for cat_name, group in df_month.groupby('payment_category'):
        records = (
            group[['payment_date', 'payment_time', 'payment_place', 'payment_out']]
            .sort_values('payment_date', ascending=False)
            .assign(
                payment_date=lambda d: d['payment_date'].astype(str),
                payment_time=lambda d: d['payment_time'].apply(
                    lambda t: str(t)[:5] if pd.notna(t) else None
                ),
                payment_place=lambda d: d['payment_place'].fillna('-'),
                payment_out=lambda d: d['payment_out'].fillna(0).astype(int),
            )
            .to_dict('records')
        )
        category_transactions[cat_name] = records

    # VLM 아이템 — 이번 달 전체
    vlm_items = []
    vlm_summary = {}
    try:
        vlm_df = pd.read_sql(text("""
            SELECT pvr.vlm_item_name, pvr.vlm_category, pvr.vlm_store_name
            FROM persona_transaction pt
            JOIN transactions t ON pt.payment_id = t.payment_id
            JOIN photo_vlm_results pvr ON pt.vlm_id = pvr.vlm_id
            WHERE pt.user_id = :user_id
              AND t.payment_date BETWEEN :start AND :end
              AND pvr.vlm_item_name IS NOT NULL
              AND pvr.vlm_item_name != ''
        """), engine, params={
            "user_id": user_id,
            "start": first_day_obj.strftime("%Y-%m-%d"),
            "end":   last_day_obj.strftime("%Y-%m-%d"),
        })
        if not vlm_df.empty:
            vlm_items = vlm_df['vlm_item_name'].dropna().unique().tolist()
    except Exception as e:
        print(f"[VLM ERROR] {e}")

    # 페르소나 기준 주: 직전 월~일 구간 (오늘 기준)
    today_obj = datetime.now().date()
    days_since_sunday = (today_obj.weekday() + 1) % 7
    prev_sunday = today_obj - timedelta(days=days_since_sunday if days_since_sunday > 0 else 7)
    prev_monday = prev_sunday - timedelta(days=6)

    # VLM 장면 — 페르소나 기준 주간 (직전 월~일)
    persona_vlm_scene = {}
    try:
        scene_df = pd.read_sql(text("""
            SELECT
                pvr.vlm_item_name  AS item_name,
                COALESCE(cm.category_name, '기타') AS category,
                pvr.vlm_store_name AS store_name,
                pvr.vlm_store_type AS store_type
            FROM persona_transaction pt
            JOIN transactions t        ON pt.payment_id = t.payment_id
            JOIN photo_vlm_results pvr ON pt.vlm_id = pvr.vlm_id
            LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
            WHERE pt.user_id = :user_id
              AND t.payment_date BETWEEN :start AND :end
        """), engine, params={
            "user_id": user_id,
            "start": str(prev_monday),
            "end":   str(prev_sunday),
        })
        if not scene_df.empty:
            store_type_counts = scene_df['store_type'].dropna().value_counts().to_dict()
            top_items = scene_df['item_name'].dropna().unique().tolist()[:5]
            cat_items = {}
            for _, row in scene_df.dropna(subset=['category', 'item_name']).iterrows():
                cat_items.setdefault(row['category'], [])
                if row['item_name'] not in cat_items[row['category']]:
                    cat_items[row['category']].append(row['item_name'])
            category_counts = scene_df['category'].value_counts().to_dict()
            persona_vlm_scene = {
                "total_count":    len(scene_df),
                "store_type_counts": store_type_counts,
                "top_items":      top_items,
                "category_items": {k: v[:2] for k, v in cat_items.items()},
                "category_counts": category_counts,
            }
    except Exception as e:
        print(f"[PERSONA VLM SCENE ERROR] {e}")

    # avatar_change_reason — avatar 테이블 최신 레코드에서 조회
    # weekly_avatar — 해당 월 각 주차에 생성된 아바타 이미지
    avatar_change_reason = None
    weekly_avatar = {}
    try:
        cr_df = pd.read_sql(text("""
            SELECT avatar_name, avatar_img_url, avatar_change_reason, avatar_explain, avatar_created_at
            FROM avatar
            WHERE user_id = :user_id
              AND YEAR(avatar_created_at) = :year
              AND MONTH(avatar_created_at) = :month
            ORDER BY avatar_created_at ASC
        """), engine, params={"user_id": user_id, "year": year, "month": month})
        if not cr_df.empty:
            avatar_change_reason = cr_df.iloc[-1]['avatar_change_reason']
            for _, row in cr_df.iterrows():
                created_at = row['avatar_created_at']
                if pd.notna(created_at):
                    week_label = classify_week(created_at)
                    weekly_avatar[week_label] = {
                        "avatar_img_url":       row['avatar_img_url'],
                        "avatar_name":          row['avatar_name'],
                        "avatar_change_reason": row['avatar_change_reason'],
                        "avatar_explain":       row['avatar_explain'],
                    }
    except Exception:
        pass

    MOOD_EMOJI = {
        'HAPPY':     '☺️',
        'SAD':       '😭',
        'SURPRISED': '😮',
        'LOVE':      '😍',
        'ANGRY':     '😡',
    }

    # 주차별 소비 감정(emoji) top1 집계
    weekly_top_emotion = {}
    try:
        emotion_df = pd.read_sql(text("""
            SELECT t.payment_date, et.emoji
            FROM persona_transaction pt
            JOIN transactions t ON pt.payment_id = t.payment_id
            JOIN emotions_text et ON pt.photo_id = et.photo_id
            WHERE pt.user_id = :user_id
              AND t.payment_date BETWEEN :start AND :end
              AND et.emoji IS NOT NULL AND et.emoji != ''
        """), engine, params={
            "user_id": user_id,
            "start": first_day_obj.strftime("%Y-%m-%d"),
            "end":   last_day_obj.strftime("%Y-%m-%d"),
        })
        if not emotion_df.empty:
            emotion_df['week_label'] = emotion_df['payment_date'].apply(classify_week)
            for week in week_order:
                week_em = emotion_df[emotion_df['week_label'] == week]
                if not week_em.empty:
                    counts = week_em['emoji'].value_counts()
                    top_mood = counts.idxmax()
                    weekly_top_emotion[week] = {
                        "emoji": MOOD_EMOJI.get(top_mood, top_mood),
                        "top_count": int(counts.max()),
                        "total_count": int(len(week_em)),
                    }
    except Exception as e:
        print(f"[EMOTION ERROR] {e}")

    # 주차별 카테고리·시간대 집계
    weekly_category_price = {}
    weekly_timepattern_price = {}
    for week in week_order:
        week_df = df[df['week_label'] == week]
        weekly_category_price[week] = week_df.groupby('payment_category')['payment_out'].sum().astype(int).to_dict() if not week_df.empty else {}
        weekly_timepattern_price[week] = week_df.groupby('time_label')['payment_out'].sum().astype(int).to_dict() if not week_df.empty else {}

    persona_week_df = df[
        (df['payment_date'].astype(str) >= str(prev_monday)) &
        (df['payment_date'].astype(str) <= str(prev_sunday))
    ]
    persona_top_category = None
    persona_top_category_amount = 0
    persona_top_category_pct = 0
    persona_peak_time = None
    persona_vlm_count = 0
    if not persona_week_df.empty:
        cat_sum = persona_week_df.groupby('payment_category')['payment_out'].sum()
        if not cat_sum.empty:
            persona_top_category = cat_sum.idxmax()
            persona_top_category_amount = int(cat_sum.max())
            total_week = int(cat_sum.sum())
            persona_top_category_pct = round(persona_top_category_amount / total_week * 100) if total_week > 0 else 0
        time_sum = persona_week_df.groupby('time_label')['payment_out'].sum()
        if not time_sum.empty:
            persona_peak_time = time_sum.idxmax()

    try:
        vlm_count_df = pd.read_sql(text("""
            SELECT COUNT(*) AS cnt
            FROM persona_transaction pt
            JOIN transactions t ON pt.payment_id = t.payment_id
            WHERE pt.user_id = :user_id
              AND t.payment_date BETWEEN :start AND :end
        """), engine, params={
            "user_id": user_id,
            "start": str(prev_monday),
            "end":   str(prev_sunday),
        })
        if not vlm_count_df.empty:
            persona_vlm_count = int(vlm_count_df.iloc[0]['cnt'])
    except Exception:
        pass

    return {
        "payment_out":              int(df_month['payment_out'].sum()),
        "payment_total_num":        len(df_month),
        "payment_days":             df_month['payment_date'].nunique(),
        "category_price":           df_month.groupby('payment_category')['payment_out'].sum().astype(int).to_dict(),
        "category_transactions":    category_transactions,
        "timepattern_price":        df_month.groupby('time_label')['payment_out'].sum().astype(int).to_dict(),
        "weekly_price":             weekly_price,
        "weekly_categories":        top3_categories,
        "week_order":               week_order,
        "weekly_category_price":    weekly_category_price,
        "weekly_timepattern_price": weekly_timepattern_price,
        "weekly_top_emotion":       weekly_top_emotion,
        "persona_week_start":           str(prev_monday),
        "persona_week_end":             str(prev_sunday),
        "persona_top_category":        persona_top_category,
        "persona_top_category_amount": persona_top_category_amount,
        "persona_top_category_pct":    persona_top_category_pct,
        "persona_peak_time":           persona_peak_time,
        "persona_vlm_count":        persona_vlm_count,
        "persona_vlm_scene":        persona_vlm_scene,
        "category_colors":       CATEGORY_COLORS,
        "vlm_items":             vlm_items,
        "vlm_summary":           vlm_summary,
        "avatar_change_reason":  avatar_change_reason,
        "weekly_avatar":         weekly_avatar,
    }