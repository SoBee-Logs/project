package com.sobee.sobee.domain.group.controller;

import com.sobee.sobee.domain.group.dto.GroupRequestDto;
import com.sobee.sobee.domain.group.dto.GroupResponseDto;
import com.sobee.sobee.domain.group.service.GroupService;
import com.sobee.sobee.global.jwt.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    public ResponseEntity<GroupResponseDto> joinGroup(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam String code
    ) {
        Long userId = extractUserId(authHeader);
        GroupResponseDto response = groupService.joinGroup(code, userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<GroupResponseDto>> getMyGroups(
            @RequestHeader("Authorization") String authHeader
    ) {
        Long userId = extractUserId(authHeader);
        List<GroupResponseDto> response = groupService.getMyGroups(userId);
        return ResponseEntity.ok(response);
    }
}