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

    first_day = datetime(target_year, target_month, 1).strftime("%Y-%m-%d")
    last_day  = datetime(
        target_year,
        target_month,
        calendar.monthrange(target_year, target_month)[1]
    ).strftime("%Y-%m-%d")

    # ✅ payment_place 추가
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
    """), engine, params={
        "user_id": user_id,
        "start": first_day,
        "end": last_day,
    })

    if df.empty:
        return {
            "payment_out":           0,
            "payment_total_num":     0,
            "payment_days":          0,
            "category_price":        {},
            "category_transactions": {},  # ✅ 추가
            "timepattern_price":     {},
            "weekly_price":          [],
            "weekly_categories":     [],
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

    # 달력 기준 주차 계산 (일요일 시작)
    first_weekday  = datetime(target_year, target_month, 1).weekday()
    adjusted_first = (first_weekday + 1) % 7

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

    # 상위 3개 카테고리
    top3_categories = (
        df.groupby('payment_category')['payment_out']
        .sum().nlargest(3).index.tolist()
    )

    # 주차별 × 상위 3개 카테고리 집계
    df_top3 = df[df['payment_category'].isin(top3_categories)]
    weekly_pivot = (
        df_top3.groupby(['week_label', 'payment_category'])['payment_out']
        .sum().astype(int).unstack(fill_value=0)
    )

    last_day_num = calendar.monthrange(target_year, target_month)[1]
    total_weeks  = (last_day_num + adjusted_first - 1) // 7 + 1
    week_order   = [f'{i}주' for i in range(1, total_weeks + 1)]

    weekly_price = []
    for week in week_order:
        if week in weekly_pivot.index:
            row = {'week': week}
            for cat in top3_categories:
                row[cat] = int(weekly_pivot.loc[week, cat]) if cat in weekly_pivot.columns else 0
            weekly_price.append(row)

    # ✅ 카테고리별 상세 거래 내역 생성
    category_transactions = {}
    for cat_name, group in df.groupby('payment_category'):
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

    # VLM 아이템 — persona_transaction과 매핑된 photo_vlm_results에서 이번 달 아이템 추출
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
            "start": first_day,
            "end": last_day,
        })
        if not vlm_df.empty:
            vlm_items = vlm_df['vlm_item_name'].dropna().unique().tolist()
    except Exception as e:
        print(f"[VLM ERROR] {e}")

    # avatar_change_reason — users 테이블에서 직접 조회
    avatar_change_reason = None
    try:
        cr_df = pd.read_sql(text("""
            SELECT avatar_change_reason FROM users WHERE user_id = :user_id
        """), engine, params={"user_id": user_id})
        if not cr_df.empty:
            avatar_change_reason = cr_df.iloc[0]['avatar_change_reason']
    except Exception:
        pass

    return {
        "payment_out":           int(df['payment_out'].sum()),
        "payment_total_num":     len(df),
        "payment_days":          df['payment_date'].nunique(),
        "category_price":        df.groupby('payment_category')['payment_out'].sum().astype(int).to_dict(),
        "category_transactions": category_transactions,
        "timepattern_price":     df.groupby('time_label')['payment_out'].sum().astype(int).to_dict(),
        "weekly_price":          weekly_price,
        "weekly_categories":     top3_categories,
        "category_colors":       CATEGORY_COLORS,
        "vlm_items":             vlm_items,
        "vlm_summary":           vlm_summary,
        "avatar_change_reason":  avatar_change_reason,
    }