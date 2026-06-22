const http = require('http');

http.get('http://localhost:5000/api/daybooks', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status Code:", res.statusCode);
    console.log("Headers:", res.headers);
    console.log("Response Body Length:", data.length);
    console.log("Response Body:", data.substring(0, 1000));
  });
}).on('error', (err) => {
  console.error("Local API request failed:", err.message);
});
