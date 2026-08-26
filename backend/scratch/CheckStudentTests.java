import java.sql.*;

public class CheckStudentTests {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            System.out.println("--- All Student Tests for PY-1 ---");
            ResultSet rs = stmt.executeQuery(
                "SELECT st.id, u.name, t.test_code, st.score, st.time_taken_seconds " +
                "FROM student_tests st " +
                "JOIN app_users u ON st.student_id = u.id " +
                "JOIN tests t ON st.test_id = t.id " +
                "WHERE t.test_code = 'PY-1'");
            while (rs.next()) {
                System.out.printf("ST ID: %d, User: %s, Code: %s, Score: %d, Time: %d%n",
                    rs.getLong(1), rs.getString(2), rs.getString(3), rs.getInt(4), rs.getLong(5));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
