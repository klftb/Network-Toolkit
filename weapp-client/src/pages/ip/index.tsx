import React, { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ipLookup, IpLookupResult } from '../../lib/api'
import './index.scss'

const PRESETS = [
  { label: '本机外网', value: '' },
  { label: '阿里 DNS', value: '223.5.5.5' },
  { label: '百度', value: 'baidu.com' },
  { label: '114 DNS', value: '114.114.114.114' },
  { label: 'Cloudflare', value: '1.1.1.1' }
]

export default function IpLookupPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IpLookupResult | null>(null)
  const [error, setError] = useState('')

  const handleLookup = async (targetQuery?: string) => {
    const q = typeof targetQuery === 'string' ? targetQuery : query
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await ipLookup(q.trim() || undefined)
      setResult(data)
      Taro.vibrateShort({ type: 'light' }).catch(() => {})
    } catch (e: any) {
      setError(e.message || '查询失败，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }

  const copyIp = (ipStr: string) => {
    Taro.setClipboardData({
      data: ipStr,
      success: () => Taro.showToast({ title: 'IP 已复制', icon: 'success' })
    })
  }

  return (
    <View className='ip-page'>
      <View className='header'>
        <Text className='title'>网络节点分析</Text>
        <Text className='subtitle'>网络节点拓扑分析 · 骨干网络与多线机房节点识别</Text>
      </View>

      <View className='search-card'>
        <View className='presets-row'>
          <Text className='preset-label'>快捷分析：</Text>
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
            placeholder='输入目标网络节点或域名 (留空分析本机)'
            className='ip-input'
          />
          <Button className='search-btn' onClick={() => handleLookup()} loading={loading}>
            {loading ? '分析中' : '分析'}
          </Button>
        </View>
      </View>

      {error ? (
        <View className='error-card'><Text>{error}</Text></View>
      ) : null}

      {result ? (
        <View className='result-card'>
          <View className='main-ip-box'>
            <View className='ip-content'>
              <Text className='label'>目标网络地址</Text>
              <Text className='value'>{result.ip}</Text>
            </View>
            <View className='copy-btn-chip' onClick={() => copyIp(result.ip)}>
              <Text>📋 复制</Text>
            </View>
          </View>

          <View className='details-grid'>
            <View className='detail-item'>
              <Text className='label'>节点区域</Text>
              <Text className='value'>{result.country} {result.region !== '-' ? result.region : ''}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>机房分布</Text>
              <Text className='value'>{result.city}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>接入线路 / 骨干网</Text>
              <Text className='value'>{result.isp}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>自治域 (ASN)</Text>
              <Text className='value'>{result.asn}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>网络时区</Text>
              <Text className='value'>{result.timezone}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
