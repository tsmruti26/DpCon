package com.dpdp_consent.demo.service;

import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.security.SecureRandom;

@Service
public class MfaService {

    /**
     * Generates a new secret key for the user's Authenticator App.
     */
    public String generateNewSecret() {
        StringBuilder sb = new StringBuilder();
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        SecureRandom rnd = new SecureRandom();
        // 32 Base32 characters represent 160 bits, the RFC 6238 recommended key size.
        for (int i = 0; i < 32; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }

    /**
     * Generates a QR code URL for the user to scan.
     */
    public String getQrCodeUrl(String username, String secret) {
        return String.format("otpauth://totp/DpConWallet:%s?secret=%s&issuer=DpConWallet",
                             username, secret);
    }

    /**
     * Verifies the 6-digit code entered by the user.
     */
    public boolean verifyCode(String secret, int code) {
        try {
            long timeWindow = System.currentTimeMillis() / 1000L / 30L;
            for (int i = -1; i <= 1; i++) {
                if (calculateTotp(secret, timeWindow + i) == code) {
                    return true;
                }
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    private int calculateTotp(String secret, long interval) throws GeneralSecurityException {
        byte[] key = decodeBase32(secret);
        byte[] data = ByteBuffer.allocate(8).putLong(interval).array();

        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec(key, "HmacSHA1"));
        byte[] hash = mac.doFinal(data);

        int offset = hash[hash.length - 1] & 0xf;
        int binary = ((hash[offset] & 0x7f) << 24) |
                     ((hash[offset + 1] & 0xff) << 16) |
                     ((hash[offset + 2] & 0xff) << 8) |
                     (hash[offset + 3] & 0xff);

        return binary % 1000000;
    }

    private byte[] decodeBase32(String base32) {
        String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        byte[] buffer = new byte[(base32.length() * 5) / 8];
        int val = 0;
        int bits = 0;
        int index = 0;

        for (char c : base32.toCharArray()) {
            int v = alphabet.indexOf(Character.toUpperCase(c));
            if (v == -1) continue;
            val = (val << 5) | v;
            bits += 5;
            if (bits >= 8) {
                buffer[index++] = (byte) ((val >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return Arrays.copyOf(buffer, index);
    }
}
