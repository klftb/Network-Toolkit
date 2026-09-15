import React, { useState, useRef } from 'react'
import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { checkTcpPort, checkUdpPort, PortScanItem } from '../../lib/api'
import './index.scss'

const PRESET_HOSTS = [
  { label: '百度 (baidu.com)', value: 'baidu.com' },
  { label: '腾讯 (qq.com)', value: 'qq.com' },
  { label: '阿里 (aliyun.com)', value: 'aliyun.com' }
]

// 纯前端可高可靠探测的 Web 及 DNS 端口预设
const PRESET_COMMON_TCP = [80, 443, 8080, 8443, 8888, 10443]
const PRESET_WEB_STD = [80, 443]
const PRESET_WEB_ALT = [8080, 8443, 8888, 10443]
const PRESET_COMMON_UDP = [53]

/**
 * 强大的 IP / IP 段解析器
 * 支持：
 * 1. 单 IP / 域名：192.168.1.1 或 qq.com
 * 2. 连续 IP 范围：192.168.1.1-192.168.1.10 或 10.3.11.1-15
 * 3. 子网掩码 CIDR：192.168.1.0/28
 * 4. 逗号分隔多目标：192.168.1.1, 192.168.1.5, 10.3.11.1
 */
export const parseTargetHosts = (inputStr: string): string[] => {
  if (!inputStr) return []
  const clean = inputStr.trim()
  const result: string[] = []

  const tokens = clean.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean)

  for (const token of tokens) {
    // 1. IP 范围全写：192.168.1.1-192.168.1.10
    const fullRangeMatch = token.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*-\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (fullRangeMatch) {
      const startIp = fullRangeMatch[1]
      const endIp = fullRangeMatch[2]
      const startParts = startIp.split('.').map(n => parseInt(n, 10))
      const endParts = endIp.split('.').map(n => parseInt(n, 10))
      if (startParts[0] === endParts[0] && startParts[1] === endParts[1] && startParts[2] === endParts[2]) {
        const start = Math.min(startParts[3], endParts[3])
        const end = Math.min(Math.max(startParts[3], endParts[3]), start + 31) // 单批限制 32 个 IP
        for (let i = start; i <= end; i++) {
          result.push(`${startParts[0]}.${startParts[1]}.${startParts[2]}.${i}`)
        }
      } else {
        result.push(startIp, endIp)
      }
      continue
    }

    // 2. IP 简写范围：10.3.11.1-15 或 192.168.1.1-10
    const shortRangeMatch = token.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})\s*-\s*(\d{1,3})$/)
    if (shortRangeMatch) {
      const prefix = shortRangeMatch[1]
      const start = Math.min(parseInt(shortRangeMatch[2], 10), parseInt(shortRangeMatch[3], 10))
      const end = Math.min(Math.max(parseInt(shortRangeMatch[2], 10), parseInt(shortRangeMatch[3], 10)), start + 31)
      for (let i = start; i <= end; i++) {
        result.push(`${prefix}${i}`)
      }
      continue
    }

    // 3. CIDR 子网：192.168.1.0/28
    const cidrMatch = token.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})\/(\d{1,2})$/)
    if (cidrMatch) {
      const prefix = cidrMatch[1]
      const base = parseInt(cidrMatch[2], 10)
      const mask = parseInt(cidrMatch[3], 10)
      if (mask >= 24 && mask <= 32) {
        const size = Math.min(Math.pow(2, 32 - mask), 32)
        for (let i = 0; i < size; i++) {
          result.push(`${prefix}${base + i}`)
        }
      } else {
        result.push(`${prefix}${base}`)
      }
      continue
    }

    // 4. 普通单个主机或域名
    result.push(token)
  }

  return Array.from(new Set(result))
}

/**
 * 端口范围解析器：支持 80, 443, 8080-8085
 */
export const parsePortInput = (inputStr: string): number[] => {
  if (!inputStr) return []

  const normalized = inputStr
    .replace(/[\uff0c\u3001]/g, ',')
    .replace(/[\uff0d\u2013\u2014\u223c\u301c~]/g, '-')
    .trim()

  const portSet = new Set<number>()
  const tokens = normalized.split(/[,，]+/).map(t => t.trim()).filter(Boolean)

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      if (!isNaN(start) && !isNaN(end) && start > 0 && end <= 65535) {
        const min = Math.min(start, end)
        const max = Math.max(start, end)
        const rangeLimit = Math.min(max, min + 49)
        for (let p = min; p <= rangeLimit; p++) {
          portSet.add(p)
        }
      }
    } else {
      const p = parseInt(token, 10)
      if (!isNaN(p) && p > 0 && p <= 65535) {
        portSet.add(p)
      }
    }
  }

  return Array.from(portSet).sort((a, b) => a - b)
}

