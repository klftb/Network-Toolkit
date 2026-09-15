import React, { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface HeaderResult {
  statusCode: number
  latency: number
  headers: Record<string, string>
  serverType: string
  cdn: string
  securityScore: number
  securityChecks: { name: string; pass: boolean; desc: string }[]
}

export default function HeadersCheck() {
  const [target, setTarget] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<HeaderResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const getCdnProvider = (headers: Record<string, string>) => {
    const h = (k: string) => (headers[k] || '').toLowerCase()
    if (h('server').includes('cloudflare') || h('cf-ray')) return 'Cloudflare'
    if (h('x-amz-cf-id')) return 'AWS CloudFront'
    if (h('x-cdn') === 'aliyun' || h('eagleid')) return '阿里云 CDN'
    if (h('x-nws-log-uuid') || h('server').includes('tencent')) return '腾讯云 CDN'
    if (h('x-swift-savetime') || h('via').includes('l2cn')) return '阿里云/网宿 CDN'
    if (h('via').includes('akamai')) return 'Akamai'
    return '未识别或未使用 CDN'
  }

  const checkSecurity = (headers: Record<string, string>) => {
    const checks = [
      { key: 'strict-transport-security', name: 'HSTS (强制 HTTPS)', desc: '防止降级攻击' },
      { key: 'x-frame-options', name: 'X-Frame-Options', desc: '防止点击劫持 (Clickjacking)' },
      { key: 'x-content-type-options', name: 'X-Content-Type-Options', desc: '防止 MIME 类型嗅探' },
      { key: 'content-security-policy', name: 'CSP (内容安全策略)', desc: '防范 XSS 攻击' }
    ]

    let passCount = 0
    const results = checks.map(c => {
      const pass = !!headers[c.key] || !!headers[c.key.toLowerCase()]
      if (pass) passCount++
      return { name: c.name, pass, desc: c.desc }
    })

    return {
      score: Math.round((passCount / checks.length) * 100),
      checks: results
    }
  }

  const handleTest = async (urlToTest?: string) => {
    let rawUrl = urlToTest || target.trim()
    if (!rawUrl) {
      Taro.showToast({ title: '请输入 URL', icon: 'none' })
      return
    }
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`
    }

    setTarget(rawUrl)
    setRunning(true)
    setResult(null)
    setErrorMsg('')
    Taro.vibrateShort({ type: 'light' }).catch(() => {})

    const start = Date.now()
    try {
      const res = await Taro.request({
        url: rawUrl,
        method: 'HEAD',
        timeout: 5000
      })
      const latency = Date.now() - start
      
      const lowerHeaders: Record<string, string> = {}
      for (const key in res.header) {
        lowerHeaders[key.toLowerCase()] = res.header[key]
      }

      const sec = checkSecurity(lowerHeaders)

      setResult({
        statusCode: res.statusCode,
        latency,
        headers: lowerHeaders,
        serverType: lowerHeaders['server'] || '未知 (未返回 Server 头)',
        cdn: getCdnProvider(lowerHeaders),
        securityScore: sec.score,
        securityChecks: sec.checks
      })
    } catch (err: any) {
      setErrorMsg(err.errMsg || '请求失败或超时')
    } finally {
      setRunning(false)
    }
  }

  return (
    <View className='headers-page'>
      <View className='header'>
        <Text className='title'>HTTP 响应头分析</Text>
        <Text className='subtitle'>深度解析目标服务器配置、CDN信息及安全策略</Text>
      </View>

      <View className='search-card'>
        <View className='input-wrapper'>
          <Input
            className='target-input'
            placeholder='输入网址，如 qq.com'
            value={target}
            onInput={(e) => setTarget(e.detail.value)}
          />
          <Button className='go-btn' disabled={running} onClick={() => handleTest()}>
            {running ? '分析中' : '分析'}
          </Button>
        </View>
        <View className='quick-tags'>
          <Text className='q-tag' onClick={() => handleTest('qq.com')}>qq.com</Text>
          <Text className='q-tag' onClick={() => handleTest('github.com')}>github.com</Text>
          <Text className='q-tag' onClick={() => handleTest('baidu.com')}>baidu.com</Text>
        </View>
      </View>

      {errorMsg && (
        <View className='error-banner'>
          <Text className='msg'>❌ 请求失败：{errorMsg}</Text>
        </View>
      )}

      {result && (
        <>
          <View className='summary-card'>
            <View className='s-row'>
              <View className='s-item'>
                <Text className='s-val'>{result.statusCode}</Text>
                <Text className='s-label'>状态码</Text>
              </View>
              <View className='s-item'>
                <Text className='s-val'>{result.latency}ms</Text>
                <Text className='s-label'>响应时间</Text>
              </View>
              <View className='s-item'>
                <Text className={`s-val sec-color-${result.securityScore}`}>
                  {result.securityScore}
                </Text>
                <Text className='s-label'>安全评分</Text>
              </View>
            </View>
            <View className='s-divider' />
            <View className='s-text-row'>
              <Text className='s-icon'>🖥️</Text>
              <Text className='s-text'>Web Server: <Text className='hl'>{result.serverType}</Text></Text>
            </View>
            <View className='s-text-row'>
              <Text className='s-icon'>☁️</Text>
              <Text className='s-text'>CDN Provider: <Text className='hl'>{result.cdn}</Text></Text>
            </View>
          </View>

          <View className='section-title'>安全标头检测 (Security Headers)</View>
          <View className='security-card'>
            {result.securityChecks.map((chk, i) => (
              <View className='sec-item' key={i}>
                <Text className='sec-icon'>{chk.pass ? '✅' : '⚠️'}</Text>
                <View className='sec-info'>
                  <Text className={`sec-name ${chk.pass ? 'pass' : 'fail'}`}>{chk.name}</Text>
                  <Text className='sec-desc'>{chk.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className='section-title'>完整响应头 (Raw Headers)</View>
          <View className='raw-headers-card'>
            {Object.keys(result.headers).map((key) => (
              <View className='hdr-row' key={key}>
                <Text className='hdr-key'>{key}</Text>
                <Text className='hdr-val' selectable>{result.headers[key]}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View className='version-footer'>
        <Text className='version-text'>v1.1 · Author: Ben</Text>
      </View>
    </View>
  )
}
