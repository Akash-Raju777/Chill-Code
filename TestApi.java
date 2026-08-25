import java.io.InputStreamReader;
import java.io.BufferedReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class TestApi {
    public static void main(String[] args) throws Exception {
        // Step 1: Login
        URL loginUrl = new URL("http://localhost:8080/api/auth/login");
        HttpURLConnection con = (HttpURLConnection) loginUrl.openConnection();
        con.setRequestMethod("POST");
        con.setRequestProperty("Content-Type", "application/json");
        con.setDoOutput(true);
        con.getOutputStream().write("{\"identifier\":\"admin1\",\"password\":\"password\"}".getBytes());
        
        BufferedReader br = new BufferedReader(new InputStreamReader(con.getInputStream()));
        String loginRes = br.readLine();
        String token = loginRes.split("\"jwt\":\"")[1].split("\"")[0];
        
        // Step 2: Fetch Question
        URL qUrl = new URL("http://localhost:8080/api/student/questions/47");
        HttpURLConnection qCon = (HttpURLConnection) qUrl.openConnection();
        qCon.setRequestMethod("GET");
        qCon.setRequestProperty("Authorization", "Bearer " + token);
        
        BufferedReader qBr = new BufferedReader(new InputStreamReader(qCon.getInputStream()));
        String line;
        while((line = qBr.readLine()) != null) {
            System.out.println(line);
        }
    }
}
