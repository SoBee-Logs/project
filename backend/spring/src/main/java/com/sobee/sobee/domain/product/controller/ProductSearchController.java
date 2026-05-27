package com.sobee.sobee.domain.product.controller;

import com.sobee.sobee.domain.product.dto.SearchResultDto;
import com.sobee.sobee.domain.product.service.ProductSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/financial-products")
@RequiredArgsConstructor
public class ProductSearchController {

    private final ProductSearchService searchService;

    /**
     * 자연어 통합 검색
     * GET /api/financial-products/search?q=신한+여행+카드
     * GET /api/financial-products/search?q=골프 보험
     * GET /api/financial-products/search?q=우대금리 1년
     */
    @GetMapping("/search")
    public ResponseEntity<SearchResultDto> search(@RequestParam String q) {
        return ResponseEntity.ok(searchService.search(q));
    }
}