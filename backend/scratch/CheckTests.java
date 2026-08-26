import java.sql.*;

public class CheckTests {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            System.out.println("--- All Badge Sets ---");
            ResultSet rs = stmt.executeQuery(
                "SELECT id, test_id, number_of_winners FROM badge_sets");
            while (rs.next()) {
                System.out.printf("BadgeSet ID: %d, Test ID: %d, Winners: %d%n",
                    rs.getLong(1), rs.getLong(2), rs.getInt(3));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
