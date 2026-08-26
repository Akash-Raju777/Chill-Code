import java.sql.*;

public class CheckTestId {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            ResultSet rs = stmt.executeQuery(
                "SELECT st.test_id, st.id, u.name, st.score, st.time_taken_seconds " +
                "FROM student_tests st " +
                "JOIN app_users u ON st.student_id = u.id " +
                "WHERE u.name = 'jd' AND st.score > 0");
            while (rs.next()) {
                System.out.printf("Test ID: %d, ST ID: %d, User: %s, Score: %d, Time: %d%n",
                    rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getInt(4), rs.getLong(5));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
