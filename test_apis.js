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
    const r1 = await fetch('https://dns.alicdn.com/resolve?name=www.baidu.com&type=A', { 'Accept': 'application/dns-json' });
    console.log('AliDNS:', r1.status, r1.data.slice(0, 100));
  } catch (e) { console.log('AliDNS err:', e.message); }

  try {
    const r2 = await fetch('https://api.vvhan.com/api/whois?domain=baidu.com');
    console.log('vvhan:', r2.status, r2.data.slice(0, 100));
  } catch (e) { console.log('vvhan err:', e.message); }

  try {
    const r3 = await fetch('https://demo.ip-api.com/json/www.baidu.com?lang=zh-CN');
    console.log('ip-api:', r3.status, r3.data.slice(0, 100));
  } catch (e) { console.log('ip-api err:', e.message); }
  
  process.exit();
}
run();
