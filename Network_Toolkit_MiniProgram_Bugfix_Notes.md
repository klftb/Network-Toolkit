---
title: 微信网络测试小程序真机兼容性修复与功能升级
date: 2026-06-16
tags:
  - AI对话记录
  - 微信小程序
  - 网络诊断
---

# 微信小程序网络测试工具真机兼容性修复与功能升级

> **日期**：2026-06-16
> **标签**：#AI对话记录 #微信小程序 #网络诊断

---

## 💡 核心需求 / 问题背景
- 开发一款100%纯前端、脱离本地后端的微信网络诊断小程序，在真机调试（iOS / PC微信客户端）过程中解决公网 DNS 解析报错崩溃、中国城市归属地显示缺失/乱码、iOS 系统 WiFi 扫描跳转权限限制等环境兼容性问题，并在此基础上新增自定义 Ping 探测参数与双模 Trace & MTR 路由诊断核心模块。

---

## 🔄 探讨过程 / 关键节点
- **解决 Aliyun DoH 域名解析失败与 `dnsResolve` 未定义崩溃**：
  - *现象*：报错 `dnsResolve is not a function`，且 DoH 解析在真机上返回 `ERR_NAME_NOT_RESOLVED (-105)`。
  - *排查*：微信小程序的 `Taro.dnsResolve` 接口属于非标或已废弃接口，在当前基础库中为 `undefined`，且它本身也仅支持白名单域名，无法解析任意外部域名。真机的 `-105` 报错则是由于微信网络沙盒拦截了未备案的第三方公共 DNS 域名所致。
  - *决策*：彻底剔除原生 `dnsResolve` 接口，改用标准的 HTTPS **三级 DoH 备用级联链（阿里云 ➔ 腾讯云 ➔ 360安全）** 在前端执行域名 IPv4 转换，并增加微信开启“开发调试”避坑引导。
- **解决国内 IP 归属地城市不显示与乱码**：
  - *现象*：`api.ip.sb` 的免费地理库对国内 IP 不返回 `city` 字段导致城市缺省为 `-`，且旧的国内位置接口使用 GBK 编码导致小程序端乱码。
  - *排查*：小程序默认仅支持标准的 UTF-8 编码响应，GBK 字节流解析会发生冲突。
  - *决策*：引入**百度公共高精度 IP 查询 API**，其响应为标准的 UTF-8 JSON，并且包含完整的“省份、城市、运营商”中文信息，并提供智能的前端正则提取算法。
- **释疑 iOS 真机 WiFi 扫描跳转权限无结果**：
  - *现象*：iPhone 开启全部微信及定位权限后，WiFi 扫描依然返回空，且微信会自动引导用户跳入系统设置页。
  - *排查*：苹果 iOS 具有底层系统级隐私安全限制，**禁止向小程序和第三方 App 暴露周围 of WiFi 列表**（仅能读取当前连接的单个 WiFi）。微信调起 `startWifi` 会触发定位授权申请，但 iOS 最终仍会返回空列表。
  - *决策*：增设醒目的黄色小黄条警告 Banner，并提供“加载模拟信号图示预览”作为演示入口。
- **PC 端微信小程序 Whois 频繁超时排查**：
  - *现象*：iOS 端开启调试后正常使用，但 PC 微信客户端打开时 Whois 卡片依然报错超时。
  - *排查*：PC 端（Windows/Mac 微信）运行小程序时具有更严格的 HTTPS 证书与域名白名单拦截，且有时无法正确响应真机调试中的“忽略域名校验”指令，导致 `who-dat.as93.net` 被直接阻断。
  - *决策*：为 `whoisLookup` 接入**排查日志机制（Diagnostics Logs）**，实时将失败报错（如 `request:fail`）输出在卡片上，并指引开发者将真机调试模式切换为“真机调试 1.0”以强制透传下发“忽略合法域名校验”配置。

---

## ✅ 最终方案 / 结论

### 1. 核心代码实现

