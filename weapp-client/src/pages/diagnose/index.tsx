import React, { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import { pingTarget, portScan, whoisLookup, ipLookup } from '../../lib/api'
import Taro from '@tarojs/taro'
import './index.scss'

const COMMON_PORTS = [21, 22, 25, 53, 80, 443, 3306, 3389, 8080]

type CardStatus = 'idle' | 'loading' | 'done' | 'error'

export default function Diagnose() {
  const [target, setTarget] = useState('baidu.com')
  const [running, setRunning] = useState(false)

  const [pingStatus, setPingStatus] = useState<CardStatus>('idle')
  const [pingData, setPingData] = useState<any>(null)

  const [ipStatus, setIpStatus] = useState<CardStatus>('idle')
  const [ipData, setIpData] = useState<any>(null)

  const [portStatus, setPortStatus] = useState<CardStatus>('idle')
  const [portData, setPortData] = useState<any[]>([])

  const [whoisStatus, setWhoisStatus] = useState<CardStatus>('idle')
  const [whoisData, setWhoisData] = useState('')

  const reset = () => {
    setPingStatus('idle'); setPingData(null)
    setIpStatus('idle'); setIpData(null)
    setPortStatus('idle'); setPortData([])
    setWhoisStatus('idle'); setWhoisData('')
  }

  const handleDiagnose = async () => {
    if (!target.trim()) return
    reset()
    setRunning(true)
    Taro.vibrateShort({ type: 'light' }).catch(() => {})

    // 1. Ping
    setPingStatus('loading')
    try {
      const d = await pingTarget(target.trim(), 'icmp')
      setPingData(d)
      setPingStatus('done')
      if (d.alive) Taro.vibrateShort({ type: 'light' }).catch(() => {})
    } catch { setPingStatus('error') }

    // 2. IP 归属地 (通过后端代理)
    setIpStatus('loading')
    try {
      const ipRes = await ipLookup(target.trim())
      setIpData({ ip: ipRes.ip, country_name: ipRes.country, region: ipRes.region, city: ipRes.city, org: ipRes.isp })
      setIpStatus('done')
    } catch { setIpStatus('error') }

    // 3. 端口扫描 (并行)
    setPortStatus('loading')
    try {
      const d = await portScan(target.trim(), COMMON_PORTS)
      setPortData(d.results || [])
      setPortStatus('done')
    } catch { setPortStatus('error') }

    // 4. Whois
    setWhoisStatus('loading')
    try {
      const d = await whoisLookup(target.trim())
      setWhoisData(d.result || '')
      setWhoisStatus('done')
    } catch { setWhoisStatus('error') }

    setRunning(false)
    Taro.vibrateShort({ type: 'heavy' }).catch(() => {})
  }

  const statusIcon = (s: CardStatus) => s === 'loading' ? '⏳' : s === 'done' ? '✅' : s === 'error' ? '❌' : '⬜'

  return (
    <View className='diagnose-page'>
      <View className='header'>
        <Text className='title'>一键体检</Text>
        <Text className='subtitle'>输入目标，同时运行 Ping + 归属地 + 端口扫描 + Whois</Text>
      </View>

      <View className='search-card'>
        <View className='input-wrapper'>
          <Input
            value={target}
            onInput={(e) => setTarget(e.detail.value)}
            placeholder='IP 或域名，如 baidu.com'
            className='target-input'
          />
          <Button className='go-btn' onClick={handleDiagnose} loading={running} disabled={running}>
            {running ? '诊断中' : '开始体检'}
          </Button>
        </View>
      </View>

      {/* Ping Card */}
      <View className='diag-card'>
        <View className='card-header'>
          <Text className='icon'>{statusIcon(pingStatus)}</Text>
          <Text className='card-title'>Ping 连通性</Text>
        </View>
        {pingStatus === 'done' && pingData && (
          <View className='card-body'>
            <View className={`status-line ${pingData.alive ? 'alive' : 'dead'}`}>
              <View className='dot'></View>
              <Text>{pingData.alive ? `连通 — ${pingData.time}ms` : '不可达'}</Text>
            </View>
          </View>
        )}
      </View>

      {/* IP Info Card */}
      <View className='diag-card'>
        <View className='card-header'>
          <Text className='icon'>{statusIcon(ipStatus)}</Text>
          <Text className='card-title'>IP 归属地</Text>
        </View>
        {ipStatus === 'done' && ipData && (
          <View className='card-body'>
            <Text className='info-line'>{ipData.ip} — {ipData.country_name} {ipData.region} {ipData.city}</Text>
            <Text className='info-sub'>{ipData.org}</Text>
          </View>
        )}
      </View>

      {/* Port Scan Card */}
      <View className='diag-card'>
        <View className='card-header'>
          <Text className='icon'>{statusIcon(portStatus)}</Text>
          <Text className='card-title'>端口扫描 ({COMMON_PORTS.length} 个常用端口)</Text>
        </View>
        {portStatus === 'done' && portData.length > 0 && (
          <View className='card-body'>
            <View className='port-grid'>
              {portData.map((r, i) => (
                <View key={i} className={`port-chip ${r.status}`}>
                  <Text>{r.port}</Text>
                </View>
              ))}
            </View>
            <Text className='info-sub'>
              开放: {portData.filter(r => r.status === 'open').map(r => r.port).join(', ') || '无'}
            </Text>
          </View>
        )}
      </View>

      {/* Whois Card */}
      <View className='diag-card'>
        <View className='card-header'>
          <Text className='icon'>{statusIcon(whoisStatus)}</Text>
          <Text className='card-title'>Whois 信息</Text>
        </View>
        {whoisStatus === 'done' && whoisData && (
          <View className='card-body'>
            <View className='whois-box'>
              <Text className='whois-text'>{whoisData.substring(0, 800)}{whoisData.length > 800 ? '...' : ''}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
