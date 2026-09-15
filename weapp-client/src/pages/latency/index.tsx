import React, { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface LatencyNode {
  name: string
  url: string
  region: string
  latency: number | null
  status: 'pending' | 'testing' | 'done' | 'timeout'
}

const NODES: Omit<LatencyNode, 'latency' | 'status'>[] = [
  { name: '百度', url: 'https://www.baidu.com', region: '国内' },
  { name: '腾讯云', url: 'https://cloud.tencent.com', region: '国内' },
  { name: '阿里云', url: 'https://www.aliyun.com', region: '国内' },
  { name: '京东', url: 'https://www.jd.com', region: '国内' },
  { name: '华为云', url: 'https://www.huaweicloud.com', region: '国内' },
  { name: '网易', url: 'https://www.163.com', region: '国内' },
  { name: 'Cloudflare', url: 'https://1.1.1.1', region: '海外' },
  { name: 'Google', url: 'https://www.google.com', region: '海外' },
  { name: 'AWS', url: 'https://aws.amazon.com', region: '海外' },
  { name: 'GitHub', url: 'https://github.com', region: '海外' },
  { name: 'Apple', url: 'https://www.apple.com', region: '海外' },
  { name: 'Microsoft', url: 'https://www.microsoft.com', region: '海外' },
]

async function measureLatency(url: string, timeout = 3000): Promise<number | null> {
  const start = Date.now()
  try {
    await Taro.request({ url, method: 'HEAD', timeout })
    return Date.now() - start
  } catch (err: any) {
    const elapsed = Date.now() - start
    const msg = (err.errMsg || '').toLowerCase()
    // SSL/域名白名单错误 = 网络层已到达，端口可达
    if (msg.includes('ssl') || msg.includes('domain list') || msg.includes('certificate') || msg.includes('err_cert')) {
      return elapsed
    }
    if (elapsed >= timeout - 100 || msg.includes('timeout') || msg.includes('abort')) {
      return null // 真实超时
    }
    // 其他错误（如 refused）也算到达了网络层
    if (elapsed > 0 && elapsed < timeout) return elapsed
    return null
  }
}

export default function Latency() {
  const [nodes, setNodes] = useState<LatencyNode[]>(
    NODES.map(n => ({ ...n, latency: null, status: 'pending' }))
  )
  const [running, setRunning] = useState(false)
  const [tested, setTested] = useState(false)

  const handleTest = async () => {
    setRunning(true)
    setTested(false)
    Taro.vibrateShort({ type: 'light' }).catch(() => {})

    const freshNodes: LatencyNode[] = NODES.map(n => ({ ...n, latency: null, status: 'testing' }))
    setNodes([...freshNodes])

    // 并行测试所有节点
    const promises = freshNodes.map(async (node, i) => {
      const lat = await measureLatency(node.url)
      freshNodes[i] = { ...freshNodes[i], latency: lat, status: lat !== null ? 'done' : 'timeout' }
      setNodes([...freshNodes])
    })
    await Promise.all(promises)

    // 按延迟排序（超时的排最后）
    freshNodes.sort((a, b) => {
      if (a.latency === null && b.latency === null) return 0
      if (a.latency === null) return 1
      if (b.latency === null) return -1
      return a.latency - b.latency
    })
    setNodes([...freshNodes])
    setRunning(false)
    setTested(true)
  }

  const maxLatency = Math.max(...nodes.filter(n => n.latency !== null).map(n => n.latency!), 1)
  const doneNodes = nodes.filter(n => n.status === 'done')
  const timeoutNodes = nodes.filter(n => n.status === 'timeout')
  const avgLatency = doneNodes.length > 0
    ? Math.round(doneNodes.reduce((s, n) => s + (n.latency || 0), 0) / doneNodes.length)
    : 0

  const getBarColor = (lat: number | null) => {
    if (lat === null) return '#94a3b8'
    if (lat < 80) return '#10b981'
    if (lat < 300) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <View className='latency-page'>
      <View className='header'>
        <Text className='title'>多节点延迟对比</Text>
        <Text className='subtitle'>并行测试到 {NODES.length} 个国内外节点的真实 HTTP 往返延迟</Text>
      </View>

      <View className='action-card'>
        <Button className='test-btn' disabled={running} onClick={handleTest}>
          {running ? '测试中...' : '开始测试'}
        </Button>
      </View>

      {tested && (
        <View className='stats-row'>
          <View className='stat-item'>
            <Text className='stat-val'>{avgLatency}ms</Text>
            <Text className='stat-label'>平均延迟</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-val'>{doneNodes.length > 0 ? doneNodes[0].name : '-'}</Text>
            <Text className='stat-label'>最快节点</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-val'>{timeoutNodes.length}</Text>
            <Text className='stat-label'>超时节点</Text>
          </View>
        </View>
      )}

      <View className='bar-chart'>
        {nodes.map((node, i) => (
          <View className='bar-row' key={i}>
            <View className='bar-label'>
              <Text className={`region-tag ${node.region === '国内' ? 'cn' : 'intl'}`}>{node.region}</Text>
              <Text className='node-name'>{node.name}</Text>
            </View>
            <View className='bar-track'>
              {node.status === 'testing' && (
                <View className='bar-fill testing' style={{ width: '60%' }} />
              )}
              {node.status === 'done' && (
                <View
                  className='bar-fill'
                  style={{
                    width: `${Math.max((node.latency! / maxLatency) * 100, 8)}%`,
                    backgroundColor: getBarColor(node.latency)
                  }}
                />
              )}
              {node.status === 'timeout' && (
                <View className='bar-fill timeout' style={{ width: '100%' }} />
              )}
            </View>
            <Text className='bar-value'>
              {node.status === 'testing' ? '...' :
               node.status === 'done' ? `${node.latency}ms` :
               node.status === 'timeout' ? '超时' : '-'}
            </Text>
          </View>
        ))}
      </View>

      <View className='version-footer'>
        <Text className='version-text'>v1.1 · Author: Ben</Text>
      </View>
    </View>
  )
}
