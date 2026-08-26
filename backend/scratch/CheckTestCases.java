import java.sql.*;

public class CheckTestCases {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            ResultSet rs = stmt.executeQuery(
                "SELECT st.id, u.name, st.score, st.test_cases_passed, st.time_taken_seconds " +
                "FROM student_tests st " +
                "JOIN app_users u ON st.student_id = u.id " +
                "JOIN tests t ON st.test_id = t.id " +
                "WHERE t.test_code = 'PY-1' AND st.score > 0");
            while (rs.next()) {
                System.out.printf("ST ID: %d, User: %s, Score: %d, TCPassed: %d, Time: %d%n",
                    rs.getLong(1), rs.getString(2), rs.getInt(3), rs.getInt(4), rs.getLong(5));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
