import React, { useState, useRef, useEffect } from 'react'
import { View, Text, Input, ScrollView, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { isIp, resolveDnsDoh, checkTcpPort, pingTarget, ipLookup } from '../../lib/api'
import './index.scss'

interface PacketLog {
  seq: number
  time: number | null
  status: 'success' | 'timeout' | 'error'
  timestamp: string
  diff: number | null // 与平均值的偏差
}

const PRESETS = ['baidu.com', 'qq.com', '1.1.1.1', '114.114.114.114', 'google.com']
const MTR_COUNT_OPTIONS = [10, 20, 50, 100]

export default function TracePage() {
  const [target, setTarget] = useState('qq.com')
  const [mtrCount, setMtrCount] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 探测元数据
  const [resolvedIp, setResolvedIp] = useState('')
  const [geoInfo, setGeoInfo] = useState('')
  const [dnsTime, setDnsTime] = useState<number | null>(null)

  // 统计数据
  const [currentRound, setCurrentRound] = useState(0)
  const [sentCount, setSentCount] = useState(0)
  const [recvCount, setRecvCount] = useState(0)
  const [lastRtt, setLastRtt] = useState<number | null>(null)
  const [bestRtt, setBestRtt] = useState<number | null>(null)
  const [worstRtt, setWorstRtt] = useState<number | null>(null)
  const [avgRtt, setAvgRtt] = useState<number | null>(null)
  const [jitter, setJitter] = useState<number | null>(null)
  const [packetLogs, setPacketLogs] = useState<PacketLog[]>([])

  const isRunningRef = useRef(false)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      stopScan()
    }
  }, [])

  const stopScan = () => {
    isRunningRef.current = false
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setLoading(false)
  }

  const handleStart = async () => {
    if (!target.trim()) {
      setError('请输入目标 IP 或域名')
      return
    }

    stopScan()
    setError('')
    setLoading(true)
    isRunningRef.current = true

    // 重置统计数据
    setCurrentRound(0)
    setSentCount(0)
    setRecvCount(0)
    setLastRtt(null)
    setBestRtt(null)
    setWorstRtt(null)
    setAvgRtt(null)
    setJitter(null)
    setPacketLogs([])
    setResolvedIp('')
    setGeoInfo('正在解析目标网络属性...')

    const cleanTarget = target.trim().replace(/^https?:\/\//i, '').split('/')[0]
    const targetHost = cleanTarget.split(':')[0]
    const targetPort = cleanTarget.includes(':') ? parseInt(cleanTarget.split(':')[1], 10) : 443

    let targetIp = targetHost
    const isHostIp = isIp(targetHost)

    // 1. 若为域名，先在手机端执行真实 DNS 解析
    if (!isHostIp) {
      const dnsStart = Date.now()
      try {
        const resolved = await resolveDnsDoh(targetHost)
        const dTime = Date.now() - dnsStart
        setDnsTime(dTime)
        if (resolved && isIp(resolved)) {
          targetIp = resolved
          setResolvedIp(resolved)
        }
      } catch {
        targetIp = targetHost
      }
    } else {
      setResolvedIp(targetHost)
      setDnsTime(0)
    }

    // 2. 获取目标 IP 的物理归属地
    ipLookup(targetIp).then(info => {
      setGeoInfo(`${info.region || ''} ${info.city || ''} · ${info.isp || '未知运营商'}`.trim())
    }).catch(() => {
      setGeoInfo('公网骨干网络节点')
    })

    // 3. 开始连续 MTR 发包探测
    runMtrProbeLoop(targetIp, targetHost, targetPort, mtrCount)
  }

  const runMtrProbeLoop = (targetIp: string, host: string, port: number, totalRounds: number) => {
    let sent = 0
    let recv = 0
    const rttList: number[] = []
    const logs: PacketLog[] = []

    const executeProbe = async () => {
      if (!isRunningRef.current) return

      sent++
      setCurrentRound(sent)
      setSentCount(sent)

      const start = Date.now()
      let currentRtt: number | null = null
      let status: 'success' | 'timeout' | 'error' = 'timeout'

      try {
        // 优先使用手机 TCP/HTTP 握手精准测算端到端往返时延
        const tcpRes = await checkTcpPort(targetIp, port, 1200)
        if (tcpRes.status === 'open' && tcpRes.latency) {
          currentRtt = tcpRes.latency
          status = 'success'
        } else {
          // 降级使用 UDP/ICMP 探测
          const pingRes = await pingTarget(host, 'icmp')
          if (pingRes.alive && pingRes.time) {
            currentRtt = pingRes.time
            status = 'success'
          } else {
            // UDP 探测也失败，记为超时
            status = 'timeout'
          }
        }
      } catch {
        status = 'timeout'
      }

      const now = new Date()
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds() / 100))}`

      if (status === 'success' && currentRtt !== null) {
        recv++
        setRecvCount(recv)
        rttList.push(currentRtt)

        const curAvg = Math.round(rttList.reduce((a, b) => a + b, 0) / rttList.length)
        const curBest = Math.min(...rttList)
        const curWorst = Math.max(...rttList)

        // 计算抖动 Jitter (相邻包延时差的平均值)
        let curJitter = 0
        if (rttList.length > 1) {
          let diffSum = 0
          for (let i = 1; i < rttList.length; i++) {
            diffSum += Math.abs(rttList[i] - rttList[i - 1])
          }
          curJitter = Math.round((diffSum / (rttList.length - 1)) * 10) / 10
        }

        setLastRtt(currentRtt)
        setAvgRtt(curAvg)
        setBestRtt(curBest)
        setWorstRtt(curWorst)
        setJitter(curJitter)

        logs.unshift({
          seq: sent,
          time: currentRtt,
          status: 'success',
          timestamp: timeStr,
          diff: currentRtt - curAvg
        })
      } else {
        logs.unshift({
          seq: sent,
          time: null,
          status: 'timeout',
          timestamp: timeStr,
          diff: null
        })
      }

      setPacketLogs([...logs])

      if (sent < totalRounds && isRunningRef.current) {
        // 每隔 350ms 发送下一轮探测包
        timerRef.current = setTimeout(executeProbe, 350)
      } else {
        setLoading(false)
        isRunningRef.current = false
        Taro.vibrateShort({ type: 'light' }).catch(() => {})
      }
    }

    timerRef.current = setTimeout(executeProbe, 50)
  }

  const copyMtrReport = () => {
    if (sentCount === 0) return
    const lossRate = sentCount > 0 ? (((sentCount - recvCount) / sentCount) * 100).toFixed(1) : '0.0'
    const report = [
      `=== 手机端真实 MTR 链路质量报告 ===`,
      `测试目标: ${target}`,
      `解析 IP: ${resolvedIp || target}`,
      `物理归属: ${geoInfo || '公网节点'}`,
      `DNS 解析耗时: ${dnsTime !== null ? `${dnsTime} ms` : '-'}`,
      `探测轮次: ${sentCount} 轮 (成功: ${recvCount}, 丢包: ${sentCount - recvCount})`,
      `丢包率: ${lossRate}%`,
      `最新延迟 (Last): ${lastRtt !== null ? `${lastRtt} ms` : '-'}`,
      `平均延迟 (Avg): ${avgRtt !== null ? `${avgRtt} ms` : '-'}`,
      `最优延迟 (Best): ${bestRtt !== null ? `${bestRtt} ms` : '-'}`,
      `最差延迟 (Worst): ${worstRtt !== null ? `${worstRtt} ms` : '-'}`,
      `网络抖动 (Jitter): ${jitter !== null ? `${jitter} ms` : '-'}`,
      `测试方式: 手机真机原生直发探测包 (无虚拟节点)`
    ].join('\n')

    Taro.setClipboardData({
      data: report,
      success: () => Taro.showToast({ title: 'MTR报告已复制', icon: 'success' })
    })
  }

  const lossRateNum = sentCount > 0 ? Math.round(((sentCount - recvCount) / sentCount) * 100) : 0

  return (
    <View className='trace-page'>
      <View className='header'>
        <Text className='title'>TCP Ping / 连通性测试</Text>
        <Text className='subtitle'>连续探测目标主机的网络延迟与丢包情况</Text>
      </View>

      <View className='control-card'>
        <View className='mode-banner'>
          <Text className='banner-icon'>🛡️</Text>
          <Text className='banner-text'>纯前端真实测速模式：100% 使用手机当前 WiFi / 蜂窝网络直连目标发包，拒绝任何模拟中间数据。</Text>
        </View>

        <View className='presets-row'>
          <Text className='preset-label'>快捷目标：</Text>
          <View className='preset-list'>
            {PRESETS.map((p) => (
              <View key={p} className='preset-chip' onClick={() => { setTarget(p); if (error) setError(''); }}>
                <Text>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='form-row-wrap'>
          <View className='input-wrapper'>
            <Input
              type='text'
              value={target}
              onInput={(e) => {
                setTarget(e.detail.value)
                if (error) setError('')
              }}
              placeholder='例如 qq.com 或 113.108.81.189'
              className='trace-input'
            />
          </View>

          <View className='count-picker-box'>
            <Picker
              mode='selector'
              range={MTR_COUNT_OPTIONS.map(c => `${c} 轮`)}
              value={MTR_COUNT_OPTIONS.indexOf(mtrCount)}
              onChange={(e) => setMtrCount(MTR_COUNT_OPTIONS[e.detail.value])}
            >
              <View className='picker-btn'>
                <Text className='picker-text'>{mtrCount} 轮</Text>
              </View>
            </Picker>
          </View>

          {loading ? (
            <View className='action-btn stop' onClick={stopScan} hoverClass='btn-active'>
              <Text>停止</Text>
            </View>
          ) : (
            <View className='action-btn' onClick={handleStart} hoverClass='btn-active'>
              <Text>开始测速</Text>
            </View>
          )}
        </View>

        {error && <Text className='error-text'>{error}</Text>}
      </View>

      {/* 探测信息卡片 */}
      {(resolvedIp || loading || sentCount > 0) && (
        <View className='target-info-card'>
          <View className='target-info-header'>
            <View className='target-host-box'>
              <Text className='target-title'>{target}</Text>
              {resolvedIp && <Text className='target-ip-badge'>{resolvedIp}</Text>}
            </View>
            {loading && <Text className='live-badge-blink'>🟢 实时探测中 ({currentRound}/{mtrCount})</Text>}
          </View>

          <View className='target-meta-row'>
            <Text className='meta-item'>📍 {geoInfo || '正在分析节点线路...'}</Text>
            {dnsTime !== null && dnsTime > 0 && <Text className='meta-item'>⚡ DNS 解析: {dnsTime}ms</Text>}
          </View>
        </View>
      )}

      {/* 核心指标看板 */}
      {sentCount > 0 && (
        <View className='stats-grid'>
          <View className='stat-card'>
            <Text className='stat-label'>平均延迟 (Avg)</Text>
            <Text className='stat-val primary'>{avgRtt !== null ? `${avgRtt} ms` : '--'}</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-label'>最新延迟 (Last)</Text>
            <Text className='stat-val'>{lastRtt !== null ? `${lastRtt} ms` : '--'}</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-label'>最优 / 最差</Text>
            <Text className='stat-val sub'>{bestRtt !== null ? `${bestRtt}` : '-'} / {worstRtt !== null ? `${worstRtt} ms` : '-'}</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-label'>网络抖动 (Jitter)</Text>
            <Text className={`stat-val ${jitter !== null && jitter < 5 ? 'good' : 'warn'}`}>
              {jitter !== null ? `±${jitter} ms` : '--'}
            </Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-label'>丢包率 (Loss)</Text>
            <Text className={`stat-val ${lossRateNum === 0 ? 'good' : 'bad'}`}>
              {lossRateNum}% ({sentCount - recvCount}/{sentCount})
            </Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-label'>成功收包率</Text>
            <Text className='stat-val good'>{sentCount > 0 ? `${Math.round((recvCount / sentCount) * 100)}%` : '--'}</Text>
          </View>
        </View>
      )}

      {/* 延迟波形迷你图 */}
      {packetLogs.length > 0 && (
        <View className='sparkline-card'>
          <View className='sparkline-header'>
            <Text className='card-title'>📈 往返延迟波动轨迹</Text>
            <View className='copy-btn' onClick={copyMtrReport}>
              <Text>📋 复制完整报告</Text>
            </View>
          </View>
          <View className='sparkline-bars'>
            {packetLogs.slice(0, 30).reverse().map((p) => {
              const heightPct = p.time ? Math.min(Math.max((p.time / ((worstRtt || 100) * 1.2)) * 100, 15), 100) : 5
              const isTimeOut = p.status === 'timeout'
              return (
                <View key={p.seq} className='bar-col'>
                  <View
                    className={`bar-fill ${isTimeOut ? 'timeout' : p.time && p.time < 50 ? 'good' : 'warn'}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <Text className='bar-seq'>#{p.seq}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* 逐包详细探测日志流 */}
      {packetLogs.length > 0 && (
        <View className='logs-container'>
          <Text className='card-title'>📋 逐轮探测明细</Text>
          <ScrollView scrollY className='logs-scroll'>
            {packetLogs.map((p) => (
              <View key={p.seq} className='log-row'>
                <View className='log-left'>
                  <Text className='seq-badge'>包 #{p.seq}</Text>
                  <Text className='log-time'>{p.timestamp}</Text>
                </View>
                <View className='log-right'>
                  {p.status === 'success' ? (
                    <>
                      <Text className='rtt-text'>{p.time} ms</Text>
                      {p.diff !== null && (
                        <Text className={`diff-text ${p.diff > 0 ? 'plus' : 'minus'}`}>
                          {p.diff > 0 ? `+${p.diff}ms` : p.diff < 0 ? `${p.diff}ms` : '0ms'}
                        </Text>
                      )}
                      <Text className='status-tag success'>成功</Text>
                    </>
                  ) : (
                    <>
                      <Text className='timeout-text'>请求超时 (Timeout)</Text>
                      <Text className='status-tag timeout'>丢包</Text>
                    </>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  )
}
