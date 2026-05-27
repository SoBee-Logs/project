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

    # ✅ year/month 파라미터 없으면 현재 달로 fallback
    target_year  = year  if year  else now.year
    target_month = month if month else now.month

    first_day = datetime(target_year, target_month, 1).strftime("%Y-%m-%d")
    last_day  = datetime(
        target_year,
        target_month,
        calendar.monthrange(target_year, target_month)[1]  # ✅ 해당 달의 마지막 날 정확히 계산
    ).strftime("%Y-%m-%d")

    # payment_category_id → category_master.category_name JOIN
    df = pd.read_sql(text("""
        SELECT
            COALESCE(cm.category_name, '기타') AS payment_category,
            t.payment_time,
            t.payment_date,
            t.payment_out
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
            "payment_out": 0,
            "payment_total_num": 0,
            "category_price": {},
            "timepattern_price": {},
            "weekly_price": [],
            "weekly_categories": [],
        }

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
        if 0 <= hour < 6:      return '새벽'
        elif 6 <= hour < 11:   return '아침'
        elif 11 <= hour < 14:  return '점심'
        elif 14 <= hour < 20:  return '저녁'
        else:                  return '심야'

    def classify_week(d):
        if d is None:
            return '기타'
        if hasattr(d, 'day'):
            day = d.day
        else:
            try:
                day = int(str(d)[8:10])
            except (ValueError, TypeError):
                return '기타'
        if day <= 7:    return '1주'
        elif day <= 14: return '2주'
        elif day <= 21: return '3주'
        else:           return '4주'

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

    week_order = ['1주', '2주', '3주', '4주']
    weekly_price = []
    for week in week_order:
        if week in weekly_pivot.index:
            row = {'week': week}
            for cat in top3_categories:
                row[cat] = int(weekly_pivot.loc[week, cat]) if cat in weekly_pivot.columns else 0
            weekly_price.append(row)

    return {
        "payment_out": int(df['payment_out'].sum()),
        "payment_total_num": len(df),
        "payment_days": df['payment_date'].nunique(),
        "category_price": df.groupby('payment_category')['payment_out'].sum().astype(int).to_dict(),
        "timepattern_price": df.groupby('time_label')['payment_out'].sum().astype(int).to_dict(),
        "weekly_price": weekly_price,
        "weekly_categories": top3_categories,
        "category_colors": CATEGORY_COLORS,
    }