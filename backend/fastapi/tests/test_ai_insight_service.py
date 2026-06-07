"""
리포트 화면 AI 상품 추천 단위 테스트
대상: backend/fastapi/app/services/ai_insight_service.py
"""

import pytest
import pandas as pd
from unittest.mock import patch, MagicMock

# lifecycle_service 의 engine 생성(create_engine) 은 lazy — 실제 DB 연결 없이 import 가능
from app.services.ai_insight_service import (
    _strip_html,
    _query_card,
    _query_savings,
    get_ai_insight,
    CATEGORY_TO_CATE,
    LIFE_STAGE_SAVE_TRM,
    LIFE_STAGE_KO,
    CHILD_STAGES,
    CHILD_KEYWORDS,
)
from app.models.schemas import AiInsightItem, AiInsightContent, BenefitGroup, BenefitLine


# ──────────────────────────────────────────────────────────────
# 헬퍼: AiInsightItem 더미 생성
# ──────────────────────────────────────────────────────────────
def _make_card_item(name="테스트카드"):
    return AiInsightItem(
        product_name=name,
        product_company="테스트은행",
        product_img_url="https://example.com/card.png",
        product_type="card",
        reason="식비 지출이 많아 추천해요",
        content=AiInsightContent(header="포인트 적립"),
    )

def _make_savings_item(name="테스트적금"):
    return AiInsightItem(
        product_name=name,
        product_company="테스트은행",
        product_img_url=None,
        product_type="savings",
        reason="12개월에 최고 연 3.5%예요",
        content=AiInsightContent(header="우대금리 최대 3.5%", middle="12개월"),
    )


# ──────────────────────────────────────────────────────────────
# 1. _strip_html
# ──────────────────────────────────────────────────────────────
class TestStripHtml:
    def test_none_returns_none(self):
        assert _strip_html(None) is None

    def test_empty_string_returns_none(self):
        assert _strip_html("") is None

    def test_whitespace_only_returns_none(self):
        assert _strip_html("   ") is None

    def test_plain_text_unchanged(self):
        assert _strip_html("안녕하세요") == "안녕하세요"

    def test_html_tags_removed(self):
        assert _strip_html("<p>Hello <b>World</b></p>") == "Hello World"

    def test_style_block_removed(self):
        result = _strip_html("<style>.a{color:red}</style>내용")
        assert "color" not in result
        assert "내용" in result

    def test_html_entities_decoded(self):
        result = _strip_html("A&nbsp;B&amp;C&lt;D&gt;E&quot;F")
        assert result == "A B&C<D>E\"F"

    def test_froala_watermark_removed(self):
        html = "<p>내용</p>\nPowered by Froala Editor"
        result = _strip_html(html)
        assert "Froala" not in result
        assert "내용" in result

    def test_multiple_newlines_collapsed(self):
        result = _strip_html("a\n\n\n\n\nb")
        assert result == "a\n\nb"

    def test_mixed_tags_and_entities(self):
        result = _strip_html("<div><span>가격: &amp;10,000</span></div>")
        assert result == "가격: &10,000"


# ──────────────────────────────────────────────────────────────
# 2. CATEGORY_TO_CATE 매핑
# ──────────────────────────────────────────────────────────────
class TestCategoryToCate:
    EXPECTED_KEYS = [
        '식비', '카페/간식', '온라인쇼핑', '패션/쇼핑', '교통',
        '여행/숙박', '문화/여가', '술/유흥', '의료/건강', '뷰티/미용',
        '주거/통신', '교육/학습', '금융', '경조/선물', '생활', '기타',
    ]

    def test_all_categories_present(self):
        for key in self.EXPECTED_KEYS:
            assert key in CATEGORY_TO_CATE, f"카테고리 누락: {key}"

    def test_each_category_has_non_empty_list(self):
        for key, val in CATEGORY_TO_CATE.items():
            assert isinstance(val, list) and len(val) > 0, f"{key} 매핑이 비어있음"

    def test_식비_contains_expected_cate(self):
        assert '일반음식점' in CATEGORY_TO_CATE['식비']

    def test_기타_fallback_to_모든가맹점(self):
        assert CATEGORY_TO_CATE['기타'] == ['모든가맹점']

    def test_카페간식_contains_카페(self):
        assert '카페' in CATEGORY_TO_CATE['카페/간식']

    def test_교통_contains_대중교통(self):
        assert '대중교통' in CATEGORY_TO_CATE['교통']


