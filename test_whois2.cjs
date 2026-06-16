const https = require('https');

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers, timeout: 8000 }, (res) => {
      // follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location, headers).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function run() {
  try {
    const r1 = await fetch('https://who-dat.as93.net/baidu.com');
    console.log('who-dat:', r1.status, r1.data.slice(0, 100));
  } catch (e) { console.log('who-dat err:', e.message); }

  try {
    const r2 = await fetch('https://rdap.apnic.net/domain/baidu.com');
    console.log('apnic rdap:', r2.status, r2.data.slice(0, 100));
  } catch (e) { console.log('apnic rdap err:', e.message); }

  try {
    const r3 = await fetch('https://whois.devclub.cn/api/whois?domain=baidu.com');
    console.log('devclub:', r3.status, r3.data.slice(0, 100));
  } catch (e) { console.log('devclub err:', e.message); }
  
  process.exit();
}
run();
