from sqlalchemy import text
import pandas as pd
import re
import random
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

# 카드 추천 이유 템플릿 — {cat}: 카테고리, {amt}: 지출액, {title}: 혜택 제목
_CARD_T_RELATED = [
    "{cat}에 쓰신 만큼, {matched_cate} 혜택으로 '{title}'까지 돌려받을 수 있어요.",
    "{cat} 소비가 있으셨군요. {matched_cate} 혜택은 물론 '{title}'도 챙길 수 있는 카드예요.",
    "{cat}에 {amt}원 쓰셨는데, {matched_cate} 혜택과 '{title}'까지 한 번에 받을 수 있어요.",
    "{cat} 지출이 있으시다면, {matched_cate} 혜택으로 '{title}'까지 알뜰하게 챙겨보세요.",
    "{cat}에 {amt}원 쓰신 만큼 {matched_cate} 혜택으로 돌려받고, '{title}'도 덤으로 누릴 수 있어요.",
]

_CARD_T_RELATED_NO_TITLE = [
    "{cat}에 쓰신 만큼 {matched_cate} 혜택으로 조금씩 돌려받을 수 있어요.",
    "{cat} 소비가 있으셨군요. {matched_cate} 혜택이 잘 맞는 카드예요.",
    "{cat}에 {amt}원 쓰셨는데, {matched_cate} 관련 혜택 카드 어떠세요?",
    "{cat} 지출이 있으시다면 {matched_cate} 혜택을 한번 살펴보세요.",
]

_CARD_T = {
    "amt_title": [
        "{cat}에 {amt}원 쓰셨는데, '{title}' 혜택으로 조금씩 돌려받을 수 있어요.",
        "{cat} 지출이 {amt}원이나 됐군요. '{title}' 혜택으로 실속을 챙겨보세요.",
        "이번 달 {cat}에 {amt}원 쓰셨다면, '{title}' 혜택이 있는 이 카드가 딱이에요.",
        "{cat}에 {amt}원 쓰신 만큼, '{title}' 혜택으로 알뜰하게 되돌려 받을 수 있어요.",
        "{cat}에 {amt}원 쓰셨는데, '{title}' 혜택까지 챙길 수 있는 카드예요.",
        "매달 {cat}에 {amt}원 정도 쓰신다면, '{title}' 혜택으로 꽤 쏠쏠하게 돌아올 거예요.",
    ],
    "title_only": [
        "{cat} 지출이 있으시다면, '{title}' 혜택으로 쓸 때마다 실속을 챙길 수 있어요.",
        "{cat} 쓸 때마다 '{title}' 혜택이 돌아오는 카드예요.",
        "{cat} 혜택을 찾고 계셨다면, '{title}'까지 챙길 수 있는 이 카드를 추천해요.",
        "{cat}에 쓸 때마다 '{title}' 혜택이 자동으로 적용돼요.",
        "{cat} 소비에 '{title}' 혜택이 딱 맞는 카드예요.",
        "{cat} 자주 쓰신다면, '{title}' 혜택으로 매번 실속을 챙길 수 있어요.",
    ],
    "amt_only": [
        "{cat}에 {amt}원 쓰셨는데, 이 카드로 바꾸면 쓸 때마다 혜택이 돌아와요.",
        "{cat}에 {amt}원이나 쓰셨군요. 혜택 없이 그냥 쓰기엔 아까운 금액이에요.",
        "이번 달 {cat}에 {amt}원 쓰셨다면, 다음 달엔 이 카드로 좀 더 알뜰하게 쓸 수 있어요.",
        "{cat} 지출이 {amt}원이네요. 관련 혜택이 쏠쏠한 카드예요.",
        "어차피 계속 쓸 {cat}이라면, {amt}원 쓸 때마다 혜택을 챙기는 게 낫지 않을까요?",
    ],
    "none": [
        "{cat} 지출이 있으시다면, 관련 혜택으로 쓸 때마다 조금씩 돌려받을 수 있어요.",
        "{cat} 쪽 혜택이 잘 갖춰진 카드예요.",
        "{cat} 자주 쓰신다면 이 카드 하나로 꽤 알뜰해질 수 있어요.",
        "{cat} 지출에 맞는 혜택이 있어서, 쓸수록 더 이득인 카드예요.",
        "{cat} 쓸 때마다 혜택을 챙기고 싶다면 한번 써보세요.",
    ],
}

