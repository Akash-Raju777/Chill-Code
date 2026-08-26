import java.sql.*;

public class QueryDb {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {
            
            System.out.println("--- All Student Tests for jd ---");
            ResultSet rs = stmt.executeQuery(
                "SELECT t.test_code, st.score, st.test_cases_passed, st.time_taken_seconds, st.status " +
                "FROM student_tests st " +
                "JOIN app_users u ON st.student_id = u.id " +
                "JOIN tests t ON st.test_id = t.id " +
                "WHERE u.username = 'jd'");
            while (rs.next()) {
                System.out.printf("Test: %s, Score: %d, TC Passed: %d, Time: %d, Status: %s%n",
                    rs.getString(1), rs.getInt(2), rs.getInt(3), rs.getLong(4), rs.getString(5));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
