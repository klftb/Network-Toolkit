const express = require('express');
const ping = require('ping');
const net = require('net');
const whois = require('whois');
const dgram = require('dgram');

const app = express();
app.use(express.json());

// Enable CORS if needed (WeChat Cloud Run handles internal proxy, but good to have)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Health check endpoint for WeChat Cloud Run
app.get('/', (req, res) => {
  res.send('Network Toolkit Cloud Backend is running.');
});

// 1. Ping / TCPing / UDP
app.post('/api/ping', async (req, res) => {
  const { target, protocol, port } = req.body;
  
  if (!target) {
    return res.status(400).json({ error: "Target is required" });
  }

  if (protocol === "icmp") {
    try {
      const result = await ping.promise.probe(target, { timeout: 3 });
      res.json({
        alive: result.alive,
        time: result.time,
        output: result.output,
      });
    } catch (err) {
      res.json({ alive: false, time: null, output: err.message });
    }
  } else if (protocol === "tcp") {
    const start = Date.now();
    const sock = new net.Socket();
    sock.setTimeout(3000);
    
    let _handled = false;
    
    sock.on("connect", () => {
      if (_handled) return;
      _handled = true;
      const time = Date.now() - start;
      sock.destroy();
      res.json({ 
        alive: true, 
        time, 
        output: `TCP connection to ${target}:${port} successful\\nTime: ${time}ms` 
      });
    })
    .on("error", (e) => {
      if (_handled) return;
      _handled = true;
      res.json({ alive: false, time: null, output: `Connection failed: ${e.message}` });
    })
    .on("timeout", () => {
      if (_handled) return;
      _handled = true;
      sock.destroy();
      res.json({ alive: false, time: null, output: `Connection timed out after 3000ms` });
    })
    .connect(parseInt(port) || 80, target);
  } else if (protocol === "udp") {
    const client = dgram.createSocket('udp4');
    const message = Buffer.from('ping');
    const start = Date.now();
    let _handled = false;
    
    const timeout = setTimeout(() => {
      if (_handled) return;
      _handled = true;
      client.close();
      res.json({ alive: true, time: null, output: `UDP packet sent to ${target}:${port}\\n(Note: UDP is stateless, lack of error implies packet was transmitted but does not guarantee receipt)` });
    }, 1000);

    client.on('error', (err) => {
      if (_handled) return;
      _handled = true;
      clearTimeout(timeout);
      client.close();
      res.json({ alive: false, time: null, output: `UDP error: ${err.message}` });
    });

    client.on('message', (msg) => {
      if (_handled) return;
      _handled = true;
      clearTimeout(timeout);
      const time = Date.now() - start;
      client.close();
      res.json({ alive: true, time, output: `UDP reply received from ${target}:${port}\\nTime: ${time}ms\\nData: ${msg.byteLength} bytes` });
    });

    client.send(message, parseInt(port) || 80, target, (err) => {
      if (err) {
          if (!_handled) {
            _handled = true;
            clearTimeout(timeout);
            client.close();
            res.json({ alive: false, time: null, output: `UDP send error: ${err.message}` });
          }
      }
    });
  } else {
    res.status(400).json({ error: "Unsupported protocol" });
  }
});

// 2. IP/Port Scanner
app.post("/api/portscan", async (req, res) => {
  const { targets, ports } = req.body;
  const actualTargets = Array.isArray(targets) ? targets : (req.body.target ? [req.body.target] : []);
  
  if (actualTargets.length === 0 || !ports || !Array.isArray(ports)) {
      return res.status(400).json({ error: "Targets and ports array are required" });
  }

  const results = [];
  const scanPort = (target, port) => {
    return new Promise((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(800);
      let status = "closed";

      sock.on("connect", () => {
        status = "open";
        sock.destroy();
      }).on("timeout", () => {
        status = "filtered"; 
        sock.destroy();
      }).on("error", () => {
        status = "closed";
      }).on("close", () => {
        resolve({ target, port, status });
      }).connect(port, target);
    });
  };

  const tasks = [];
  for (const t of actualTargets) {
    for (const p of ports) {
      tasks.push({ target: t, port: p });
    }
  }

  const MAX_CONCURRENT = 1000;
  let index = 0;
  const worker = async () => {
    while (index < tasks.length) {
      const { target, port } = tasks[index++];
      results.push(await scanPort(target, port));
    }
  };
  
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, tasks.length) }, worker);
  await Promise.all(workers);

  res.json({ results });
});

