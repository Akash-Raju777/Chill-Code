package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.SubjectRepository;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/super-admin/settings")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class DepartmentSettingsController {

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/departments")
    public ResponseEntity<List<Map<String, Object>>> getDepartments() {
        List<User> staff = userRepository.findByRole(Role.ADMIN);
        Set<String> depts = new LinkedHashSet<>();
        for (User s : staff) {
            depts.add(s.getDepartment() != null ? s.getDepartment() : "Unassigned");
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (String dept : depts) {
            Map<String, Object> item = new HashMap<>();
            item.put("department", dept);
            long count = staff.stream()
                    .filter(s -> (s.getDepartment() != null ? s.getDepartment() : "Unassigned").equals(dept)).count();
            item.put("staffCount", count);
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/subjects")
    public ResponseEntity<List<Subject>> getAllSubjects() {
        return ResponseEntity.ok(subjectRepository.findAll());
    }

    @GetMapping("/academic-config")
    public ResponseEntity<Map<String, Object>> getAcademicConfig() {
        Map<String, Object> config = new HashMap<>();
        Set<String> depts = new HashSet<>();
        for (User s : userRepository.findByRole(Role.ADMIN)) {
            depts.add(s.getDepartment() != null ? s.getDepartment() : "Unassigned");
        }
        config.put("totalDepartments", depts.size());
        config.put("totalSubjects", subjectRepository.count());
        config.put("systemVersion", "1.0.0");
        return ResponseEntity.ok(config);
    }
}
