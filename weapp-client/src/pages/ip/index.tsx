import React, { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import { ipLookup } from '../../lib/api'
import './index.scss'

export default function IpLookupPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleLookup = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await ipLookup(query.trim() || undefined)
      setResult(data)
    } catch (e: any) {
      setError(e.message || '查询失败，请确保后端服务已启动')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='ip-page'>
      <View className='header'>
        <Text className='title'>公网 IP 探针</Text>
        <Text className='subtitle'>支持 IP 地址与域名查询归属地</Text>
      </View>

      <View className='search-card'>
        <View className='input-wrapper'>
          <Input
            value={query}
            onInput={(e) => setQuery(e.detail.value)}
            placeholder='IP 或域名 (留空查本机)'
            className='ip-input'
          />
          <Button className='search-btn' onClick={handleLookup} loading={loading}>
            探测
          </Button>
        </View>
      </View>

      {error ? (
        <View className='error-card'><Text>{error}</Text></View>
      ) : null}

      {result ? (
        <View className='result-card'>
          <View className='main-ip'>
            <Text className='label'>解析结果</Text>
            <Text className='value'>{result.ip}</Text>
          </View>
          <View className='details-grid'>
            <View className='detail-item'>
              <Text className='label'>国家/地区</Text>
              <Text className='value'>{result.country} {result.region}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>城市</Text>
              <Text className='value'>{result.city}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>运营商</Text>
              <Text className='value'>{result.isp}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>ASN</Text>
              <Text className='value'>{result.asn}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>时区</Text>
              <Text className='value'>{result.timezone}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
