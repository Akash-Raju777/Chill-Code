package com.chillcode.assessment.security;

import com.chillcode.assessment.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

public class CustomUserDetails implements UserDetails {

    private final User user;
    private final String identifier;

    public CustomUserDetails(User user) {
        this(user, user.getRegisterNumber() != null ? user.getRegisterNumber() : user.getUsername());
    }

    public CustomUserDetails(User user, String identifier) {
        this.user = user;
        this.identifier = identifier;
    }

    public User getUser() {
        return user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        if (identifier != null && !identifier.trim().isEmpty()) {
            return identifier;
        }
        return user.getRegisterNumber() != null ? user.getRegisterNumber() : user.getUsername();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
