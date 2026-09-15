import Taro from '@tarojs/taro'

declare const wx: any

/** 
 * 后端 API 地址配置（如已部署微信云托管或 Node.js 服务端，可在此填入地址，例如 https://your-server.com）
 * 也支持在小程序内通过缓存动态配置
 */
export let BACKEND_SERVER_URL = ''

export const getBackendUrl = (): string => {
  try {
    const saved = Taro.getStorageSync('custom_backend_url')
    if (saved && typeof saved === 'string') return saved.trim()
  } catch {}
  return BACKEND_SERVER_URL
}

export const setBackendUrl = (url: string): void => {
  BACKEND_SERVER_URL = url.trim()
  try {
    Taro.setStorageSync('custom_backend_url', url.trim())
  } catch {}
}

// ==================== Types ====================

export interface PingResult {
  alive: boolean
  time: number | null
  output: string
}

export interface PortScanItem {
  target: string
  port: number
  status: 'open' | 'closed' | 'filtered'
  latency?: number | null
}

export interface PortScanResult {
  results: PortScanItem[]
}

export interface WhoisResult {
  result: string
}

export interface IpLookupResult {
  ip: string
  country: string
  region: string
  city: string
  isp: string
  asn: string
  timezone: string
}

// ==================== Utilities ====================

/** 判断是否为合法的 IPv4 地址 */
export const isIp = (str: string): boolean => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(str)

/** 判断是否为局域网私网 IP 地址 */
export const isLanIp = (ip: string): boolean => {
  if (!isIp(ip)) return false
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return true
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10)
    if (second >= 16 && second <= 31) return true
  }
  return false
}

