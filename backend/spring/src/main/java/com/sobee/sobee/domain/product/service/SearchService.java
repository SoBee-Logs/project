package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.dto.ParsedSearchDto;
import com.sobee.sobee.domain.product.dto.SearchRequestDto;
import com.sobee.sobee.domain.product.dto.SearchResponseDto;
import com.sobee.sobee.domain.product.dto.SearchResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final ProductSearchService productSearchService;
    private final RestTemplate restTemplate;

    @Value("${fastapi.base-url:http://localhost:8000}")
    private String fastapiBaseUrl;

    @Value("${fastapi.internal-secret:}")
    private String internalSecret;

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

        // 회사명 필터 ("롯데카드 추천해줘" → company: "롯데")
        if (parsed.getCompany() != null && !parsed.getCompany().isBlank()) {
            List<SearchResponseDto.ProductDto> companyFiltered = filtered.stream()
                    .filter(p -> p.getProduct_company() != null
                            && p.getProduct_company().contains(parsed.getCompany()))
                    .collect(Collectors.toList());
            // 필터 후 결과가 있을 때만 적용 (없으면 원본 유지)
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
                    ? "https://www.card-gorilla.com/card/detail/" + c.getGorillaId()
                    : "";

            String header = (c.getTopBenefitTitles() != null && !c.getTopBenefitTitles().isEmpty())
                    ? c.getTopBenefitTitles().get(0)
                    : "";

            String middle = "";
            if (c.getMinPerformance() != null && c.getMinPerformance() > 0) {
                middle += "전월 실적 " + String.format("%,d", c.getMinPerformance()) + "원 이상";
            }
            if (c.getAnnualFeeBasic() != null && !c.getAnnualFeeBasic().isBlank()) {
                middle += (middle.isEmpty() ? "" : " / ") + "연회비 " + c.getAnnualFeeBasic();
            }

            String small = (c.getTopBenefitTitles() != null && c.getTopBenefitTitles().size() > 1)
                    ? String.join(", ", c.getTopBenefitTitles().subList(1, c.getTopBenefitTitles().size()))
                    : "";

            products.add(SearchResponseDto.ProductDto.builder()
                    .product_name(c.getCardName())
                    .product_company(c.getCorpName())
                    .product_img_url(c.getCardImgUrl())
                    .product_type("card")
                    .is_discontinued(Boolean.TRUE.equals(c.getIsDiscontinued()))
                    .content(SearchResponseDto.ContentDto.builder()
                            .header(header).middle(middle).small(small).url(cardUrl)
                            .build())
                    .build());
        }

        for (SearchResultDto.SavingsResult s : result.getSavings()) {
            products.add(SearchResponseDto.ProductDto.builder()
                    .product_name(s.getFinPrdtNm())
                    .product_company(s.getKorCoNm())
                    .product_img_url(null)
                    .product_type("savings")
                    .content(SearchResponseDto.ContentDto.builder()
                            .header(s.getIntrMaxRate() != null ? "우대금리 최대 " + s.getIntrMaxRate() + "%" : "")
                            .middle(s.getSaveTrm() != null ? s.getSaveTrm() + "개월" : "")
                            .small(s.getSpclCnd() != null ? s.getSpclCnd() : "")
                            .url("")
                            .build())
                    .build());
        }

        for (SearchResultDto.InsuranceResult i : result.getInsurance()) {
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
}
