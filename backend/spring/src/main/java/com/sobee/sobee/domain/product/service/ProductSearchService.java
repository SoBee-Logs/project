package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.document.CardDocument;
import com.sobee.sobee.domain.product.document.InsuranceDocument;
import com.sobee.sobee.domain.product.document.SavingsDocument;
import com.sobee.sobee.domain.product.dto.SearchResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductSearchService {

    private final ElasticsearchOperations elasticsearchOperations;

    public SearchResultDto search(String query) {
        if (query == null || query.isBlank()) {
            return SearchResultDto.builder()
                    .keyword(query)
                    .totalCount(0)
                    .cards(List.of())
                    .savings(List.of())
                    .insurance(List.of())
                    .build();
        }

        log.info("🔍 ES 검색: '{}'", query);

        List<SearchResultDto.CardResult> cards = searchCards(query);
        List<SearchResultDto.SavingsResult> savings = searchSavings(query);
        List<SearchResultDto.InsuranceResult> insurance = searchInsurance(query);

        int total = cards.size() + savings.size() + insurance.size();
        log.info("✅ 검색 결과 — 카드: {}건, 예적금: {}건, 보험: {}건", cards.size(), savings.size(), insurance.size());

        return SearchResultDto.builder()
                .keyword(query)
                .totalCount(total)
                .cards(cards)
                .savings(savings)
                .insurance(insurance)
                .build();
    }

    private List<SearchResultDto.CardResult> searchCards(String keyword) {
        NativeQuery query = NativeQuery.builder()
                .withQuery(q -> q.multiMatch(m -> m
                        .query(keyword)
                        .fields("cardName^3", "corpName^3", "cateNames^2", "topBenefitTitles^2")
                        .fuzziness("AUTO")
                ))
                .withPageable(PageRequest.of(0, 30))
                .build();

        return elasticsearchOperations.search(query, CardDocument.class).stream()
                .map(SearchHit::getContent)
                .map(doc -> SearchResultDto.CardResult.builder()
                        .cardInfoId(Long.valueOf(doc.getId()))
                        .gorillaId(doc.getGorillaId())
                        .cardName(doc.getCardName())
                        .corpName(doc.getCorpName())
                        .cardType(doc.getCardType())
                        .annualFeeBasic(doc.getAnnualFeeBasic())
                        .minPerformance(doc.getMinPerformance())
                        .cardImgUrl(doc.getCardImgUrl())
                        .isDiscontinued(doc.getIsDiscontinued())
                        .topBenefitTitles(doc.getTopBenefitTitles())
                        .build())
                .collect(Collectors.toList());
    }

    private List<SearchResultDto.SavingsResult> searchSavings(String keyword) {
        NativeQuery query = NativeQuery.builder()
                .withQuery(q -> q.multiMatch(m -> m
                        .query(keyword)
                        .fields("finPrdtNm^3", "spclCnd^2", "korCoNm")
                        .fuzziness("AUTO")
                ))
                .withPageable(PageRequest.of(0, 20))
                .build();

        return elasticsearchOperations.search(query, SavingsDocument.class).stream()
                .map(SearchHit::getContent)
                .map(doc -> SearchResultDto.SavingsResult.builder()
                        .savingsId(Long.valueOf(doc.getId()))
                        .korCoNm(doc.getKorCoNm())
                        .finPrdtNm(doc.getFinPrdtNm())
                        .saveTrm(doc.getSaveTrm())
                        .intrRate(doc.getIntrRate())
                        .intrMaxRate(doc.getIntrMaxRate())
                        .spclCnd(doc.getSpclCnd())
                        .build())
                .collect(Collectors.toList());
    }

    private List<SearchResultDto.InsuranceResult> searchInsurance(String keyword) {
        NativeQuery query = NativeQuery.builder()
                .withQuery(q -> q.multiMatch(m -> m
                        .query(keyword)
                        .fields("productName^3", "situationTags^2", "category^2", "description", "insurer")
                        .fuzziness("AUTO")
                ))
                .withPageable(PageRequest.of(0, 20))
                .build();

        return elasticsearchOperations.search(query, InsuranceDocument.class).stream()
                .map(SearchHit::getContent)
                .map(doc -> SearchResultDto.InsuranceResult.builder()
                        .productId(doc.getId())
                        .productName(doc.getProductName())
                        .insurer(doc.getInsurer())
                        .category(doc.getCategory())
                        .situationTags(doc.getSituationTags())
                        .coveragePeriodDays(doc.getCoveragePeriodDays())
                        .productUrl(doc.getProductUrl())
                        .build())
                .collect(Collectors.toList());
    }
}
