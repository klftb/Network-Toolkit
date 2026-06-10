import express from "express";
import path from "path";
import ping from "ping";
import net from "net";
import dns from "dns";
import * as whois from "whois";
import { spawn, execSync } from "child_process";
import iconv from "iconv-lite";
import * as ftp from "basic-ftp";
import SftpClient from "ssh2-sftp-client";
import multer from "multer";
import os from "os";
import fs from "fs";
import { EventEmitter } from "events";
// @ts-ignore
import tftp from "tftp";

import { Transform } from "stream";

// Prevent server crashes from unhandled child_process exceptions (like missing traceroute)
const activeStreams = new Map<string, { stream: any, abort: () => void }>();
const transferProgress = new Map<string, { loaded: number, total: number, paused: boolean }>();

class PausableStream extends Transform {
  transferId: string;
  fileSize: number;
  isPausedFlag: boolean = false;
  resumeCallback: (() => void) | null = null;
  loaded: number = 0;

  constructor(transferId: string, fileSize: number) {
    super();
    this.transferId = transferId;
    this.fileSize = fileSize;
    transferProgress.set(transferId, { loaded: 0, total: fileSize, paused: false });
  }

  _transform(chunk: any, encoding: string, callback: any) {
    this.loaded += chunk.length;
    const progress = transferProgress.get(this.transferId);
    if (progress) {
      progress.loaded = this.loaded;
    }

    if (this.isPausedFlag) {
      this.resumeCallback = () => {
        this.resumeCallback = null;
        callback(null, chunk);
      };
    } else {
      callback(null, chunk);
    }
  }

  pauseStream() {
    this.isPausedFlag = true;
    const progress = transferProgress.get(this.transferId);
    if (progress) progress.paused = true;
  }

  resumeStream() {
    this.isPausedFlag = false;
    const progress = transferProgress.get(this.transferId);
    if (progress) progress.paused = false;
    if (this.resumeCallback) {
      this.resumeCallback();
    }
  }

