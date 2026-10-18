package com.dpdp_consent.demo.repository;
import com.dpdp_consent.demo.model.OtpToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
public interface OtpTokenRepository extends JpaRepository<OtpToken, Long> {
    Optional<OtpToken> findTopByPseudoIdAndUsedFalseOrderByIdDesc(String pseudoId);
    @Transactional void deleteByPseudoId(String pseudoId);
}