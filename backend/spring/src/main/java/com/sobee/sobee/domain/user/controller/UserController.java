package com.sobee.sobee.domain.user.controller;

import com.sobee.sobee.domain.user.dto.UserPersonaDto;
import com.sobee.sobee.domain.user.dto.UserRequestDto;
import com.sobee.sobee.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody UserRequestDto dto) {
        userService.register(dto);
        return ResponseEntity.ok("회원가입 성공");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody UserRequestDto dto) {
        String token = userService.login(dto.getEmail());
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{userId}/name")
    public ResponseEntity<Map<String, String>> getUserName(@PathVariable Long userId) {
        Map<String, String> result = new HashMap<>();
        result.put("name", userService.getUserName(userId));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{userId}/persona")
    public ResponseEntity<UserPersonaDto> getPersona(@PathVariable Long userId) {
        return ResponseEntity.ok(userService.getPersona(userId));
    }

    // 회원 탈퇴 — is_active = false (Soft Delete)
    @DeleteMapping("/{userId}")
    public ResponseEntity<String> deleteUser(@PathVariable Long userId) {
        userService.deactivateUser(userId);
        return ResponseEntity.ok("회원 탈퇴 완료");
    }
}