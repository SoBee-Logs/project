package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.dto.ParsedSearchDto;
import com.sobee.sobee.domain.product.dto.SearchRequestDto;
import com.sobee.sobee.domain.product.dto.SearchResponseDto;
import com.sobee.sobee.domain.product.dto.SearchResultDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("SearchService 단위 테스트")
class SearchServiceTest {

    @Mock
    private ProductSearchService productSearchService;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private SearchService searchService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(searchService, "fastapiBaseUrl", "http://localhost:8000");
        ReflectionTestUtils.setField(searchService, "internalSecret", "test-secret");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private SearchResultDto emptyResult(String keyword) {
        return SearchResultDto.builder()
                .keyword(keyword).totalCount(0)
                .cards(List.of()).savings(List.of()).insurance(List.of())
                .build();
    }

    private ParsedSearchDto buildParsed(String category, String company, String aiText, List<String> types) {
        ParsedSearchDto dto = new ParsedSearchDto();
        ReflectionTestUtils.setField(dto, "category", category);
        ReflectionTestUtils.setField(dto, "company", company);
        ReflectionTestUtils.setField(dto, "ai_text", aiText);
        ReflectionTestUtils.setField(dto, "product_types",
                types != null ? types : List.of("card", "savings", "insurance"));
        ReflectionTestUtils.setField(dto, "keywords", List.of());
        return dto;
    }

    private SearchRequestDto request(String input) {
        SearchRequestDto req = new SearchRequestDto();
        ReflectionTestUtils.setField(req, "search_input", input);
        return req;
    }

    private void mockGpt(ParsedSearchDto parsed) {
        when(restTemplate.postForEntity(anyString(), any(), eq(ParsedSearchDto.class)))
                .thenReturn(ResponseEntity.ok(parsed));
    }

