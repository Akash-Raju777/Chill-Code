import java.sql.*;

public class CheckSchema {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
        String user = "postgres.kuvllswyxrtjjbougrgy";
        String password = "AkashAkASh@777";
        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            ResultSet rs = stmt.executeQuery("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'student_achievements'");
            while (rs.next()) {
                System.out.printf("Constraint: %s, Def: %s%n",
                    rs.getString(1), rs.getString(2));
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
