import React, { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import { portScan } from '../../lib/api'
import './index.scss'

export default function PortScan() {
  const [target, setTarget] = useState('')
  const [customPorts, setCustomPorts] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState('')
  const [scanTime, setScanTime] = useState(0)

  const doScan = async (ports: number[]) => {
    if (!target.trim()) {
      setError('请输入目标 IP 或域名')
      return
    }
    setLoading(true)
    setError('')
    setResults([])
    const start = Date.now()
    try {
      const data = await portScan(target.trim(), ports)
      setScanTime(Date.now() - start)
      setResults(data.results || [])
    } catch (e: any) {
      setError(e.message || '扫描失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCustomScan = () => {
    const ports = customPorts.split(/[,，\s]+/).map(Number).filter(n => n > 0 && n <= 65535)
    if (ports.length === 0) {
      setError('请输入有效端口号（逗号分隔）')
      return
    }
    doScan(ports)
  }

  const scanCommon = () => doScan([21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3306, 3389, 5432, 6379, 8080, 8443])
  const scanWeb = () => doScan([80, 443, 8080, 8443, 8888, 9090])
  const scanDb = () => doScan([3306, 5432, 6379, 27017, 1433, 1521])

  const openCount = results.filter(r => r.status === 'open').length

  return (
    <View className='portscan-page'>
      <View className='header'>
        <Text className='title'>端口扫描</Text>
        <Text className='subtitle'>云端代理探测，支持自定义与预设</Text>
      </View>

      <View className='form-card'>
        <View className='form-group'>
          <Text className='label'>目标主机</Text>
          <View className='input-wrapper'>
            <Input
              value={target}
              onInput={(e) => setTarget(e.detail.value)}
              placeholder='IP 或域名，如 192.168.1.1'
            />
          </View>
        </View>

        <View className='form-group'>
          <Text className='label'>自定义端口（逗号分隔）</Text>
          <View className='input-wrapper'>
            <Input
              value={customPorts}
              onInput={(e) => setCustomPorts(e.detail.value)}
              placeholder='例如: 80, 443, 8080'
            />
          </View>
        </View>

        <Button className='submit-btn' onClick={handleCustomScan} loading={loading}>
          {loading ? '扫描中...' : '自定义扫描'}
        </Button>

        <View className='presets'>
          <Text className='label'>快捷预设</Text>
          <View className='preset-btns'>
            <Button className='preset-btn' onClick={scanCommon}>常用端口</Button>
            <Button className='preset-btn' onClick={scanWeb}>Web 服务</Button>
            <Button className='preset-btn' onClick={scanDb}>数据库</Button>
          </View>
        </View>
      </View>

      {error ? (
        <View className='error-card'><Text>{error}</Text></View>
      ) : null}

      {results.length > 0 ? (
        <View className='results-section'>
          <View className='results-summary'>
            <Text className='summary-text'>
              共 {results.length} 端口，{openCount} 个开放，{(scanTime / 1000).toFixed(1)}s
            </Text>
          </View>
          {results.map((r, i) => (
            <View className={'port-item ' + r.status} key={String(i)}>
              <View className='port-info'>
                <Text className='port-number'>{r.port}</Text>
                <Text className='port-target'>{r.target}</Text>
              </View>
              <View className={'status-badge ' + r.status}>
                <Text>{r.status === 'open' ? '开放' : r.status === 'filtered' ? '过滤' : '关闭'}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
