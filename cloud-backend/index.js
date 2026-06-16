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

// Start Server (WeChat Cloud Run defaults to Port 80)
const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Cloud Backend running on port ${PORT}`);
});