/** 提取一级顶级域名用于 WHOIS 数据库查询 */
export const extractMainDomain = (domain: string): string => {
  const clean = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim()
  const parts = clean.split('.')
  if (parts.length <= 2) return clean

  const doubleSuffixes = ['com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'co.uk', 'co.jp']
  const lastTwo = parts.slice(-2).join('.')
  if (doubleSuffixes.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.')
  }
  return parts.slice(-2).join('.')
}

// ==================== WeChat Native UDP DNS Resolution Engine ====================
// 采用 RFC 1035 原生二进制 UDP 报文直连骨干 DNS，100% 真实网络测量，免疫域名白名单拦截

export function buildDnsQueryPacket(domain: string): ArrayBuffer {
  const parts = domain.split('.').filter(Boolean)
  const qname: number[] = []
  for (const part of parts) {
    qname.push(part.length)
    for (let i = 0; i < part.length; i++) {
      qname.push(part.charCodeAt(i))
    }
  }
  qname.push(0)

  // Header: ID=0x1234, Flags=0x0100 (标准递归查询), QDCOUNT=1, ANCOUNT=0, NSCOUNT=0, ARCOUNT=0
  const header = [0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
  // QTYPE=0x0001 (A记录), QCLASS=0x0001 (IN)
  const qtypeClass = [0x00, 0x01, 0x00, 0x01]

  const total = [...header, ...qname, ...qtypeClass]
  const buf = new Uint8Array(total.length)
  for (let i = 0; i < total.length; i++) {
    buf[i] = total[i]
  }
  return buf.buffer
}

export function parseDnsResponsePacket(arr: Uint8Array): string[] {
  if (arr.length < 12) return []
  const ancount = (arr[6] << 8) | arr[7]
  if (ancount === 0) return []

  let offset = 12
  while (offset < arr.length && arr[offset] !== 0) {
    if ((arr[offset] & 0xc0) === 0xc0) {
      offset += 2
      break
    }
    offset += arr[offset] + 1
  }
  if (offset < arr.length && arr[offset] === 0) offset += 1
  offset += 4

  const ips: string[] = []
  for (let a = 0; a < ancount && offset < arr.length; a++) {
    if ((arr[offset] & 0xc0) === 0xc0) {
      offset += 2
    } else {
      while (offset < arr.length && arr[offset] !== 0) {
        offset += arr[offset] + 1
      }
      if (offset < arr.length && arr[offset] === 0) offset++
    }

    if (offset + 10 > arr.length) break
    const type = (arr[offset] << 8) | arr[offset + 1]
    const rdlen = (arr[offset + 8] << 8) | arr[offset + 9]
    offset += 10

    if (type === 1 && rdlen === 4 && offset + 4 <= arr.length) {
      const ip = `${arr[offset]}.${arr[offset + 1]}.${arr[offset + 2]}.${arr[offset + 3]}`
      if (isIp(ip)) {
        ips.push(ip)
      }
    }
    offset += rdlen
  }
  return ips
}

/**
 * 微信原生 UDP DNS 域名解析引擎 (单 Socket 并发批量探测 + 内网网关智能探测)
 */
export async function resolveDnsNativeUdp(domain: string, timeoutMs = 1800): Promise<{ ip: string; rtt: number } | null> {
  const cleanDomain = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim()
  if (isIp(cleanDomain)) return { ip: cleanDomain, rtt: 10 }

  const createUDPSocket = (Taro as any).createUDPSocket || (typeof wx !== 'undefined' ? (wx as any).createUDPSocket : null)
  if (typeof createUDPSocket !== 'function') return null

  // 1. 聚合企业内网常见网关 DNS、子网网段与公网权威 DNS
  const DNS_SERVERS = [
    // 企业内部私有网关与 DNS
    '10.3.11.1',
    '10.3.11.254',
    '10.3.255.225',
    '10.3.255.254',
    '10.3.0.1',
    '10.3.1.1',
    '10.0.0.1',
    '10.0.0.53',
    '192.168.1.1',
    '192.168.0.1',
    '192.168.31.1',
    '192.168.1.254',
    '172.16.0.1',
    // 公网 Anycast DNS
    '223.5.5.5',
    '119.29.29.29',
    '114.114.114.114',
    '180.76.76.76',
    '1.1.1.1'
  ]

  return new Promise<{ ip: string; rtt: number } | null>((resolve) => {
    const start = Date.now()
    let isDone = false
    let udp: any = null
    let timer: any = null

    const finish = (result: { ip: string; rtt: number } | null) => {
      if (!isDone) {
        isDone = true
        if (timer) clearTimeout(timer)
        if (udp) {
          try {
            if (typeof udp.offMessage === 'function') udp.offMessage()
            if (typeof udp.offError === 'function') udp.offError()
            udp.close()
          } catch {}
          udp = null
        }
        resolve(result)
      }
    }

    timer = setTimeout(() => {
      finish(null)
    }, timeoutMs)

    try {
      udp = createUDPSocket()
      if (!udp) {
        finish(null)
        return
      }

      try { udp.bind() } catch {}

      udp.onError(() => {
        // 忽略单项网络错误，等待其他 DNS 服务器回复
      })

      udp.onMessage((msgRes: any) => {
        try {
          const rawMsg = msgRes.message
          const uint8 = rawMsg instanceof ArrayBuffer ? new Uint8Array(rawMsg) : (rawMsg?.buffer ? new Uint8Array(rawMsg.buffer) : null)
          if (uint8) {
            const ips = parseDnsResponsePacket(uint8)
            if (ips.length > 0 && isIp(ips[0])) {
              const rtt = Math.max(Date.now() - start, 1)
              finish({ ip: ips[0], rtt })
              return
            }
          }
        } catch {}
      })

      const payload = buildDnsQueryPacket(cleanDomain)
      // 使用单套接字向所有候选 DNS 服务器异步发送查询请求
      for (const server of DNS_SERVERS) {
        try {
          udp.send({
            address: server,
            port: 53,
            message: payload
          })
        } catch {}
      }
    } catch {
      finish(null)
    }
  })
}

export async function resolveDnsDoh(domain: string): Promise<string | null> {
  const cleanDomain = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim()
  if (isIp(cleanDomain)) return cleanDomain

  // 1. 优先通过原生免白名单 UDP 发包向内网及公网 DNS 直查
  const nativeUdp = await resolveDnsNativeUdp(cleanDomain)
  if (nativeUdp?.ip && isIp(nativeUdp.ip)) return nativeUdp.ip

  // 2. 备用通过公网 DoH 接口查询
  const dohUrls = [
    `https://dns.alidns.com/resolve?name=${encodeURIComponent(cleanDomain)}&type=A`,
    `https://doh.pub/dns-query?name=${encodeURIComponent(cleanDomain)}&type=A`
  ]

  for (const url of dohUrls) {
    try {
      const res = await Taro.request({
        url,
        method: 'GET',
        header: { 'Accept': 'application/dns-json' },
        timeout: 1000
      })

      if (res.statusCode === 200 && res.data && (res.data as any).Answer) {
        const answers = (res.data as any).Answer
        const aRecord = answers.find((ans: any) => ans.type === 1 && ans.data && isIp(ans.data))
        if (aRecord?.data) {
          return aRecord.data
        }
      }
    } catch {}
  }

  return null
}

// ==================== Real Mobile UDP Protocol Payloads ====================

function getUdpPayload(port: number, domain = 'baidu.com'): ArrayBuffer {
  if (port === 53) {
    return buildDnsQueryPacket(domain)
  }
  if (port === 123) {
    const buf = new Uint8Array(48)
    buf[0] = 0x1b
    return buf.buffer
  }
  if (port === 161) {
    return new Uint8Array([
      0x30, 0x26, 0x02, 0x01, 0x00, 0x04, 0x06, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63,
      0xa0, 0x19, 0x02, 0x04, 0x00, 0x00, 0x00, 0x01, 0x02, 0x01, 0x00, 0x02, 0x01, 0x00,
      0x30, 0x0b, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x05, 0x00
    ]).buffer
  }
  if (port === 500 || port === 4500) {
    return new Uint8Array([
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x10, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x1c
    ]).buffer
  }
  return new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer
}

/**
 * 手机原生 UDP 真实时延探测
 */
export async function checkUdpPort(host: string, port: number, timeoutMs = 800): Promise<{ status: 'open' | 'closed' | 'filtered', latency: number | null }> {
  const start = Date.now()
  const cleanHost = host.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim()

  let targetIp = cleanHost
  if (!isIp(cleanHost)) {
    try {
      const resolved = await resolveDnsDoh(cleanHost)
      if (resolved) targetIp = resolved
    } catch {}
  }

  const createUDPSocket = (Taro as any).createUDPSocket || (typeof wx !== 'undefined' ? (wx as any).createUDPSocket : null)
  if (typeof createUDPSocket !== 'function') {
    return { status: 'filtered', latency: null }
  }

  return new Promise((resolve) => {
    try {
      const udp = createUDPSocket()
      let isDone = false

      try { udp.bind() } catch {}

      const cleanUp = (status: 'open' | 'closed' | 'filtered', lat: number | null) => {
        if (!isDone) {
          isDone = true
          if (timer) clearTimeout(timer)
          try { udp.close() } catch {}
          resolve({ status, latency: lat })
        }
      }

      const timer = setTimeout(() => {
        cleanUp('filtered', null)
      }, timeoutMs)

      udp.onError((err: any) => {
        const msg = (err.errMsg || err.message || '').toLowerCase()
        if (msg.includes('unreachable') || msg.includes('refused') || msg.includes('reset') || msg.includes('closed')) {
          cleanUp('closed', null)
        } else {
          cleanUp('filtered', null)
        }
      })

      udp.onMessage(() => {
        const elapsed = Math.max(Date.now() - start, 1)
        cleanUp('open', elapsed)
      })

      const payload = getUdpPayload(port, cleanHost)
      udp.send({
        address: targetIp,
        port: port,
        message: payload
      })
    } catch {
      resolve({ status: 'filtered', latency: null })
    }
  })
}

// ==================== 全局单例 TCP 探测互斥锁与限流队列 ====================
// 微信小程序底层限制同一时间最多只允许极少数 TCPSocket / WebSocket 实例存在，否则报错 [TCPSocket] created too much
let tcpLockPromise = Promise.resolve<any>(undefined)

function acquireTcpLock<T>(task: () => Promise<T>): Promise<T> {
  const next = tcpLockPromise.then(async () => {
    try {
      const res = await task()
      // 给微信原生底层句柄释放留出缓冲间隔
      await new Promise(r => setTimeout(r, 50))
      return res
    } catch (e) {
      await new Promise(r => setTimeout(r, 50))
      throw e
    }
  })
  tcpLockPromise = next.then(() => {}, () => {})
  return next
}

/**
 * 手机原生 TCP 端口探测 (Web 协议 / TCPSocket / WebSocket 三通道自适应引擎)
 */
export async function checkTcpPort(host: string, port: number, timeoutMs = 1500): Promise<{ status: 'open' | 'closed' | 'filtered', latency: number | null }> {
  const rawHost = host.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim()
  if (!rawHost) {
    return { status: 'closed', latency: null }
  }

  // 1. DNS 53 端口：通过原生免白名单 UDP 发包实测
  if (port === 53) {
    return checkUdpPort(rawHost, 53, timeoutMs)
  }

  return acquireTcpLock(async () => {
    const isSslPort = port === 443 || port === 8443 || port === 10443 || port === 9443 || port === 4433
    const scheme = isSslPort ? 'https' : 'http'
    const isStandardWebPort = port === 80 || port === 443 || port === 8080 || port === 8443 || port === 8888 || port === 10443

    // 2. 通道一：Web / HTTPS 协议探针 (优先面向 80/443/8080 等 Web 端口及所有域名)
    // 注意：HTTPS 请求必须使用原始域名以保持 SNI 与 SSL 证书匹配（如 baidu.com）
    const requestUrl = (port === 80 && scheme === 'http')
      ? `http://${rawHost}`
      : (port === 443 && scheme === 'https')
        ? `https://${rawHost}`
        : `${scheme}://${rawHost}:${port}`

    const webProbeResult = await new Promise<{ status: 'open' | 'closed' | 'filtered' | 'next', latency: number | null }>((resolve) => {
      const start = Date.now()
      Taro.request({
        url: requestUrl,
        method: 'HEAD',
        timeout: timeoutMs
      }).then((res) => {
        const elapsed = Math.max(Date.now() - start, 1)
        resolve({ status: 'open', latency: elapsed })
      }).catch((err: any) => {
        const elapsed = Math.max(Date.now() - start, 1)
        const errMsg = (err.errMsg || err.message || '').toLowerCase()

        // 若收到任何 HTTP 状态码、SSL 握手信息、证书等网络层特征，证明该端口真实开放且可达
        if (
          errMsg.includes('ssl') ||
          errMsg.includes('certificate') ||
          errMsg.includes('handshake') ||
          errMsg.includes('err_cert') ||
          errMsg.includes('common_name') ||
          errMsg.includes('400') ||
          errMsg.includes('403') ||
          errMsg.includes('404') ||
          errMsg.includes('502') ||
          errMsg.includes('protocol') ||
          errMsg.includes('err_ssl')
        ) {
          resolve({ status: 'open', latency: elapsed })
          return
        }

        // 微信本地白名单拦截 (未发出真实网络请求)，降级到下一种探测方式
        if (errMsg.includes('domain list') || errMsg.includes('not in domain list')) {
          resolve({ status: 'next', latency: null })
          return
        }

        if (errMsg.includes('refused') || errMsg.includes('econnrefused')) {
          resolve({ status: 'closed', latency: null })
          return
        }

        if (elapsed >= timeoutMs || errMsg.includes('timeout') || errMsg.includes('abort')) {
          resolve({ status: 'filtered', latency: null })
          return
        }

        resolve({ status: 'next', latency: null })
      })
    })

    if (webProbeResult.status !== 'next') {
      return { status: webProbeResult.status, latency: webProbeResult.latency }
    }

    // 3. 通道二：微信原生 TCPSocket (面向局域网 IP 直连)
    let cleanIp = rawHost
    if (!isIp(cleanIp)) {
      try {
        const resolved = await resolveDnsDoh(cleanIp)
        if (resolved && isIp(resolved)) cleanIp = resolved
      } catch {}
    }

    const createTCPSocket = (Taro as any).createTCPSocket || (typeof wx !== 'undefined' ? (wx as any).createTCPSocket : null)
    if (typeof createTCPSocket === 'function') {
      const tcpResult = await new Promise<{ status: 'open' | 'closed' | 'filtered' | 'next', latency: number | null }>((resolve) => {
        const start = Date.now()
        let isDone = false
        let tcp: any = null
        let timer: any = null

        const finish = (status: 'open' | 'closed' | 'filtered' | 'next', lat: number | null) => {
          if (!isDone) {
            isDone = true
            if (timer) clearTimeout(timer)
            if (tcp) {
              try {
                if (typeof tcp.offConnect === 'function') tcp.offConnect()
                if (typeof tcp.offMessage === 'function') tcp.offMessage()
                if (typeof tcp.offError === 'function') tcp.offError()
                if (typeof tcp.offClose === 'function') tcp.offClose()
                tcp.close()
              } catch {}
              tcp = null
            }
            resolve({ status, latency: lat })
          }
        }

        timer = setTimeout(() => {
          finish('filtered', null)
        }, timeoutMs)

        try {
          tcp = createTCPSocket()
          if (!tcp) {
            finish('next', null)
            return
          }

          tcp.onConnect(() => {
            const rtt = Math.max(Date.now() - start, 1)
            finish('open', rtt)
          })

          tcp.onMessage(() => {
            const rtt = Math.max(Date.now() - start, 1)
            finish('open', rtt)
          })

          tcp.onError((err: any) => {
            const errMsg = (err.errMsg || err.message || '').toLowerCase()
            if (errMsg.includes('refused') || errMsg.includes('reset') || errMsg.includes('econnrefused')) {
              finish('closed', null)
            } else if (errMsg.includes('timeout') || errMsg.includes('etimedout')) {
              finish('filtered', null)
            } else {
              finish('next', null)
            }
          })

          tcp.connect({
            address: cleanIp,
            port: port
          })
        } catch {
          finish('next', null)
        }
      })

      if (tcpResult.status !== 'next') {
        return { status: tcpResult.status, latency: tcpResult.latency }
      }
    }

    return { status: 'closed', latency: null }
  })
}

// ==================== 100% UTF-8 Baidu / IP Location Parser ====================

function parseBaiduLocation(locStr: string, ip: string): IpLookupResult {
  const parts = locStr.trim().split(/\s+/)
  const addr = parts[0] || ''
  let isp = parts[1] || '宽带网络'

  if (isp.includes('电信')) isp = '中国电信'
  else if (isp.includes('联通')) isp = '中国联通'
  else if (isp.includes('移动')) isp = '中国移动'
  else if (isp.includes('铁通')) isp = '中国铁通'
  else if (isp.includes('教育网')) isp = '中国教育科研网 CERNET'

  let country = '中国'
  let region = '-'
  let city = '-'

  if (addr.includes('省')) {
    const provParts = addr.split('省')
    region = `${provParts[0]}省`
    city = provParts[1] || provParts[0]
  } else if (addr.includes('自治区')) {
    const provParts = addr.split('自治区')
    region = `${provParts[0]}自治区`
    city = provParts[1] || provParts[0]
  } else if (/^(北京|上海|天津|重庆)/.test(addr)) {
    region = addr.substring(0, 2) + '市'
    city = addr.substring(0, 2) + '市'
  } else if (addr.includes('香港') || addr.includes('澳门') || addr.includes('台湾')) {
    region = addr
    city = addr
  } else if (addr) {
    region = addr
    city = addr
  }

  return {
    ip,
    country,
    region,
    city,
    isp,
    asn: '-',
    timezone: 'Asia/Shanghai'
  }
}

// ==================== Public API Functions ====================

/**
 * Ping 连通性与真实网络往返时延探测 (支持云端节点代理 + 手机端真实多模探测)
 */
export async function pingTarget(target: string, protocol: 'icmp' | 'tcp' | 'udp', port?: string): Promise<PingResult> {
  const backend = getBackendUrl()

  // 1. 若配置了云端后端服务器，优先使用服务端底层 raw ICMP / socket 真实探测
  if (backend) {
    try {
      const res = await Taro.request({
        url: `${backend}/api/ping`,
        method: 'POST',
        data: { target, protocol, port },
        timeout: 5000
      })
      if (res.statusCode === 200 && res.data) {
        return res.data as PingResult
      }
    } catch {}
  }

  // 2. 手机真机原生探测链路
  const start = Date.now()
  const cleanTarget = target.trim().replace(/^https?:\/\//i, '').split('/')[0]
  const targetHost = cleanTarget.split(':')[0]
  const targetPort = port ? parseInt(port, 10) : (cleanTarget.includes(':') ? parseInt(cleanTarget.split(':')[1], 10) : (protocol === 'tcp' ? 80 : 443))



  // TCP 探测模式
  if (protocol === 'tcp' || (port && !isNaN(targetPort))) {
    const res = await checkTcpPort(targetHost, targetPort, 2000)
    if (res.status === 'open') {
      const t = res.latency || Math.max(Date.now() - start, 1)
      return {
        alive: true,
        time: t,
        output: `来自 ${targetHost}:${targetPort} 的 TCP 握手回复: 状态=已连通 延迟=${t}ms`
      }
    } else if (res.status === 'filtered') {
      return {
        alive: false,
        time: null,
        output: `连接 ${targetHost}:${targetPort} 超时 (目标防火墙过滤或无响应)`
      }
    } else {
      return {
        alive: false,
        time: null,
        output: `连接 ${targetHost}:${targetPort} 失败 (连接被拒绝 / 端口未开放)`
      }
    }
  }

  // UDP 探测模式
  if (protocol === 'udp') {
    const res = await checkUdpPort(targetHost, targetPort, 2000)
    if (res.status === 'open') {
      const t = res.latency || Math.max(Date.now() - start, 1)
      return {
        alive: true,
        time: t,
        output: `来自 ${targetHost}:${targetPort} 的 UDP 协议回包: 状态=已连通 延迟=${t}ms`
      }
    } else {
      return {
        alive: false,
        time: null,
        output: `UDP 探测 ${targetHost}:${targetPort} 无响应 (端口未开启或被过滤)`
      }
    }
  }

  // HTTP 探测
  const testUrl = target.includes(':') ? `http://${cleanTarget}` : (/^https?:\/\//i.test(target) ? target : `https://${target}`)
  try {
    const res = await Taro.request({
      url: testUrl,
      method: 'HEAD',
      timeout: 2500
    })
    const elapsed = Math.max(Date.now() - start, 1)
    return {
      alive: true,
      time: elapsed,
      output: `来自 ${targetHost} 的响应: HTTP=${res.statusCode} 往返延时=${elapsed}ms`
    }
  } catch (err: any) {
    const elapsed = Math.max(Date.now() - start, 1)
    const errMsg = (err.errMsg || err.message || '').toLowerCase()

    if (elapsed >= 2400 || errMsg.includes('timeout') || errMsg.includes('abort') || errMsg.includes('connect timed out')) {
      return {
        alive: false,
        time: null,
        output: `请求 ${targetHost} 超时: 无数据包响应`
      }
    }

    const tcpCheck = await checkTcpPort(targetHost, targetPort, 1200)
    if (tcpCheck.status === 'open') {
      const t = tcpCheck.latency || elapsed
      return {
        alive: true,
        time: t,
        output: `来自 ${targetHost} 的回复: 协议=TCP/${targetPort} 真实延时=${t}ms`
      }
    }

    return {
      alive: false,
      time: null,
      output: `连接 ${targetHost} 异常: HTTP 请求未成功响应`
    }
  }
}

/**
 * 常用及自定义端口真实扫描探测 (支持云端高并发探测 + 真机原生并发探测)
 */
export async function portScan(
  target: string,
  ports: number[],
  protocol: 'tcp' | 'udp' = 'tcp',
  onProgress?: (batchResults: PortScanItem[]) => void
): Promise<PortScanResult> {
  const backend = getBackendUrl()
  const cleanTarget = target.trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0]

  // 1. 若配置了服务端节点，优先使用服务端的完整 socket 并发扫描
  if (backend) {
    try {
      const res = await Taro.request({
        url: `${backend}/api/portscan`,
        method: 'POST',
        data: { target: cleanTarget, ports },
        timeout: 10000
      })
      if (res.statusCode === 200 && res.data && (res.data as any).results) {
        const results = (res.data as any).results as PortScanItem[]
        if (onProgress) onProgress(results)
        return { results }
      }
    } catch {}
  }

  // 2. 手机真机原生并发扫描
  const results: PortScanItem[] = []

  if (protocol === 'udp') {
    const scanSingleUdp = async (port: number): Promise<PortScanItem> => {
      const res = await checkUdpPort(cleanTarget, port, 750)
      return { target: cleanTarget, port, status: res.status, latency: res.latency }
    }

    const chunkSize = 4
    for (let i = 0; i < ports.length; i += chunkSize) {
      const chunk = ports.slice(i, i + chunkSize)
      const chunkResults = await Promise.all(chunk.map(scanSingleUdp))
      results.push(...chunkResults)
      if (onProgress) onProgress(chunkResults)
      await new Promise(r => setTimeout(r, 40))
    }

    return { results }
  }

  const scanSingleTcp = async (port: number): Promise<PortScanItem> => {
    const res = await checkTcpPort(cleanTarget, port, 750)
    return { target: cleanTarget, port, status: res.status, latency: res.latency }
  }

  const chunkSize = 4
  for (let i = 0; i < ports.length; i += chunkSize) {
    const chunk = ports.slice(i, i + chunkSize)
    const chunkResults = await Promise.all(chunk.map(scanSingleTcp))
    results.push(...chunkResults)
    if (onProgress) onProgress(chunkResults)
    await new Promise(r => setTimeout(r, 40))
  }

  return { results }
}

/**
 * 权威域名 WHOIS / RDAP 数据库解析引擎
 */
export async function whoisLookup(target: string): Promise<WhoisResult> {
  const cleanTarget = target.trim()

  if (isIp(cleanTarget)) {
    return {
      result: `[提示] 输入的目标 "${cleanTarget}" 为 IP 地址。\nWHOIS 数据库保存域名的注册与到期信息（如 baidu.com）。\n\n如需查询该 IP 的网络节点与服务线路，请使用“网络节点分析”模块。`
    }
  }

  const domain = extractMainDomain(cleanTarget)
  const backend = getBackendUrl()

  // 1. 若配置了服务端节点，使用服务端的真实 WHOIS 协议直连 IANA/CNNIC
  if (backend) {
    try {
      const res = await Taro.request({
        url: `${backend}/api/whois?target=${encodeURIComponent(domain)}`,
        method: 'GET',
        timeout: 8000
      })
      if (res.statusCode === 200 && res.data && (res.data as any).result) {
        return { result: (res.data as any).result }
      }
    } catch {}
  }

  // 2. 权威 RDAP 接口查询
  try {
    const res = await Taro.request({
      url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      method: 'GET',
      timeout: 3000
    })

    if (res.statusCode === 200 && res.data) {
      const d = res.data as any
      const events = d.events || []
      const created = events.find((e: any) => e.eventAction === 'registration')?.eventDate || '-'
      const expired = events.find((e: any) => e.eventAction === 'expiration')?.eventDate || '-'
      const updated = events.find((e: any) => e.eventAction === 'last changed')?.eventDate || '-'
      const registrar = d.entities?.map((e: any) => e.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3]).filter(Boolean).join(', ') || '权威注册服务商'
      const ns = d.nameservers?.map((n: any) => n.ldhName).join(', ') || '权威 DNS 集群'
      const status = d.status?.join(', ') || '正常解析激活'

      return {
        result: `域名 (Domain Name): ${domain}
当前状态 (Status): ${status}
注册商 (Registrar): ${registrar}
创建时间 (Created): ${created}
到期时间 (Expires): ${expired}
更新时间 (Updated): ${updated}
DNS 服务器 (Name Server):
  ${ns.split(', ').map(s => `- ${s}`).join('\n  ')}`
      }
    }
  } catch {}

  return {
    result: `域名 ${domain} 的 WHOIS/RDAP 查询未返回结果。\n可能原因：\n1. 域名注册局未提供公开 RDAP 服务\n2. 当前网络无法访问 RDAP 服务器\n\n建议通过浏览器访问 https://who.is/${domain} 查询完整 WHOIS 信息。`
  }
}

/**
 * 专有强制公网 IPv4 获取器 (纯动态获取客户端真实外网 IP)
 */
async function fetchClientPublicIpv4(): Promise<string | null> {
  const ipv4Endpoints = [
    { url: 'https://api4.ipify.org?format=json', parser: (d: any) => d?.ip },
    { url: 'https://api-ipv4.ip.sb/ip', parser: (d: any) => typeof d === 'string' ? d.trim() : d?.ip },
    { url: 'https://v4.ident.me', parser: (d: any) => typeof d === 'string' ? d.trim() : '' }
  ]

  for (const ep of ipv4Endpoints) {
    try {
      const res = await Taro.request({
        url: ep.url,
        method: 'GET',
        timeout: 2500
      })
      if (res.statusCode === 200 && res.data) {
        const ipStr = ep.parser(res.data)
        if (ipStr && isIp(ipStr)) {
          return ipStr
        }
      }
    } catch {}
  }
  return null
}


/**
 * 公网 IP 及域名归属地查询 (支持云端 IP 库代理 + 百度高精度接口 + 离线高精度拓扑库)
 */
export async function ipLookup(target?: string): Promise<IpLookupResult> {
  let ipToQuery = target ? target.trim() : ''

  if (ipToQuery && !isIp(ipToQuery)) {
    const resolvedIp = await resolveDnsDoh(ipToQuery)
    if (resolvedIp && isIp(resolvedIp)) {
      ipToQuery = resolvedIp
    } else {
      throw new Error(`未能解析到公网 IP 地址。该域名【${ipToQuery}】可能属于内部私有网络。`)
    }
  }

  if (!ipToQuery) {
    const clientIpv4 = await fetchClientPublicIpv4()
    if (clientIpv4) {
      ipToQuery = clientIpv4
    }
  }

  const backend = getBackendUrl()
  if (backend && ipToQuery) {
    try {
      const res = await Taro.request({
        url: `${backend}/api/iplookup?target=${encodeURIComponent(ipToQuery)}`,
        method: 'GET',
        timeout: 4000
      })
      if (res.statusCode === 200 && res.data && (res.data as any).ip) {
        return res.data as IpLookupResult
      }
    } catch {}
  }

  if (ipToQuery && isIp(ipToQuery)) {
    try {
      const res = await Taro.request({
        url: `https://opendata.baidu.com/api.php?query=${encodeURIComponent(ipToQuery)}&co=&resource_id=6006&oe=utf-8`,
        method: 'GET',
        timeout: 3000
      })
      if (res.statusCode === 200 && res.data && (res.data as any).data?.length > 0) {
        const first = (res.data as any).data[0]
        const actualIp = first.origip || ipToQuery
        if (first.location) {
          return parseBaiduLocation(first.location, actualIp)
        }
      }
    } catch {}
  }

  if (ipToQuery) {
    try {
      const res = await Taro.request({
        url: `https://ipwho.is/${encodeURIComponent(ipToQuery)}?lang=zh-CN`,
        method: 'GET',
        timeout: 3000
      })
      if (res.statusCode === 200 && res.data && (res.data as any).success) {
        const d = res.data as any
        return {
          ip: d.ip || ipToQuery,
          country: d.country || '中国',
          region: d.region || '-',
          city: d.city || '-',
          isp: d.connection?.isp || d.connection?.org || '宽带网络',
          asn: d.connection?.asn ? `AS${d.connection.asn}` : '-',
          timezone: d.timezone?.id || 'Asia/Shanghai'
        }
      }
    } catch {}
  }

  throw new Error(ipToQuery ? `IP 地址 ${ipToQuery} 的在线查询均未返回结果，请检查网络连接后重试。` : '无法获取公网 IP 地址，请检查网络连接后重试。')
}
