import java.sql.*;

public class DumpAchievements {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            System.out.println("--- All Student Achievements ---");
            ResultSet rs = stmt.executeQuery(
                "SELECT sa.id, u.name, sa.test_code, sa.rank_achieved, sa.badge_name " +
                "FROM student_achievements sa " +
                "JOIN app_users u ON sa.student_id = u.id");
            while (rs.next()) {
                System.out.printf("SA ID: %d, User: %s, TestCode: %s, RankAchieved: %s, BadgeName: %s%n",
                    rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
