from app.services.lifecycle_service import engine
from app.core.constants import MOOD_NAME_TO_EMOJI
from app.core.emotion import pick_top_mood_name
from sqlalchemy import text
import pandas as pd
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
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


def get_transaction_report(user_id: int, year: int = None, month: int = None, summary: bool = False):
    now = datetime.now()
    target_year  = year  if year  else now.year
    target_month = month if month else now.month

    first_day_obj  = datetime(target_year, target_month, 1)
    last_day_num   = calendar.monthrange(target_year, target_month)[1]
    last_day_obj   = datetime(target_year, target_month, last_day_num)
    adjusted_first = first_day_obj.weekday()  # 월=0 ... 일=6
    start_str      = first_day_obj.strftime("%Y-%m-%d")
    end_str        = last_day_obj.strftime("%Y-%m-%d")
    end_exclusive  = (last_day_obj + timedelta(days=1)).strftime("%Y-%m-%d")

    def classify_time(t):
        if t is None: return '기타'
        if isinstance(t, timedelta): hour = int(t.total_seconds() // 3600)
        else:
            try: hour = int(str(t)[:2])
            except (ValueError, TypeError): return '기타'
        if 0 <= hour < 5:    return '새벽'
        elif 5 <= hour < 10: return '아침'
        elif 10 <= hour < 15: return '점심'
        elif 15 <= hour < 20: return '저녁'
        else:                 return '심야'

    def classify_week(d):
        if d is None: return '기타'
        if not hasattr(d, 'day'):
            try: d = datetime.strptime(str(d)[:10], "%Y-%m-%d")
            except (ValueError, TypeError): return '기타'
        return f'{(d.day + adjusted_first - 1) // 7 + 1}주'

    # ── 5개 쿼리 병렬 실행 ────────────────────────────────────────────
    def _q_transactions():
        return pd.read_sql(text("""
            SELECT COALESCE(cm.category_name, '기타') AS payment_category,
                   t.payment_time, t.payment_date, t.payment_out, t.payment_place
            FROM transactions t
            LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
            WHERE t.user_id = :user_id
              AND t.payment_date BETWEEN :start AND :end
              AND t.payment_out > 0
        """), engine, params={"user_id": user_id, "start": start_str, "end": end_str})

    def _q_avatar():
        try:
            return pd.read_sql(text("""
                SELECT avatar_name, avatar_img_url, avatar_change_reason,
                       avatar_explain, avatar_created_at
                FROM avatar
                WHERE user_id = :user_id
                  AND avatar_created_at >= :start AND avatar_created_at < :end
                ORDER BY avatar_created_at ASC
            """), engine, params={"user_id": user_id, "start": start_str, "end": end_exclusive})
        except Exception: return pd.DataFrame()

    def _q_all_mapped():
        try:
            return pd.read_sql(text("""
                SELECT DISTINCT pt.photo_id, DATE(pm.taken_at) AS taken_date
                FROM persona_transaction pt
                JOIN photo_metadata pm ON pt.photo_id = pm.photo_id
                WHERE pt.user_id = :user_id
                  AND pm.taken_at >= :start AND pm.taken_at < :end
            """), engine, params={"user_id": user_id, "start": start_str, "end": end_exclusive})
        except Exception: return pd.DataFrame()

    def _q_emotion():
        try:
            return pd.read_sql(text("""
                SELECT MAX(pm.taken_at) AS taken_at, et.emoji
                FROM (SELECT DISTINCT photo_id FROM persona_transaction WHERE user_id = :user_id) pt
                JOIN photo_metadata pm ON pt.photo_id = pm.photo_id
                JOIN emotions_text et  ON pt.photo_id = et.photo_id
                WHERE pm.taken_at >= :start AND pm.taken_at < :end
                  AND et.emoji IS NOT NULL AND et.emoji != ''
                GROUP BY pt.photo_id, et.emoji
            """), engine, params={"user_id": user_id, "start": start_str, "end": end_exclusive})
        except Exception: return pd.DataFrame()

    def _q_vlm_batch():
        try:
            df = pd.read_sql(text("""
                SELECT pvr.vlm_item_name  AS item_name,
                       COALESCE(cm.category_name, '기타') AS category,
                       pvr.vlm_store_name AS store_name,
                       pvr.vlm_store_type AS store_type,
                       DATE(pm.taken_at)  AS taken_date
                FROM persona_transaction pt
                JOIN photo_metadata pm     ON pt.photo_id = pm.photo_id
                JOIN photo_vlm_results pvr ON pt.vlm_id = pvr.vlm_id
                LEFT JOIN transactions t   ON pt.payment_id = t.payment_id
                LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                WHERE pt.user_id = :user_id
                  AND pm.taken_at >= :start AND pm.taken_at < :end
            """), engine, params={"user_id": user_id, "start": start_str, "end": end_exclusive})
            if not df.empty:
                df['taken_date'] = pd.to_datetime(df['taken_date']).dt.date
            return df
        except Exception as e:
            print(f"[VLM BATCH ERROR] {e}")
            return pd.DataFrame()

    with ThreadPoolExecutor(max_workers=5) as executor:
        fut_tx     = executor.submit(_q_transactions)
        fut_avatar = executor.submit(_q_avatar)
        fut_mapped = executor.submit(_q_all_mapped)
        fut_emotion= executor.submit(_q_emotion)
        fut_vlm    = executor.submit(_q_vlm_batch)
        df            = fut_tx.result()
        cr_df         = fut_avatar.result()
        all_mapped_df = fut_mapped.result()
        emotion_df    = fut_emotion.result()
        _month_vlm_df = fut_vlm.result()

    # ── 빈 달 early return ────────────────────────────────────────────
    _empty_base = {
        "payment_out": 0, "payment_total_num": 0, "payment_days": 0,
        "category_price": {}, "timepattern_price": {},
        "weekly_price": [], "weekly_categories": [], "week_order": [],
        "weekly_category_price": {}, "weekly_timepattern_price": {},
        "weekly_top_emotion": {}, "weekly_avatar": {},
        "persona_week_start": str(first_day_obj.date()), "persona_week_end": str(first_day_obj.date()),
        "persona_top_category": None, "persona_top_category_amount": 0,
        "persona_top_category_pct": 0, "persona_peak_time": None,
        "persona_vlm_count": 0, "persona_vlm_scene": {},
        "category_colors": CATEGORY_COLORS, "vlm_items": [], "vlm_summary": {},
        "avatar_change_reason": None, "avatar_change_reason_month": None,
        "weekly_avatar": {}, "category_transactions": {},
    }
    if df.empty:
        return _empty_base

    # ── df 전처리 ─────────────────────────────────────────────────────
    df['time_label'] = df['payment_time'].apply(classify_time)
    df['week_label'] = df['payment_date'].apply(classify_week)

    total_weeks = (last_day_num + adjusted_first - 1) // 7 + 1
    week_order  = [f'{i}주' for i in range(1, total_weeks + 1)]

    top3_categories = df.groupby('payment_category')['payment_out'].sum().nlargest(3).index.tolist()
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

    # ── category_transactions (summary 모드 스킵) ─────────────────────
    category_transactions = {}
    if not summary:
        for cat_name, group in df.groupby('payment_category'):
            category_transactions[cat_name] = (
                group[['payment_date', 'payment_time', 'payment_place', 'payment_out']]
                .sort_values('payment_date', ascending=False)
                .assign(
                    payment_date=lambda d: d['payment_date'].astype(str),
                    payment_time=lambda d: d['payment_time'].apply(
                        lambda t: str(t)[:5] if pd.notna(t) else None),
                    payment_place=lambda d: d['payment_place'].fillna('-'),
                    payment_out=lambda d: d['payment_out'].fillna(0).astype(int),
                ).to_dict('records')
            )

    # ── vlm_items (summary 모드 스킵, vlm_batch 결과 재활용) ──────────
    vlm_items = []
    vlm_summary = {}
    if not summary and not _month_vlm_df.empty:
        vlm_items = _month_vlm_df['item_name'].dropna().unique().tolist()

    # ── avatar 처리 + persona 기준 주 계산 ───────────────────────────
    avatar_change_reason       = None
    avatar_change_reason_month = None
    last_created_at            = None
    if not cr_df.empty:
        avatar_change_reason = cr_df.iloc[-1]['avatar_change_reason']
        last_created_at      = cr_df.iloc[-1]['avatar_created_at']
        avatar_change_reason_month = (
            pd.to_datetime(last_created_at).month if pd.notna(last_created_at) else None
        )

    if last_created_at is not None and pd.notna(last_created_at):
        avatar_date     = pd.to_datetime(last_created_at).date()
        avatar_week_num = (avatar_date.day + adjusted_first - 1) // 7 + 1
        week_num        = avatar_week_num - 1
    else:
        from zoneinfo import ZoneInfo
        today_obj = datetime.now(ZoneInfo("Asia/Seoul")).date()
        week_num  = (today_obj.day + adjusted_first - 1) // 7 + 1 - 1

    if week_num < 1:
        prev_m    = target_month - 1 if target_month > 1 else 12
        prev_y    = target_year if target_month > 1 else target_year - 1
        prev_last = calendar.monthrange(prev_y, prev_m)[1]
        prev_monday = datetime(prev_y, prev_m, 1).date()
        prev_sunday = datetime(prev_y, prev_m, prev_last).date()
    else:
        w_start_day = max(1, (week_num - 1) * 7 - adjusted_first + 1)
        w_end_day   = min(last_day_num, week_num * 7 - adjusted_first)
        prev_monday = datetime(target_year, target_month, w_start_day).date()
        prev_sunday = datetime(target_year, target_month, w_end_day).date()

    # ── VLM scene: 배치 결과를 Python에서 날짜 범위로 필터 (N+1 제거) ─
    def scene_from_df(sdf, start_date, end_date):
        if sdf.empty: return {}
        sub = sdf[(sdf['taken_date'] >= start_date) & (sdf['taken_date'] <= end_date)]
        if sub.empty: return {}
        cat_items = {}
        for _, row in sub.dropna(subset=['category', 'item_name']).iterrows():
            cat_items.setdefault(row['category'], [])
            if row['item_name'] not in cat_items[row['category']]:
                cat_items[row['category']].append(row['item_name'])
        return {
            "total_count":       len(sub),
            "store_type_counts": sub['store_type'].dropna().value_counts().to_dict(),
            "top_items":         sub['item_name'].dropna().unique().tolist()[:5],
            "category_items":    {k: v[:2] for k, v in cat_items.items()},
            "category_counts":   sub['category'].value_counts().to_dict(),
        }

    persona_vlm_scene = scene_from_df(_month_vlm_df, prev_monday, prev_sunday)

    # ── weekly_avatar (vlm_scene은 배치에서 Python 필터) ─────────────
    weekly_avatar = {}
    for _, row in cr_df.iterrows():
        created_at = row['avatar_created_at']
        if pd.notna(created_at):
            av_wn = (pd.to_datetime(created_at).day + adjusted_first - 1) // 7 + 1
            pv_wn = av_wn - 1
            if pv_wn >= 1:
                ws = max(1, (pv_wn - 1) * 7 - adjusted_first + 1)
                we = min(last_day_num, pv_wn * 7 - adjusted_first)
                scene_start = datetime(target_year, target_month, ws).date()
                scene_end   = datetime(target_year, target_month, we).date()
            else:
                pm_ = target_month - 1 if target_month > 1 else 12
                py_ = target_year if target_month > 1 else target_year - 1
                scene_start = datetime(py_, pm_, 1).date()
                scene_end   = datetime(py_, pm_, calendar.monthrange(py_, pm_)[1]).date()
            weekly_avatar[classify_week(created_at)] = {
                "avatar_img_url":       row['avatar_img_url'],
                "avatar_name":          row['avatar_name'],
                "avatar_change_reason": row['avatar_change_reason'],
                "avatar_explain":       row['avatar_explain'],
                "vlm_scene":            scene_from_df(_month_vlm_df, scene_start, scene_end),
            }

    # ── 감정 집계 ─────────────────────────────────────────────────────
    weekly_top_emotion = {}
    try:
        if not all_mapped_df.empty:
            all_mapped_df['week_label'] = all_mapped_df['taken_date'].apply(classify_week)
        if not emotion_df.empty:
            emotion_df['taken_at']   = pd.to_datetime(emotion_df['taken_at'])
            emotion_df['week_label'] = emotion_df['taken_at'].dt.date.apply(classify_week)
            for week in week_order:
                week_em = emotion_df[emotion_df['week_label'] == week]
                if not week_em.empty:
                    counts   = week_em['emoji'].value_counts()
                    top_mood = pick_top_mood_name(zip(week_em['emoji'], week_em['taken_at']))
                    total    = len(all_mapped_df[all_mapped_df['week_label'] == week]) if not all_mapped_df.empty else len(week_em)
                    weekly_top_emotion[week] = {
                        "emoji":       MOOD_NAME_TO_EMOJI.get(top_mood, top_mood),
                        "top_count":   int(counts.max()),
                        "total_count": int(total),
                    }
    except Exception as e:
        print(f"[EMOTION ERROR] {e}")

    # ── 주차별 카테고리·시간대 집계 ──────────────────────────────────
    weekly_category_price    = {}
    weekly_timepattern_price = {}
    for week in week_order:
        wdf = df[df['week_label'] == week]
        weekly_category_price[week]    = wdf.groupby('payment_category')['payment_out'].sum().astype(int).to_dict() if not wdf.empty else {}
        weekly_timepattern_price[week] = wdf.groupby('time_label')['payment_out'].sum().astype(int).to_dict() if not wdf.empty else {}

    # ── persona 기준 주 집계 (df에서 Python 필터, 별도 쿼리 제거) ────
    persona_top_category        = None
    persona_top_category_amount = 0
    persona_top_category_pct    = 0
    persona_peak_time           = None
    try:
        pdate = df['payment_date'].apply(lambda d: str(d)[:10])
        persona_week_df = df[(pdate >= str(prev_monday)) & (pdate <= str(prev_sunday))]
        if not persona_week_df.empty:
            cat_sum = persona_week_df.groupby('payment_category')['payment_out'].sum()
            if not cat_sum.empty:
                persona_top_category        = cat_sum.idxmax()
                persona_top_category_amount = int(cat_sum.max())
                total_week = int(cat_sum.sum())
                persona_top_category_pct    = round(persona_top_category_amount / total_week * 100) if total_week > 0 else 0
            time_sum = persona_week_df.groupby('time_label')['payment_out'].sum()
            if not time_sum.empty:
                persona_peak_time = time_sum.idxmax()
    except Exception as e:
        print(f"[PERSONA WEEK ERROR] {e}")

    # ── persona vlm count (vlm_batch에서 Python 필터, 별도 쿼리 제거)
    persona_vlm_count = 0
    if not _month_vlm_df.empty:
        persona_vlm_count = int(
            (((_month_vlm_df['taken_date'] >= prev_monday) &
              (_month_vlm_df['taken_date'] <= prev_sunday))).sum()
        )

    return {
        "payment_out":              int(df['payment_out'].sum()),
        "payment_total_num":        len(df),
        "payment_days":             df['payment_date'].nunique(),
        "category_price":           df.groupby('payment_category')['payment_out'].sum().astype(int).to_dict(),
        "category_transactions":    category_transactions,
        "timepattern_price":        df.groupby('time_label')['payment_out'].sum().astype(int).to_dict(),
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
        "avatar_change_reason":        avatar_change_reason,
        "avatar_change_reason_month":   avatar_change_reason_month,
        "weekly_avatar":               weekly_avatar,
    }


def get_avatar_room_data(user_id: int, year: int = None, month: int = None):
    now = datetime.now()
    target_year  = year  if year  else now.year
    target_month = month if month else now.month

    first_day_obj  = datetime(target_year, target_month, 1)
    last_day_num   = calendar.monthrange(target_year, target_month)[1]
    last_day_obj   = datetime(target_year, target_month, last_day_num)
    adjusted_first = first_day_obj.weekday()
    start_str      = first_day_obj.strftime("%Y-%m-%d")
    end_str        = last_day_obj.strftime("%Y-%m-%d")
    # DATE() 함수 없이 범위 비교하기 위한 다음날 자정
    end_exclusive  = (last_day_obj + timedelta(days=1)).strftime("%Y-%m-%d")
    # avatar 쿼리: YEAR()/MONTH() 대신 범위 비교
    next_month_first = (last_day_obj + timedelta(days=1)).strftime("%Y-%m-%d")

    def classify_time(t):
        if t is None: return '기타'
        if isinstance(t, timedelta): hour = int(t.total_seconds() // 3600)
        else:
            try: hour = int(str(t)[:2])
            except (ValueError, TypeError): return '기타'
        if 0 <= hour < 5:    return '새벽'
        elif 5 <= hour < 10: return '아침'
        elif 10 <= hour < 15: return '점심'
        elif 15 <= hour < 20: return '저녁'
        else:                 return '심야'

    def classify_week(d):
        if d is None: return '기타'
        if not hasattr(d, 'day'):
            try: d = datetime.strptime(str(d)[:10], "%Y-%m-%d")
            except (ValueError, TypeError): return '기타'
        return f'{(d.day + adjusted_first - 1) // 7 + 1}주'

    # ── 5개 쿼리 병렬 실행 (사진 관련 쿼리 먼저 submit) ─────────────
    def _q_vlm_batch():
        try:
            df = pd.read_sql(text("""
                SELECT
                    pvr.vlm_item_name  AS item_name,
                    COALESCE(cm.category_name, '기타') AS category,
                    pvr.vlm_store_name AS store_name,
                    pvr.vlm_store_type AS store_type,
                    DATE(pm.taken_at)  AS taken_date
                FROM persona_transaction pt
                JOIN photo_metadata pm     ON pt.photo_id = pm.photo_id
                JOIN photo_vlm_results pvr ON pt.vlm_id = pvr.vlm_id
                LEFT JOIN transactions t   ON pt.payment_id = t.payment_id
                LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
                WHERE pt.user_id = :user_id
                  AND pm.taken_at >= :start AND pm.taken_at < :end
            """), engine, params={"user_id": user_id, "start": start_str, "end": end_exclusive})
            if not df.empty:
                df['taken_date'] = pd.to_datetime(df['taken_date']).dt.date
            return df
        except Exception as e:
            print(f"[VLM SCENE ERROR] {e}")
            return pd.DataFrame()

    def _q_all_mapped():
        try:
            return pd.read_sql(text("""
                SELECT DISTINCT pt.photo_id, DATE(pm.taken_at) AS taken_date
                FROM persona_transaction pt
                JOIN photo_metadata pm ON pt.photo_id = pm.photo_id
                WHERE pt.user_id = :user_id
                  AND pm.taken_at >= :start AND pm.taken_at < :end
            """), engine, params={"user_id": user_id, "start": start_str, "end": end_exclusive})
        except Exception:
            return pd.DataFrame()

    def _q_emotion():
        try:
            return pd.read_sql(text("""
                SELECT MAX(pm.taken_at) AS taken_at, et.emoji
                FROM (SELECT DISTINCT photo_id FROM persona_transaction WHERE user_id = :user_id) pt
                JOIN photo_metadata pm ON pt.photo_id = pm.photo_id
                JOIN emotions_text et  ON pt.photo_id = et.photo_id
                WHERE pm.taken_at >= :start AND pm.taken_at < :end
                  AND et.emoji IS NOT NULL AND et.emoji != ''
                GROUP BY pt.photo_id, et.emoji
            """), engine, params={"user_id": user_id, "start": start_str, "end": end_exclusive})
        except Exception:
            return pd.DataFrame()

    def _q_transactions():
        return pd.read_sql(text("""
            SELECT
                COALESCE(cm.category_name, '기타') AS payment_category,
                t.payment_time,
                t.payment_date,
                t.payment_out
            FROM transactions t
            LEFT JOIN category_master cm ON t.payment_category_id = cm.payment_category_id
            WHERE t.user_id = :user_id
              AND t.payment_date BETWEEN :start AND :end
              AND t.payment_out > 0
        """), engine, params={"user_id": user_id, "start": start_str, "end": end_str})

    def _q_avatar():
        try:
            return pd.read_sql(text("""
                SELECT avatar_name, avatar_img_url, avatar_change_reason, avatar_explain, avatar_created_at
                FROM avatar
                WHERE user_id = :user_id
                  AND avatar_created_at >= :start AND avatar_created_at < :end
                ORDER BY avatar_created_at ASC
            """), engine, params={"user_id": user_id, "start": start_str, "end": next_month_first})
        except Exception:
            return pd.DataFrame()

    with ThreadPoolExecutor(max_workers=5) as executor:
        # 사진 관련 쿼리(무거운 것) 먼저 submit
        fut_vlm     = executor.submit(_q_vlm_batch)
        fut_mapped  = executor.submit(_q_all_mapped)
        fut_emotion = executor.submit(_q_emotion)
        fut_tx      = executor.submit(_q_transactions)
        fut_avatar  = executor.submit(_q_avatar)

        _month_vlm_df = fut_vlm.result()
        all_mapped_df = fut_mapped.result()
        emotion_df    = fut_emotion.result()
        df            = fut_tx.result()
        cr_df         = fut_avatar.result()

    if df.empty:
        return {
            "has_transactions":         False,
            "week_order":               [],
            "weekly_avatar":            {},
            "avatar_change_reason":     None,
            "weekly_category_price":    {},
            "weekly_timepattern_price": {},
            "weekly_top_emotion":       {},
            "persona_vlm_scene":        {},
        }

    df['time_label'] = df['payment_time'].apply(classify_time)
    df['week_label'] = df['payment_date'].apply(classify_week)

    total_weeks = (last_day_num + adjusted_first - 1) // 7 + 1
    week_order  = [f'{i}주' for i in range(1, total_weeks + 1)]

    weekly_category_price    = {}
    weekly_timepattern_price = {}
    for week in week_order:
        wdf = df[df['week_label'] == week]
        weekly_category_price[week]    = wdf.groupby('payment_category')['payment_out'].sum().astype(int).to_dict() if not wdf.empty else {}
        weekly_timepattern_price[week] = wdf.groupby('time_label').size().astype(int).to_dict() if not wdf.empty else {}

    # 병렬 결과로 avatar 처리
    avatar_change_reason = None
    last_created_at      = None
    if not cr_df.empty:
        avatar_change_reason = cr_df.iloc[-1]['avatar_change_reason']
        last_created_at      = cr_df.iloc[-1]['avatar_created_at']

    if last_created_at is not None and pd.notna(last_created_at):
        avatar_date = pd.to_datetime(last_created_at).date()
        week_num    = (avatar_date.day + adjusted_first - 1) // 7 + 1 - 1
    else:
        from zoneinfo import ZoneInfo
        today_obj = datetime.now(ZoneInfo("Asia/Seoul")).date()
        week_num  = (today_obj.day + adjusted_first - 1) // 7 + 1 - 1

    if week_num < 1:
        prev_m    = target_month - 1 if target_month > 1 else 12
        prev_y    = target_year if target_month > 1 else target_year - 1
        prev_last = calendar.monthrange(prev_y, prev_m)[1]
        prev_monday = datetime(prev_y, prev_m, 1).date()
        prev_sunday = datetime(prev_y, prev_m, prev_last).date()
    else:
        w_start_day = max(1, (week_num - 1) * 7 - adjusted_first + 1)
        w_end_day   = min(last_day_num, week_num * 7 - adjusted_first)
        prev_monday = datetime(target_year, target_month, w_start_day).date()
        prev_sunday = datetime(target_year, target_month, w_end_day).date()

    def scene_from_df(sdf, start_date, end_date):
        if sdf.empty: return {}
        sub = sdf[(sdf['taken_date'] >= start_date) & (sdf['taken_date'] <= end_date)]
        if sub.empty: return {}
        cat_items = {}
        for _, row in sub.dropna(subset=['category', 'item_name']).iterrows():
            cat_items.setdefault(row['category'], [])
            if row['item_name'] not in cat_items[row['category']]:
                cat_items[row['category']].append(row['item_name'])
        return {
            "total_count":       len(sub),
            "store_type_counts": sdf['store_type'].dropna().value_counts().to_dict(),
            "top_items":         sub['item_name'].dropna().unique().tolist()[:5],
            "category_items":    {k: v[:2] for k, v in cat_items.items()},
            "category_counts":   sub['category'].value_counts().to_dict(),
        }

    persona_vlm_scene = scene_from_df(_month_vlm_df, prev_monday, prev_sunday)

    weekly_avatar = {}
    for _, row in cr_df.iterrows():
        created_at = row['avatar_created_at']
        if pd.notna(created_at):
            av_wn = (pd.to_datetime(created_at).day + adjusted_first - 1) // 7 + 1
            pv_wn = av_wn - 1
            if pv_wn >= 1:
                ws = max(1, (pv_wn - 1) * 7 - adjusted_first + 1)
                we = min(last_day_num, pv_wn * 7 - adjusted_first)
                scene_start = datetime(target_year, target_month, ws).date()
                scene_end   = datetime(target_year, target_month, we).date()
            else:
                pm_ = target_month - 1 if target_month > 1 else 12
                py_ = target_year if target_month > 1 else target_year - 1
                scene_start = datetime(py_, pm_, 1).date()
                scene_end   = datetime(py_, pm_, calendar.monthrange(py_, pm_)[1]).date()
            weekly_avatar[classify_week(created_at)] = {
                "avatar_img_url":       row['avatar_img_url'],
                "avatar_name":          row['avatar_name'],
                "avatar_change_reason": row['avatar_change_reason'],
                "avatar_explain":       row['avatar_explain'],
                "vlm_scene":            scene_from_df(_month_vlm_df, scene_start, scene_end),
            }

    # 병렬 결과로 emotion 처리
    weekly_top_emotion = {}
    try:
        if not all_mapped_df.empty:
            all_mapped_df['week_label'] = all_mapped_df['taken_date'].apply(classify_week)
        if not emotion_df.empty:
            emotion_df['taken_at']   = pd.to_datetime(emotion_df['taken_at'])
            emotion_df['week_label'] = emotion_df['taken_at'].dt.date.apply(classify_week)
            for week in week_order:
                week_em = emotion_df[emotion_df['week_label'] == week]
                if not week_em.empty:
                    counts   = week_em['emoji'].value_counts()
                    top_mood = pick_top_mood_name(zip(week_em['emoji'], week_em['taken_at']))
                    total    = len(all_mapped_df[all_mapped_df['week_label'] == week]) if not all_mapped_df.empty else len(week_em)
                    weekly_top_emotion[week] = {
                        "emoji":       MOOD_NAME_TO_EMOJI.get(top_mood, top_mood),
                        "top_count":   int(counts.max()),
                        "total_count": int(total),
                    }
    except Exception as e:
        print(f"[EMOTION ERROR] {e}")

    return {
        "has_transactions":         True,
        "week_order":               week_order,
        "weekly_avatar":            weekly_avatar,
        "avatar_change_reason":     avatar_change_reason,
        "weekly_category_price":    weekly_category_price,
        "weekly_timepattern_price": weekly_timepattern_price,
        "weekly_top_emotion":       weekly_top_emotion,
        "persona_vlm_scene":        persona_vlm_scene,
    }