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
      if (!token) throw new Error("No token returned");
      
      const req2 = http.request({
        hostname: 'localhost',
        port: 8080,
        path: '/api/student/questions/47',
        method: 'GET',
        headers: {'Authorization': 'Bearer ' + token}
      }, res2 => {
        let data2 = '';
        res2.on('data', d => data2 += d);
        res2.on('end', () => {
          console.log(data2);
        });
      });
      req2.end();
    } catch(e) {
      console.log(data); // print raw response
    }
  });
});
// Need valid student credentials! Let's check DB for students!
