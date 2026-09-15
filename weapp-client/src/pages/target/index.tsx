import React, { useState } from 'react'
import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ipLookup, resolveDnsDoh, checkTcpPort, IpLookupResult, PortScanResult } from '../../lib/api'
import './index.scss'

const PRESETS = [
  { label: '本机', value: '' },
  { label: '阿里', value: '223.5.5.5' },
  { label: '百度', value: 'baidu.com' },
  { label: 'CF', value: '1.1.1.1' }
]

const COMMON_PORTS = [21, 22, 53, 80, 443, 3306, 3389, 8080]

export default function TargetDiagnostics() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'ip' | 'dns' | 'http' | 'port'>('ip')
  
  const [loading, setLoading] = useState(false)
  
  // States for all tools
  const [ipResult, setIpResult] = useState<IpLookupResult | null>(null)
  const [dnsResult, setDnsResult] = useState<any | null>(null)
  const [httpResult, setHttpResult] = useState<any | null>(null)
  const [portResults, setPortResults] = useState<Record<number, PortScanResult>>({})
  const [customPort, setCustomPort] = useState('')

  const [error, setError] = useState('')

  const handleLookup = async (targetQuery?: string) => {
    const q = typeof targetQuery === 'string' ? targetQuery : query
    setLoading(true)
    setError('')
    
    // Clear previous results
    if (activeTab === 'ip') setIpResult(null)
    if (activeTab === 'dns') setDnsResult(null)
    if (activeTab === 'http') setHttpResult(null)
    if (activeTab === 'port') setPortResults({})

    try {
      if (activeTab === 'ip') {
        const data = await ipLookup(q.trim() || undefined)
        setIpResult(data)
      } else if (activeTab === 'dns') {
        if (!q.trim()) throw new Error('请输入要查询的域名')
        try {
          const resolved = await resolveDnsDoh(q.trim())
          setDnsResult({ status: 'success', records: [{ type: 'A/AAAA', value: resolved, ttl: '-' }] })
        } catch {
          setDnsResult({ status: 'error', records: [] })
        }
      } else if (activeTab === 'http') {
        if (!q.trim()) throw new Error('请输入要查询的 URL 或域名')
        let rawUrl = q.trim()
        if (!/^https?:\/\//i.test(rawUrl)) rawUrl = `https://${rawUrl}`
        const start = Date.now()
        const res = await Taro.request({ url: rawUrl, method: 'HEAD', timeout: 5000 })
        const latency = Date.now() - start
        
        const lowerHeaders: Record<string, string> = {}
        for (const key in res.header) {
          lowerHeaders[key.toLowerCase()] = res.header[key]
        }
        setHttpResult({ statusCode: res.statusCode, protocol: 'HTTP', timingMs: latency, headers: lowerHeaders })
      } else if (activeTab === 'port') {
        if (!q.trim()) throw new Error('请输入目标 IP 或域名')
        Taro.showToast({ title: '开始扫描', icon: 'none' })
        // Scan ports concurrently
        await Promise.all(COMMON_PORTS.map(async (port) => {
          setPortResults(prev => ({ ...prev, [port]: { port, status: 'scanning' } }))
          const res = await checkTcpPort(q.trim(), port)
          setPortResults(prev => ({ ...prev, [port]: res }))
        }))
      }
      Taro.vibrateShort({ type: 'light' }).catch(() => {})
    } catch (e: any) {
      setError(e.message || '查询失败，请检查网络')
    } finally {
      setLoading(false)
    }
  }

  const scanCustomPort = async () => {
    const q = query.trim()
    if (!q) {
      Taro.showToast({ title: '请先输入目标', icon: 'none' })
      return
    }
    const p = parseInt(customPort, 10)
    if (isNaN(p) || p <= 0 || p > 65535) {
      Taro.showToast({ title: '端口号无效', icon: 'none' })
      return
    }
    setPortResults(prev => ({ ...prev, [p]: { port: p, status: 'scanning' } }))
    const res = await checkTcpPort(q, p)
    setPortResults(prev => ({ ...prev, [p]: res }))
  }

  return (
    <View className='target-page'>
      <View className='header'>
        <Text className='title'>目标诊断</Text>
        <Text className='subtitle'>多维度网络目标分析工具集</Text>
      </View>

      <View className='search-card'>
        <View className='presets-row'>
          <Text className='preset-label'>快捷输入：</Text>
          <View className='preset-list'>
            {PRESETS.map((p) => (
              <View
                key={p.label}
                className='preset-chip'
                onClick={() => {
                  setQuery(p.value)
                  handleLookup(p.value)
                }}
              >
                <Text>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='input-wrapper'>
          <Input
            value={query}
            onInput={(e) => setQuery(e.detail.value)}
            placeholder='输入 IP 或 域名'
            className='main-input'
          />
          <Button className='search-btn' onClick={() => handleLookup()} loading={loading}>
            {loading ? '分析中' : '执行探测'}
          </Button>
        </View>
        
        <View className='tabs-row'>
          <View className={`tab-item ${activeTab === 'ip' ? 'active' : ''}`} onClick={() => setActiveTab('ip')}>IP查询</View>
          <View className={`tab-item ${activeTab === 'dns' ? 'active' : ''}`} onClick={() => setActiveTab('dns')}>DNS解析</View>
          <View className={`tab-item ${activeTab === 'http' ? 'active' : ''}`} onClick={() => setActiveTab('http')}>HTTP头</View>
          <View className={`tab-item ${activeTab === 'port' ? 'active' : ''}`} onClick={() => setActiveTab('port')}>端口检测</View>
        </View>
      </View>

      {error ? <View className='error-card'><Text>{error}</Text></View> : null}

      <ScrollView scrollY className='result-scroll'>
        {/* IP Tab Content */}
        {activeTab === 'ip' && ipResult && (
          <View className='result-card'>
            <View className='main-val-box'>
              <Text className='val-label'>目标 IP</Text>
              <Text className='val-text'>{ipResult.ip}</Text>
            </View>
            <View className='details-grid'>
              <View className='detail-item'><Text className='d-label'>区域</Text><Text className='d-val'>{ipResult.country} {ipResult.region !== '-' ? ipResult.region : ''}</Text></View>
              <View className='detail-item'><Text className='d-label'>城市</Text><Text className='d-val'>{ipResult.city}</Text></View>
              <View className='detail-item'><Text className='d-label'>ISP/接入商</Text><Text className='d-val'>{ipResult.isp}</Text></View>
              <View className='detail-item'><Text className='d-label'>ASN</Text><Text className='d-val'>{ipResult.asn}</Text></View>
            </View>
          </View>
        )}

        {/* DNS Tab Content */}
        {activeTab === 'dns' && dnsResult && (
          <View className='result-card'>
            <View className='dns-status'>
              <Text>解析状态：</Text>
              <Text className={`status ${dnsResult.status === 'success' ? 'ok' : 'err'}`}>
                {dnsResult.status === 'success' ? '成功' : '失败'}
              </Text>
            </View>
            <View className='records-list'>
              {dnsResult.records.map((rec, i) => (
                <View key={i} className='record-item'>
                  <Text className='r-type'>{rec.type}</Text>
                  <Text className='r-val'>{rec.value}</Text>
                  <Text className='r-ttl'>TTL: {rec.ttl}</Text>
                </View>
              ))}
              {dnsResult.records.length === 0 && <Text className='no-data'>未找到解析记录</Text>}
            </View>
          </View>
        )}

        {/* HTTP Tab Content */}
        {activeTab === 'http' && httpResult && (
          <View className='result-card'>
            <View className='http-status-box'>
              <Text className='s-code'>{httpResult.statusCode}</Text>
              <Text className='s-text'>Protocol: {httpResult.protocol}</Text>
              <Text className='s-time'>耗时: {httpResult.timingMs}ms</Text>
            </View>
            <View className='headers-list'>
              {Object.keys(httpResult.headers).map((k) => (
                <View key={k} className='header-item'>
                  <Text className='h-key'>{k}:</Text>
                  <Text className='h-val'>{httpResult.headers[k]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Port Tab Content */}
        {activeTab === 'port' && (
          <View className='result-card port-card'>
            <View className='custom-port-row'>
              <Input
                className='cp-input'
                type='number'
                placeholder='自定义端口 (1-65535)'
                value={customPort}
                onInput={e => setCustomPort(e.detail.value)}
              />
              <Button className='cp-btn' onClick={scanCustomPort}>探测</Button>
            </View>
            <View className='ports-grid'>
              {Array.from(new Set([...COMMON_PORTS, ...Object.keys(portResults).map(Number)])).sort((a,b) => a-b).map((port) => {
                const res = portResults[port]
                if (!res) return <View key={port} className='port-item waiting'><Text>:{port}</Text></View>
                let pClass = 'waiting'
                if (res.status === 'open') pClass = 'open'
                if (res.status === 'closed' || res.status === 'timeout' || res.status === 'refused') pClass = 'closed'
                return (
                  <View key={port} className={`port-item ${pClass}`}>
                    <Text className='p-num'>:{port}</Text>
                    {res.status === 'scanning' && <Text className='p-state'>探测中</Text>}
                    {res.status === 'open' && <Text className='p-state'>开放</Text>}
                    {res.status === 'closed' && <Text className='p-state'>关闭</Text>}
                    {res.status === 'timeout' && <Text className='p-state'>超时</Text>}
                    {res.status === 'refused' && <Text className='p-state'>拒绝</Text>}
                    {res.status === 'error' && <Text className='p-state'>异常</Text>}
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
