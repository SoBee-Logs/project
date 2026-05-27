package com.sobee.sobee.domain.product.controller;

import com.sobee.sobee.domain.product.entity.CardInfo;
import com.sobee.sobee.domain.product.service.CardService;
import com.sobee.sobee.domain.product.service.CardSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/financial-products/cards")
@RequiredArgsConstructor
public class CardController {

    private final CardSyncService cardSyncService;
    private final CardService cardService;

    /** cards.json → DB 적재 */
    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> syncCards() {
        int count = cardSyncService.syncFromJson();
        return ResponseEntity.ok(Map.of("status", "success", "synced", count));
    }

    /** 전체 카드 조회 */
    @GetMapping
    public ResponseEntity<List<CardInfo>> getAllCards() {
        return ResponseEntity.ok(cardService.findAll());
    }

    /** 현행 카드만 (단종 제외) */
    @GetMapping("/active")
    public ResponseEntity<List<CardInfo>> getActiveCards() {
        return ResponseEntity.ok(cardService.findActive());
    }

    /** 카드사별 조회 */
    @GetMapping("/corp/{corpName}")
    public ResponseEntity<List<CardInfo>> getByCorpName(@PathVariable String corpName) {
        return ResponseEntity.ok(cardService.findByCorpName(corpName));
    }

    /** 카드명/카드사 키워드 검색 */
    @GetMapping("/search")
    public ResponseEntity<List<CardInfo>> search(@RequestParam String keyword) {
        return ResponseEntity.ok(cardService.search(keyword));
    }
}