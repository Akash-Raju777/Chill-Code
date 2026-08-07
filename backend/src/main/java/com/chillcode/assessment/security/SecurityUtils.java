package com.chillcode.assessment.security;

import com.chillcode.assessment.entity.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityUtils {

    public static User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails) {
            return ((CustomUserDetails) authentication.getPrincipal()).getUser();
        }
        return null;
    }

    public static Long getCurrentAdminId() {
        User user = getCurrentUser();
        if (user != null) {
            if (user.getRole() == com.chillcode.assessment.entity.Role.ADMIN) {
                return user.getId();
            } else if (user.getRole() == com.chillcode.assessment.entity.Role.STUDENT && user.getAdmin() != null) {
                return user.getAdmin().getId();
            }
        }
        return null;
    }
}
