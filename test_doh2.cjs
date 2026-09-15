const https = require('https');

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function run() {
  try {
    const r1 = await fetch('https://doh.pub/dns-query?name=www.baidu.com&type=A', { 'Accept': 'application/dns-json' });
    console.log('Tencent DoH:', r1.status, r1.data.slice(0, 100));
  } catch (e) { console.log('Tencent DoH err:', e.message); }

  try {
    const r2 = await fetch('https://dns.alidns.com/resolve?name=www.baidu.com&type=A');
    console.log('AliDNS:', r2.status, r2.data.slice(0, 100));
  } catch (e) { console.log('AliDNS err:', e.message); }
  
  process.exit();
}
run();
