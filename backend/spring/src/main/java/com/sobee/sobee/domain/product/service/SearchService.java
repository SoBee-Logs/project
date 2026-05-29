package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.dto.ParsedSearchDto;
import com.sobee.sobee.domain.product.dto.SearchRequestDto;
import com.sobee.sobee.domain.product.dto.SearchResponseDto;
import com.sobee.sobee.domain.product.dto.SearchResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final List<String> FINANCIAL_COMPANIES =
        List.of("신한", "삼성", "롯데", "현대", "KB", "우리", "하나", "NH", "BC", "씨티", "카카오", "토스", "IBK", "기업", "국민", "농협", "수협");

    // GPT 카테고리 → 실제 DB cate_name 매핑 (카테고리 간 중복 최소화)
    private static final Map<String, List<String>> CATEGORY_MAP = Map.ofEntries(
        Map.entry("음식점", List.of("푸드", "일반음식점", "패밀리레스토랑", "패스트푸드", "배달앱", "점심", "저녁")),
        Map.entry("카페",   List.of("카페", "카페/디저트", "베이커리")),
        Map.entry("교통",   List.of("교통", "대중교통", "택시", "기차", "고속버스", "자동차/하이패스", "하이패스")),
        Map.entry("주유",   List.of("주유", "주유소", "충전소")),
        Map.entry("쇼핑",   List.of("쇼핑", "백화점", "아울렛")),
        Map.entry("마트",   List.of("대형마트", "마트/편의점", "SSM")),
        Map.entry("편의점", List.of("편의점")),
        Map.entry("영화",   List.of("영화", "OTT/영화/문화", "공연/전시", "테마파크")),
        Map.entry("통신",   List.of("통신", "SKT", "KT", "LGU+")),
        Map.entry("여행",   List.of("여행/숙박", "여행사", "온라인 여행사", "호텔", "리조트", "항공권", "항공마일리지")),
        Map.entry("해외",   List.of("해외", "해외이용", "공항라운지", "공항라운지/PP", "면세점")),
        Map.entry("의료",   List.of("병원", "병원/약국", "약국", "동물병원")),
        Map.entry("교육",   List.of("교육/육아", "학원", "학습지", "유치원", "어린이집")),
        Map.entry("스포츠", List.of("레저/스포츠", "골프", "피트니스", "경기관람")),
        Map.entry("온라인", List.of("온라인쇼핑", "소셜커머스", "홈쇼핑", "해외직구", "간편결제"))
    );

    private final ProductSearchService productSearchService;
    private final RestTemplate restTemplate;

    @Value("${fastapi.base-url:http://localhost:8000}")
    private String fastapiBaseUrl;

    @Value("${fastapi.internal-secret:}")
    private String internalSecret;

    @Cacheable(value = "searchCache", key = "#request.search_input.trim().toLowerCase()")
    public SearchResponseDto search(SearchRequestDto request) {
        String keyword = request.getSearch_input();

        // GPT 파싱 + ES 검색 병렬 실행
        CompletableFuture<ParsedSearchDto> parseFuture = CompletableFuture
                .supplyAsync(() -> callParseSearch(keyword));

        CompletableFuture<SearchResultDto> searchFuture = CompletableFuture
                .supplyAsync(() -> productSearchService.search(keyword));

        CompletableFuture.allOf(parseFuture, searchFuture).join();

        ParsedSearchDto parsed = parseFuture.getNow(null);
        SearchResultDto result = searchFuture.getNow(SearchResultDto.builder()
                .keyword(keyword).totalCount(0)
                .cards(List.of()).savings(List.of()).insurance(List.of())
                .build());

        // GPT category → 카테고리 기반 ES 검색 결과를 앞에 병합
        if (parsed != null && parsed.getCategory() != null) {
            List<String> dbCateNames = CATEGORY_MAP.getOrDefault(parsed.getCategory(), List.of());
            if (!dbCateNames.isEmpty()) {
                List<SearchResultDto.CardResult> catCards =
                        productSearchService.searchAndEnrichCardsByCateNames(dbCateNames);

                // 텍스트 카드의 cateNames를 직접 확인해 카테고리 매칭 판단 (catCards 크기 제한 우회)
                Set<String> cateNameSet = new HashSet<>(dbCateNames);

                // 텍스트 검색 카드 중 카테고리 관련 있는 것 (cateNames 직접 확인)
                List<SearchResultDto.CardResult> textWithCate = result.getCards().stream()
                        .filter(c -> c.getCateNames() != null &&
                                c.getCateNames().stream().anyMatch(cateNameSet::contains))
                        .collect(Collectors.toList());
                List<SearchResultDto.CardResult> textOnly = result.getCards().stream()
                        .filter(c -> c.getCateNames() == null ||
                                c.getCateNames().stream().noneMatch(cateNameSet::contains))
                        .collect(Collectors.toList());

                // catCards 중 텍스트 검색에 없는 것만 추가 (중복 방지)
                Set<Long> textWithCateIds = textWithCate.stream()
                        .map(SearchResultDto.CardResult::getCardInfoId)
                        .collect(Collectors.toSet());
                List<SearchResultDto.CardResult> catOnly = catCards.stream()
                        .filter(c -> !textWithCateIds.contains(c.getCardInfoId()))
                        .collect(Collectors.toList());

                // 정렬: 텍스트+카테고리 → 카테고리만 → 텍스트만
                List<SearchResultDto.CardResult> merged = new ArrayList<>(textWithCate);
                merged.addAll(catOnly);
                merged.addAll(textOnly);

                result = SearchResultDto.builder()
                        .keyword(result.getKeyword()).totalCount(result.getTotalCount())
                        .cards(merged).savings(result.getSavings()).insurance(result.getInsurance())
                        .build();
            }
        }

        List<SearchResponseDto.ProductDto> products = buildProducts(result);

        // GPT 결과로 후처리 (회사명 필터, 타입 필터)
        if (parsed != null) {
            products = applyGptFilter(products, parsed);
        }

        String aiText = (parsed != null && parsed.getAi_text() != null && !parsed.getAi_text().isBlank())
                ? parsed.getAi_text()
                : "'" + keyword + "' 관련 상품을 찾았어요. 총 " + products.size() + "개의 상품이 있어요.";

        return SearchResponseDto.builder()
                .AI_text(aiText)
                .products(products)
                .build();
    }

    private List<SearchResponseDto.ProductDto> applyGptFilter(
            List<SearchResponseDto.ProductDto> products, ParsedSearchDto parsed) {

        List<SearchResponseDto.ProductDto> filtered = new ArrayList<>(products);

        // 상품 타입 필터 (카드/예적금/보험 중 특정 타입만 요청한 경우)
        if (parsed.getProduct_types() != null && parsed.getProduct_types().size() < 3) {
            filtered = filtered.stream()
                    .filter(p -> parsed.getProduct_types().contains(p.getProduct_type()))
                    .collect(Collectors.toList());
        }

        // 회사명 필터 — 금융기관 브랜드일 때만 적용 ("롯데카드 추천해줘" → company: "롯데")
        String company = parsed.getCompany();
        if (company != null && !company.isBlank()
                && FINANCIAL_COMPANIES.stream().anyMatch(fc -> fc.equalsIgnoreCase(company))) {
            List<SearchResponseDto.ProductDto> companyFiltered = filtered.stream()
                    .filter(p -> p.getProduct_company() != null
                            && p.getProduct_company().contains(company))
                    .collect(Collectors.toList());
            if (!companyFiltered.isEmpty()) {
                filtered = companyFiltered;
            }
        }

        return filtered;
    }

    private List<SearchResponseDto.ProductDto> buildProducts(SearchResultDto result) {
        List<SearchResponseDto.ProductDto> products = new ArrayList<>();

        for (SearchResultDto.CardResult c : result.getCards()) {
            String cardUrl = c.getGorillaId() != null
                    ? "https://www.card-gorilla.com/card/detail/" + c.getGorillaId() : "";

            String header = (c.getTopBenefitTitles() != null && !c.getTopBenefitTitles().isEmpty())
                    ? c.getTopBenefitTitles().get(0) : "";

            String middle = (c.getTopBenefitTitles() != null && c.getTopBenefitTitles().size() > 1)
                    ? c.getTopBenefitTitles().get(1) : "";

            String small = (c.getTopBenefitTitles() != null && c.getTopBenefitTitles().size() > 2)
                    ? String.join(", ", c.getTopBenefitTitles().subList(2, c.getTopBenefitTitles().size())) : "";

            // 카테고리별 혜택 그룹
            List<SearchResponseDto.BenefitGroup> benefitGroups = null;
            if (c.getBenefits() != null && !c.getBenefits().isEmpty()) {
                Map<String, List<SearchResultDto.BenefitItem>> grouped = new LinkedHashMap<>();
                for (SearchResultDto.BenefitItem b : c.getBenefits()) {
                    String key = b.getCateName() != null ? b.getCateName() : "기타";
                    grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(b);
                }
                benefitGroups = grouped.entrySet().stream()
                        .map(e -> SearchResponseDto.BenefitGroup.builder()
                                .cateName(e.getKey())
                                .lines(e.getValue().stream()
                                        .filter(b -> b.getTitle() != null)
                                        .map(b -> SearchResponseDto.BenefitLine.builder()
                                                .title(b.getTitle())
                                                .comment(b.getComment())
                                                .build())
                                        .collect(Collectors.toList()))
                                .build())
                        .collect(Collectors.toList());
            }

            products.add(SearchResponseDto.ProductDto.builder()
                    .product_name(c.getCardName())
                    .product_company(c.getCorpName())
                    .product_img_url(c.getCardImgUrl())
                    .product_type("card")
                    .is_discontinued(Boolean.TRUE.equals(c.getIsDiscontinued()))
                    .content(SearchResponseDto.ContentDto.builder()
                            .header(header).middle(middle).small(small).url(cardUrl)
                            .benefitGroups(benefitGroups)
                            .annualFeeDetail(stripHtml(c.getAnnualFeeDetail()))
                            .onlyOnline(c.getOnlyOnline())
                            .isImpend(c.getIsImpend())
                            .build())
                    .build());
        }

        for (SearchResultDto.SavingsResult s : result.getSavings()) {
            String intrRateStr = s.getIntrRate() != null ? s.getIntrRate().stripTrailingZeros().toPlainString() + "%" : null;
            String intrMaxRateStr = s.getIntrMaxRate() != null ? s.getIntrMaxRate().stripTrailingZeros().toPlainString() + "%" : null;

            products.add(SearchResponseDto.ProductDto.builder()
                    .product_name(s.getFinPrdtNm())
                    .product_company(s.getKorCoNm())
                    .product_img_url(null)
                    .product_type("savings")
                    .content(SearchResponseDto.ContentDto.builder()
                            .header(intrMaxRateStr != null ? "우대금리 최대 " + intrMaxRateStr : "")
                            .middle(s.getSaveTrm() != null ? s.getSaveTrm() + "개월" : "")
                            .small(s.getSpclCnd() != null ? s.getSpclCnd() : "")
                            .url("")
                            .intrRate(intrRateStr)
                            .intrRateType(s.getIntrRateType())
                            .joinWay(s.getJoinWay())
                            .joinMember(s.getJoinMember())
                            .etcNote(s.getEtcNote())
                            .mtrtInt(s.getMtrtInt())
                            .build())
                    .build());
        }

        for (SearchResultDto.InsuranceResult i : result.getInsurance()) {
            String ageRange = null;
            if (i.getAgeMin() != null && i.getAgeMax() != null)
                ageRange = "만 " + i.getAgeMin() + "~" + i.getAgeMax() + "세";
            else if (i.getAgeMin() != null)
                ageRange = "만 " + i.getAgeMin() + "세 이상";

            List<SearchResponseDto.CoverageItem> coverages = null;
            if (i.getCoverages() != null && !i.getCoverages().isEmpty()) {
                coverages = i.getCoverages().stream()
                        .map(c -> SearchResponseDto.CoverageItem.builder()
                                .itemName(c.getItemName())
                                .conditionText(c.getConditionText())
                                .exclusionText(c.getExclusionText())
                                .build())
                        .collect(Collectors.toList());
            }

            products.add(SearchResponseDto.ProductDto.builder()
                    .product_name(i.getProductName())
                    .product_company(i.getInsurer())
                    .product_img_url(null)
                    .product_type("insurance")
                    .content(SearchResponseDto.ContentDto.builder()
                            .header(i.getCategory() != null ? i.getCategory() : "")
                            .middle(i.getSituationTags() != null ? i.getSituationTags() : "")
                            .small(i.getCoveragePeriodDays() != null ? "보장기간 " + i.getCoveragePeriodDays() + "일" : "")
                            .url(i.getProductUrl() != null ? i.getProductUrl() : "")
                            .description(i.getDescription())
                            .coverages(coverages)
                            .ageRange(ageRange)
                            .gender(i.getGender())
                            .notes(i.getNotes())
                            .build())
                    .build());
        }

        return products;
    }

    private ParsedSearchDto callParseSearch(String query) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (internalSecret != null && !internalSecret.isBlank()) {
                headers.set("X-Internal-Secret", internalSecret);
            }
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(Map.of("query", query), headers);
            ResponseEntity<ParsedSearchDto> response = restTemplate.postForEntity(
                    fastapiBaseUrl + "/internal/parse-search",
                    entity,
                    ParsedSearchDto.class);
            return response.getBody();
        } catch (Exception e) {
            log.warn("GPT 파싱 실패, ES 결과만 사용: {}", e.getMessage());
            return null;
        }
    }

    private String stripHtml(String html) {
        if (html == null || html.isBlank()) return null;
        return html
                .replaceAll("(?is)<style[^>]*>.*?</style>", "")
                .replaceAll("<[^>]+>", "")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replaceAll("(?i)Powered\\s+by\\s*[\\r\\n\\s]*Froala\\s+Editor", "")
                .replaceAll("[ \t]+", " ")
                .replaceAll("(\r?\n){3,}", "\n\n")
                .trim();
    }
}