#### 🌐 公网 IP 解析、DoH 三级容灾与百度 IP 定位 (`src/lib/api.ts`)
```typescript
import Taro from '@tarojs/taro'

const isIp = (str: string) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(str)

// 提取一级主域名用于 Whois 查询
const extractMainDomain = (domain: string): string => {
  let clean = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim()
  const parts = clean.split('.')
  if (parts.length <= 2) return clean
  const doubleSuffixes = ['com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'co.uk', 'co.jp']
  const lastTwo = parts.slice(-2).join('.')
  if (doubleSuffixes.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.')
  }
  return parts.slice(-2).join('.')
}

// Whois 查询 (带排查日志)
export async function whoisLookup(target: string) {
  const cleanTarget = target.trim()
  if (isIp(cleanTarget)) {
    return {
      result: `[提示] 输入的目标 "${cleanTarget}" 为 IP 地址。WHOIS 仅保存域名注册信息。\n如需查询物理归属请使用“公网 IP 探针”模块。`
    }
  }

  const domain = extractMainDomain(cleanTarget)
  const errors: string[] = []
  
  // 1. 优先采用 who-dat.as93.net
  try {
    const res = await Taro.request({
      url: `https://who-dat.as93.net/${encodeURIComponent(domain)}`,
      method: 'GET',
      timeout: 6000
    })
    if (res.statusCode === 200 && res.data && (res.data as any).domain) {
      const d = res.data as any
      const ns = d.nameservers ? d.nameservers.map((n: any) => n.name).join(', ') : '-'
      return {
        result: `[Whois 极速解析成功]\n域名名称 (Domain): ${d.domain}\n注册状态 (Status): ${d.status ? d.status.join(', ') : '-'}\n创建时间 (Created): ${d.dates?.created || '-'}\n到期时间 (Expires): ${d.dates?.expires || '-'}\n更新时间 (Updated): ${d.dates?.updated || '-'}\n注册商 (Registrar): ${d.registrar?.name || '-'}\nDNS 服务器 (Name Servers): ${ns}`
      }
    } else {
      errors.push(`Who-Dat 接口响应异常: 状态码=${res.statusCode}`)
    }
  } catch (err: any) {
    errors.push(`Who-Dat 接口请求失败: ${err.errMsg || err.message || '未知错误'}`)
  }

  // 2. 备用采用 rdap.org
  try {
    const res = await Taro.request({
      url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
      method: 'GET',
      timeout: 6000
    })
    if (res.statusCode === 200 && res.data) {
      const d = res.data as any
      const events = d.events || []
      const created = events.find((e: any) => e.eventAction === 'registration')?.eventDate || '-'
      const expired = events.find((e: any) => e.eventAction === 'expiration')?.eventDate || '-'
      const registrar = d.entities?.map((e: any) => e.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3]).filter(Boolean).join(', ') || '-'
      const ns = d.nameservers?.map((n: any) => n.ldhName).join(', ') || '-'
      
      return {
        result: `[RDAP Whois 深度解析成功]\n域名名称 (Domain): ${domain}\n注册机构 (Registrar): ${registrar}\n创建时间 (Created): ${created}\n到期时间 (Expires): ${expired}\nDNS 服务器 (Name Servers): ${ns}`
      }
    } else {
      errors.push(`RDAP 接口响应异常: 状态码=${res.statusCode}`)
    }
  } catch (err: any) {
    errors.push(`RDAP 接口请求失败: ${err.errMsg || err.message || '未知错误'}`)
  }

  return { 
    result: `Whois 查询超时或失败。\n\n[排查日志]:\n${errors.join('\n')}\n\n💡 提示：如果您在 PC 端微信小程序测试或进行「真机调试」，请确保开启了「忽略域名校验/不校验合法域名」选项。若仍失败，请在微信开发者工具中将「真机调试 2.0」切换为「真机调试 1.0」模式，以绕过微信 PC 端的强制域名白名单限制。` 
  }
}

