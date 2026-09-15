import React, { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  pingTarget,
  portScan,
  whoisLookup,
  ipLookup,
  PingResult,
  PortScanItem
} from '../../lib/api'
import './index.scss'

// 前端可真实验证的 Web 端口（HTTP/HTTPS 协议）
const COMMON_PORTS = [80, 443, 8080, 8443, 8888, 10443]

type CardStatus = 'idle' | 'loading' | 'done' | 'error'

interface PingDiagnoseData extends PingResult {
  resolvedIp?: string
  location?: string
  isp?: string
}

const initialCards = {
  ping: { status: 'idle' as CardStatus, data: null as PingDiagnoseData | null },
  port: { status: 'idle' as CardStatus, data: [] as PortScanItem[] },
  whois: { status: 'idle' as CardStatus, data: '' }
}

export default function Diagnose() {
  const [target, setTarget] = useState('')
  const [running, setRunning] = useState(false)
  const [cards, setCards] = useState(initialCards)

  const updateCard = <K extends keyof typeof initialCards>(
    key: K,
    status: CardStatus,
    data: (typeof initialCards)[K]['data']
  ) => {
    setCards(prev => ({
      ...prev,
      [key]: { status, data }
    }))
  }

  const handleDiagnose = async () => {
    const cleanTarget = target.trim()
    if (!cleanTarget) return

    setCards({
      ping: { status: 'loading', data: null },
      port: { status: 'loading', data: [] },
      whois: { status: 'loading', data: '' }
    })
    setRunning(true)
    Taro.vibrateShort({ type: 'light' }).catch(() => {})

    // 1. DNS解析 + HTTP连通性 + 节点分析
    const runPingAndIp = async () => {
      try {
        const [pingRes, ipRes] = await Promise.allSettled([
          pingTarget(cleanTarget, 'icmp'),
          ipLookup(cleanTarget)
        ])

        const pData: PingResult = pingRes.status === 'fulfilled' ? pingRes.value : { alive: false, time: null, output: '' }
        const ipData = ipRes.status === 'fulfilled' ? ipRes.value : null

        const hasRealIp = ipData?.ip && isIp(ipData.ip)
        const merged: PingDiagnoseData = {
          ...pData,
          resolvedIp: hasRealIp ? ipData.ip : (isIp(cleanTarget) ? cleanTarget : undefined),
          location: (hasRealIp && ipData) ? `${ipData.country !== '中国' && ipData.country !== '局域网' && ipData.country !== '企业内网' ? ipData.country : ''} ${ipData.region} ${ipData.city}`.trim() : undefined,
          isp: hasRealIp ? ipData?.isp : undefined
        }

        updateCard('ping', 'done', merged)
        if (pData.alive) Taro.vibrateShort({ type: 'light' }).catch(() => {})
      } catch {
        updateCard('ping', 'error', null)
      }
    }

    // 2. 端口扫描任务 (含 10443 端口)
    const runPort = async () => {
      try {
        const d = await portScan(cleanTarget, COMMON_PORTS, 'tcp')
        updateCard('port', 'done', d.results || [])
      } catch {
        updateCard('port', 'error', [])
      }
    }

    // 3. Whois 域名数据库查询
    const runWhois = async () => {
      try {
        const d = await whoisLookup(cleanTarget)
        updateCard('whois', 'done', d.result || '')
      } catch {
        updateCard('whois', 'error', '')
      }
    }

    await Promise.allSettled([runPingAndIp(), runPort(), runWhois()])

    setRunning(false)
    Taro.vibrateShort({ type: 'heavy' }).catch(() => {})
  }

  const statusIcon = (s: CardStatus) => {
    switch (s) {
      case 'loading': return '⏳'
      case 'done': return '✅'
      case 'error': return '❌'
      default: return '⬜'
    }
  }

  const { ping, port, whois } = cards

  return (
    <View className='diagnose-page'>
      <View className='header'>
        <Text className='title'>一键体检</Text>
        <Text className='subtitle'>输入目标，一键执行 HTTP连通性 + Web端口检测 + Whois</Text>
      </View>

      <View className='search-card'>
        <View className='input-wrapper'>
          <Input
            value={target}
            onInput={(e) => setTarget(e.detail.value)}
            placeholder='输入目标域名或 IP，如 baidu.com 或 192.168.1.1'
            className='target-input'
          />
          <Button className='go-btn' onClick={handleDiagnose} loading={running} disabled={running}>
            {running ? '诊断中' : '开始体检'}
          </Button>
        </View>
      </View>

      {/* HTTP 连通性与网络节点分析 */}
      <View className='diag-card'>
        <View className='card-header'>
          <Text className='icon'>{statusIcon(ping.status)}</Text>
          <Text className='card-title'>HTTP 连通性与网络节点分析</Text>
        </View>
        {ping.status === 'done' && ping.data && (
          <View className='card-body'>
            <View className={`status-line ${ping.data.alive ? 'alive' : 'dead'}`}>
              <View className='dot'></View>
              <Text>{ping.data.alive ? `连通 — 延迟 ${ping.data.time}ms` : '目标不可达 / 超时'}</Text>
            </View>

            {ping.data.resolvedIp && (
              <View className='ip-geo-info'>
                <View className='ip-badge-row'>
                  <Text className='badge-tag'>解析 IP</Text>
                  <Text className='ip-val'>{ping.data.resolvedIp}</Text>
                </View>
                {ping.data.location && (
                  <Text className='geo-val'>📍 节点网络：{ping.data.location} · {ping.data.isp || '公网网络'}</Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* 常用端口扫描 Card (含 10443) */}
      <View className='diag-card'>
        <View className='card-header'>
          <Text className='icon'>{statusIcon(port.status)}</Text>
          <Text className='card-title'>常用端口扫描 ({COMMON_PORTS.length} 个端口 · 含 10443)</Text>
        </View>
        {port.status === 'done' && port.data.length > 0 && (
          <View className='card-body'>
            <View className='port-grid'>
              {port.data.map((r, i) => (
                <View key={i} className={`port-chip ${r.status}`}>
                  <Text>{r.port}</Text>
                </View>
              ))}
            </View>
            <Text className='info-sub'>
              🟢 开放端口: {port.data.filter(r => r.status === 'open').map(r => r.port).join(', ') || '无'}
            </Text>
          </View>
        )}
      </View>

      {/* Whois 域名注册信息 Card */}
      <View className='diag-card'>
        <View className='card-header'>
          <Text className='icon'>{statusIcon(whois.status)}</Text>
          <Text className='card-title'>Whois 域名注册信息</Text>
        </View>
        {whois.status === 'done' && whois.data && (
          <View className='card-body'>
            <View className='whois-box'>
              <Text className='whois-text' userSelect>
                {whois.data.substring(0, 800)}{whois.data.length > 800 ? '...' : ''}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