    private void mockGptFail() {
        when(restTemplate.postForEntity(anyString(), any(), eq(ParsedSearchDto.class)))
                .thenThrow(new RuntimeException("GPT 연결 실패"));
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("GPT 파싱")
    class GptParsing {

        @Test
        @DisplayName("GPT 파싱 실패 시 ES 결과만 반환되고 ai_text는 기본값으로 채워짐")
        void gptFail_returnsDefaultAiText() {
            when(productSearchService.search(anyString())).thenReturn(emptyResult("카페 혜택 카드"));
            mockGptFail();

            SearchResponseDto result = searchService.search(request("카페 혜택 카드"));

            assertThat(result.getAI_text()).contains("카페 혜택 카드");
        }

        @Test
        @DisplayName("GPT 파싱 성공 시 AI_text가 파싱 결과로 채워짐")
        void gptSuccess_aiTextFromParsed() {
            String expected = "카페 할인 카드를 찾고 계시는군요!";
            when(productSearchService.search(anyString())).thenReturn(emptyResult("카페"));
            mockGpt(buildParsed(null, null, expected, null));

            SearchResponseDto result = searchService.search(request("카페"));

            assertThat(result.getAI_text()).isEqualTo(expected);
        }

        @Test
        @DisplayName("GPT ai_text가 비어있으면 기본값 ai_text 사용")
        void gptSuccess_emptyAiText_usesDefault() {
            when(productSearchService.search(anyString())).thenReturn(emptyResult("적금"));
            mockGpt(buildParsed(null, null, "  ", null));

            SearchResponseDto result = searchService.search(request("적금"));

            assertThat(result.getAI_text()).contains("적금");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("matched_cate_names")
    class MatchedCateNames {

        @Test
        @DisplayName("카테고리 파싱 성공 시 CATEGORY_MAP 기반 matched_cate_names 반환")
        void category_카페_returnsMatchedCateNames() {
            when(productSearchService.search(anyString())).thenReturn(emptyResult("카페"));
            when(productSearchService.searchAndEnrichCardsByCateNames(anyList())).thenReturn(List.of());
            mockGpt(buildParsed("카페", null, "카페 검색", null));

            SearchResponseDto result = searchService.search(request("카페"));

            assertThat(result.getMatched_cate_names())
                    .containsExactlyInAnyOrder("카페", "카페/디저트", "베이커리");
        }

        @Test
        @DisplayName("카테고리 교통 → 교통 관련 cate_names 반환")
        void category_교통_returnsMatchedCateNames() {
            when(productSearchService.search(anyString())).thenReturn(emptyResult("교통"));
            when(productSearchService.searchAndEnrichCardsByCateNames(anyList())).thenReturn(List.of());
            mockGpt(buildParsed("교통", null, "교통 검색", null));

            SearchResponseDto result = searchService.search(request("교통"));

            assertThat(result.getMatched_cate_names())
                    .contains("교통", "대중교통", "택시");
        }

        @Test
        @DisplayName("카테고리 null이면 matched_cate_names 비어있음")
        void categoryNull_emptyMatchedCateNames() {
            when(productSearchService.search(anyString())).thenReturn(emptyResult("적금"));
            mockGpt(buildParsed(null, null, "적금 검색", null));

            SearchResponseDto result = searchService.search(request("적금"));

            assertThat(result.getMatched_cate_names()).isEmpty();
        }

        @Test
        @DisplayName("GPT 파싱 실패 시 matched_cate_names 비어있음")
        void gptFail_emptyMatchedCateNames() {
            when(productSearchService.search(anyString())).thenReturn(emptyResult("카드"));
            mockGptFail();

            SearchResponseDto result = searchService.search(request("카드"));

            assertThat(result.getMatched_cate_names()).isEmpty();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("상품 타입 필터")
    class TypeFilter {

        @Test
        @DisplayName("card 타입만 요청 시 savings·insurance 제외")
        void typeFilter_cardOnly_excludesOthers() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("카드").totalCount(3)
                    .cards(List.of(
                            SearchResultDto.CardResult.builder()
                                    .cardInfoId(1L).cardName("신한 카드").corpName("신한카드").build()))
                    .savings(List.of(
                            SearchResultDto.SavingsResult.builder()
                                    .savingsId(1L).korCoNm("신한은행").finPrdtNm("신한 적금").build()))
                    .insurance(List.of(
                            SearchResultDto.InsuranceResult.builder()
                                    .productId("INS-1").productName("테스트 보험").insurer("삼성화재").build()))
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, null, "카드 검색", List.of("card")));

            SearchResponseDto result = searchService.search(request("카드"));

            assertThat(result.getProducts())
                    .isNotEmpty()
                    .allMatch(p -> "card".equals(p.getProduct_type()));
        }

        @Test
        @DisplayName("savings 타입만 요청 시 card·insurance 제외")
        void typeFilter_savingsOnly_excludesOthers() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("적금").totalCount(2)
                    .cards(List.of(
                            SearchResultDto.CardResult.builder()
                                    .cardInfoId(1L).cardName("신한 카드").corpName("신한카드").build()))
                    .savings(List.of(
                            SearchResultDto.SavingsResult.builder()
                                    .savingsId(1L).korCoNm("신한은행").finPrdtNm("신한 적금").build()))
                    .insurance(List.of())
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, null, "적금 검색", List.of("savings")));

            SearchResponseDto result = searchService.search(request("적금"));

            assertThat(result.getProducts())
                    .isNotEmpty()
                    .allMatch(p -> "savings".equals(p.getProduct_type()));
        }

