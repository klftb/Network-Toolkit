import React, { useState } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import { pingTarget } from '../../lib/api'
import './index.scss'

export default function Ping() {
  const [target, setTarget] = useState('')
  const [port, setPort] = useState('')
  const [protocol, setProtocol] = useState<'icmp'|'tcp'|'udp'>('icmp')
  const protocolOptions = ['icmp', 'tcp', 'udp']
  
  const [pingCount, setPingCount] = useState(4)
  const countOptions = [4, 8, 10, 20]
  
  const [pingInterval, setPingInterval] = useState(1000)
  const intervalOptions = [200, 500, 1000]
  
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [pingLogs, setPingLogs] = useState<string[]>([])

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
    setPingLogs([])

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
    
    setResult({
      alive: successCount > 0,
      time: successCount > 0 ? Math.round(totalTime / successCount) : null,
      output: logs.join('\n')
    })
    setLoading(false)
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
          <Text className='label'>探测次数</Text>
          <Picker 
            mode='selector' 
            range={countOptions.map(c => `${c} 次`)} 
            onChange={(e) => setPingCount(countOptions[e.detail.value])}
          >
            <View className='picker-view'>{pingCount} 次</View>
          </Picker>
        </View>

        <View className='form-group'>
          <Text className='label'>探测间隔</Text>
          <Picker 
            mode='selector' 
            range={intervalOptions.map(i => `${i} ms`)} 
            onChange={(e) => setPingInterval(intervalOptions[e.detail.value])}
          >
            <View className='picker-view'>{pingInterval} ms</View>
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

      {(pingLogs.length > 0 || result) && (
        <View className={`result-card ${result ? (result.alive ? 'success' : 'fail') : 'success'}`}>
          <View className='status-row'>
            <View className='status-indicator'></View>
            <Text className='status-text'>
              {loading ? '正在持续探测中...' : (result && result.alive ? '连通 (Alive)' : '探测结束')}
            </Text>
          </View>
          
          {result && (
            <View className='info-row'>
              <Text className='label'>平均耗时</Text>
              <Text className='value'>{result.time !== null ? `${result.time} ms` : '-'}</Text>
            </View>
          )}
          
          <View className='terminal-output' style={{ maxHeight: '350px' }}>
            <Text className='output-text'>{pingLogs.join('\n')}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
