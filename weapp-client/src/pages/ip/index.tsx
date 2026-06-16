import React, { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function IpLookup() {
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleLookup = async () => {
    if (!ip.trim() && !result) {
      // If empty, look up own IP
    }
    
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const target = ip.trim() || ''
      // In a real mini program, we would send this to our cloud-backend proxy
      // Here we use a public API directly (needs "不校验合法域名" in dev tools)
      const res = await Taro.request({
        url: `https://ipapi.co/${target ? target + '/' : ''}json/`,
        method: 'GET'
      })

      if (res.data && res.data.ip) {
        setResult(res.data)
      } else {
        setError(res.data.reason || '查询失败，请输入合法的IP地址')
      }
    } catch (e: any) {
      setError(e.errMsg || '网络请求失败，请在本地设置中勾选"不校验合法域名"')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='ip-page'>
      <View className='header'>
        <Text className='title'>公网 IP 探针</Text>
        <Text className='subtitle'>精准归属地与 ISP 服务商查询</Text>
      </View>

      <View className='search-card'>
        <View className='input-wrapper'>
          <Input 
            value={ip} 
            onInput={(e) => setIp(e.detail.value)}
            placeholder='输入IP地址 (留空查本机)'
            className='ip-input'
          />
          <Button 
            className='search-btn' 
            onClick={handleLookup} 
            loading={loading}
          >
            探测
          </Button>
        </View>
      </View>

      {error && (
        <View className='error-card'>
          <Text>{error}</Text>
        </View>
      )}

      {result && (
        <View className='result-card animated'>
          <View className='main-ip'>
            <Text className='label'>目标 IP</Text>
            <Text className='value'>{result.ip}</Text>
          </View>
          
          <View className='details-grid'>
            <View className='detail-item'>
              <Text className='label'>国家/地区</Text>
              <Text className='value'>{result.country_name || '-'} {result.region || '-'}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>城市</Text>
              <Text className='value'>{result.city || '-'}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>运营商 (ISP)</Text>
              <Text className='value'>{result.org || '-'}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>ASN</Text>
              <Text className='value'>{result.asn || '-'}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
