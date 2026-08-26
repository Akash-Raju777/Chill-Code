import java.sql.*;

public class CheckAllScores {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            ResultSet rs = stmt.executeQuery(
                "SELECT u.name, st.score, st.time_taken_seconds, st.submitted_at " +
                "FROM student_tests st " +
                "JOIN app_users u ON st.student_id = u.id " +
                "JOIN tests t ON st.test_id = t.id " +
                "WHERE t.test_code = 'PY-1' AND st.score > 0 " +
                "ORDER BY st.score DESC, st.time_taken_seconds ASC");
            while (rs.next()) {
                System.out.printf("User: %s, Score: %d, Time: %d, Submitted: %s%n",
                    rs.getString(1), rs.getInt(2), rs.getLong(3), rs.getString(4));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
