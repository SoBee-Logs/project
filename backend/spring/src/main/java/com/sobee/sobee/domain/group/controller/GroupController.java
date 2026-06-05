package com.sobee.sobee.domain.group.controller;

import com.sobee.sobee.domain.group.dto.GroupRequestDto;
import com.sobee.sobee.domain.group.dto.GroupResponseDto;
import com.sobee.sobee.domain.group.service.GroupService;
import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final JwtUtil jwtUtil;

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("토큰이 없습니다.");
        }
        String token = authHeader.substring(7);
        return jwtUtil.getUserId(token);
    }

    @PostMapping
    public ResponseEntity<GroupResponseDto> createGroup(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody GroupRequestDto dto
    ) {
        Long userId = extractUserId(authHeader);
        GroupResponseDto response = groupService.createGroup(dto, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinGroup(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam String code
    ) {
        Long userId = extractUserId(authHeader);
        try {
            GroupResponseDto response = groupService.joinGroup(code, userId);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            // 이미 참여 중인 모임 → 409 Conflict
            if (msg.contains("이미 참여한 모임")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("message", "이미 참여 중인 모임이에요."));
            }
            // 존재하지 않는 코드 → 404 Not Found
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "존재하지 않는 코드예요."));
        }
    }

    @GetMapping
    public ResponseEntity<List<GroupResponseDto>> getMyGroups(
            @RequestHeader("Authorization") String authHeader
    ) {
        Long userId = extractUserId(authHeader);
        List<GroupResponseDto> response = groupService.getMyGroups(userId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{groupId}/leave")
    public ResponseEntity<Void> leaveGroup(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long groupId
    ) {
        Long userId = extractUserId(authHeader);
        groupService.leaveGroup(groupId, userId);
        return ResponseEntity.ok().build();
    }
}