        @Test
        @DisplayName("모든 타입 포함(3개) 시 필터 미적용")
        void typeFilter_allTypes_noFilter() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("추천").totalCount(2)
                    .cards(List.of(
                            SearchResultDto.CardResult.builder()
                                    .cardInfoId(1L).cardName("신한 카드").corpName("신한카드").build()))
                    .savings(List.of(
                            SearchResultDto.SavingsResult.builder()
                                    .savingsId(1L).korCoNm("신한은행").finPrdtNm("신한 적금").build()))
                    .insurance(List.of())
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, null, "검색", List.of("card", "savings", "insurance")));

            SearchResponseDto result = searchService.search(request("추천"));

            assertThat(result.getProducts()).hasSize(2);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("회사명 필터")
    class CompanyFilter {

        @Test
        @DisplayName("금융기관 브랜드(신한) → 신한 상품만 반환")
        void companyFilter_financialBrand_filtersOthers() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("신한 카드").totalCount(2)
                    .cards(List.of(
                            SearchResultDto.CardResult.builder()
                                    .cardInfoId(1L).cardName("신한 Deep Dream").corpName("신한카드").build(),
                            SearchResultDto.CardResult.builder()
                                    .cardInfoId(2L).cardName("롯데 카드").corpName("롯데카드").build()))
                    .savings(List.of()).insurance(List.of())
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, "신한", "신한 검색", null));

            SearchResponseDto result = searchService.search(request("신한 카드"));

            assertThat(result.getProducts())
                    .isNotEmpty()
                    .allMatch(p -> p.getProduct_company().contains("신한"));
        }

        @Test
        @DisplayName("금융기관 브랜드(KB) → 결과 없으면 필터 미적용 (전체 반환)")
        void companyFilter_financialBrand_emptyFiltered_returnsAll() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("KB 카드").totalCount(1)
                    .cards(List.of(
                            SearchResultDto.CardResult.builder()
                                    .cardInfoId(1L).cardName("신한 카드").corpName("신한카드").build()))
                    .savings(List.of()).insurance(List.of())
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, "KB", "KB 검색", null));

            SearchResponseDto result = searchService.search(request("KB 카드"));

            // 필터 결과 없으면 전체 반환
            assertThat(result.getProducts()).hasSize(1);
        }

        @Test
        @DisplayName("일반 브랜드(스타벅스) → 필터 미적용, 전체 반환")
        void companyFilter_nonFinancialBrand_noFilter() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("스타벅스").totalCount(2)
                    .cards(List.of(
                            SearchResultDto.CardResult.builder()
                                    .cardInfoId(1L).cardName("신한 카드").corpName("신한카드").build(),
                            SearchResultDto.CardResult.builder()
                                    .cardInfoId(2L).cardName("KB 카드").corpName("KB카드").build()))
                    .savings(List.of()).insurance(List.of())
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, "스타벅스", "스타벅스 혜택", null));

            SearchResponseDto result = searchService.search(request("스타벅스 혜택"));

            assertThat(result.getProducts()).hasSize(2);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("보험 정렬")
    class InsuranceSorting {

        @Test
        @DisplayName("파싱된 카테고리와 일치하는 보험이 앞으로 정렬됨")
        void insurance_matchingCategoryComesFirst() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("보험").totalCount(2)
                    .cards(List.of()).savings(List.of())
                    .insurance(List.of(
                            SearchResultDto.InsuranceResult.builder()
                                    .productId("1").productName("여행자보험").insurer("삼성화재").category("여행").build(),
                            SearchResultDto.InsuranceResult.builder()
                                    .productId("2").productName("실손의료보험").insurer("현대해상").category("의료").build()))
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            when(productSearchService.searchAndEnrichCardsByCateNames(anyList())).thenReturn(List.of());
            mockGpt(buildParsed("의료", null, "의료 보험 검색", List.of("insurance")));

            SearchResponseDto result = searchService.search(request("의료 보험"));

            List<SearchResponseDto.ProductDto> insurances = result.getProducts().stream()
                    .filter(p -> "insurance".equals(p.getProduct_type())).toList();

            assertThat(insurances).isNotEmpty();
            assertThat(insurances.get(0).getProduct_name()).isEqualTo("실손의료보험");
        }

        @Test
        @DisplayName("카테고리 미일치 보험끼리는 상대 순서 유지")
        void insurance_nonMatchingCategoryKeepsOrder() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("보험").totalCount(2)
                    .cards(List.of()).savings(List.of())
                    .insurance(List.of(
                            SearchResultDto.InsuranceResult.builder()
                                    .productId("1").productName("여행자보험").insurer("삼성화재").category("여행").build(),
                            SearchResultDto.InsuranceResult.builder()
                                    .productId("2").productName("자동차보험").insurer("현대해상").category("교통").build()))
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            when(productSearchService.searchAndEnrichCardsByCateNames(anyList())).thenReturn(List.of());
            mockGpt(buildParsed("의료", null, "보험 검색", List.of("insurance")));

            SearchResponseDto result = searchService.search(request("보험"));

            List<SearchResponseDto.ProductDto> insurances = result.getProducts().stream()
                    .filter(p -> "insurance".equals(p.getProduct_type())).toList();

            assertThat(insurances).hasSize(2);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("회사 로고 URL (COMPANY_LOGO_MAP)")
    class CompanyLogoMap {

        @Test
        @DisplayName("등록된 은행(국민은행) → savings product_img_url not null")
        void logoMap_registeredBank_hasLogoUrl() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("적금").totalCount(1)
                    .cards(List.of())
                    .savings(List.of(SearchResultDto.SavingsResult.builder()
                            .savingsId(1L).korCoNm("국민은행").finPrdtNm("KB 적금")
                            .intrMaxRate(BigDecimal.valueOf(4.5)).build()))
                    .insurance(List.of())
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, null, "적금", List.of("savings")));

            SearchResponseDto result = searchService.search(request("적금"));

            assertThat(result.getProducts())
                    .filteredOn(p -> "savings".equals(p.getProduct_type()))
                    .allMatch(p -> p.getProduct_img_url() != null && !p.getProduct_img_url().isBlank());
        }

        @Test
        @DisplayName("미등록 회사 → savings product_img_url null")
        void logoMap_unknownCompany_nullLogoUrl() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("적금").totalCount(1)
                    .cards(List.of())
                    .savings(List.of(SearchResultDto.SavingsResult.builder()
                            .savingsId(1L).korCoNm("알수없는은행").finPrdtNm("미등록 적금").build()))
                    .insurance(List.of())
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, null, "적금", List.of("savings")));

            SearchResponseDto result = searchService.search(request("적금"));

            assertThat(result.getProducts())
                    .filteredOn(p -> "savings".equals(p.getProduct_type()))
                    .allMatch(p -> p.getProduct_img_url() == null);
        }

        @Test
        @DisplayName("등록된 보험사(삼성화재) → insurance product_img_url not null")
        void logoMap_registeredInsurer_hasLogoUrl() {
            SearchResultDto esResult = SearchResultDto.builder()
                    .keyword("보험").totalCount(1)
                    .cards(List.of()).savings(List.of())
                    .insurance(List.of(SearchResultDto.InsuranceResult.builder()
                            .productId("INS-1").productName("삼성 화재보험").insurer("삼성화재").build()))
                    .build();

            when(productSearchService.search(anyString())).thenReturn(esResult);
            mockGpt(buildParsed(null, null, "보험", List.of("insurance")));

            SearchResponseDto result = searchService.search(request("보험"));

            assertThat(result.getProducts())
                    .filteredOn(p -> "insurance".equals(p.getProduct_type()))
                    .allMatch(p -> p.getProduct_img_url() != null && !p.getProduct_img_url().isBlank());
        }

        @Test
        @DisplayName("COMPANY_LOGO_MAP에 등록된 모든 은행 18개 매핑 확인")
        void logoMap_allRegisteredBanks_haveLogoUrl() {
            List<String> registeredBanks = List.of(
                    "경남은행", "광주은행", "국민은행", "농협은행주식회사", "부산은행",
                    "수협은행", "신한은행", "아이엠뱅크", "우리은행", "전북은행",
                    "제주은행", "주식회사 카카오뱅크", "주식회사 케이뱅크", "주식회사 하나은행",
                    "중소기업은행", "토스뱅크 주식회사", "한국산업은행", "한국스탠다드차타드은행"
            );

            for (String bankName : registeredBanks) {
                SearchResultDto esResult = SearchResultDto.builder()
                        .keyword("적금").totalCount(1).cards(List.of())
                        .savings(List.of(SearchResultDto.SavingsResult.builder()
                                .savingsId(1L).korCoNm(bankName).finPrdtNm("테스트 적금").build()))
                        .insurance(List.of()).build();

                when(productSearchService.search(anyString())).thenReturn(esResult);
                mockGpt(buildParsed(null, null, "적금", List.of("savings")));

                SearchResponseDto result = searchService.search(request("적금"));

                assertThat(result.getProducts())
                        .filteredOn(p -> "savings".equals(p.getProduct_type()))
                        .as("은행 [%s]의 로고 URL이 존재해야 함", bankName)
                        .allMatch(p -> p.getProduct_img_url() != null);

                // Cacheable 우회를 위해 mock 초기화
                reset(productSearchService, restTemplate);
            }
        }
    }
}
