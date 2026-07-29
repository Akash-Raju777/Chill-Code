package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findBySubjectId(Long subjectId);
    java.util.Optional<Question> findBySubjectIdAndTitle(Long subjectId, String title);
    java.util.Optional<Question> findByQuestionCode(String questionCode);
}
