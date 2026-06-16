import React, { useState } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import { pingTarget } from '../../lib/api'
import './index.scss'

export default function Ping() {
  const [target, setTarget] = useState('')
  const [port, setPort] = useState('')
  const [protocol, setProtocol] = useState<'icmp'|'tcp'|'udp'>('icmp')
  const protocolOptions = ['icmp', 'tcp', 'udp']
  
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handlePing = async () => {
    if (!target.trim()) {
      setError('请输入目标 IP 或域名')
      return
    }
    
    if (protocol !== 'icmp' && !port.trim()) {
      setError('TCP/UDP 探测需要指定端口')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await pingTarget(target.trim(), protocol, port.trim())
      setResult(data)
    } catch (e: any) {
      setError(e.message || '网络请求失败，请确保本地 cloud-backend 已启动')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='ping-page'>
      <View className='header'>
        <Text className='title'>Ping 探测</Text>
        <Text className='subtitle'>多协议网络连通性测试 (依托云端节点)</Text>
      </View>

      <View className='form-card'>
        <View className='form-group'>
          <Text className='label'>协议</Text>
          <Picker 
            mode='selector' 
            range={protocolOptions} 
            onChange={(e) => setProtocol(protocolOptions[e.detail.value] as 'icmp'|'tcp'|'udp')}
          >
            <View className='picker-view'>{protocol.toUpperCase()}</View>
          </Picker>
        </View>

        <View className='form-group'>
          <Text className='label'>目标主机</Text>
          <View className='input-wrapper'>
            <Input 
              value={target} 
              onInput={(e) => setTarget(e.detail.value)}
              placeholder='192.168.1.1 或 google.com'
            />
          </View>
        </View>

        {protocol !== 'icmp' && (
          <View className='form-group'>
            <Text className='label'>端口</Text>
            <View className='input-wrapper'>
              <Input 
                type='number'
                value={port} 
                onInput={(e) => setPort(e.detail.value)}
                placeholder='例如: 80'
              />
            </View>
          </View>
        )}

        <Button 
          className='submit-btn' 
          onClick={handlePing} 
          loading={loading}
        >
          {loading ? '探测中...' : '开始探测'}
        </Button>
      </View>

      {error && (
        <View className='error-card'>
          <Text>{error}</Text>
        </View>
      )}

      {result && (
        <View className={`result-card ${result.alive ? 'success' : 'fail'}`}>
          <View className='status-row'>
            <View className='status-indicator'></View>
            <Text className='status-text'>{result.alive ? '连通 (Alive)' : '超时/失败 (Dead)'}</Text>
          </View>
          
          <View className='info-row'>
            <Text className='label'>耗时</Text>
            <Text className='value'>{result.time !== null ? `${result.time} ms` : '-'}</Text>
          </View>
          
          <View className='terminal-output'>
            <Text className='output-text'>{result.output}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
