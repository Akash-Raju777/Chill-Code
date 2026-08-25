public class DbTest3 {
    public static void main(String[] args) throws Exception {
        java.sql.Connection c = java.sql.DriverManager.getConnection(
            "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require", 
            "postgres.kuvllswyxrtjjbougrgy", 
            "AkashAkASh@777"
        );
        java.sql.Statement s = c.createStatement();
        java.sql.ResultSet rs = s.executeQuery("SELECT identifier, password, role FROM users LIMIT 5");
        while(rs.next()) {
            System.out.println("ID: " + rs.getString("identifier") + ", PWD: " + rs.getString("password") + ", ROLE: " + rs.getString("role"));
        }
    }
}
