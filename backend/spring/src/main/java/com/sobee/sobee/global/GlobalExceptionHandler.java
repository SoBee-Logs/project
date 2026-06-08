package com.sobee.sobee.global;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<String> handleRuntimeException(RuntimeException e) {
        if (e.getMessage() != null && e.getMessage().contains("토큰")) {
            return ResponseEntity.status(401).body("인증이 필요합니다.");
        }
        return ResponseEntity.status(400).body(e.getMessage());
    }

    @ExceptionHandler(org.springframework.web.bind.MissingRequestHeaderException.class)
    public ResponseEntity<String> handleMissingHeader(org.springframework.web.bind.MissingRequestHeaderException e) {
        return ResponseEntity.status(401).body("인증이 필요합니다.");
    }
}