# 적금 추천 이유 템플릿 — {trm}: 개월, {rate}: 금리
_SAVINGS_T = {
    'TEEN': [
        "용돈 조금씩 모으다 보면 어느새 목돈이 돼 있을 거예요! {trm}개월에 최고 연 {rate}%예요.",
        "지금부터 시작하면 나중에 진짜 달라요. {trm}개월 적금 한번 도전해봐요!",
        "모아두면 언젠간 쓸 일이 생기더라고요. {trm}개월에 최고 {rate}%, 나쁘지 않죠?",
        "10대 때 적금 시작하면 친구들한테 자랑할 수 있어요 ㅎㅎ {trm}개월에 최고 연 {rate}%예요!",
    ],
    'UNI': [
        "학생 때 시작하면 나중에 진짜 뿌듯해요. {trm}개월에 최고 연 {rate}%예요!",
        "알바비 조금씩 모아두면 졸업할 때 목돈 생겨 있을 거예요. {trm}개월짜리예요!",
        "학비 걱정 조금은 덜어낼 수 있어요. {trm}개월에 최고 {rate}%, 꽤 짭짤해요!",
        "대학생 때 적금 하나 만들어두면 나중에 진짜 잘했다 싶을 거예요. {trm}개월 강추해요!",
    ],
    'NEW_JOB': [
        "첫 월급이잖아요! 이참에 적금 하나 만들어보는 거 어때요? {trm}개월에 최고 연 {rate}%예요.",
        "사회초년생 때 시작하는 적금, 나중에 진짜 뿌듯해요. {trm}개월 동안 모아봐요!",
        "첫 직장, 첫 적금! 월급 들어오면 바로 이체해두면 {trm}개월 후에 목돈 생겨요.",
        "이제 돈 모을 때가 됐죠! {trm}개월에 최고 {rate}% 금리, 지금 딱이에요.",
        "사회 나온 기념으로 적금 하나 시작해봐요. {trm}개월에 최고 연 {rate}%, 진짜 알차요!",
    ],
    'NEW_WED': [
        "둘이 같이 모으면 진짜 빨라요. 함께 목돈 만들어봐요! {trm}개월에 최고 연 {rate}%예요.",
        "신혼 때 시작하는 적금, 나중에 진짜 잘했다 싶을 거예요. {trm}개월짜리 강추해요!",
        "내 집 마련 꿈꾸고 있다면 지금부터 차근차근 모아야죠. {trm}개월에 최고 {rate}%예요.",
        "둘이 조금씩 모으면 {trm}개월 후엔 제법 목돈 생겨요. 최고 연 {rate}% 금리예요!",
        "신혼 살림에 목돈이 하나 있으면 진짜 든든하거든요. {trm}개월 같이 모아봐요!",
    ],
    'CHILD_BABY': [
        "아이 이름으로 하나 만들어두면 나중에 정말 든든하더라고요! {trm}개월에 최고 연 {rate}%예요.",
        "우리 아이 미래를 위해 조금씩 모아두는 거, 나중에 정말 잘했다 싶을 거예요. {trm}개월짜리예요!",
        "아이가 크면 돈 쓸 일이 많아지더라고요. 지금부터 {trm}개월 동안 미리 모아봐요!",
        "아이 선물은 지금 이 적금이에요. {trm}개월에 최고 {rate}%, 든든하게 쌓아줘요!",
    ],
    'CHILD_TEEN': [
        "교육비는 미리 준비할수록 나중이 편해요. 지금이 딱이에요! {trm}개월에 최고 연 {rate}%예요.",
        "학원비, 생각보다 많이 들죠. 이 적금으로 미리미리 준비해봐요. {trm}개월짜리예요!",
        "아이 교육비 걱정된다면 지금부터 조금씩 모아두는 게 맞아요. 최고 {rate}%예요!",
        "중고등학교 때부터 교육비가 본격적으로 들어가더라고요. {trm}개월에 최고 연 {rate}% 강추해요!",
    ],
    'CHILD_UNI': [
        "등록금 생각하면 지금부터 조금씩 모아두는 게 맞아요! {trm}개월에 최고 연 {rate}%예요.",
        "대학 등록금이 진짜 큰돈이잖아요. 이 적금으로 준비해두는 거 어때요? {trm}개월이에요!",
        "미리 준비해두면 그때 가서 훨씬 여유로워요. 최고 {rate}% 금리, 나쁘지 않죠?",
        "아이 대학 입학 전에 이 적금 하나 마무리해두면 진짜 든든해요. {trm}개월짜리예요!",
    ],
    'GOLLIFE': [
        "노후 준비, 사실 빠를수록 좋거든요. 지금 딱 좋은 타이밍이에요! {trm}개월에 최고 연 {rate}%예요.",
        "든든한 노후를 위해 지금 시작해봐요. {trm}개월 동안 모으면 생각보다 많이 쌓여요!",
        "나중에 후회하지 않으려면 지금이 기회예요. {trm}개월에 최고 {rate}% 금리예요.",
        "노후 자금, 지금 시작하는 사람이 진짜 현명한 사람이에요. {trm}개월에 최고 연 {rate}% 강추해요!",
    ],
    'SECLIFE': [
        "새 출발 준비 중이시군요! 차근차근 모아가다 보면 든든해질 거예요. {trm}개월에 최고 연 {rate}%예요.",
        "새로운 시작을 위한 자금 마련, 지금부터 해봐요. {trm}개월짜리 적금 강추해요!",
        "제2의 인생을 위한 든든한 준비, 이 적금이 딱이에요. 최고 {rate}% 금리예요!",
        "새 출발엔 든든한 자금이 필요하죠. {trm}개월 동안 알차게 모아봐요!",
    ],
    'RETIR': [
        "여유롭게 지내려면 이런 안정적인 상품이 딱이에요! {trm}개월에 최고 연 {rate}%예요.",
        "은퇴 후엔 안정이 최고죠. {trm}개월 동안 안전하게 굴려봐요. 최고 {rate}% 금리예요!",
        "여유 자금 묵혀두기엔 아깝잖아요. {trm}개월에 최고 {rate}%, 알뜰하게 운용해봐요!",
        "편안한 노후를 위한 안심 적금이에요. {trm}개월에 최고 연 {rate}%, 믿을 수 있어요!",
    ],
}