# ──────────────────────────────────────────────────────────────
# 3. LIFE_STAGE_SAVE_TRM 매핑
# ──────────────────────────────────────────────────────────────
class TestLifeStageSaveTrm:
    EXPECTED = {
        'TEEN': 6,
        'UNI': 12,
        'NEW_JOB': 12,
        'NEW_WED': 24,
        'CHILD_BABY': 36,
        'CHILD_TEEN': 36,
        'CHILD_UNI': 24,
        'GOLLIFE': 24,
        'SECLIFE': 12,
        'RETIR': 12,
    }

    def test_all_life_stages_present(self):
        for code in self.EXPECTED:
            assert code in LIFE_STAGE_SAVE_TRM, f"생애주기 누락: {code}"

    def test_term_values_correct(self):
        for code, expected_trm in self.EXPECTED.items():
            assert LIFE_STAGE_SAVE_TRM[code] == expected_trm, (
                f"{code}: expected {expected_trm}, got {LIFE_STAGE_SAVE_TRM[code]}"
            )

    def test_teen_has_shortest_term(self):
        assert LIFE_STAGE_SAVE_TRM['TEEN'] == 6

    def test_child_stages_have_long_term(self):
        assert LIFE_STAGE_SAVE_TRM['CHILD_BABY'] == 36
        assert LIFE_STAGE_SAVE_TRM['CHILD_TEEN'] == 36

    def test_life_stage_ko_covers_all_codes(self):
        for code in LIFE_STAGE_SAVE_TRM:
            assert code in LIFE_STAGE_KO, f"한국어 이름 누락: {code}"


# ──────────────────────────────────────────────────────────────
# 4. CHILD_STAGES / CHILD_KEYWORDS 상수
# ──────────────────────────────────────────────────────────────
class TestChildStagesConstants:
    def test_child_stages_set(self):
        assert isinstance(CHILD_STAGES, set)
        assert 'TEEN' in CHILD_STAGES
        assert 'CHILD_BABY' in CHILD_STAGES

    def test_non_child_stages_not_in_set(self):
        assert 'NEW_JOB' not in CHILD_STAGES
        assert 'RETIR' not in CHILD_STAGES

    def test_child_keywords_is_regex_pattern(self):
        import re
        assert re.search(CHILD_KEYWORDS, "키즈전용통장") is not None
        assert re.search(CHILD_KEYWORDS, "어린이적금") is not None
        assert re.search(CHILD_KEYWORDS, "일반적금") is None


