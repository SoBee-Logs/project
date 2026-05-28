package com.sobee.sobee.domain.product.service;

import com.sobee.sobee.domain.product.document.CardDocument;
import com.sobee.sobee.domain.product.document.InsuranceDocument;
import com.sobee.sobee.domain.product.document.SavingsDocument;
import com.sobee.sobee.domain.product.dto.SearchResultDto;
import com.sobee.sobee.domain.product.entity.CardInfo;
import com.sobee.sobee.domain.product.entity.InsuranceProduct;
import com.sobee.sobee.domain.product.entity.SavingsProduct;
import com.sobee.sobee.domain.product.repository.CardInfoRepository;
import com.sobee.sobee.domain.product.repository.InsuranceProductRepository;
import com.sobee.sobee.domain.product.repository.SavingsProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductSearchService {

    private final ElasticsearchOperations elasticsearchOperations;
    private final CardInfoRepository cardInfoRepository;
    private final SavingsProductRepository savingsProductRepository;
    private final InsuranceProductRepository insuranceProductRepository;

    @Transactional(readOnly = true)
    public SearchResultDto search(String query) {
        if (query == null || query.isBlank()) {
            return SearchResultDto.builder()
                    .keyword(query).totalCount(0)
                    .cards(List.of()).savings(List.of()).insurance(List.of())
                    .build();
        }

        log.info("🔍 ES 검색: '{}'", query);

        List<SearchResultDto.CardResult> cards = enrichCards(searchCards(query));
        List<SearchResultDto.SavingsResult> savings = enrichSavings(searchSavings(query));
        List<SearchResultDto.InsuranceResult> insurance = enrichInsurance(searchInsurance(query));

        int total = cards.size() + savings.size() + insurance.size();
        log.info("✅ 검색 결과 — 카드: {}건, 예적금: {}건, 보험: {}건", cards.size(), savings.size(), insurance.size());

        return SearchResultDto.builder()
                .keyword(query).totalCount(total)
                .cards(cards).savings(savings).insurance(insurance)
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

    private List<SearchResultDto.CardResult> enrichCards(List<SearchResultDto.CardResult> cards) {
        if (cards.isEmpty()) return cards;

        List<Long> ids = cards.stream().map(SearchResultDto.CardResult::getCardInfoId).collect(Collectors.toList());
        Map<Long, CardInfo> infoMap = cardInfoRepository.findAllWithBenefitsByIds(ids)
                .stream().collect(Collectors.toMap(CardInfo::getCardInfoId, Function.identity()));

        return cards.stream().map(c -> {
            CardInfo info = infoMap.get(c.getCardInfoId());
            if (info == null) return c;

            List<SearchResultDto.BenefitItem> benefits = info.getBenefits().stream()
                    .filter(b -> !Boolean.TRUE.equals(b.getIsNotice()))
                    .map(b -> SearchResultDto.BenefitItem.builder()
                            .cateName(b.getCateName())
                            .title(b.getTitle())
                            .comment(b.getComment())
                            .build())
                    .collect(Collectors.toList());

            return SearchResultDto.CardResult.builder()
                    .cardInfoId(c.getCardInfoId())
                    .gorillaId(c.getGorillaId())
                    .cardName(c.getCardName())
                    .corpName(c.getCorpName())
                    .cardType(c.getCardType())
                    .annualFeeBasic(c.getAnnualFeeBasic())
                    .annualFeeDetail(info.getAnnualFeeDetail())
                    .minPerformance(c.getMinPerformance())
                    .onlyOnline(info.getOnlyOnline())
                    .isImpend(info.getIsImpend())
                    .cardImgUrl(c.getCardImgUrl())
                    .isDiscontinued(c.getIsDiscontinued())
                    .topBenefitTitles(c.getTopBenefitTitles())
                    .benefits(benefits)
                    .build();
        }).collect(Collectors.toList());
    }

    private List<SearchResultDto.SavingsResult> enrichSavings(List<SearchResultDto.SavingsResult> savings) {
        if (savings.isEmpty()) return savings;

        List<Long> ids = savings.stream().map(SearchResultDto.SavingsResult::getSavingsId).collect(Collectors.toList());
        Map<Long, SavingsProduct> savingsMap = savingsProductRepository.findAllById(ids)
                .stream().collect(Collectors.toMap(SavingsProduct::getSavingsId, Function.identity()));

        return savings.stream().map(s -> {
            SavingsProduct sp = savingsMap.get(s.getSavingsId());
            if (sp == null) return s;

            return SearchResultDto.SavingsResult.builder()
                    .savingsId(s.getSavingsId())
                    .korCoNm(s.getKorCoNm())
                    .finPrdtNm(s.getFinPrdtNm())
                    .saveTrm(s.getSaveTrm())
                    .intrRate(s.getIntrRate())
                    .intrMaxRate(s.getIntrMaxRate())
                    .intrRateType(sp.getIntrRateType())
                    .spclCnd(s.getSpclCnd())
                    .joinWay(sp.getJoinWay())
                    .joinMember(sp.getJoinMember())
                    .etcNote(sp.getEtcNote())
                    .mtrtInt(sp.getMtrtInt())
                    .build();
        }).collect(Collectors.toList());
    }

    private List<SearchResultDto.InsuranceResult> enrichInsurance(List<SearchResultDto.InsuranceResult> insurance) {
        if (insurance.isEmpty()) return insurance;

        List<String> ids = insurance.stream().map(SearchResultDto.InsuranceResult::getProductId).collect(Collectors.toList());
        Map<String, InsuranceProduct> insMap = insuranceProductRepository.findAllWithCoveragesByIds(ids)
                .stream().collect(Collectors.toMap(InsuranceProduct::getProductId, Function.identity()));

        return insurance.stream().map(i -> {
            InsuranceProduct ip = insMap.get(i.getProductId());
            if (ip == null) return i;

            List<SearchResultDto.CoverageItem> coverages = ip.getCoverages().stream()
                    .map(c -> SearchResultDto.CoverageItem.builder()
                            .itemName(c.getItemName())
                            .conditionText(c.getConditionText())
                            .exclusionText(c.getExclusionText())
                            .build())
                    .collect(Collectors.toList());

            return SearchResultDto.InsuranceResult.builder()
                    .productId(i.getProductId())
                    .productName(i.getProductName())
                    .insurer(i.getInsurer())
                    .category(i.getCategory())
                    .situationTags(i.getSituationTags())
                    .description(ip.getDescription())
                    .coveragePeriodDays(i.getCoveragePeriodDays())
                    .ageMin(ip.getAgeMin())
                    .ageMax(ip.getAgeMax())
                    .gender(ip.getGender())
                    .notes(ip.getNotes())
                    .productUrl(i.getProductUrl())
                    .coverages(coverages)
                    .build();
        }).collect(Collectors.toList());
    }
}