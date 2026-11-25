package com.chillcode.assessment.security;

import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    /**
     * Short-TTL cache for the per-request JWT filter lookup.
     * Every authenticated request calls loadUserByUsername(); hitting the DB
     * each time added a ~300-400ms floor to ALL endpoints (remote Supabase RTT).
     * 15s TTL: status changes (suspend/inactive) propagate within 15s while
     * eliminating the vast majority of per-request user lookups.
     */
    private static final long CACHE_TTL_MS = 15_000L;
    private static final int MAX_CACHE_ENTRIES = 10_000;

    private static final class CacheEntry {
        final UserDetails details;
        final long expiresAt;

        CacheEntry(UserDetails details, long expiresAt) {
            this.details = details;
            this.expiresAt = expiresAt;
        }
    }

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        long now = System.currentTimeMillis();
        CacheEntry cached = cache.get(identifier);
        if (cached != null && now < cached.expiresAt) {
            return cached.details;
        }

        User user = userRepository.findByIdentifier(identifier).orElseThrow(() ->
            new UsernameNotFoundException("User not found with identifier: " + identifier));

        UserDetails details = new CustomUserDetails(user, identifier);

        // Opportunistic size bound: drop expired entries, then oldest if still oversized
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            cache.entrySet().removeIf(e -> now >= e.getValue().expiresAt);
            if (cache.size() >= MAX_CACHE_ENTRIES) {
                cache.clear();
            }
        }
        cache.put(identifier, new CacheEntry(details, now + CACHE_TTL_MS));

        return details;
    }

    /**
     * Evict a single user from the auth cache (call on login, status change,
     * password change, or role change so effects are immediate).
     */
    public void evict(String identifier) {
        if (identifier != null) {
            cache.remove(identifier);
        }
    }

    /** Evict the entire auth cache (used on bulk administrative actions). */
    public void evictAll() {
        cache.clear();
    }
}
