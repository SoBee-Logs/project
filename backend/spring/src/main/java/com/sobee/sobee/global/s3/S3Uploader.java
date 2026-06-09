package com.sobee.sobee.global.s3;

import lombok.RequiredArgsConstructor;
import org.imgscalr.Scalr;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class S3Uploader {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    public String upload(MultipartFile file) {
        String fileName = "photos/" + UUID.randomUUID() + "_" + file.getOriginalFilename();

        try {
            byte[] imageBytes;
            String contentType = file.getContentType();

            if (contentType != null && contentType.startsWith("image/")) {
                BufferedImage original = ImageIO.read(file.getInputStream());
                if (original != null && (original.getWidth() > 1080 || original.getHeight() > 1080)) {
                    BufferedImage resized = Scalr.resize(original, Scalr.Method.QUALITY, 1080);
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    ImageIO.write(resized, "jpg", baos);
                    imageBytes = baos.toByteArray();
                    contentType = "image/jpeg";
                } else {
                    imageBytes = file.getBytes();
                }
            } else {
                imageBytes = file.getBytes();
            }

            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(fileName)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromBytes(imageBytes)
            );
        } catch (IOException e) {
            throw new RuntimeException("S3 업로드 실패", e);
        }

        return "https://" + bucket + ".s3.ap-northeast-2.amazonaws.com/" + fileName;
    }
}