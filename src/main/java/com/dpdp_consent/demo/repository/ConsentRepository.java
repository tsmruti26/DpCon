package com.dpdp_consent.demo.repository;

import com.dpdp_consent.demo.model.Consent;
import com.dpdp_consent.demo.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ConsentRepository extends JpaRepository<Consent, Long> {
    List<Consent> findByUser(User user);
    void deleteByUser(User user);
    List<Consent> findByUserAndStatus(User user, String status);

    // Fixed: Use @Query to find by the username property of the linked User entity
    @Query("SELECT c FROM Consent c WHERE c.user.username = :username")
    List<Consent> findByUsername(@Param("username") String username);

    @Query("SELECT c FROM Consent c WHERE c.id = :id AND c.user.username = :username")
    Optional<Consent> findByIdAndUsername(@Param("id") Long id, @Param("username") String username);
}
