import React, { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { buildDnsQueryPacket, parseDnsResponsePacket, isIp } from '../../lib/api'
import './index.scss'

interface DnsServer {
  id: string
  name: string
  ip: string
  provider: string
}

interface DnsResult {
  serverId: string
  status: 'pending' | 'testing' | 'done' | 'error' | 'timeout'
  ips: string[]
  latency: number | null
}

const DNS_SERVERS: DnsServer[] = [
  { id: 'aliyun', name: '阿里 DNS', ip: '223.5.5.5', provider: 'Alibaba' },
  { id: 'tencent', name: '腾讯 DNS', ip: '119.29.29.29', provider: 'Tencent' },
  { id: '114', name: '114 DNS', ip: '114.114.114.114', provider: '114DNS' },
  { id: 'baidu', name: '百度 DNS', ip: '180.76.76.76', provider: 'Baidu' },
  { id: 'cloudflare', name: 'Cloudflare', ip: '1.1.1.1', provider: 'Cloudflare' },
  { id: 'google', name: 'Google DNS', ip: '8.8.8.8', provider: 'Google' }
]

export default function DnsCheck() {
  const [target, setTarget] = useState('')
  const [running, setRunning] = useState(false)
  const [tested, setTested] = useState(false)
  const [results, setResults] = useState<Record<string, DnsResult>>({})

  const handleTest = async (domainToTest?: string) => {
    let host = domainToTest || target.trim()
    host = host.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim()
    if (!host) {
      Taro.showToast({ title: '请输入域名', icon: 'none' })
      return
    }

    if (isIp(host)) {
      Taro.showToast({ title: '请输入域名而不是 IP', icon: 'none' })
      return
    }

    setTarget(host)
    setRunning(true)
    setTested(false)

    const initialResults: Record<string, DnsResult> = {}
    DNS_SERVERS.forEach(s => {
      initialResults[s.id] = { serverId: s.id, status: 'testing', ips: [], latency: null }
    })
    setResults(initialResults)

    const createUDPSocket = (Taro as any).createUDPSocket || (typeof wx !== 'undefined' ? (wx as any).createUDPSocket : null)
    if (typeof createUDPSocket !== 'function') {
      Taro.showToast({ title: '基础库不支持 UDP', icon: 'none' })
      setRunning(false)
      return
    }

    const promises = DNS_SERVERS.map(server => {
      return new Promise<void>((resolve) => {
        const start = Date.now()
        let isDone = false
        let udp: any = null
        let timer: any = null

        const finish = (status: DnsResult['status'], ips: string[] = [], lat: number | null = null) => {
          if (!isDone) {
            isDone = true
            if (timer) clearTimeout(timer)
            if (udp) {
              try { udp.close() } catch {}
            }
            setResults(prev => ({
              ...prev,
              [server.id]: { serverId: server.id, status, ips, latency: lat }
            }))
            resolve()
          }
        }

        timer = setTimeout(() => finish('timeout'), 2500)

        try {
          udp = createUDPSocket()
          udp.bind()
          udp.onMessage((msgRes: any) => {
            const rawMsg = msgRes.message
            const uint8 = rawMsg instanceof ArrayBuffer ? new Uint8Array(rawMsg) : (rawMsg?.buffer ? new Uint8Array(rawMsg.buffer) : null)
            if (uint8) {
              const ips = parseDnsResponsePacket(uint8)
              if (ips.length > 0) {
                finish('done', ips, Math.max(Date.now() - start, 1))
              } else {
                finish('error')
              }
            }
          })
          udp.onError(() => finish('error'))

          const payload = buildDnsQueryPacket(host)
          udp.send({
            address: server.ip,
            port: 53,
            message: payload
          })
        } catch {
          finish('error')
        }
      })
    })

    await Promise.all(promises)
    setRunning(false)
    setTested(true)
  }

  // 计算一致性
  const doneResults = Object.values(results).filter(r => r.status === 'done' && r.ips.length > 0)
  let isConsistent = true
  let firstIps = ''
  if (doneResults.length > 1) {
    firstIps = [...doneResults[0].ips].sort().join(',')
    for (let i = 1; i < doneResults.length; i++) {
      if ([...doneResults[i].ips].sort().join(',') !== firstIps) {
        isConsistent = false
        break
      }
    }
  }

  return (
    <View className='dnscheck-page'>
      <View className='header'>
        <Text className='title'>DNS 对比分析</Text>
        <Text className='subtitle'>并行查询多个权威 DNS，对比解析结果与响应速度</Text>
      </View>

      <View className='search-card'>
        <View className='input-wrapper'>
          <Input
            className='target-input'
            placeholder='输入域名，如 baidu.com'
            value={target}
            onInput={(e) => setTarget(e.detail.value)}
          />
          <Button className='go-btn' disabled={running} onClick={() => handleTest()}>
            {running ? '查询中' : '对比'}
          </Button>
        </View>
        <View className='quick-tags'>
          <Text className='q-tag' onClick={() => handleTest('baidu.com')}>baidu.com</Text>
          <Text className='q-tag' onClick={() => handleTest('qq.com')}>qq.com</Text>
          <Text className='q-tag' onClick={() => handleTest('github.com')}>github.com</Text>
        </View>
      </View>

      {tested && doneResults.length > 0 && (
        <View className={`consistency-banner ${isConsistent ? 'success' : 'warning'}`}>
          <Text className='icon'>{isConsistent ? '✅' : '⚠️'}</Text>
          <Text className='msg'>
            {isConsistent ? '各 DNS 解析结果一致，无明显污染' : '解析结果不一致！可能存在 DNS 劫持或使用了 CDN 区域解析'}
          </Text>
        </View>
      )}

      <View className='results-list'>
        {DNS_SERVERS.map(server => {
          const res = results[server.id]
          const isPending = !res || res.status === 'pending'
          const isTesting = res?.status === 'testing'
          const isDone = res?.status === 'done'

          return (
            <View className='dns-row' key={server.id}>
              <View className='dns-info'>
                <Text className='dns-name'>{server.name}</Text>
                <Text className='dns-ip'>{server.ip}</Text>
              </View>

              <View className='dns-content'>
                {isPending && <Text className='muted'>等待测试</Text>}
                {isTesting && <Text className='testing-text'>查询中...</Text>}
                {res?.status === 'timeout' && <Text className='err-text'>请求超时</Text>}
                {res?.status === 'error' && <Text className='err-text'>查询失败</Text>}
                {isDone && (
                  <View className='ip-list'>
                    {res.ips.map((ip, idx) => (
                      <Text className='res-ip' key={idx}>{ip}</Text>
                    ))}
                  </View>
                )}
              </View>

              <View className='dns-lat'>
                {isDone && res.latency !== null && (
                  <Text className={`lat-val ${res.latency < 50 ? 'good' : res.latency < 150 ? 'warn' : 'bad'}`}>
                    {res.latency}ms
                  </Text>
                )}
              </View>
            </View>
          )
        })}
      </View>
      <View className='version-footer'>
        <Text className='version-text'>v1.1 · Author: Ben</Text>
      </View>
    </View>
  )
}
