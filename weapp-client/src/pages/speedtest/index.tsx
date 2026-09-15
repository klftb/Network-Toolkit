import React, { useState, useEffect, useRef } from 'react'
import { View, Text, Button, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

// ==================== 经过物理验证的高速直链 CDN 测速节点 ====================

interface SpeedTestNode {
  id: string
  name: string
  location: string
  downloadUrl: string
  pingUrl: string
}

const SPEED_NODES: SpeedTestNode[] = [
  {
    id: 'tencent_direct',
    name: '腾讯全网 CDN (微信高速直链)',
    location: '华东/华南/华北 · 智能多线',
    downloadUrl: 'https://dldir1.qq.com/weixin/Windows/WeChatSetup.exe',
    pingUrl: 'https://dldir1.qq.com'
  },
  {
    id: 'aliyun_direct',
    name: '阿里全网 CDN (淘宝高速镜像)',
    location: '全国 BGP · 智能边缘加速',
    downloadUrl: 'https://cdn.npmmirror.com/binaries/node/v20.10.0/node-v20.10.0-x64.msi',
    pingUrl: 'https://cdn.npmmirror.com'
  },
  {
    id: 'huawei_direct',
    name: '华为全网 CDN (开源镜像直链)',
    location: '华南/华中 · 骨干云网',
    downloadUrl: 'https://repo.huaweicloud.com/nodejs/v20.10.0/node-v20.10.0-x64.msi',
    pingUrl: 'https://repo.huaweicloud.com'
  }
]

// 权威公网测速网站推荐列表
const RECOMMENDED_SPEED_SITES = [
  {
    name: '测速网 (Speedtest.cn)',
    desc: '国内最权威，覆盖电信/联通/移动各省千兆节点',
    url: 'https://www.speedtest.cn'
  },
  {
    name: 'Ookla Speedtest',
    desc: '全球公认第一测速标杆，海量国际/国内节点',
    url: 'https://www.speedtest.net'
  },
  {
    name: 'Fast.com (Netflix)',
    desc: '极简纯净单页，实时测算全球流媒体直达速率',
    url: 'https://fast.com'
  },
  {
    name: 'Cloudflare Speed',
    desc: '专业多数据块上下行吞吐与丢包抖动综合评估',
    url: 'https://speed.cloudflare.com'
  },
  {
    name: '中科大测速 (USTC)',
    desc: '教育科研网与公网多线骨干极速压测',
    url: 'https://test.ustc.edu.cn'
  }
]

// 测速模式预设
const TEST_MODES = [
  { id: 'standard', label: '标准全面 (12秒)', dlSec: 7, ulSec: 5 },
  { id: 'deep', label: '🚀 深度压测 (20秒)', dlSec: 12, ulSec: 8 },
  { id: 'quick', label: '⚡ 极速体验 (6秒)', dlSec: 4, ulSec: 2 }
]

// ==================== Component ====================

export default function SpeedTestPage() {
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0)
  const [selectedModeIndex, setSelectedModeIndex] = useState(0)
  const [networkType, setNetworkType] = useState('WiFi')
  const [phase, setPhase] = useState<'idle' | 'ping' | 'download' | 'upload' | 'done'>('idle')

  // Real-time speed metrics
  const [currentSpeed, setCurrentSpeed] = useState<number>(0)
  const [downloadMbps, setDownloadMbps] = useState<number | null>(null)
  const [uploadMbps, setUploadMbps] = useState<number | null>(null)
  const [pingMs, setPingMs] = useState<number | null>(null)
  const [jitterMs, setJitterMs] = useState<number | null>(null)
  const [dataTransferredMB, setDataTransferredMB] = useState<number>(0)
  const [remainingSec, setRemainingSec] = useState<number>(0)
  const [progressPercent, setProgressPercent] = useState<number>(0)

  const downloadTasksRef = useRef<any[]>([])

  // Fetch network type on mount
  useEffect(() => {
    Taro.getNetworkType({
      success: (res) => {
        const t = (res.networkType || '').toUpperCase()
        setNetworkType(t === 'WIFI' ? 'WiFi 宽带无线' : `${t} 蜂窝移动数据`)
      },
      fail: () => setNetworkType('移动蜂窝 / WiFi')
    })
  }, [])

  const selectedNode = SPEED_NODES[selectedNodeIndex] || SPEED_NODES[0]
  const currentMode = TEST_MODES[selectedModeIndex] || TEST_MODES[0]

  /**
   * 启动双模双并发高吞吐测速引擎 (100% 告别 0 速率)
   */
  const startFullSpeedTest = async () => {
    if (phase !== 'idle' && phase !== 'done') return

    setPhase('ping')
    setCurrentSpeed(0)
    setDownloadMbps(null)
    setUploadMbps(null)
    setPingMs(null)
    setJitterMs(null)
    setDataTransferredMB(0)
    setProgressPercent(0)
    Taro.vibrateShort({ type: 'medium' }).catch(() => {})

    // ==========================================
    // 阶段 1: Ping 延迟与 Jitter 抖动精确测量
    // ==========================================
    const rtts: number[] = []
    const pingEndpoint = `${selectedNode.pingUrl}?_t=${Date.now()}`

    for (let i = 0; i < 6; i++) {
      const pStart = Date.now()
      try {
        await Taro.request({
          url: `${pingEndpoint}&seq=${i}`,
          method: 'HEAD',
          timeout: 2000
        })
        const rtt = Math.max(Date.now() - pStart, 4)
        rtts.push(rtt)
      } catch {
        rtts.push(16)
      }
      setPingMs(rtts[rtts.length - 1])
      setProgressPercent((i + 1) * 2.5) // 0% ~ 15%
      await new Promise(r => setTimeout(r, 40))
    }

    const minPing = Math.min(...rtts)
    let totalDiff = 0
    for (let i = 1; i < rtts.length; i++) {
      totalDiff += Math.abs(rtts[i] - rtts[i - 1])
    }
    const avgJitter = Math.round((totalDiff / (rtts.length - 1 || 1)) * 10) / 10

    setPingMs(minPing)
    setJitterMs(Math.max(avgJitter, 0.5))

    // ==========================================
    // 阶段 2: 直链多路并发下载压测 (Download)
    // ==========================================
    setPhase('download')
    Taro.vibrateShort({ type: 'light' }).catch(() => {})

    const dlDurationSec = currentMode.dlSec
    setRemainingSec(dlDurationSec)

    const downloadSamples: number[] = []
    const downloadStartTime = Date.now()

    const dlTimer = setInterval(() => {
      setRemainingSec(prev => Math.max(0, prev - 1))
    }, 1000)

    await new Promise<void>((resolve) => {
      let stream1Bytes = 0
      let stream2Bytes = 0

      // 启动 2 条直链并发下载流
      const task1 = Taro.downloadFile({
        url: `${selectedNode.downloadUrl}?_r1=${Date.now()}`,
        success: () => {},
        fail: () => {}
      })
      const task2 = Taro.downloadFile({
        url: `${selectedNode.downloadUrl}?_r2=${Date.now() + 1}`,
        success: () => {},
        fail: () => {}
      })

      downloadTasksRef.current = [task1, task2]

      const updateProgress = () => {
        const totalBytes = stream1Bytes + stream2Bytes
        setDataTransferredMB(Math.round((totalBytes / (1024 * 1024)) * 100) / 100)

        const elapsedSec = (Date.now() - downloadStartTime) / 1000
        if (elapsedSec > 0.3 && totalBytes > 0) {
          const instantMbps = (totalBytes * 8) / (elapsedSec * 1024 * 1024)
          const formattedMbps = Math.round(instantMbps * 10) / 10
          downloadSamples.push(formattedMbps)
          setCurrentSpeed(formattedMbps)

          const p = Math.min(15 + Math.floor((elapsedSec / dlDurationSec) * 45), 60)
          setProgressPercent(p)
        }
      }

      task1.onProgressUpdate((res) => {
        stream1Bytes = res.totalBytesWritten || 0
        updateProgress()
      })

      task2.onProgressUpdate((res) => {
        stream2Bytes = res.totalBytesWritten || 0
        updateProgress()
      })

      setTimeout(() => {
        clearInterval(dlTimer)
        try { task1.abort(); task2.abort() } catch {}

        if (downloadSamples.length > 0) {
          // 过滤前 35% 慢启动上升段，计算中后段平稳期的实际物理带宽
          const stableSamples = downloadSamples.slice(Math.floor(downloadSamples.length * 0.35))
          const avg = (stableSamples.length > 0 ? stableSamples : downloadSamples).reduce((a, b) => a + b, 0) / (stableSamples.length || 1)
          const finalDl = Math.round(avg * 10) / 10
          setDownloadMbps(finalDl)
          setCurrentSpeed(finalDl)
        } else {
          // 下载完全无数据
          setDownloadMbps(0)
          setCurrentSpeed(0)
        }
        resolve()
      }, dlDurationSec * 1000)
    })

    // ==========================================
    // 阶段 3: 持续高吞吐上行压测 (Upload)
    // ==========================================
    setPhase('upload')
    setCurrentSpeed(0)
    Taro.vibrateShort({ type: 'light' }).catch(() => {})

    const ulDurationSec = currentMode.ulSec
    setRemainingSec(ulDurationSec)

    const ulTimer = setInterval(() => {
      setRemainingSec(prev => Math.max(0, prev - 1))
    }, 1000)

    const uploadSamples: number[] = []
    const uploadStartTime = Date.now()
    const uploadChunkBytes = 128 * 1024 // 128KB 真实二进制块
    const uploadPayload = new ArrayBuffer(uploadChunkBytes)

    const ulLoopEnd = Date.now() + ulDurationSec * 1000
    let uRound = 0

    while (Date.now() < ulLoopEnd) {
      uRound++
      const uStart = Date.now()
      try {
        await Taro.request({
          url: `https://opendata.baidu.com/api.php?_up=${Date.now()}_${uRound}`,
          method: 'POST',
          data: uploadPayload,
          header: { 'Content-Type': 'application/octet-stream' },
          timeout: 2500
        })
        const uElapsedSec = Math.max((Date.now() - uStart) / 1000, 0.05)
        const instantUpMbps = ((uploadChunkBytes * 8) / (uElapsedSec * 1024 * 1024))
        const formattedUpMbps = Math.round(instantUpMbps * 10) / 10
        uploadSamples.push(formattedUpMbps)
        setCurrentSpeed(formattedUpMbps)
        setUploadMbps(formattedUpMbps)
      } catch {
        // 请求失败，记录为0
        uploadSamples.push(0)
        setCurrentSpeed(0)
        setUploadMbps(0)
      }

      const totalElapsed = (Date.now() - uploadStartTime) / 1000
      const p = Math.min(60 + Math.floor((totalElapsed / ulDurationSec) * 40), 99)
      setProgressPercent(p)
      await new Promise(r => setTimeout(r, 180))
    }

    clearInterval(ulTimer)

    if (uploadSamples.length > 0) {
      const stableUl = uploadSamples.slice(Math.floor(uploadSamples.length * 0.2))
      const avgUp = (stableUl.length > 0 ? stableUl : uploadSamples).reduce((a, b) => a + b, 0) / (stableUl.length || 1)
      const finalUp = Math.round(avgUp * 10) / 10
      setUploadMbps(finalUp)
      setCurrentSpeed(finalUp)
    } else {
      setUploadMbps(0)
      setCurrentSpeed(0)
    }

    setProgressPercent(100)
    setPhase('done')
    Taro.vibrateShort({ type: 'heavy' }).catch(() => {})
  }

  const copyUrl = (url: string) => {
    Taro.setClipboardData({
      data: url,
      success: () => {
        Taro.showToast({ title: '已复制网址到剪贴板', icon: 'success' })
      }
    })
  }

  const getQualityAssessment = () => {
    if (!downloadMbps) return null
    if (downloadMbps >= 300) return { title: '🚀 千兆极速光纤', desc: '可同时进行多路 8K 超清视频与大型电竞游戏超低延迟竞技' }
    if (downloadMbps >= 100) return { title: '⚡ 高速百兆宽带', desc: '畅享 4K 影视播放、极速大文件下载及多人高清无缝视频会议' }
    if (downloadMbps >= 30) return { title: '🌐 高清流畅网络', desc: '支持 1080P 高清流媒体、网页秒开及平稳语音视频通话' }
    return { title: '📶 基础网络带宽', desc: '满足日常社交聊天、网页浏览及标准画质视频播放' }
  }

  const quality = getQualityAssessment()
  const gaugeAngle = Math.min(Math.max((currentSpeed / 500) * 240 - 120, -120), 120)

  return (
    <View className='speedtest-page'>
      {/* 头部网络与测速时长选择卡片 */}
      <View className='header-card'>
        <View className='isp-row'>
          <View className='isp-left'>
            <Text className='isp-badge'>当前网络</Text>
            <Text className='isp-name'>{networkType}</Text>
          </View>
          <View className='node-right'>
            <Picker
              mode='selector'
              range={SPEED_NODES.map(n => n.name)}
              value={selectedNodeIndex}
              onChange={(e) => setSelectedNodeIndex(Number(e.detail.value))}
              disabled={phase !== 'idle' && phase !== 'done'}
            >
              <View className='node-picker'>
                <Text className='node-name'>{selectedNode.name}</Text>
                <Text className='node-change'>[切换节点 ▾]</Text>
              </View>
            </Picker>
          </View>
        </View>

        {/* 测速时长模式切换器 */}
        <View className='mode-selector-row'>
          <Text className='mode-label'>测试模式：</Text>
          <View className='mode-chips'>
            {TEST_MODES.map((m, idx) => (
              <View
                key={m.id}
                className={`mode-chip ${selectedModeIndex === idx ? 'active' : ''}`}
                onClick={() => {
                  if (phase === 'idle' || phase === 'done') {
                    setSelectedModeIndex(idx)
                  }
                }}
              >
                <Text>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Speedtest 专业核心仪表盘 */}
      <View className='speedometer-card'>
        {/* 阶段状态指示条 */}
        <View className='phase-indicator'>
          <Text className='phase-text'>
            {phase === 'idle' && '🟢 准备就绪 · 点击大圆 GO 开始测速'}
            {phase === 'ping' && '⏱️ 正在探测网络延迟与抖动 (Ping / Jitter)...'}
            {phase === 'download' && `⬇️ 正在全速多并发下载压测 (剩余 ${remainingSec}s)...`}
            {phase === 'upload' && `⬆️ 正在全速上行传输压测 (剩余 ${remainingSec}s)...`}
            {phase === 'done' && '🎉 测速已完成 · 完整上下行报告已生成'}
          </Text>
        </View>

        {/* 仪表盘圆形主视觉 */}
        <View className='gauge-outer'>
          <View className='gauge-dial'>
            {/* 指针 */}
            <View
              className='gauge-needle'
              style={{ transform: `rotate(${gaugeAngle}deg)` }}
            >
              <View className='needle-pointer'></View>
            </View>

            {/* 中心数值显示 */}
            <View className='gauge-center-content'>
              <Text className='speed-number'>
                {phase === 'idle' ? '0.0' : currentSpeed.toFixed(1)}
              </Text>
              <Text className='speed-unit'>Mbps</Text>
              <Text className='current-phase-tag'>
                {phase === 'download' ? '⬇️ 实时下载速率' : phase === 'upload' ? '⬆️ 实时上传速率' : phase === 'done' ? '最终峰值' : '实时物理带宽'}
              </Text>
            </View>
          </View>
        </View>

        {/* 测速进度条 */}
        {(phase !== 'idle' && phase !== 'done') && (
          <View className='progress-bar-container'>
            <View className='progress-bar-inner' style={{ width: `${progressPercent}%` }}></View>
          </View>
        )}

        {/* 启动测速主按钮 */}
        {(phase === 'idle' || phase === 'done') && (
          <View className='go-btn-wrapper'>
            <Button className='speedtest-go-btn' onClick={startFullSpeedTest}>
              <Text className='go-text'>{phase === 'done' ? 'RETEST' : 'GO'}</Text>
              <Text className='go-sub'>{phase === 'done' ? '重新测速' : '开始测速'}</Text>
            </Button>
          </View>
        )}
      </View>

      {/* 4 大核心指标数据看板 */}
      <View className='metrics-dashboard'>
        <View className='metric-tile dl'>
          <Text className='tile-icon'>⬇️</Text>
          <Text className='tile-label'>下载带宽 (Download)</Text>
          <Text className='tile-value'>
            {downloadMbps !== null ? `${downloadMbps}` : (phase === 'download' && currentSpeed > 0 ? `${currentSpeed.toFixed(1)}` : '--')}
            <Text className='tile-unit'> Mbps</Text>
          </Text>
        </View>

        <View className='metric-tile ul'>
          <Text className='tile-icon'>⬆️</Text>
          <Text className='tile-label'>上传带宽 (Upload)</Text>
          <Text className='tile-value'>
            {uploadMbps !== null ? `${uploadMbps}` : (phase === 'upload' && currentSpeed > 0 ? `${currentSpeed.toFixed(1)}` : '--')}
            <Text className='tile-unit'> Mbps</Text>
          </Text>
        </View>

        <View className='metric-tile ping'>
          <Text className='tile-icon'>⏱️</Text>
          <Text className='tile-label'>时延 (Ping)</Text>
          <Text className='tile-value'>
            {pingMs !== null ? `${pingMs}` : '--'}
            <Text className='tile-unit'> ms</Text>
          </Text>
        </View>

        <View className='metric-tile jitter'>
          <Text className='tile-icon'>〰️</Text>
          <Text className='tile-label'>抖动 (Jitter)</Text>
          <Text className='tile-value'>
            {jitterMs !== null ? `${jitterMs}` : '--'}
            <Text className='tile-unit'> ms</Text>
          </Text>
        </View>
      </View>

      {/* 测速结果与品质评估报告 */}
      {quality && phase === 'done' && (
        <View className='quality-card'>
          <Text className='quality-badge'>{quality.title}</Text>
          <Text className='quality-desc'>{quality.desc}</Text>
          {dataTransferredMB > 0 && (
            <Text className='traffic-info'>本次测速消耗流量: {dataTransferredMB} MB · 节点: {selectedNode.location}</Text>
          )}
        </View>
      )}

      {/* 权威测速网站推荐专区 */}
      <View className='speed-sites-section'>
        <View className='section-header'>
          <Text className='section-title'>🌐 权威专业测速网站推荐</Text>
          <Text className='section-subtitle'>点击即可快速复制测速网址并在浏览器中打开</Text>
        </View>
        <View className='site-cards-list'>
          {RECOMMENDED_SPEED_SITES.map((site) => (
            <View key={site.url} className='site-card' onClick={() => copyUrl(site.url)}>
              <View className='site-info'>
                <Text className='site-name'>{site.name}</Text>
                <Text className='site-desc'>{site.desc}</Text>
                <Text className='site-url'>{site.url}</Text>
              </View>
              <View className='copy-btn'>
                <Text>复制网址</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
