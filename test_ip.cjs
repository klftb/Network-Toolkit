const https = require('https');

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...headers }, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function run() {
  try {
    const r1 = await fetch('https://api.ip.sb/geoip/8.8.8.8');
    console.log('ip.sb:', r1.status, r1.data.slice(0, 100));
  } catch (e) { console.log('ip.sb err:', e.message); }

  try {
    const r2 = await fetch('https://ipapi.co/8.8.8.8/json/');
    console.log('ipapi.co:', r2.status, r2.data.slice(0, 100));
  } catch (e) { console.log('ipapi.co err:', e.message); }

  try {
    const r3 = await fetch('https://qifu-api.baidubce.com/info/pip?ip=8.8.8.8');
    console.log('baidu bce:', r3.status, r3.data.slice(0, 100));
  } catch (e) { console.log('baidu bce err:', e.message); }
  
  process.exit();
}
run();