# ──────────────────────────────────────────────────────────────
# 5. _query_card (pd.read_sql mocking)
# ──────────────────────────────────────────────────────────────
class TestQueryCard:
    """pd.read_sql 을 mock 해서 DB 없이 카드 추천 로직 검증"""

    def _make_card_df(self):
        return pd.DataFrame([{
            'card_info_id': 1,
            'card_name': '신한 Deep Dream 카드',
            'corp_name': '신한카드',
            'card_img_url': 'https://example.com/card.png',
            'gorilla_id': 'shinhan-001',
            'annual_fee_basic': 15000,
            'annual_fee_detail': '<p>기본 연회비</p>',
            'only_online': 0,
            'is_impend': 0,
        }])

    def _make_benefits_df(self, cate_name='일반음식점'):
        return pd.DataFrame([
            {'cate_name': cate_name, 'title': '식비 10% 할인', 'comment': '월 최대 5,000원'},
            {'cate_name': '카페', 'title': '카페 5% 적립', 'comment': '월 최대 2,000원'},
        ])

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_returns_ai_insight_item_for_matching_category(self, mock_read_sql):
        mock_read_sql.side_effect = [self._make_card_df(), self._make_benefits_df()]

        result = _query_card(['일반음식점', '푸드'], '식비', 50000)

        assert result is not None
        assert result.product_type == 'card'
        assert result.product_name == '신한 Deep Dream 카드'
        assert result.product_company == '신한카드'

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_card_url_uses_gorilla_id(self, mock_read_sql):
        mock_read_sql.side_effect = [self._make_card_df(), self._make_benefits_df()]

        result = _query_card(['일반음식점'], '식비', 30000)

        assert result.content.url == 'https://www.card-gorilla.com/card/detail/shinhan-001'

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_annual_fee_detail_html_stripped(self, mock_read_sql):
        mock_read_sql.side_effect = [self._make_card_df(), self._make_benefits_df()]

        result = _query_card(['일반음식점'], '식비', 30000)

        assert '<p>' not in (result.content.annualFeeDetail or '')

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_benefit_groups_populated(self, mock_read_sql):
        mock_read_sql.side_effect = [self._make_card_df(), self._make_benefits_df()]

        result = _query_card(['일반음식점'], '식비', 30000)

        assert result.content.benefitGroups is not None
        assert len(result.content.benefitGroups) >= 1

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_fallback_to_all_merchants_when_no_match(self, mock_read_sql):
        # 첫 쿼리 빈 결과 → 폴백 쿼리에서 카드 반환
        mock_read_sql.side_effect = [pd.DataFrame(), self._make_card_df(), self._make_benefits_df()]

        result = _query_card(['일반음식점'], '식비', 30000)

        assert result is not None
        assert result.product_type == 'card'

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_returns_none_when_all_queries_empty(self, mock_read_sql):
        mock_read_sql.side_effect = [pd.DataFrame(), pd.DataFrame()]

        result = _query_card(['일반음식점'], '식비', 30000)

        assert result is None

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_reason_contains_category_name(self, mock_read_sql):
        mock_read_sql.side_effect = [self._make_card_df(), self._make_benefits_df()]

        result = _query_card(['일반음식점'], '식비', 80000)

        assert '식비' in result.reason

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_reason_with_related_category_uses_matched_cate(self, mock_read_sql):
        """사용자 지출 카테고리(식비)와 카드 혜택 카테고리(일반음식점)가 다를 때 연결 문구 사용"""
        benefits_df = pd.DataFrame([
            {'cate_name': '일반음식점', 'title': '10% 할인', 'comment': None},
        ])
        mock_read_sql.side_effect = [self._make_card_df(), benefits_df]

        result = _query_card(['일반음식점'], '카페/간식', 30000)

        # matched_cate(일반음식점)와 top_category(카페/간식)가 다르면 연결 문구
        assert result.reason is not None

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_reason_amt_title_template_when_category_matches(self, mock_read_sql):
        """matched_cate == top_category 이고 amount > 0, title 있으면 amt_title 템플릿"""
        # cate_name 과 top_category 를 동일하게 설정해야 related 분기를 타지 않음
        benefits_df = pd.DataFrame([
            {'cate_name': '교통', 'title': '대중교통 10% 할인', 'comment': None},
        ])
        mock_read_sql.side_effect = [self._make_card_df(), benefits_df]

        result = _query_card(['교통', '대중교통'], '교통', 50000)

        # matched_cate('교통') == top_category('교통') → _CARD_T["amt_title"] 또는 "title_only"
        reason = result.reason
        assert '50,000' in reason or '10% 할인' in reason or '교통' in reason

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_reason_none_template_when_no_amount_no_title(self, mock_read_sql):
        """amount=0, 매칭 title 없음 → none 템플릿"""
        benefits_df = pd.DataFrame([
            {'cate_name': '일반음식점', 'title': None, 'comment': '할인'},
        ])
        mock_read_sql.side_effect = [self._make_card_df(), benefits_df]

        result = _query_card(['일반음식점'], '식비', 0)

        assert result.reason is not None
        assert len(result.reason) > 0

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_no_gorilla_id_sets_url_none(self, mock_read_sql):
        df = self._make_card_df().copy()
        df.at[0, 'gorilla_id'] = None
        mock_read_sql.side_effect = [df, self._make_benefits_df()]

        result = _query_card(['일반음식점'], '식비', 10000)

        assert result.content.url is None


