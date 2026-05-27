package com.sobee.sobee.domain.product.controller;

import com.sobee.sobee.domain.product.dto.SearchRequestDto;
import com.sobee.sobee.domain.product.dto.SearchResponseDto;
import com.sobee.sobee.domain.product.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @PostMapping("/search")
    public ResponseEntity<SearchResponseDto> search(@RequestBody SearchRequestDto request) {
        return ResponseEntity.ok(searchService.search(request));
    }

    @GetMapping("/search/recom_question")
    public ResponseEntity<List<String>> getRecomQuestion() {
        return ResponseEntity.ok(List.of(
                "실적 채울 카드 추천해줘",
                "내 패턴에 맞는 카드",
                "나 여행 갈 건데 어떤 트래블 카드 써야 해?",
                "카페 혜택 좋은 카드는 뭐야?"
        ));
    }

    @GetMapping("/search/recent_question")
    public ResponseEntity<List<String>> getRecentQuestion() {
        return ResponseEntity.ok(List.of(
                "카페 혜택 좋은 카드는 뭐야?",
                "이번 달 카드 실적 얼마나 남았어?"
        ));
    }
}