// 3. Whois
app.get("/api/whois", (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: "Target required" });

  whois.lookup(target, { timeout: 10000 }, (err, data) => {
    if (err) {
      return res.json({ result: `Error performing WHOIS: ${err.message}` });
    }
    res.json({ result: data });
  });
});

// 4. IP Lookup Proxy (avoids 403 from third-party APIs in mini program)
app.get("/api/iplookup", async (req, res) => {
  const target = req.query.target || '';
  const https = require('https');
  const http = require('http');

  const tryApi = (url, parse, useHttp) => {
    return new Promise((resolve) => {
      const mod = useHttp ? http : https;
      const request = mod.get(url, { timeout: 6000 }, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => {
          try {
            const data = JSON.parse(body);
            const result = parse(data);
            resolve(result);
          } catch { resolve(null); }
        });
      });
      request.on('error', () => resolve(null));
      request.on('timeout', () => { request.destroy(); resolve(null); });
    });
  };

  // Try ipwho.is first
  let result = await tryApi(
    `https://ipwho.is/${target}`,
    (d) => d.success !== false ? {
      ip: d.ip, country: d.country || '-', region: d.region || '-',
      city: d.city || '-', isp: (d.connection?.org || d.connection?.isp || '-'),
      asn: d.connection?.asn ? 'AS' + d.connection.asn : '-',
      timezone: d.timezone?.id || '-'
    } : null,
    false
  );

  // Fallback to ip-api.com
  if (!result) {
    result = await tryApi(
      `http://ip-api.com/json/${target}?lang=zh-CN`,
      (d) => d.status === 'success' ? {
        ip: d.query, country: d.country || '-', region: d.regionName || '-',
        city: d.city || '-', isp: d.isp || d.org || '-',
        asn: d.as ? d.as.split(' ')[0] : '-', timezone: d.timezone || '-'
      } : null,
      true
    );
  }

  if (result) {
    res.json(result);
  } else {
    res.status(502).json({ error: 'All upstream APIs failed' });
  }
});

// Start Server (WeChat Cloud Run defaults to Port 80)
const PORT = process.env.PORT || 80;

// 5. Website Connectivity Test
app.get("/api/website-test", async (req, res) => {
  const sites = [
    { name: "百度", host: "www.baidu.com", port: 443, category: "domestic" },
    { name: "腾讯", host: "www.qq.com", port: 443, category: "domestic" },
    { name: "阿里云", host: "www.aliyun.com", port: 443, category: "domestic" },
    { name: "京东", host: "www.jd.com", port: 443, category: "domestic" },
    { name: "哔哩哔哩", host: "www.bilibili.com", port: 443, category: "domestic" },
    { name: "Google", host: "www.google.com", port: 443, category: "global" },
    { name: "GitHub", host: "github.com", port: 443, category: "global" },
    { name: "AWS", host: "aws.amazon.com", port: 443, category: "global" },
    { name: "Azure", host: "portal.azure.com", port: 443, category: "global" },
    { name: "Cloudflare", host: "www.cloudflare.com", port: 443, category: "global" },
  ];

  const testSite = (site) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const sock = new net.Socket();
      sock.setTimeout(3000);
      sock.on("connect", () => {
        const latency = Date.now() - start;
        sock.destroy();
        resolve({ ...site, alive: true, latency });
      });
      sock.on("error", (e) => {
        resolve({ ...site, alive: false, error: e.message });
      });
      sock.on("timeout", () => {
        sock.destroy();
        resolve({ ...site, alive: false, error: "timeout" });
      });
      sock.connect(site.port, site.host);
    });
  };

  const results = await Promise.all(sites.map(testSite));
  res.json({ results });
});

// 6. Speed Test (generate random data for download speed measurement)
app.get("/api/speedtest", (req, res) => {
  const sizeMB = parseInt(req.query.size) || 1;
  const bytes = Math.min(sizeMB, 10) * 1024 * 1024; // Max 10MB
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': bytes,
    'Cache-Control': 'no-cache'
  });
  // Generate random chunks
  const chunkSize = 65536;
  let sent = 0;
  const sendChunk = () => {
    while (sent < bytes) {
      const size = Math.min(chunkSize, bytes - sent);
      const buf = Buffer.alloc(size, 0x41);
      if (!res.write(buf)) {
        sent += size;
        res.once('drain', sendChunk);
        return;
      }
      sent += size;
    }
    res.end();
  };
  sendChunk();
});

app.listen(PORT, () => {
  console.log(`Cloud Backend running on port ${PORT}`);
});
