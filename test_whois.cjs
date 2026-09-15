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
    const r1 = await fetch('https://rdap.org/domain/baidu.com');
    console.log('rdap:', r1.status, r1.data.slice(0, 200));
  } catch (e) { console.log('rdap err:', e.message); }

  process.exit();
}
run();
