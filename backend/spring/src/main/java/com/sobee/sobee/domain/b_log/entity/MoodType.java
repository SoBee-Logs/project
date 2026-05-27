package com.sobee.sobee.domain.b_log.entity;

public enum MoodType {
    HAPPY("☺️"),
    SAD("😭"),
    SURPRISED("😮"),
    LOVE("😍"),
    ANGRY("😡");

    private final String emoji;

    MoodType(String emoji) {
        this.emoji = emoji;
    }

    public String getEmoji() {
        return emoji;
    }
}