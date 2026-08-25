public class DbTest2 {
    public static void main(String[] args) throws Exception {
        java.sql.Connection c = java.sql.DriverManager.getConnection(
            "jdbc:postgresql://aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require", 
            "postgres.kuvllswyxrtjjbougrgy", 
            "AkashAkASh@777"
        );
        java.sql.Statement s = c.createStatement();
        java.sql.ResultSet rs = s.executeQuery("SELECT * FROM test_cases");
        while(rs.next()) {
            System.out.println("ID: " + rs.getLong("id") + ", QID: " + rs.getLong("question_id"));
            System.out.println("Input: " + rs.getString("input_data"));
            System.out.println("Output: " + rs.getString("expected_output"));
            System.out.println("Hidden: " + rs.getBoolean("is_hidden"));
            System.out.println("-------");
        }
    }
}
