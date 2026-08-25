import com.fasterxml.jackson.databind.ObjectMapper;

public class JacksonTest {
    public static void main(String[] args) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        com.chillcode.assessment.dto.TestCaseDto dto = com.chillcode.assessment.dto.TestCaseDto.builder()
            .id(1L)
            .inputData("ash")
            .expectedOutput("ash")
            .isHidden(false)
            .marks(5)
            .build();
        System.out.println(mapper.writeValueAsString(dto));
    }
}
