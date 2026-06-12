package com.sobee.sobee.domain.b_log.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Map;

@Getter
@AllArgsConstructor
public class DiaryPreviewBatchResponse {
    private Map<Long, DiaryPreviewResponse> previews;
}
