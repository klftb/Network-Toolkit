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
    const r1 = await fetch('https://cloudflare-dns.com/dns-query?name=www.baidu.com&type=A', { 'Accept': 'application/dns-json' });
    console.log('Cloudflare:', r1.status, r1.data.slice(0, 100));
  } catch (e) { console.log('Cloudflare err:', e.message); }

  try {
    const r2 = await fetch('https://dns.google/resolve?name=www.baidu.com&type=A');
    console.log('Google:', r2.status, r2.data.slice(0, 100));
  } catch (e) { console.log('Google err:', e.message); }

  try {
    const r3 = await fetch('https://223.5.5.5/resolve?name=www.baidu.com&type=A', { 'Accept': 'application/dns-json' });
    console.log('AliDNS IP:', r3.status, r3.data.slice(0, 100));
  } catch (e) { console.log('AliDNS IP err:', e.message); }
  
  process.exit();
}
run();
