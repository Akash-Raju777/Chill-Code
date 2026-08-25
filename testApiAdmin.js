const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 8080,
  path: '/api/auth/login',
  method: 'POST',
  headers: {'Content-Type': 'application/json'}
}, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const token = JSON.parse(data).jwt;
      console.log("Token:", token.substring(0, 20) + "...");
      
      const req2 = http.request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/admin/questions/47',
        method: 'GET',
        headers: {'Authorization': 'Bearer ' + token}
      }, res2 => {
        let data2 = '';
        res2.on('data', d => data2 += d);
        res2.on('end', () => {
          console.log("Question 47:");
          console.log(JSON.stringify(JSON.parse(data2), null, 2));
        });
      });
      req2.end();
    } catch(e) {
      console.log(data);
    }
  });
});
req.write(JSON.stringify({identifier: 'admin1', password: 'password'}));
req.end();
