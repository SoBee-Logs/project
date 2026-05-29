from sqlalchemy import text
import pandas as pd
import re
from app.services.lifecycle_service import engine
from app.models.schemas import AiInsightContent, AiInsightItem, AiInsightResponse, BenefitGroup, BenefitLine

# category_master.category_name → card_benefits.cate_name 매핑
CATEGORY_TO_CATE: dict[str, list[str]] = {
    '식비':       ['일반음식점', '푸드', '패밀리레스토랑', '패스트푸드', '배달앱'],
    '카페/간식':  ['카페', '카페/디저트', '베이커리'],
    '온라인쇼핑': ['온라인쇼핑', '소셜커머스', '간편결제'],
    '패션/쇼핑':  ['쇼핑', '백화점', '아울렛'],
    '교통':       ['교통', '대중교통', '택시', '기차', '고속버스', '자동차/하이패스', '하이패스'],
    '여행/숙박':  ['여행/숙박', '항공권', '호텔', '면세점', '항공마일리지', '리조트'],
    '문화/여가':  ['영화', 'OTT/영화/문화', '공연/전시', '테마파크', '경기관람', '레저/스포츠'],
    '술/유흥':    ['푸드', '생활'],
    '의료/건강':  ['병원/약국', '병원', '약국', '드럭스토어'],
    '뷰티/미용':  ['뷰티/피트니스', '헤어', '화장품'],
    '주거/통신':  ['통신', 'KT', 'SKT', 'LGU+', '공과금/렌탈'],
    '교육/학습':  ['교육/육아', '학원', '학습지', '어린이집', '유치원'],
    '금융':       ['금융', '은행사', '증권사', '보험사'],
    '경조/선물':  ['쇼핑', '생활'],
    '생활':       ['대형마트', '마트/편의점', '편의점', 'SSM'],
    '기타':       ['모든가맹점'],
}

LIFE_STAGE_KO = {
    'TEEN':       '십대',
    'UNI':        '대학생',
    'NEW_JOB':    '사회초년생',
    'NEW_WED':    '신혼부부',
    'CHILD_BABY': '영유아 자녀',
    'CHILD_TEEN': '자녀 의무교육',
    'CHILD_UNI':  '자녀 대학생',
    'GOLLIFE':    '중년',
    'SECLIFE':    '2nd Life',
    'RETIR':      '은퇴',
}

LIFE_STAGE_SAVE_TRM = {
    'TEEN':       6,
    'UNI':        12,
    'NEW_JOB':    12,
    'NEW_WED':    24,
    'CHILD_BABY': 36,
    'CHILD_TEEN': 36,
    'CHILD_UNI':  24,
    'GOLLIFE':    24,
    'SECLIFE':    12,
    'RETIR':      12,
}

CHILD_STAGES = {'TEEN', 'CHILD_BABY', 'CHILD_TEEN', 'CHILD_UNI'}
CHILD_KEYWORDS = '키즈|아이|어린이|주니어|청소년|영유아|태아|baby|kids|junior'


def _strip_html(html: str | None) -> str | None:
    if not html:
        return None
    text_val = re.sub(r'(?is)<style[^>]*>.*?</style>', '', html)
    text_val = re.sub(r'<[^>]+>', '', text_val)
    text_val = text_val.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')
    text_val = re.sub(r'(?i)Powered\s+by\s*[\r\n\s]*Froala\s+Editor', '', text_val)
    text_val = re.sub(r'[ \t]+', ' ', text_val)
    text_val = re.sub(r'(\r?\n){3,}', '\n\n', text_val)
    return text_val.strip() or None


def _query_card(cate_names: list[str], top_category: str) -> AiInsightItem | None:
    placeholders = ', '.join(f':c{i}' for i in range(len(cate_names)))
    params = {f'c{i}': v for i, v in enumerate(cate_names)}
    df = pd.read_sql(text(f"""
        SELECT ci.card_info_id, ci.card_name, ci.corp_name, ci.card_img_url, ci.gorilla_id,
               ci.annual_fee_basic, ci.annual_fee_detail, ci.only_online, ci.is_impend
        FROM card_info ci
        WHERE ci.card_info_id IN (
            SELECT DISTINCT cb.card_info_id FROM card_benefits cb WHERE cb.cate_name IN ({placeholders})
        )
          AND ci.card_img_url IS NOT NULL
          AND ci.is_discontinued = 0
        ORDER BY RAND()
        LIMIT 1
    """), engine, params=params)

    if df.empty:
        df = pd.read_sql(text("""
            SELECT ci.card_info_id, ci.card_name, ci.corp_name, ci.card_img_url, ci.gorilla_id,
                   ci.annual_fee_basic, ci.annual_fee_detail, ci.only_online, ci.is_impend
            FROM card_info ci
            WHERE ci.card_info_id IN (
                SELECT DISTINCT cb.card_info_id FROM card_benefits cb WHERE cb.cate_name = '모든가맹점'
            )
              AND ci.card_img_url IS NOT NULL
              AND ci.is_discontinued = 0
            ORDER BY RAND()
            LIMIT 1
        """), engine)

    if df.empty:
        return None

    r = df.iloc[0]
    card_info_id = int(r['card_info_id'])
    gorilla_id = r['gorilla_id']
    card_url = f"https://www.card-gorilla.com/card/detail/{gorilla_id}" if gorilla_id else None
    reason = f"이번 달 {top_category} 지출이 많아 관련 혜택 카드를 추천해요"

    benefits_df = pd.read_sql(text("""
        SELECT cate_name, title, comment FROM card_benefits
        WHERE card_info_id = :card_info_id AND (is_notice = 0 OR is_notice IS NULL)
        ORDER BY card_ben_id
    """), engine, params={"card_info_id": card_info_id})

    benefit_groups = []
    if not benefits_df.empty:
        for cate, group in benefits_df.groupby('cate_name', sort=False):
            lines = [
                BenefitLine(
                    title=row['title'] if pd.notna(row['title']) else None,
                    comment=row['comment'] if pd.notna(row['comment']) else None,
                )
                for _, row in group.iterrows()
                if pd.notna(row['title'])
            ]
            if lines:
                benefit_groups.append(BenefitGroup(cateName=str(cate), lines=lines))

    top_title = benefits_df.iloc[0]['title'] if not benefits_df.empty and pd.notna(benefits_df.iloc[0]['title']) else None
    annual_fee_basic = r['annual_fee_basic'] if pd.notna(r['annual_fee_basic']) else None
    annual_fee_detail = _strip_html(r['annual_fee_detail'] if pd.notna(r['annual_fee_detail']) else None)

    return AiInsightItem(
        product_name=r['card_name'],
        product_company=r['corp_name'],
        product_img_url=r['card_img_url'] or None,
        product_type='card',
        reason=reason,
        content=AiInsightContent(
            header=top_title,
            middle=f"연회비 {annual_fee_basic}" if annual_fee_basic else None,
            url=card_url,
            benefitGroups=benefit_groups if benefit_groups else None,
            annualFeeDetail=annual_fee_detail,
            onlyOnline=bool(r['only_online']) if pd.notna(r['only_online']) else None,
            isImpend=bool(r['is_impend']) if pd.notna(r['is_impend']) else None,
        ),
    )