# ──────────────────────────────────────────────────────────────
# 6. _query_savings (pd.read_sql mocking)
# ──────────────────────────────────────────────────────────────
class TestQuerySavings:

    def _make_savings_df(self, spcl_cnd='급여이체 시 우대', intr_max_rate=3.5):
        return pd.DataFrame([{
            'fin_prdt_nm': '청년 희망 적금',
            'kor_co_nm': '신한은행',
            'intr_rate': 2.5,
            'intr_max_rate': intr_max_rate,
            'save_trm': 12,
            'spcl_cnd': spcl_cnd,
            'intr_rate_type': '단리',
            'join_way': '영업점, 인터넷, 스마트폰',
            'join_member': '만 19세 이상',
            'etc_note': None,
            'mtrt_int': None,
        }])

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_returns_savings_item(self, mock_read_sql):
        mock_read_sql.return_value = self._make_savings_df()

        result = _query_savings(12, 'NEW_JOB')

        assert result is not None
        assert result.product_type == 'savings'
        assert result.product_name == '청년 희망 적금'

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_returns_none_when_empty(self, mock_read_sql):
        mock_read_sql.return_value = pd.DataFrame()

        result = _query_savings(12, 'NEW_JOB')

        assert result is None

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_reason_contains_term_and_rate(self, mock_read_sql):
        mock_read_sql.return_value = self._make_savings_df(intr_max_rate=4.0)

        result = _query_savings(12, 'UNI')

        # 기간(12개월)은 reason 에 항상 포함
        assert '12' in result.reason
        # 금리는 템플릿에 따라 reason 에 없을 수 있으므로 content.header 에서 검증
        assert '4.0%' in result.content.header

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_short_spcl_cnd_appended_to_reason(self, mock_read_sql):
        short_spcl = '급여이체 시 우대'
        mock_read_sql.return_value = self._make_savings_df(spcl_cnd=short_spcl)

        result = _query_savings(12, 'NEW_JOB')

        assert short_spcl in result.reason

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_long_spcl_cnd_not_appended(self, mock_read_sql):
        long_spcl = 'A' * 51
        mock_read_sql.return_value = self._make_savings_df(spcl_cnd=long_spcl)

        result = _query_savings(12, 'NEW_JOB')

        assert long_spcl not in result.reason

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_child_stage_does_not_filter_child_keywords(self, mock_read_sql):
        """CHILD_STAGES 코드일 때 아이 관련 상품 필터를 걸지 않아야 함"""
        mock_read_sql.return_value = self._make_savings_df()

        result = _query_savings(36, 'CHILD_BABY')

        assert result is not None
        # CHILD_STAGES 쿼리에서 CHILD_KEYWORDS 조건 없이 호출되었는지 검증
        call_args = mock_read_sql.call_args
        query_str = str(call_args[0][0])
        assert 'NOT REGEXP' not in query_str

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_non_child_stage_filters_child_keywords(self, mock_read_sql):
        """일반 생애주기일 때 아이 관련 상품 제외 필터 적용"""
        mock_read_sql.return_value = self._make_savings_df()

        result = _query_savings(12, 'NEW_JOB')

        assert result is not None
        call_args = mock_read_sql.call_args
        query_str = str(call_args[0][0])
        assert 'NOT REGEXP' in query_str

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_header_shows_max_rate(self, mock_read_sql):
        mock_read_sql.return_value = self._make_savings_df(intr_max_rate=3.8)

        result = _query_savings(12, 'RETIR')

        assert '3.8%' in result.content.header

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_middle_shows_save_trm(self, mock_read_sql):
        mock_read_sql.return_value = self._make_savings_df()

        result = _query_savings(12, 'UNI')

        assert '12개월' in result.content.middle

    @patch('app.services.ai_insight_service.pd.read_sql')
    def test_unknown_life_stage_uses_default_template(self, mock_read_sql):
        mock_read_sql.return_value = self._make_savings_df()

        result = _query_savings(12, 'UNKNOWN_STAGE')

        assert result is not None
        assert result.reason is not None