// IP 查询 (DoH 三级容灾 + 百度高精度 IP)
export async function ipLookup(target?: string) {
  let ipToQuery = target ? target.trim() : ''
  
  if (!ipToQuery) {
    try {
      const getIpRes = await Taro.request({ url: 'https://api.ipify.org?format=json', method: 'GET', timeout: 3000 })
      if (getIpRes.statusCode === 200 && getIpRes.data && (getIpRes.data as any).ip) {
        ipToQuery = (getIpRes.data as any).ip
      }
    } catch {
      try {
        const getIpRes2 = await Taro.request({ url: 'https://api.ip.sb/ip', method: 'GET', timeout: 3000 })
        if (getIpRes2.statusCode === 200 && getIpRes2.data) {
          ipToQuery = String(getIpRes2.data).trim()
        }
      } catch {}
    }
  }
  
  if (ipToQuery && !isIp(ipToQuery)) {
    let resolved = false
    // 1. 阿里云 DoH
    try {
      const dohRes = await Taro.request({
        url: `https://dns.alidns.com/resolve?name=${encodeURIComponent(ipToQuery)}&type=A`,
        method: 'GET',
        header: { 'Accept': 'application/dns-json' },
        timeout: 3000
      })
      if (dohRes.statusCode === 200 && dohRes.data && (dohRes.data as any).Answer) {
        const aRecord = (dohRes.data as any).Answer.find((ans: any) => ans.type === 1 && ans.data && isIp(ans.data))
        if (aRecord) { ipToQuery = aRecord.data; resolved = true; }
      }
    } catch {}
    
    // 2. 腾讯云 DoH
    if (!resolved) {
      try {
        const dohRes2 = await Taro.request({
          url: `https://doh.pub/dns-query?name=${encodeURIComponent(ipToQuery)}&type=A`,
          method: 'GET',
          header: { 'Accept': 'application/dns-json' },
          timeout: 3000
        })
        if (dohRes2.statusCode === 200 && dohRes2.data && (dohRes2.data as any).Answer) {
          const aRecord = (dohRes2.data as any).Answer.find((ans: any) => ans.type === 1 && ans.data && isIp(ans.data))
          if (aRecord) { ipToQuery = aRecord.data; resolved = true; }
        }
      } catch {}
    }
    
    // 3. 360安全 DoH
    if (!resolved) {
      try {
        const dohRes3 = await Taro.request({
          url: `https://doh.360.cn/resolve?name=${encodeURIComponent(ipToQuery)}&type=A`,
          method: 'GET',
          header: { 'Accept': 'application/dns-json' },
          timeout: 3000
        })
        if (dohRes3.statusCode === 200 && dohRes3.data && (dohRes3.data as any).Answer) {
          const aRecord = (dohRes3.data as any).Answer.find((ans: any) => ans.type === 1 && ans.data && isIp(ans.data))
          if (aRecord) { ipToQuery = aRecord.data; resolved = true; }
        }
      } catch {}
    }
  }

  // 1. 优先调用百度高精度 IP 定位
  try {
    const res = await Taro.request({
      url: `https://opendata.baidu.com/api.php?query=${encodeURIComponent(ipToQuery)}&co=&resource_id=6006&oe=utf-8`,
      method: 'GET',
      timeout: 4000
    })
    if (res.statusCode === 200 && res.data && (res.data as any).data && (res.data as any).data.length > 0) {
      const d = (res.data as any).data[0]
      const loc = d.location || ''
      let country = '-', region = '-', city = '-', isp = '-'
      if (loc) {
        const parts = loc.trim().split(/\s+/)
        const addr = parts[0] || ''
        isp = parts[1] || '-'
        if (addr.includes('省')) {
          country = '中国'
          const provParts = addr.split('省')
          region = provParts[0] + '省'
          city = provParts[1] || '-'
        } else if (addr.includes('自治区')) {
          country = '中国'
          const provParts = addr.split('自治区')
          region = provParts[0] + '自治区'
          city = provParts[1] || '-'
        } else if (addr.startsWith('北京') || addr.startsWith('上海') || addr.startsWith('天津') || addr.startsWith('重庆')) {
          country = '中国'
          region = addr.substring(0, 3).includes('市') ? addr.substring(0, 3) : addr.substring(0, 2) + '市'
          city = addr
        } else if (addr.includes('香港') || addr.includes('澳门') || addr.includes('台湾')) {
          country = '中国'
          region = addr; city = addr
        } else {
          country = addr; region = '-'; city = '-'
        }
      }
      return { ip: d.origip || ipToQuery || '', country, region, city, isp, asn: '-', timezone: 'Asia/Shanghai' }
    }
  } catch {}

  // 2. 备用调用 ip.sb
  try {
    const res = await Taro.request({ url: `https://api.ip.sb/geoip/${encodeURIComponent(ipToQuery)}`, method: 'GET', timeout: 4000 })
    if (res.statusCode === 200 && res.data) {
      const d = (res.data as any)
      return { ip: d.ip || ipToQuery || '', country: d.country || '中国', region: d.region || '-', city: d.city || '-', isp: d.isp || d.organization || '-', asn: d.asn ? String(d.asn) : '-', timezone: d.timezone || 'Asia/Shanghai' }
    }
  } catch {}

  if (ipToQuery && !isIp(ipToQuery)) {
    throw new Error(`公网 DNS 解析失败 (目标: "${ipToQuery}")。如果是真机调试，请确保手机微信小程序中开启了「开发调试」模式，并检查网络连接。`)
  }
  throw new Error('公网 IP 解析超时。如果是真机调试，请确保手机微信小程序中开启了「开发调试」模式，或检查您的网络连接。')
}
```

#### 📡 循环发包式 Ping 探测实现（`src/pages/ping/index.tsx` 核心算法段）
```typescript
    let successCount = 0
    let failCount = 0
    let totalTime = 0
    let times: number[] = []
    
    const logs: string[] = [`PING ${target} via ${protocol.toUpperCase()}:`]
    setPingLogs([...logs])

    for (let i = 0; i < pingCount; i++) {
      try {
        const data = await pingTarget(target.trim(), protocol, port.trim())
        if (data.alive) {
          successCount++
          const t = data.time || 0
          times.push(t)
          totalTime += t
          logs.push(`来自 ${target} 的回复: seq=${i + 1} 协议=${protocol.toUpperCase()} 延迟=${t}ms`)
        } else {
          failCount++
          logs.push(`请求 ${target} 目标超时: seq=${i + 1}`)
        }
      } catch (err: any) {
        failCount++
        logs.push(`探测 ${target} 失败: seq=${i + 1} 原因=${err.message || '未知错误'}`)
      }
      setPingLogs([...logs])

      if (i < pingCount - 1) {
        await new Promise(resolve => setTimeout(resolve, pingInterval))
      }
    }

    const lossRate = ((failCount / pingCount) * 100).toFixed(0)
    const minTime = times.length > 0 ? Math.min(...times) : 0
    const maxTime = times.length > 0 ? Math.max(...times) : 0
    const avgTime = times.length > 0 ? (totalTime / times.length).toFixed(1) : 0

    logs.push(``)
    logs.push(`--- ${target} 探测统计信息 ---`)
    logs.push(`已发送 = ${pingCount}，已接收 = ${successCount}，丢失 = ${failCount} (${lossRate}% 丢失)`)
    if (successCount > 0) {
      logs.push(`往返行程的估计时间 (ms):`)
      logs.push(`    最短 = ${minTime}ms，最长 = ${maxTime}ms，平均 = ${avgTime}ms`)
    }
    setPingLogs([...logs])