  cancelStream() {
    this.isPausedFlag = false;
    const progress = transferProgress.get(this.transferId);
    if (progress) progress.paused = false;
    if (this.resumeCallback) {
      const cb = this.resumeCallback;
      this.resumeCallback = null;
      cb(new Error("Cancelled"));
    }
    this.destroy(new Error("Cancelled"));
  }
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Increase payload size for speed tests
  app.use(express.json({ limit: "50mb" }));
  app.use(express.text({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  const upload = multer({ dest: os.tmpdir() });

  // --- API Routes --- //

  // 0. FTP / SFTP Connection Test
  app.post("/api/ftp/test-connection", async (req, res) => {
    const { protocol, host, port, user, password } = req.body;
    
    if (!host) return res.status(400).json({ success: false, error: "Host is required" });
    
    const start = Date.now();
    try {
      let fileList: string[] = [];
      if (protocol === "SFTP") {
        const sftp = new SftpClient();
        await sftp.connect({
          host,
          port: parseInt(port) || 22,
          username: user || "anonymous",
          password: password || "",
          readyTimeout: 5000
        });
        const list = await sftp.list("/");
        fileList = list.slice(0, 10).map((f) => `${f.type === 'd' ? 'DIR' : 'FILE'} ${f.name} (${f.size} bytes)`);
        if (list.length > 10) fileList.push(`... and ${list.length - 10} more.`);
        await sftp.end();
      } else {
        const client = new ftp.Client();
        client.ftp.verbose = false;
        await client.access({
          host,
          port: parseInt(port) || 21,
          user: user || "anonymous",
          password: password || "",
          secure: false
        });
        const list = await client.list("/");
        fileList = list.slice(0, 10).map((f) => `${f.isDirectory ? 'DIR' : 'FILE'} ${f.name} (${f.size} bytes)`);
        if (list.length > 10) fileList.push(`... and ${list.length - 10} more.`);
        client.close();
      }
      
      const time = Date.now() - start;
      return res.json({ 
        success: true, 
        time, 
        output: `成功连接到 ${protocol} 服务器。\n耗时: ${time}ms\n\n--- 根目录预览 ---\n${fileList.length > 0 ? fileList.join('\n') : '空目录'}`
      });
    } catch (err: any) {
      return res.json({ 
        success: false, 
        time: null, 
        output: `连接失败: ${err.message}` 
      });
    }
  });

  // 0.05 FTP / SFTP List Directory
  app.post("/api/ftp/list", async (req, res) => {
    const { protocol, host, port, user, password, currentPath } = req.body;
    if (!host) return res.status(400).json({ success: false, error: "Host is required" });

    try {
      let files: any[] = [];
      const targetPath = currentPath || ".";
      if (protocol === "SFTP") {
        const sftp = new SftpClient();
        await sftp.connect({ host, port: parseInt(port) || 22, username: user || "anonymous", password: password || "", readyTimeout: 5000 });
        const list = await sftp.list(targetPath);
        files = list.map(f => ({ name: f.name, type: f.type === 'd' ? 'd' : '-', size: f.size, mtime: f.modifyTime }));
        await sftp.end();
      } else {
        const client = new ftp.Client();
        await client.access({ host, port: parseInt(port) || 21, user: user || "anonymous", password: password || "", secure: false });
        const list = await client.list(targetPath);
        files = list.map(f => ({ name: f.name, type: f.isDirectory ? 'd' : '-', size: f.size, mtime: f.modifiedAt ? new Date(f.modifiedAt).getTime() : 0 }));
        client.close();
      }
      return res.json({ success: true, files });
    } catch (err: any) {
      return res.json({ success: false, error: err.message });
    }
  });

  // 0.1 FTP / SFTP Download
  app.post("/api/ftp/download", async (req, res) => {
    const { protocol, host, port, user, password, remotePath, transferId } = req.body;
    if (!host || !remotePath) return res.status(400).json({ success: false, error: "Missing required fields" });

    const localFileName = `download_${transferId || Date.now()}_${path.basename(remotePath)}`;
    const localPath = path.join(os.tmpdir(), localFileName);
    
    try {
      let fileSize = 100;
      let abortFn = () => {};

      if (protocol === "SFTP") {
        const sftp = new SftpClient();
        await sftp.connect({ host, port: parseInt(port) || 22, username: user || "anonymous", password: password || "", readyTimeout: 5000 });
        const stat = await sftp.stat(remotePath);
        fileSize = stat.size || 100;
        
        const pStream = new PausableStream(transferId || "", fileSize);
        abortFn = () => { sftp.end(); };
        if (transferId) activeStreams.set(transferId, { stream: pStream, abort: abortFn });

        const ws = fs.createWriteStream(localPath);
        pStream.pipe(ws);
        
        const getPromise = sftp.get(remotePath, pStream);
        
        await new Promise<void>((resolve, reject) => {
          ws.on('finish', resolve);
          ws.on('error', reject);
          pStream.on('error', reject);
        });
        
        await getPromise;
        await sftp.end();
      } else {
        const client = new ftp.Client();
        await client.access({ host, port: parseInt(port) || 21, user: user || "anonymous", password: password || "", secure: false });
        const size = await client.size(remotePath);
        fileSize = size || 100;
        
        const pStream = new PausableStream(transferId || "", fileSize);
        abortFn = () => { client.close(); };
        if (transferId) activeStreams.set(transferId, { stream: pStream, abort: abortFn });

        const ws = fs.createWriteStream(localPath);
        pStream.pipe(ws);

        await client.downloadTo(pStream, remotePath);
        client.close();
      }
      
      if (transferId) {
        transferProgress.delete(transferId);
        activeStreams.delete(transferId);
      }
      return res.json({ success: true, fileId: localFileName, fileName: path.basename(remotePath) });
    } catch (err: any) {
      console.error("Download error:", err);
      if (transferId) {
        transferProgress.delete(transferId);
        activeStreams.delete(transferId);
      }
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      return res.json({ success: false, error: err.message });
    }
  });

  // 0.35 Serve downloaded file to browser
  app.get("/api/ftp/serve", (req, res) => {
    const fileId = req.query.fileId as string;
    const fileName = req.query.fileName as string;
    if (!fileId || !fileName) return res.status(400).send("Missing parameters");
    
    const localPath = path.join(os.tmpdir(), fileId);
    if (fs.existsSync(localPath)) {
      res.download(localPath, fileName, (err) => {
        if (!err) {
          fs.unlink(localPath, () => {}); // Cleanup after successful download
        }
      });
    } else {
      res.status(404).send("File not found or expired");
    }
  });

  // 0.15 FTP / SFTP Transfer Progress
  app.get("/api/ftp/progress", (req, res) => {
    const id = req.query.id as string;
    const progress = transferProgress.get(id);
    if (progress) {
      return res.json({ success: true, loaded: progress.loaded, total: progress.total, paused: progress.paused });
    }
    return res.json({ success: false });
  });

  // 0.16 FTP / SFTP Actions (Pause, Resume, Cancel)
  app.post("/api/ftp/action", (req, res) => {
    const { id, action } = req.body;
    if (!id || !action) return res.status(400).json({ success: false, error: "Missing required fields" });

    const active = activeStreams.get(id);
    if (!active) return res.json({ success: false, error: "Task not found" });

    if (action === "pause") {
      active.stream.pauseStream();
    } else if (action === "resume") {
      active.stream.resumeStream();
    } else if (action === "cancel") {
      active.stream.cancelStream();
      active.abort();
      activeStreams.delete(id);
      transferProgress.delete(id);
    }
    return res.json({ success: true });
  });

  // 0.2 FTP / SFTP Upload
  app.post("/api/ftp/upload", upload.single('file'), async (req, res) => {
    const { protocol, host, port, user, password, remotePath, transferId } = req.body;
    const file = req.file;
    if (!host || !remotePath || !file) return res.status(400).json({ success: false, error: "Missing required fields" });

    if (transferId) {
      transferProgress.set(transferId, { loaded: 0, total: file.size, paused: false });
    }

    try {
      let abortFn = () => {};

      if (protocol === "SFTP") {
        const sftp = new SftpClient();
        await sftp.connect({ host, port: parseInt(port) || 22, username: user || "anonymous", password: password || "", readyTimeout: 5000 });
        
        const pStream = new PausableStream(transferId || "", file.size);
        abortFn = () => { sftp.end(); };
        if (transferId) activeStreams.set(transferId, { stream: pStream, abort: abortFn });

        const rs = fs.createReadStream(file.path);
        rs.pipe(pStream);

        await sftp.put(pStream, remotePath);
        await sftp.end();
      } else {
        const client = new ftp.Client();
        await client.access({ host, port: parseInt(port) || 21, user: user || "anonymous", password: password || "", secure: false });
        
        const pStream = new PausableStream(transferId || "", file.size);
        abortFn = () => { client.close(); };
        if (transferId) activeStreams.set(transferId, { stream: pStream, abort: abortFn });

        const rs = fs.createReadStream(file.path);
        rs.pipe(pStream);

        await client.uploadFrom(pStream, remotePath);
        client.close();
      }
      
      fs.unlinkSync(file.path);
      if (transferId) {
        transferProgress.delete(transferId);
        activeStreams.delete(transferId);
      }
      return res.json({ success: true, message: "文件上传成功" });
    } catch (err: any) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      if (transferId) {
        transferProgress.delete(transferId);
        activeStreams.delete(transferId);
      }
      return res.json({ success: false, error: err.message });
    }
  });

  // 0.25 FTP / SFTP Delete File
  app.post("/api/ftp/delete", async (req, res) => {
    const { protocol, host, port, user, password, remotePath } = req.body;
    if (!host || !remotePath) return res.status(400).json({ success: false, error: "Missing required fields" });

    try {
      if (protocol === "SFTP") {
        const sftp = new SftpClient();
        await sftp.connect({ host, port: parseInt(port) || 22, username: user || "anonymous", password: password || "", readyTimeout: 5000 });
        await sftp.delete(remotePath);
        await sftp.end();
      } else {
        const client = new ftp.Client();
        await client.access({ host, port: parseInt(port) || 21, user: user || "anonymous", password: password || "", secure: false });
        await client.remove(remotePath);
        client.close();
      }
      return res.json({ success: true, message: "文件删除成功" });
    } catch (err: any) {
      return res.json({ success: false, error: err.message });
    }
  });

  // ============================================
  // TFTP SERVER IMPLEMENTATION
  // ============================================
  const tftpEvents = new EventEmitter();
  let tftpServer: any = null;
  const activeTftpTransfers = new Map<string, any>();

  app.get("/api/tftp/status", (req, res) => {
    res.json({
      running: !!tftpServer,
      port: 69,
      root: tftpServer ? tftpServer.root : null
    });
  });

  app.post("/api/tftp/cancel", (req, res) => {
    const { file } = req.body;
    if (!file) return res.status(400).json({ success: false, error: "Missing file name" });
    
    const reqObj = activeTftpTransfers.get(file);
    if (reqObj) {
      try {
        reqObj.abort("Transfer cancelled by server");
        tftpEvents.emit("log", `[WARNING] Transfer for ${file} was forcefully cancelled.`);
        activeTftpTransfers.delete(file);
        return res.json({ success: true });
      } catch (err: any) {
        return res.json({ success: false, error: err.message });
      }
    }
    return res.json({ success: false, error: "Transfer not found" });
  });

  app.post("/api/tftp/start", (req, res) => {
    const { root } = req.body;
    if (tftpServer) {
      return res.json({ success: false, error: "TFTP Server is already running" });
    }
    try {
      if (!fs.existsSync(root)) {
        fs.mkdirSync(root, { recursive: true });
      }
      
      tftpServer = tftp.createServer({
        host: "0.0.0.0",
        port: 69,
        root: root,
        denyPUT: false
      }, (req: any, res: any) => {
        req._listenerCalled = true;
        const clientIP = req.stats.remoteAddress;
        const file = req.file;
        const method = req.method;
        const filename = path.join(root, file);

        activeTftpTransfers.set(file, req);

        tftpEvents.emit("log", `[REQUEST] ${clientIP} requested ${method} /${file}`);

        let transferred = 0;
        let startTime = Date.now();
        let lastEmit = Date.now();

        const emitProgress = (done = false, force = false) => {
          const now = Date.now();
          if (!force && !done && now - lastEmit < 500) return;
          lastEmit = now;
          const elapsed = (now - startTime) / 1000;
          const speed = elapsed > 0 ? transferred / elapsed : 0;
          
          tftpEvents.emit("progress", {
            file,
            direction: method === 'GET' ? 'download' : 'upload',
            transferred,
            speed,
            done
          });
        };

        if (method === "GET") {
          fs.stat(filename, (error, stats) => {
            if (error) {
              req.abort(error.message);
              tftpEvents.emit("log", `[ERROR] GET ${file} failed: ${error.message}`);
              activeTftpTransfers.delete(file);
              return;
            }
            res.setSize(stats.size);
            const rs = fs.createReadStream(filename);
            rs.on("data", (chunk: Buffer) => {
              transferred += chunk.length;
              emitProgress();
            });
            rs.on("error", (err: Error) => {
              req.abort(err.message);
              tftpEvents.emit("log", `[ERROR] GET ${file} stream error: ${err.message}`);
              activeTftpTransfers.delete(file);
            });
            res.on("finish", () => {
              emitProgress(true, true);
              tftpEvents.emit("log", `[SUCCESS] GET ${file} finished (${transferred} bytes)`);
              activeTftpTransfers.delete(file);
            });
            rs.pipe(res);
          });
        } else {
          // PUT
          const ws = fs.createWriteStream(filename);
          req.on("data", (chunk: Buffer) => {
            transferred += chunk.length;
            emitProgress();
          });
          req.on("end", () => {
            emitProgress(true, true);
            tftpEvents.emit("log", `[SUCCESS] PUT ${file} finished (${transferred} bytes)`);
            activeTftpTransfers.delete(file);
          });
          req.on("error", (error: any) => {
            tftpEvents.emit("log", `[ERROR] PUT ${file} failed: ${error.message}`);
            ws.destroy();
            activeTftpTransfers.delete(file);
          });
          req.pipe(ws);
        }
      });

      tftpServer.on("error", (error: any) => {
        tftpEvents.emit("log", `[ERROR] Server error: ${error.message}`);
      });

      tftpServer.listen();
      tftpEvents.emit("log", `[INFO] TFTP Server started on port 69, root directory: ${root}`);
      return res.json({ success: true });
    } catch (err: any) {
      tftpServer = null;
      return res.json({ success: false, error: err.message });
    }
  });

  app.post("/api/tftp/stop", (req, res) => {
    if (tftpServer) {
      try {
        tftpServer.close();
      } catch (e) {}
      tftpServer = null;
      activeTftpTransfers.clear();
      tftpEvents.emit("log", `[INFO] TFTP Server stopped.`);
    }
    return res.json({ success: true });
  });

  app.get("/api/tftp/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    const logListener = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'log', message: msg })}\n\n`);
    };
    
    const progressListener = (data: any) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', data })}\n\n`);
    };
    
    tftpEvents.on("log", logListener);
    tftpEvents.on("progress", progressListener);
    
    req.on("close", () => {
      tftpEvents.removeListener("log", logListener);
      tftpEvents.removeListener("progress", progressListener);
    });
  });

  // 1. Ping / TCPing
  app.post("/api/ping", async (req, res) => {
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
      } catch (err: any) {
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
      // Basic UDP Ping (stateless, cannot truly detect open without app-layer response)
      // We will report "Packet sent" or any immediate socket err
      import("dgram").then((dgram) => {
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
      }).catch(err => {
         res.json({ alive: false, time: null, output: err.message });
      });
    } else {
      res.status(400).json({ error: "Unsupported protocol" });
    }
  });

  // 2. IP/Port Scanner
  app.post("/api/portscan", async (req, res) => {
    const { targets, ports } = req.body; // accept targets array now
    // Fallback if 'target' is used
    const actualTargets = Array.isArray(targets) ? targets : (req.body.target ? [req.body.target] : []);
    
    if (actualTargets.length === 0 || !ports || !Array.isArray(ports)) {
       return res.status(400).json({ error: "Targets and ports array are required" });
    }

    const results: any[] = [];
    const scanPort = (target: string, port: number) => {
      return new Promise((resolve) => {
        const sock = new net.Socket();
        sock.setTimeout(800);
        let status = "closed";

        sock.on("connect", () => {
          status = "open";
          sock.destroy();
        }).on("timeout", () => {
          status = "filtered"; // Timeout usually means dropped/filtered
          sock.destroy();
        }).on("error", () => {
          status = "closed"; // Reject means closed
        }).on("close", () => {
          resolve({ target, port, status });
        }).connect(port, target);
      });
    };

    // Prepare all tasks
    const tasks: {target: string, port: number}[] = [];
    for (const t of actualTargets) {
      for (const p of ports) {
        tasks.push({ target: t, port: p });
      }
    }

    // Scan with high concurrency pool
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
    const target = req.query.target as string;
    if (!target) return res.status(400).json({ error: "Target required" });

    // Ensure safe whois (max 10s timeout to prevent hanging)
    whois.lookup(target, { timeout: 10000 }, (err, data) => {
      if (err) {
        return res.json({ result: `Error performing WHOIS: ${err.message}` });
      }
      res.json({ result: data });
    });
  });

  // 4. Public IP
  app.get("/api/myip", async (req, res) => {
    const provider = req.query.provider as string || "ipify";
    try {
      if (provider === "ip138") {
         const resp = await fetch("https://2024.ip138.com/", { 
           headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
           signal: AbortSignal.timeout(5000) 
         });
         const text = await resp.text();
         const match = text.match(/\[([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\]/);
         if (match) {
             return res.json({ ip: match[1] });
         }
         // Fallback regex without brackets
         const matchFallback = text.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
         if (matchFallback) {
             return res.json({ ip: matchFallback[1] });
         }
         throw new Error("Could not parse IP from IP138");
      } else if (provider === "ip38") {
         const resp = await fetch("https://www.ip38.com", { 
           headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
           signal: AbortSignal.timeout(5000) 
         });
         const text = await resp.text();
         // ip38 normally shows IP like: "您的IP地址是：12.34.56.78" or in a specific element
         const match = text.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
         if (match) {
             return res.json({ ip: match[1] });
         }
         throw new Error("Could not parse IP from IP38");
      } else {
         const resp = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
         const data = await resp.json();
         return res.json({ ip: data.ip });
      }
    } catch (err: any) {
      // Fallback
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "Unknown";
      const ipString = Array.isArray(ip) ? ip[0] : ip.split(",")[0].trim();
      res.json({ ip: ipString === "::1" || ipString === "127.0.0.1" ? "Unknown (Local Network)" : ipString });
    }
  });

  // 4.5 Geo IP Proxy
  app.get("/api/geoip/:ip", async (req, res) => {
    try {
      const { ip } = req.params;
      const { source } = req.query;

      if (source === 'ip38') {
          const response = await fetch(`http://www.ip38.com/ip.php?ip=${ip}`);
          const text = await response.text();
          const match = text.match(/<h1>iP地址\s*<mark>[^<]+<\/mark>\s*查询结果：<span class="region">([^<]+)<\/span><\/h1>/i);
          if (match) {
            const resultText = match[1].trim();
            // Try to split into parts, e.g. "中国 四川 德阳 联通"
            const parts = resultText.split(/\s+/);
            const mapped = {
              status: 'success',
              country: parts.length > 0 ? parts[0] : '-',
              countryCode: 'CN',
              regionName: parts.length > 1 ? parts[1] : '-',
              city: parts.length > 2 ? parts[2] : '-',
              isp: parts.length > 3 ? parts.slice(3).join(' ') : '-',
              as: '-',
              lon: '-',
              lat: '-',
              timezone: 'Asia/Shanghai'
            };
            return res.json(mapped);
          }
      }

      // Default to ip-api
      const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4.8 Website Latency & Connectivity Test
  app.get("/api/website-test", async (req, res) => {
    const websites = [
      // 国内主流网站
      { id: "baidu", name: "百度 (Baidu)", host: "www.baidu.com", port: 443, category: "domestic" },
      { id: "taobao", name: "淘宝网 (Alibaba)", host: "www.taobao.com", port: 443, category: "domestic" },
      { id: "jd", name: "京东商城 (JD)", host: "www.jd.com", port: 443, category: "domestic" },
      { id: "bilibili", name: "哔哩哔哩 (Bilibili)", host: "www.bilibili.com", port: 443, category: "domestic" },
      { id: "tencent", name: "腾讯网 (Tencent)", host: "www.qq.com", port: 443, category: "domestic" },
      
      // 国外大厂云业务 / M365业务
      { id: "m365", name: "Microsoft 365 (O365)", host: "outlook.office365.com", port: 443, category: "global" },
      { id: "aws", name: "Amazon AWS Portal", host: "aws.amazon.com", port: 443, category: "global" },
      { id: "azure", name: "Microsoft Azure Portal", host: "portal.azure.com", port: 443, category: "global" },
      { id: "gcp", name: "Google Cloud Platform", host: "cloud.google.com", port: 443, category: "global" },
      { id: "github", name: "GitHub Repository", host: "github.com", port: 443, category: "global" },
      { id: "cloudflare", name: "Cloudflare Core IP", host: "1.1.1.1", port: 53, category: "global" }
    ];

    const results = await Promise.all(websites.map(async (web) => {
      const start = Date.now();
      const sock = new net.Socket();
      sock.setTimeout(2500); // 2.5 seconds timeout
      
      return new Promise((resolve) => {
        let finished = false;
        
        sock.on("connect", () => {
          if (finished) return;
          finished = true;
          const time = Date.now() - start;
          sock.destroy();
          resolve({ ...web, alive: true, latency: time });
        })
        .on("error", (err) => {
          if (finished) return;
          finished = true;
          sock.destroy();
          resolve({ ...web, alive: false, error: err.message });
        })
        .on("timeout", () => {
          if (finished) return;
          finished = true;
          sock.destroy();
          resolve({ ...web, alive: false, error: "timeout" });
        })
        .connect(web.port, web.host);
      });
    }));

    res.json({ results });
  });

  // 4.9 Real DNS Query Resolution & Latency Test
  app.get("/api/dns-test", async (req, res) => {
    const { server, domain } = req.query;
    if (!server || typeof server !== "string") {
      return res.status(400).json({ error: "Missing dns server IP" });
    }
    const testDomain = (typeof domain === "string" && domain) ? domain : "www.baidu.com";

    const resolver = new dns.Resolver();
    try {
      resolver.setServers([server]);
    } catch (e: any) {
      return res.json({ alive: false, error: "Invalid DNS IP: " + e.message });
    }

    const start = Date.now();
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        res.json({ alive: false, error: "DNS connection timeout" });
      }
    }, 2500); // 2.5s DNS Query Timeout

    resolver.resolve4(testDomain, (err, addresses) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      if (err) {
        res.json({ alive: false, error: err.message, code: err.code });
      } else {
        const time = Date.now() - start;
        res.json({ alive: true, latency: time, addresses: addresses || [] });
      }
    });
  });

  // 5. Speed test (Download/Upload simulation)
  app.get("/api/speedtest/download", (req, res) => {
    const sizeStr = req.query.size as string;
    const size = parseInt(sizeStr) || 1024 * 1024; // default 1MB
    const safeSize = Math.min(size, 20 * 1024 * 1024); // max 20MB
    
    // Generate pseudo-random garbage data
    const buffer = Buffer.alloc(safeSize, "x");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", safeSize);
    res.send(buffer);
  });

  app.post("/api/speedtest/upload", (req, res) => {
    // Just respond OK to an upload stream
    res.json({ success: true, bytesReceived: req.body.length || 0 });
  });

  // 6. TraceRoute / MTR (Parallel Ping fallback)
  app.get("/api/traceroute", async (req, res) => {
    const target = req.query.target as string;
    if (!target) return res.status(400).json({ error: "Target required" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    
    res.write(`data: ${JSON.stringify({ type: 'pid', pid: 1 })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'destination', destination: target })}\n\n`);

    let reached = false;
    let maxHopReached = 30;
    
    // Send in batches of 5 to avoid dropping
    for (let batchStart = 1; batchStart <= 30; batchStart += 5) {
       if (res.writableEnded || reached) break;
       
       const promises = [];
       for (let i = 0; i < 5; i++) {
           const ttl = batchStart + i;
           if (ttl > 30) break;
           
           promises.push(new Promise<void>((resolve) => {
               const start = Date.now();
               const isWin = process.platform === 'win32';
               const spawnArgs = isWin 
                   ? ['-n', '1', '-4', '-i', ttl.toString(), '-w', '1000', target] 
                   : ['-c', '1', '-4', '-t', ttl.toString(), '-W', '1', target];
               const p = spawn('ping', spawnArgs);
               
               let output = '';
               p.stdout.on('data', (d: any) => output += d.toString());
               p.stderr.on('data', (d: any) => output += d.toString());
               
               p.on('close', (code: any) => {
                   if (res.writableEnded) { resolve(); return; }
                   
                   if (/(Name or service not known|bad address|unknown host|Temporary failure)/i.test(output)) {
                       res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to resolve target: ' + target })}\n\n`);
                       res.end();
                       resolve(); return;
                   }

                   const elapsed = Date.now() - start;
                   const isWin = process.platform === 'win32';
                   let hopIp = '*';
                   let rtt = '';

                   if (isWin) {
                       const ips = output.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/g);
                       // First IP is usually the target being pinged. The second might be the hop.
                       // Looking for lines containing IP and either "TTL", "time", "时间", "过期"
                       const lines = output.split('\n');
                       for (const line of lines) {
                           if (/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/.test(line)) {
                               if (line.toLowerCase().includes('ttl') || line.includes('时间') || line.includes('time') || line.includes('回复') || line.includes('reply')) {
                                  const match = line.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
                                  // If this is the "Pinging [IP]" line, skip it
                                  if (!line.toLowerCase().includes('pinging') && !line.includes('正在 Ping')) {
                                      if (match) hopIp = match[1];
                                  }
                               }
                           }
                       }
                       const timeMatch = output.match(/(?:time|时间)[=<]([\d]+)ms/i);
                       if (timeMatch) rtt = timeMatch[1];
                       if (code === 0 && (output.toLowerCase().includes('bytes=') || output.toLowerCase().includes('字节=')) && !(output.toLowerCase().includes('expired') || output.includes('过期'))) {
                           reached = true;
                           if (ttl < maxHopReached) maxHopReached = ttl;
                           if (hopIp === '*') hopIp = target;
                       }
                   } else {
                       const matchIpParen = output.match(/[Ff]rom\s+[^\s]+\s*\(([\d\.]+)\)/);
                       const matchIpDirect = output.match(/[Ff]rom\s+([\d\.]+)/);
                       if (matchIpParen) hopIp = matchIpParen[1];
                       else if (matchIpDirect) hopIp = matchIpDirect[1];
                       else {
                           const bytesFromParen = output.match(/bytes\s+from\s+[^\s]+\s*\(([\d\.]+)\)/i);
                           const bytesFromDirect = output.match(/bytes\s+from\s+([\d\.]+)/i);
                           if (bytesFromParen) hopIp = bytesFromParen[1];
                           else if (bytesFromDirect) hopIp = bytesFromDirect[1];
                       }

                       const timeMatch = output.match(/time=([\d\.]+)/);
                       if (timeMatch) rtt = timeMatch[1];
                       
                       if (code === 0 && output.toLowerCase().includes('bytes from') && !output.toLowerCase().includes('time to live exceeded')) {
                           reached = true;
                           if (ttl < maxHopReached) maxHopReached = ttl;
                           if (hopIp === '*') hopIp = target;
                       }
                   }

                   res.write(`data: ${JSON.stringify({ type: 'hop', hop: { hop: ttl, ip: hopIp, rtt1: hopIp !== '*' ? (rtt || elapsed.toString()) : '*' } })}\n\n`);
                   resolve();
               });
               
               p.on('error', () => {
                   if (!res.writableEnded) {
                       res.write(`data: ${JSON.stringify({ type: 'hop', hop: { hop: ttl, ip: '*', rtt1: '*' } })}\n\n`);
                   }
                   resolve();
               });
           }));
       }
       
       await Promise.all(promises);
    }

    if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'close', code: 0, maxHopReached })}\n\n`);
        res.end();
    }
  });

  // 7. Continuous Ping Stream Endpoint
  app.get("/api/ping-stream", (req, res) => {
    const target = req.query.target as string || "8.8.8.8";
    const protocol = req.query.protocol as string || "icmp";
    const port = parseInt(req.query.port as string) || 80;
    const packetSizeStr = req.query.size as string || "56";
    const speedMs = parseInt(req.query.speed as string) || 1000;
    const count = parseInt(req.query.count as string) || 5;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let clientClosed = false;
    req.on("close", () => {
        clientClosed = true;
    });

    if (protocol === "icmp") {
        let sizeArg = packetSizeStr;
        if (!/^\d+$/.test(sizeArg)) sizeArg = "56";
        const isWin = process.platform === "win32";
        
        let currentCount = 0;
        const doPing = () => {
             if (clientClosed) {
                 return;
             }
             if (currentCount >= count) {
                 res.write(`data: ${JSON.stringify({ type: 'close', code: 0 })}\n\n`);
                 res.end(); return;
             }
             currentCount++;
             const seq = currentCount;
             let spawnArgs = isWin 
                 ? ['-n', '1', '-l', sizeArg, '-w', '1000', target] 
                 : ['-c', '1', '-W', '1', '-s', sizeArg, target];
                 
             const p = spawn('ping', spawnArgs);
             let out = '';
             p.stdout.on('data', (d: any) => out += d.toString());
             p.stderr.on('data', (d: any) => out += d.toString());
             p.on('close', (code: any) => {
                 let alive = false;
                 let latency = '';
                 const lowerOut = out.toLowerCase();
                 // Determine if it was successful including common Chinese terms
                 if (code === 0 && (lowerOut.includes('bytes from') || lowerOut.includes('bytes=') || lowerOut.includes('字节=')) && !lowerOut.includes('ttl expired') && !lowerOut.includes('unreachable') && !lowerOut.includes('request timed out') && !lowerOut.includes('不可达') && !lowerOut.includes('超时')) {
                     alive = true;
                     const timeMatch = out.match(/(?:time|时间)[=<]([\d\.]+)\s*(ms)?/i);
                     if (timeMatch) latency = timeMatch[1];
                 }
                 
                 const formattedLine = alive 
                    ? `Reply from ${target} icmp_seq=${seq} bytes=${sizeArg} time=${latency}ms` 
                    : `Request timed out for ${target} icmp_seq=${seq}`;
                 
                 res.write(`data: ${JSON.stringify({ type: 'output', line: formattedLine, alive })}\n\n`);
                 
                 setTimeout(doPing, speedMs);
             });
             p.on('error', (err: any) => {
                 res.write(`data: ${JSON.stringify({ type: 'error', line: `Error seq=${seq}: ${err.message}` })}\n\n`);
                 setTimeout(doPing, speedMs);
             });
        };
        doPing();
    } else if (protocol === "tcp" || protocol === "udp") {
        let currentCount = 0;
        const doPing = async () => {
             if (clientClosed) {
                 return;
             }
             if (currentCount >= count) {
                 res.write(`data: ${JSON.stringify({ type: 'close', code: 0 })}\n\n`);
                 res.end(); return;
             }
             currentCount++;
             const start = Date.now();
             
             if (protocol === "tcp") {
                 let handled = false;
                 const sock = new net.Socket();
                 const timeoutLimit = Math.max(1000, speedMs);
                 sock.setTimeout(timeoutLimit);
                 sock.on("connect", () => {
                     if (handled) return; handled = true;
                     const time = Date.now() - start;
                     res.write(`data: ${JSON.stringify({ type: 'output', alive: true, line: `Connected to ${target}:${port} tcp_seq=${currentCount} time=${time} ms` })}\n\n`);
                     sock.destroy();
                     setTimeout(doPing, Math.max(0, speedMs - time));
                 });
                 sock.on("error", (e) => {
                     if (handled) return; handled = true;
                     res.write(`data: ${JSON.stringify({ type: 'error', alive: false, line: `TCP Request Error to ${target}:${port} seq=${currentCount}: ${e.message}` })}\n\n`);
                     sock.destroy();
                     setTimeout(doPing, speedMs);
                 });
                 sock.on("timeout", () => {
                     if (handled) return; handled = true;
                     res.write(`data: ${JSON.stringify({ type: 'error', alive: false, line: `TCP Request Timeout to ${target}:${port} seq=${currentCount}` })}\n\n`);
                     sock.destroy();
                     setTimeout(doPing, speedMs);
                 });
                 sock.connect(port, target);
             } else {
                 import("dgram").then((dgram) => {
                     let handled = false;
                     let packetSize = parseInt(packetSizeStr) || 56;
                     if (packetSize > 65507) packetSize = 65507; 
                     const client = dgram.createSocket('udp4');
                     const message = Buffer.alloc(packetSize, 'p');
                     
                     const timeoutLimit = Math.max(1000, speedMs);
                     const timeout = setTimeout(() => {
                        if (handled) return; handled = true;
                        res.write(`data: ${JSON.stringify({ type: 'output', alive: false, line: `UDP request sent to ${target}:${port} seq=${currentCount} (No reply implies timeout)` })}\n\n`);
                        client.close();
                        setTimeout(doPing, speedMs);
                     }, timeoutLimit);

                     client.on('error', (err) => {
                        if (handled) return; handled = true;
                        clearTimeout(timeout); client.close();
                        res.write(`data: ${JSON.stringify({ type: 'error', alive: false, line: `UDP Error: ${err.message}` })}\n\n`);
                        setTimeout(doPing, speedMs);
                     });
                     client.on('message', (msg) => {
                        if (handled) return; handled = true;
                        clearTimeout(timeout); const time = Date.now() - start;
                        res.write(`data: ${JSON.stringify({ type: 'output', alive: true, line: `Reply from ${target}:${port} (UDP) seq=${currentCount} time=${time} ms bytes=${msg.byteLength}` })}\n\n`);
                        client.close();
                        setTimeout(doPing, Math.max(0, speedMs - time));
                     });
                     client.send(message, port, target, (err) => {
                        if (err && !handled) {
                            handled = true; clearTimeout(timeout); client.close();
                            res.write(`data: ${JSON.stringify({ type: 'error', alive: false, line: `UDP Send Error: ${err.message}` })}\n\n`);
                            setTimeout(doPing, speedMs);
                        }
                     });
                 }).catch(e => {
                     res.write(`data: ${JSON.stringify({ type: 'error', alive: false, line: e.message })}\n\n`);
                     res.end();
                 });
             }
        };
        doPing();
    } else {
        res.write(`data: ${JSON.stringify({ type: 'error', line: 'Unsupported protocol' })}\n\n`);
        res.end();
    }
  });

  app.get("/api/wifi/current", async (req, res) => {
      try {
          const wifiModule = await import('node-wifi');
          const wifi = wifiModule.default || wifiModule;
          wifi.init({ iface: null });
          wifi.getCurrentConnections((error: any, currentConnections: any) => {
             if (error) {
                 return res.status(500).json({ error: error.message || 'Failed to get current connection' });
             } 
             if (currentConnections && currentConnections.length > 0) {
                 const conn = currentConnections[0];
                 let rssi = conn.signal_level || -50;
                 // Some platforms return percentage (0-100) instead of dBm.
                 if (rssi > 0 && rssi <= 100) { rssi = Math.round((rssi / 2) - 100); }
                 res.json({ 
                     rssi: rssi,
                     ssid: conn.ssid || 'Unknown',
                     bssid: conn.bssid || conn.mac || 'Unknown',
                 });
             } else {
                 res.json({ rssi: -50, ssid: 'Disconnected', bssid: 'None' });
             }
          });
      } catch (err: any) {
          res.status(500).json({ error: err.message });
      }
  });

  // 8. Wifi Scan
  app.get("/api/wifi/scan", async (req, res) => {
      try {
          if (process.platform === 'win32') {
              try {
                  // Capture binary buffer directly without chcp to avoid cmd.exe parsing errors
                  const buffer = execSync('netsh wlan show networks mode=bssid', { maxBuffer: 1024 * 1024 });
                  let output = buffer.toString('utf-8');
                  // If it contains the replacement character, it's likely GBK
                  if (output.includes('')) {
                      output = iconv.decode(buffer, 'cp936');
                  } else {
                      // Try cp936 anyway as English ASCII is valid in cp936, protecting against invisible mangling
                      output = iconv.decode(buffer, 'cp936');
                  }
                  
                  const lines = output.split('\n');
                  const fallbackNetworks: any[] = [];
                  
                  let currentSSID = '';
                  let currentAuth = '';
                  let currentEncryption = '';

                  for (let i = 0; i < lines.length; i++) {
                      const line = lines[i].trim();
                      if (line.match(/^SSID\s+\d+\s*:\s+(.*)$/i)) {
                          currentSSID = line.match(/^SSID\s+\d+\s*:\s+(.*)$/i)![1].trim() || '<Hidden SSID>';
                          if (currentSSID === '') currentSSID = '<Hidden SSID>';
                          currentAuth = '';
                          currentEncryption = '';
                      } else if (line.match(/(Authentication|验证|认证)\s*:\s+(.*)$/i)) {
                          currentAuth = line.match(/:\s+(.*)$/i)![1].trim();
                      } else if (line.match(/(Encryption|加密)\s*:\s+(.*)$/i)) {
                          currentEncryption = line.match(/:\s+(.*)$/i)![1].trim();
                      } else if (line.match(/^BSSID\s+\d+\s*:\s+([a-fA-F0-9:]+)/i)) {
                          const bssidMatch = line.match(/^BSSID\s+\d+\s*:\s+([a-fA-F0-9:]+)/i);
                          
                          let signalMatch = 50, channelMatch = 1;
                          let radioType = '';
                          let rates = '';

                          for(let j = i+1; j < Math.min(i+15, lines.length); j++) {
                              const subline = lines[j].trim();
                              // Stop when hitting next SSID or BSSID or empty line
                              if (subline === '' || subline.match(/^SSID|^BSSID/i)) break; 

                              const parts = subline.split(':');
                              if (parts.length >= 2) {
                                  const key = parts[0].toLowerCase();
                                  const val = parts.slice(1).join(':').trim();
                                  if (key.includes('channel') || key.includes('信道') || key.includes('信 道') || key.includes('频段') || key.includes('频道') || key.includes('通道')) {
                                      const num = parseInt(val, 10);
                                      if (!isNaN(num) && num >= 1 && num <= 165) channelMatch = num;
                                  } else if (key.includes('signal') || key.includes('信号')) {
                                      const signalRegex = val.match(/(\d+)\s*%/);
                                      if (signalRegex) signalMatch = parseInt(signalRegex[1], 10);
                                  } else if (key.includes('radio') || key.includes('无线') || key.includes('类型')) {
                                      radioType = val;
                                  } else if (key.includes('rate') || key.includes('速率')) {
                                      rates += val + " ";
                                  }
                              }
                          }
                          
                          const frequencyMatch = channelMatch > 14 ? (5000 + channelMatch * 5) : (2407 + channelMatch * 5);
                          const maxRate = rates.split(/\s+/).map(r => parseFloat(r)).filter(r => !isNaN(r)).reduce((a,b) => Math.max(a,b), 0);
                          const rssiVal = Math.round(signalMatch / 2 - 100);
                          
                          let realisticSpeed = maxRate > 0 ? `${maxRate} Mbit/s` : '-';
                          const lowerRadio = radioType.toLowerCase();
                          if (lowerRadio.includes('ax') || lowerRadio.includes('wifi 6')) realisticSpeed = '1200+ Mbit/s (802.11ax)';
                          else if (lowerRadio.includes('ac') || lowerRadio.includes('wifi 5')) realisticSpeed = '867 Mbit/s (802.11ac)';
                          else if (lowerRadio.includes('n') || lowerRadio.includes('wifi 4')) realisticSpeed = '300 Mbit/s (802.11n)';
                          else if (lowerRadio.includes('g') || lowerRadio.includes('a')) realisticSpeed = '54 Mbit/s (802.11g/a)';
                          else if (lowerRadio.includes('b')) realisticSpeed = '11 Mbit/s (802.11b)';
                          else if (radioType) realisticSpeed = maxRate > 0 ? `${maxRate} Mbit/s [${radioType}]` : radioType;

                          fallbackNetworks.push({
                              ssid: currentSSID,
                              bssid: bssidMatch ? bssidMatch[1] : 'Unknown',
                              signal_level: rssiVal,
                              channel: channelMatch,
                              frequency: frequencyMatch,
                              security: currentAuth,
                              security_flags: [currentAuth, currentEncryption].filter(Boolean),
                              speed: realisticSpeed,
                              quality: Math.max(0, Math.min(100, 2 * (rssiVal + 100)))
                          });
                      }
                  }
                  // We bypass node-wifi on Windows completely to fix connection discrepancies
                  if (fallbackNetworks.length > 0) {
                      return res.json({ networks: fallbackNetworks });
                  }
              } catch (e) {
                  console.error("Custom Windows wifi parser failed", e);
              }
          }

          const wifiModule = await import('node-wifi');
          const wifi = wifiModule.default || wifiModule;
          wifi.init({ iface: null });
          wifi.scan((error: any, networks: any) => {
             if (error) {
                 const errMsg = String(error.message || '');
                 // 如果底层命令报错（往往是没有无线网卡或 wlansvc 服务未开启）
                 if (errMsg.includes('wlansvc') || errMsg.includes('Bssid') || errMsg.includes('Command failed')) {
                     return res.json({ networks: [] });
                 }
                 return res.status(500).json({ error: error.message || 'Scan failed' });
             } 
             res.json({ networks: networks || [] });
          });
      } catch (err: any) {
          res.status(500).json({ error: err.message });
      }
  });

  // 4.9 Backend IP Detection
  app.get("/api/backend-ip", async (req, res) => {
    try {
      // Fetch both simultaneously
      const results = await Promise.allSettled([
        (async () => {
           const response = await fetch('http://www.ip38.com/', {
              headers: {
                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
              }
           });
           const text = await response.text();
           const match = text.match(/<a[^>]*>(\d+\.\d+\.\d+\.\d+)<\/a>/) || text.match(/(\d+\.\d+\.\d+\.\d+)\.htm/);
           if (match) {
               return match[1];
           }
           return 'Unknown';
        })(),
        (async () => {
           const response = await fetch('http://ip-api.com/json/');
           const data = await response.json();
           return data.query || 'Unknown';
        })()
      ]);

      const chinazIp = results[0].status === 'fulfilled' ? results[0].value : 'Unknown';
      const ipapiIp = results[1].status === 'fulfilled' ? results[1].value : 'Unknown';

      res.json({
         chinaz: chinazIp,
         ipapi: ipapiIp
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Vite Middleware --- //
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, the file is compiled to dist/server.cjs, so __dirname is already the dist folder
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