_FV = "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.{}&size=256"
COMPANY_LOGO_MAP: dict[str, str] = {
    # 은행
    "경남은행":               _FV.format("knbank.co.kr"),
    "광주은행":               _FV.format("kjbank.com"),
    "국민은행":               "https://www.kbstar.com/openimg/favi_ipad_n201512.png",
    "농협은행주식회사":        _FV.format("nonghyup.com"),
    "부산은행":               _FV.format("busanbank.co.kr"),
    "수협은행":               "https://www.suhyup.co.kr/Web-home/_UI/images/suhyup.jpg",
    "신한은행":               _FV.format("shinhan.com"),
    "아이엠뱅크":             "https://www.imbank.co.kr/img/fnm/imbank.png",
    "우리은행":               _FV.format("wooribank.com"),
    "전북은행":               _FV.format("jbbank.co.kr"),
    "제주은행":               "https://www.jejubank.co.kr/hmpg/images/comm/jeju_bank_thumbnail.png",
    "주식회사 카카오뱅크":    "https://www.kakaobank.com/view/images/kkb_og_img.png",
    "주식회사 케이뱅크":      "https://www.kbanknow.com/resource/img/favicon.svg",
    "주식회사 하나은행":      "https://www.hanabank.com/apple-touch-icon.png",
    "중소기업은행":           "https://www.ibk.co.kr/img/common/ic_bm_ios.png",
    "토스뱅크 주식회사":      _FV.format("tossbank.com"),
    "한국산업은행":           _FV.format("kdb.co.kr"),
    "한국스탠다드차타드은행": _FV.format("standardchartered.co.kr"),
    # 보험사
    "NH농협생명":             _FV.format("nhlife.co.kr"),
    "교보라이프플래닛":       _FV.format("kyobolifeplanet.com"),
    "교보생명":               _FV.format("kyobo.co.kr"),
    "메트라이프":             _FV.format("metlife.co.kr"),
    "삼성화재":               _FV.format("samsungfire.com"),
    "신한라이프":             "https://www.shinhanlife.co.kr/resources/images/fav/favicon_ci_shinhan_30.svg",
    "카카오페이손해보험":      _FV.format("kakaopayins.com"),
    "캐롯손해보험":           "https://www.carrotins.com/static/images/share/new-official-v2.png",
}


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


