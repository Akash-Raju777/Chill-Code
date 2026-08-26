package com.chillcode.assessment;

import org.springframework.context.ApplicationContext;
import org.springframework.boot.SpringApplication;
import com.chillcode.assessment.ChillCodeApplication;
import com.chillcode.assessment.service.BadgeSetService;

public class TestFix {
    public static void main(String[] args) {
        ApplicationContext ctx = SpringApplication.run(ChillCodeApplication.class, args);
        BadgeSetService badgeService = ctx.getBean(BadgeSetService.class);
        try {
            System.out.println("--- TRIGGERING BADGE ALLOCATION ---");
            badgeService.allocateBadgesForTest(461L);
            System.out.println("--- DONE ---");
        } catch (Exception e) {
            e.printStackTrace();
        }
        System.exit(0);
    }
}
