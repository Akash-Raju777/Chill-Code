import java.sql.*;

public class CheckSAs {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            ResultSet rs = stmt.executeQuery("SELECT id, student_id, test_id, test_code, badge_name FROM student_achievements");
            while (rs.next()) {
                System.out.printf("SA ID: %d, Student ID: %d, Test ID: %d, Test Code: %s, Badge: %s%n",
                    rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getString(4), rs.getString(5));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