def _query_card(cate_names: list[str], top_category: str, top_amount: int = 0) -> AiInsightItem | None:
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
    card_url = f"https://www.card-gorilla.com/card/detail/{gorilla_id}" if (gorilla_id and pd.notna(gorilla_id)) else None
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

    # 매칭 카테고리 혜택 title 우선 사용, 없으면 첫 번째 혜택
    matching_title = None
    matched_cate = None
    for _, row in benefits_df.iterrows():
        if row['cate_name'] in cate_names and pd.notna(row['title']):
            matching_title = row['title']
            matched_cate = row['cate_name']
            break
    top_title = matching_title or (
        benefits_df.iloc[0]['title'] if not benefits_df.empty and pd.notna(benefits_df.iloc[0]['title']) else None
    )
    annual_fee_basic = r['annual_fee_basic'] if pd.notna(r['annual_fee_basic']) else None
    annual_fee_detail = _strip_html(r['annual_fee_detail'] if pd.notna(r['annual_fee_detail']) else None)

    # 상위 카테고리(사용자 지출)와 하위 카테고리(카드 혜택)가 다를 때 연결 문구 사용
    if matched_cate and matched_cate != top_category:
        if top_title and top_title != matched_cate:
            reason = random.choice(_CARD_T_RELATED).format(
                cat=top_category, matched_cate=matched_cate,
                amt=f"{top_amount:,}", title=top_title,
            )
        else:
            reason = random.choice(_CARD_T_RELATED_NO_TITLE).format(
                cat=top_category, matched_cate=matched_cate, amt=f"{top_amount:,}",
            )
    elif top_amount > 0 and top_title:
        if top_title == top_category:
            reason = random.choice(_CARD_T["amt_only"]).format(cat=top_category, amt=f"{top_amount:,}")
        else:
            reason = random.choice(_CARD_T["amt_title"]).format(cat=top_category, amt=f"{top_amount:,}", title=top_title)
    elif top_title:
        if top_title == top_category:
            reason = random.choice(_CARD_T["none"]).format(cat=top_category)
        else:
            reason = random.choice(_CARD_T["title_only"]).format(cat=top_category, title=top_title)
    elif top_amount > 0:
        reason = random.choice(_CARD_T["amt_only"]).format(cat=top_category, amt=f"{top_amount:,}")
    else:
        reason = random.choice(_CARD_T["none"]).format(cat=top_category)

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
    templates = _SAVINGS_T.get(life_stage_code, [
        f"{stage_ko}한테 딱 맞는 적금이에요. {{trm}}개월에 최고 연 {{rate}}%, 한번 시작해봐요!"
    ])
    spcl = str(r['spcl_cnd']).strip() if pd.notna(r['spcl_cnd']) else None
    base = random.choice(templates).format(trm=r['save_trm'], rate=r['intr_max_rate'])
    if spcl and len(spcl) <= 50:
        reason = f"{base} {spcl} 조건 맞추면 우대금리도 챙길 수 있어요!"
    else:
        reason = base

    def _s(val): return str(val) if pd.notna(val) else None

    intr_rate_str = f"{r['intr_rate']}%" if pd.notna(r['intr_rate']) else None
    intr_max_rate_str = f"{r['intr_max_rate']}%" if pd.notna(r['intr_max_rate']) else None

    return AiInsightItem(
        product_name=r['fin_prdt_nm'],
        product_company=r['kor_co_nm'],
        product_img_url=COMPANY_LOGO_MAP.get(r['kor_co_nm']),
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
    top_amount = 0
    card_item = None

    if category_price:
        # 지출 상위 순서대로 매칭 카드가 있을 때까지 시도
        sorted_cats = sorted(category_price.items(), key=lambda x: x[1], reverse=True)
        for cat_name, cat_amount in sorted_cats:
            cate_names = CATEGORY_TO_CATE.get(cat_name, [])
            if not cate_names or cate_names == ['모든가맹점']:
                continue
            candidate = _query_card(cate_names, cat_name, int(cat_amount))
            if candidate:
                card_item = candidate
                top_category = cat_name
                top_amount = int(cat_amount)
                break
        # 모든 카테고리에서 매칭 실패 시 전체 폴백
        if not card_item:
            top_category = sorted_cats[0][0] if sorted_cats else '기타'
            top_amount = int(sorted_cats[0][1]) if sorted_cats else 0
            card_item = _query_card(['모든가맹점'], top_category, top_amount)

    save_trm = LIFE_STAGE_SAVE_TRM.get(life_stage_code, 12)
    savings_item = _query_savings(save_trm, life_stage_code)

    items = [x for x in [card_item, savings_item] if x is not None]

    message = None
    if not life_stage_code:
        message = '생애주기 분석이 되지 않아 일반 추천을 드려요'

    return AiInsightResponse(recommned=items, message=message)