```

#### 🕸️ 路由追踪终端优化布局与自适应 (`src/pages/trace/index.scss`)
```scss
.terminal-body {
  padding: 16px;
  height: 350px;
  box-sizing: border-box;

  .terminal-text {
    font-family: Consolas, Monaco, monospace;
    font-size: 11.5px; /* 调小字号防止普通屏幕截断 */
    color: #38bdf8;
    line-height: 1.6;
    white-space: pre;
    word-break: keep-all;
    display: inline-block; /* 确保撑开横向滚动 */
    min-width: 100%;
  }
}
```

### 2. 真机调试免域名白名单拦截设置方法
PC微信端与真机调试测试时，必须执行以确保网络高可用：
1. **清除开发者工具缓存**：在微信开发者工具上方选择「微信开发者工具」->「清除缓存」->「全部清除」。
2. **切换真机调试模式**：点击「真机调试」下拉箭头，将默认的 **「真机调试 2.0」切换为「真机调试 1.0」**（此步骤能将不校验合法域名的配置成功透传至 PC 端微信）。
3. **开启手机开发调试**：真机扫码进入后，点击手机屏幕右上角 **「...」** ➔ **「开发调试」** ➔ **「开启」**。

---

## 🚀 后续行动
- [ ] **收集小程序发布审核所需域名**：整理本程序用到的全部第三方公网域名（Aliyun/Tencent DoH、百度IP、Aliyun测速镜像、Whois服务器等）。
- [ ] **后台配置白名单**：在正式发布上线前，登录微信公众平台，将上述域名全部配置到 `request合法域名` 白名单中，实现无需开启开发调试即可供普通用户顺畅使用。
