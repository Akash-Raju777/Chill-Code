import java.sql.*;

public class CheckBD {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            ResultSet rs = stmt.executeQuery("SELECT rank_position, badge_name FROM badge_definitions WHERE badge_set_id = 58");
            while (rs.next()) {
                System.out.printf("Rank: %d, Badge: %s%n",
                    rs.getInt(1), rs.getString(2));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