def _query_savings(save_trm: int = 12, life_stage_code: str | None = None) -> AiInsightItem | None:
    is_child_stage = life_stage_code in CHILD_STAGES
    cols = "fin_prdt_nm, kor_co_nm, intr_rate, intr_max_rate, save_trm, spcl_cnd, intr_rate_type, join_way, join_member, etc_note, mtrt_int"
    if is_child_stage:
        df = pd.read_sql(text(f"""
            SELECT {cols} FROM (
                SELECT {cols} FROM savings_products
                WHERE save_trm = :save_trm
                ORDER BY intr_max_rate DESC
                LIMIT 5
            ) AS top5
            ORDER BY RAND() LIMIT 1
        """), engine, params={"save_trm": save_trm})
    else:
        df = pd.read_sql(text(f"""
            SELECT {cols} FROM (
                SELECT {cols} FROM savings_products
                WHERE save_trm = :save_trm
                  AND fin_prdt_nm NOT REGEXP :child_kw
                ORDER BY intr_max_rate DESC
                LIMIT 5
            ) AS top5
            ORDER BY RAND() LIMIT 1
        """), engine, params={"save_trm": save_trm, "child_kw": CHILD_KEYWORDS})

    if df.empty:
        return None

    r = df.iloc[0]
    stage_ko = LIFE_STAGE_KO.get(life_stage_code, '회원')
    reason = f"{stage_ko}에게 맞는 {r['save_trm']}개월 적금 상품이에요 (최고 연 {r['intr_max_rate']}%)"

    def _s(val): return str(val) if pd.notna(val) else None

    intr_rate_str = f"{r['intr_rate']}%" if pd.notna(r['intr_rate']) else None
    intr_max_rate_str = f"{r['intr_max_rate']}%" if pd.notna(r['intr_max_rate']) else None

    return AiInsightItem(
        product_name=r['fin_prdt_nm'],
        product_company=r['kor_co_nm'],
        product_img_url=None,
        product_type='savings',
        reason=reason,
        content=AiInsightContent(
            header=f"우대금리 최대 {intr_max_rate_str}" if intr_max_rate_str else None,
            middle=f"{r['save_trm']}개월" if pd.notna(r['save_trm']) else None,
            small=_s(r['spcl_cnd']),
            intrRate=intr_rate_str,
            intrRateType=_s(r['intr_rate_type']),
            joinWay=_s(r['join_way']),
            joinMember=_s(r['join_member']),
            etcNote=_s(r['etc_note']),
            mtrtInt=_s(r['mtrt_int']),
        ),
    )


async def get_ai_insight(user_id: int, category_price: dict) -> AiInsightResponse:
    """
    ✅ report_service에서 이미 계산된 category_price를 받아서 사용
       — DB 트랜잭션 중복 조회 없음
    """
    df_user = pd.read_sql(text("""
        SELECT life_stage_code FROM users WHERE user_id = :user_id
    """), engine, params={"user_id": user_id})
    life_stage_code = df_user['life_stage_code'].iloc[0] if not df_user.empty else None
    if pd.isna(life_stage_code) if life_stage_code is not None else True:
        life_stage_code = None

    top_category = '기타'
    cate_names = ['모든가맹점']
    if category_price:
        top_category = max(category_price, key=category_price.get)
        cate_names = CATEGORY_TO_CATE.get(top_category, ['모든가맹점'])

    card_item = _query_card(cate_names, top_category)

    save_trm = LIFE_STAGE_SAVE_TRM.get(life_stage_code, 12)
    savings_item = _query_savings(save_trm, life_stage_code)

    items = [x for x in [card_item, savings_item] if x is not None]

    message = None
    if not life_stage_code:
        message = '생애주기 분석이 되지 않아 일반 추천을 드려요'

    return AiInsightResponse(recommned=items, message=message)