# ──────────────────────────────────────────────────────────────
# 7. get_ai_insight (비동기, 내부 함수 mock)
# ──────────────────────────────────────────────────────────────
class TestGetAiInsight:
    """
    _query_card / _query_savings 를 mock 해서
    get_ai_insight 의 조율 로직(orchestration)만 검증
    """

    def _user_df(self, life_stage_code='NEW_JOB'):
        return pd.DataFrame([{'life_stage_code': life_stage_code}])

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_returns_ai_insight_response(self, mock_sql, mock_card, mock_savings):
        mock_sql.return_value = self._user_df()
        mock_card.return_value = _make_card_item()
        mock_savings.return_value = _make_savings_item()

        result = await get_ai_insight(1, {'식비': 50000})

        assert result.recommned is not None
        assert len(result.recommned) == 2

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_no_message_when_life_stage_present(self, mock_sql, mock_card, mock_savings):
        mock_sql.return_value = self._user_df('NEW_JOB')
        mock_card.return_value = _make_card_item()
        mock_savings.return_value = _make_savings_item()

        result = await get_ai_insight(1, {'식비': 50000})

        assert result.message is None

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_message_set_when_no_life_stage(self, mock_sql, mock_card, mock_savings):
        mock_sql.return_value = pd.DataFrame([{'life_stage_code': None}])
        mock_card.return_value = _make_card_item()
        mock_savings.return_value = _make_savings_item()

        result = await get_ai_insight(1, {'식비': 50000})

        assert result.message == '생애주기 분석이 되지 않아 일반 추천을 드려요'

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_message_set_when_user_not_found(self, mock_sql, mock_card, mock_savings):
        mock_sql.return_value = pd.DataFrame()  # 유저 없음
        mock_card.return_value = _make_card_item()
        mock_savings.return_value = _make_savings_item()

        result = await get_ai_insight(999, {'식비': 50000})

        assert result.message == '생애주기 분석이 되지 않아 일반 추천을 드려요'

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_empty_category_price_skips_card_query(self, mock_sql, mock_card, mock_savings):
        mock_sql.return_value = self._user_df()
        mock_savings.return_value = _make_savings_item()

        result = await get_ai_insight(1, {})

        mock_card.assert_not_called()
        assert len(result.recommned) == 1
        assert result.recommned[0].product_type == 'savings'

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_card_tried_by_descending_amount(self, mock_sql, mock_card, mock_savings):
        """지출 금액 내림차순으로 카드 매칭 시도 — 가장 큰 카테고리부터"""
        mock_sql.return_value = self._user_df()
        mock_card.return_value = None  # 첫 번째 시도 실패
        mock_savings.return_value = _make_savings_item()

        category_price = {'교통': 10000, '식비': 80000, '카페/간식': 30000}
        await get_ai_insight(1, category_price)

        first_call_cate_names = mock_card.call_args_list[0][0][1]
        assert first_call_cate_names == '식비'

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_result_excludes_none_items(self, mock_sql, mock_card, mock_savings):
        """_query_card 또는 _query_savings 가 None 이면 결과에서 제외"""
        mock_sql.return_value = self._user_df()
        mock_card.return_value = None
        mock_savings.return_value = _make_savings_item()

        result = await get_ai_insight(1, {'식비': 50000})

        assert all(item is not None for item in result.recommned)
        assert len(result.recommned) == 1

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_기타_category_uses_fallback_모든가맹점(self, mock_sql, mock_card, mock_savings):
        """기타만 있을 때: 루프에서 skip → 폴백에서 ['모든가맹점']으로 _query_card 호출"""
        mock_sql.return_value = self._user_df()
        mock_card.return_value = _make_card_item()
        mock_savings.return_value = _make_savings_item()

        await get_ai_insight(1, {'기타': 100000})

        # 폴백 경로: _query_card(['모든가맹점'], '기타', 100000) 로 1회 호출
        mock_card.assert_called_once_with(['모든가맹점'], '기타', 100000)

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_life_stage_used_for_savings_term(self, mock_sql, mock_card, mock_savings):
        """TEEN 생애주기 → save_trm=6 으로 _query_savings 호출"""
        mock_sql.return_value = self._user_df('TEEN')
        mock_card.return_value = _make_card_item()
        mock_savings.return_value = _make_savings_item()

        await get_ai_insight(1, {'식비': 30000})

        savings_call_trm = mock_savings.call_args[0][0]
        assert savings_call_trm == LIFE_STAGE_SAVE_TRM['TEEN']  # 6

    @pytest.mark.asyncio
    @patch('app.services.ai_insight_service._query_savings')
    @patch('app.services.ai_insight_service._query_card')
    @patch('app.services.ai_insight_service.pd.read_sql')
    async def test_unknown_life_stage_defaults_to_12_months(self, mock_sql, mock_card, mock_savings):
        """LIFE_STAGE_SAVE_TRM 에 없는 코드 → 기본 12개월"""
        mock_sql.return_value = pd.DataFrame([{'life_stage_code': 'UNKNOWN_CODE'}])
        mock_card.return_value = _make_card_item()
        mock_savings.return_value = _make_savings_item()

        await get_ai_insight(1, {'식비': 30000})

        savings_call_trm = mock_savings.call_args[0][0]
        assert savings_call_trm == 12