export default function PortScan() {
  const [target, setTarget] = useState('')
  const [protocol, setProtocol] = useState<'tcp' | 'udp'>('tcp')
  const [customPorts, setCustomPorts] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PortScanItem[]>([])
  const [error, setError] = useState('')
  const [scanTime, setScanTime] = useState(0)
  const [showOnlyOpen, setShowOnlyOpen] = useState(true)
  const [progressText, setProgressText] = useState('')
  const stopRequestedRef = useRef(false)

  const doScan = async (ports: number[]) => {
    const hosts = parseTargetHosts(target)
    if (hosts.length === 0) {
      setError('请输入有效的目标主机或 IP 地址段（如 10.3.11.1-10 或 192.168.1.1）')
      return
    }
    if (ports.length === 0) {
      setError('请指定要扫描的端口或范围（如 80, 443, 8080, 8443）')
      return
    }

    setLoading(true)
    setError('')
    setResults([])
    setShowOnlyOpen(true)
    setProgressText('')
    stopRequestedRef.current = false
    const start = Date.now()

    const allItems: PortScanItem[] = []
    const totalTasks = hosts.length * ports.length
    let completedTasks = 0

    try {
      // 遍历所有目标主机（严格单套接字排队探测）
      for (let hIdx = 0; hIdx < hosts.length; hIdx++) {
        if (stopRequestedRef.current) break
        const host = hosts[hIdx]

        for (let pIdx = 0; pIdx < ports.length; pIdx++) {
          if (stopRequestedRef.current) break
          const port = ports[pIdx]
          completedTasks++
          setProgressText(`正在探测 (${completedTasks}/${totalTasks}) · ${host}:${port}`)

          try {
            const res = protocol === 'tcp'
              ? await checkTcpPort(host, port, 1200)
              : await checkUdpPort(host, port, 1200)

            allItems.push({
              target: host,
              port,
              status: res.status,
              latency: res.latency
            })
          } catch {
            allItems.push({
              target: host,
              port,
              status: 'filtered',
              latency: null
            })
          }

          setResults([...allItems])
          setScanTime(Date.now() - start)
        }
      }

      setScanTime(Date.now() - start)
      setResults([...allItems])
      setProgressText(
        stopRequestedRef.current
          ? `已停止：共探测 ${allItems.length}/${totalTasks} 项`
          : `扫描完成：共探测 ${hosts.length} 台主机 · ${allItems.length} 个端口`
      )
      Taro.vibrateShort({ type: 'light' }).catch(() => {})
    } catch (e: any) {
      setError(e.message || '扫描过程异常')
    } finally {
      setLoading(false)
      stopRequestedRef.current = false
    }
  }

  const handleCustomScan = () => {
    const ports = parsePortInput(customPorts)
    if (ports.length === 0) {
      setError('请输入有效端口号或范围（例如: 80, 443, 8080, 8443, 8888）')
      return
    }
    doScan(ports)
  }

  const handleStop = () => {
    stopRequestedRef.current = true
    setProgressText('正在停止扫描...')
  }

  const openCount = results.filter(r => r.status === 'open').length
  const filteredResults = showOnlyOpen ? results.filter(r => r.status === 'open') : results
  const parsedHostCount = parseTargetHosts(target).length

  return (
    <View className='portscan-page'>
      <View className='header'>
        <Text className='title'>端口扫描</Text>
        <Text className='subtitle'>📱 纯真机前端高精度 Web 服务与 DNS 端口连通性检测</Text>
      </View>

      <View className='form-card'>
        {/* 协议切换器 */}
        <View className='protocol-selector-card'>
          <View
            className={`proto-btn-item ${protocol === 'tcp' ? 'active' : ''}`}
            onClick={() => { if (!loading) setProtocol('tcp') }}
          >
            <Text className='proto-tag'>TCP 协议</Text>
          </View>
          <View
            className={`proto-btn-item ${protocol === 'udp' ? 'active' : ''}`}
            onClick={() => { if (!loading) setProtocol('udp') }}
          >
            <Text className='proto-tag'>UDP 协议</Text>
          </View>
        </View>

        <View className='presets-row'>
          <Text className='preset-label'>快捷目标：</Text>
          <View className='preset-list'>
            {PRESET_HOSTS.map((h) => (
              <View key={h.label} className='preset-chip' onClick={() => setTarget(h.value)}>
                <Text>{h.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='form-group'>
          <View className='label-row'>
            <Text className='label'>目标主机 / IP 地址段</Text>
            {parsedHostCount > 1 && <Text className='host-count-tag'>已识别 {parsedHostCount} 台主机</Text>}
          </View>
          <View className='input-wrapper'>
            <Input
              value={target}
              onInput={(e) => setTarget(e.detail.value)}
              placeholder='输入目标域名或 IP，如 baidu.com 或 192.168.1.1'
            />
          </View>
          <Text className='input-hint'>💡 纯前端支持探测 Web/SSL 端口 (80/443/8080/8443/8888/10443) 与 DNS 53 端口</Text>
        </View>

        <View className='form-group'>
          <View className='label-row'>
            <Text className='label'>自定义端口与范围</Text>
            <Text className='label-tip'>支持 80, 443, 8080, 8443, 8888, 10443</Text>
          </View>
          <View className='input-wrapper'>
            <Input
              value={customPorts}
              onInput={(e) => setCustomPorts(e.detail.value)}
              placeholder='输入端口，如 80, 443, 8080'
            />
          </View>
        </View>

        <View className='action-btns-row'>
          <Button
            className='submit-btn'
            onClick={loading ? handleStop : handleCustomScan}
            style={{ background: loading ? '#ef4444' : undefined }}
          >
            {loading ? '🛑 停止扫描' : parsedHostCount > 1 ? `🚀 开始 ${protocol.toUpperCase()} 端口扫描 (${parsedHostCount} 台主机)` : `🚀 开始 ${protocol.toUpperCase()} 端口扫描`}
          </Button>
        </View>

        <View className='presets'>
          <Text className='label'>快捷常用端口预设</Text>
          {protocol === 'tcp' ? (
            <View className='preset-btns'>
              <Button className='preset-btn' onClick={() => doScan(PRESET_COMMON_TCP)} disabled={loading}>
                全部 Web & 运维端口 (6个)
              </Button>
              <Button className='preset-btn' onClick={() => doScan(PRESET_WEB_STD)} disabled={loading}>
                标准 Web (80 / 443)
              </Button>
              <Button className='preset-btn' onClick={() => doScan(PRESET_WEB_ALT)} disabled={loading}>
                拓展 Web & 管理 (8080/8443/8888/10443)
              </Button>
            </View>
          ) : (
            <View className='preset-btns'>
              <Button className='preset-btn' onClick={() => doScan(PRESET_COMMON_UDP)} disabled={loading}>
                DNS 域名解析 (53 / UDP)
              </Button>
            </View>
          )}
        </View>
      </View>

      {progressText ? (
        <View className='progress-banner'>
          <Text className='prog-text'>⚡ {progressText}</Text>
        </View>
      ) : null}

      {error ? (
        <View className='error-card'><Text>{error}</Text></View>
      ) : null}

      {/* 扫描结果专区 */}
      {results.length > 0 ? (
        <View className='results-section'>
          <View className='results-header-bar'>
            <View className='summary-left'>
              <Text className='summary-text'>
                已探测 {results.length} 项 · <Text className='open-highlight'>{openCount} 项开放</Text> · 耗时 {(scanTime / 1000).toFixed(1)}s
              </Text>
            </View>
            <View className='filter-toggle-row'>
              <View
                className={`filter-chip ${showOnlyOpen ? 'active' : ''}`}
                onClick={() => setShowOnlyOpen(true)}
              >
                <Text>仅看开放 ({openCount})</Text>
              </View>
              <View
                className={`filter-chip ${!showOnlyOpen ? 'active' : ''}`}
                onClick={() => setShowOnlyOpen(false)}
              >
                <Text>全部 ({results.length})</Text>
              </View>
            </View>
          </View>

          {filteredResults.length > 0 ? (
            <View className='port-list'>
              {filteredResults.map((r, i) => (
                <View className={'port-item ' + r.status} key={`${r.target}-${r.port}-${i}`}>
                  <View className='port-info'>
                    <View className='port-header-line'>
                      <Text className='port-number'>端口 {r.port} / {protocol.toUpperCase()}</Text>
                      {r.port === 80 && <Text className='port-service-tag'>HTTP</Text>}
                      {r.port === 443 && <Text className='port-service-tag'>HTTPS</Text>}
                      {r.port === 8080 && <Text className='port-service-tag'>HTTP Alt</Text>}
                      {r.port === 8443 && <Text className='port-service-tag'>HTTPS Alt</Text>}
                      {r.port === 8888 && <Text className='port-service-tag'>Web Panel</Text>}
                      {r.port === 10443 && <Text className='port-service-tag'>SSL VPN</Text>}
                      {r.port === 53 && <Text className='port-service-tag'>DNS</Text>}
                    </View>
                    <Text className='port-target'>主机: {r.target}</Text>
                  </View>
                  <View className={'status-badge ' + r.status}>
                    <Text>
                      {r.status === 'open' 
                        ? `🟢 开放 (${r.latency ? `${r.latency}ms` : 'OPEN'})` 
                        : r.status === 'filtered' ? '🟡 过滤' : '🔴 关闭'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className='empty-open-card'>
              <Text className='empty-icon'>🛡️</Text>
              <Text className='empty-title'>未发现开放端口</Text>
              <Text className='empty-desc'>
                在所扫描的 {results.length} 项中均未响应握手信号。已自动隐藏关闭及过滤端口。
              </Text>
              <Button className='show-all-btn' onClick={() => setShowOnlyOpen(false)}>
                查看全部 {results.length} 项状态 (含关闭与过滤)
              </Button>
            </View>
          )}
        </View>
      ) : null}
    </View>
  )
}
