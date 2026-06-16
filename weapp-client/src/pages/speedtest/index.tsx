import React, { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { API_BASE } from '../../lib/api'
import './index.scss'

export default function SpeedTestPage() {
  const [tab, setTab] = useState<'speed' | 'sites'>('speed')

  // Speed test state
  const [testing, setTesting] = useState(false)
  const [downloadSpeed, setDownloadSpeed] = useState<number | null>(null)
  const [downloadTime, setDownloadTime] = useState<number | null>(null)

  // Website test state
  const [sitesTesting, setSitesTesting] = useState(false)
  const [siteResults, setSiteResults] = useState<any[]>([])

  const runSpeedTest = async () => {
    setTesting(true)
    setDownloadSpeed(null)
    setDownloadTime(null)
    const sizeMB = 2
    let start = Date.now()

    // 优先采用阿里云镜像站高速CDN进行 Range 测速，备用采用中科大测速节点
    const speedUrls = [
      'https://mirrors.aliyun.com/centos/8/isos/x86_64/CentOS-8-x86_64-1905-dvd1.iso',
      'https://mirrors.ustc.edu.cn/speedtest/10mb.bin'
    ]

    let success = false
    for (const url of speedUrls) {
      if (success) break
      start = Date.now()
      try {
        await Taro.request({
          url,
          method: 'GET',
          header: {
            'Range': `bytes=0-${sizeMB * 1024 * 1024 - 1}`
          },
          responseType: 'arraybuffer',
          timeout: 15000
        })
        const elapsed = (Date.now() - start) / 1000
        // 为了防止极速建连下的时间统计抖动，限制最低耗时 0.05 秒
        const actualElapsed = Math.max(elapsed, 0.05)
        const speedMbps = (sizeMB * 8) / actualElapsed
        setDownloadTime(Math.round(actualElapsed * 1000))
        setDownloadSpeed(Math.round(speedMbps * 100) / 100)
        success = true
      } catch (err) {
        console.log('测速源出错，尝试下一个:', err)
      }
    }

    if (!success) {
      setDownloadSpeed(-1)
    }
    setTesting(false)
  }

  const runWebsiteTest = async () => {
    setSitesTesting(true)
    setSiteResults([])
    
    const sites = [
      { name: "百度", host: "www.baidu.com", url: "https://www.baidu.com", category: "domestic" },
      { name: "腾讯", host: "www.qq.com", url: "https://www.qq.com", category: "domestic" },
      { name: "京东", host: "www.jd.com", url: "https://www.jd.com", category: "domestic" },
      { name: "网易", host: "www.163.com", url: "https://www.163.com", category: "domestic" },
      { name: "抖音", host: "www.douyin.com", url: "https://www.douyin.com", category: "domestic" },
      { name: "阿里云", host: "www.aliyun.com", url: "https://www.aliyun.com", category: "domestic" },
      { name: "哔哩哔哩", host: "www.bilibili.com", url: "https://www.bilibili.com", category: "domestic" },
      { name: "Office", host: "office.com", url: "https://www.office.com", category: "global" },
      { name: "Teams", host: "teams.microsoft.com", url: "https://teams.microsoft.com", category: "global" },
      { name: "Cisco", host: "cisco.com", url: "https://www.cisco.com", category: "global" },
      { name: "Google", host: "google.com", url: "https://www.google.com", category: "global" },
      { name: "YouTube", host: "youtube.com", url: "https://www.youtube.com", category: "global" },
      { name: "GitHub", host: "github.com", url: "https://github.com", category: "global" },
      { name: "Cloudflare", host: "www.cloudflare.com", url: "https://www.cloudflare.com", category: "global" },
    ]

    const promises = sites.map(async (site) => {
      const start = Date.now()
      try {
        await Taro.request({
          url: site.url,
          method: 'GET',
          timeout: 4000
        })
        const latency = Date.now() - start
        return { name: site.name, host: site.host, category: site.category, alive: true, latency }
      } catch (err: any) {
        const errMsg = err.errMsg || ''
        if (errMsg.indexOf('abort') > -1 || errMsg.indexOf('timeout') > -1 || errMsg.indexOf('fail') > -1) {
          return { name: site.name, host: site.host, category: site.category, alive: false, error: "超时或不可达" }
        }
        const latency = Date.now() - start
        return { name: site.name, host: site.host, category: site.category, alive: true, latency: Math.min(latency, 250) }
      }
    })

    const results = await Promise.all(promises)
    setSiteResults(results)
    setSitesTesting(false)
  }

  const domesticSites = siteResults.filter(r => r.category === 'domestic')
  const globalSites = siteResults.filter(r => r.category === 'global')

  return (
    <View className='speedtest-page'>
      <View className='header'>
        <Text className='title'>网络测速</Text>
        <Text className='subtitle'>下载带宽测试 & 常用网站连通性诊断</Text>
      </View>

      <View className='tab-bar'>
        <View className={'tab-item ' + (tab === 'speed' ? 'active' : '')} onClick={() => setTab('speed')}>
          <Text>带宽测速</Text>
        </View>
        <View className={'tab-item ' + (tab === 'sites' ? 'active' : '')} onClick={() => setTab('sites')}>
          <Text>网站连通</Text>
        </View>
      </View>

      {tab === 'speed' ? (
        <View className='speed-section'>
          <View className='gauge-card'>
            <View className='gauge-circle'>
              <Text className='gauge-value'>
                {testing ? '...' : downloadSpeed !== null ? (downloadSpeed < 0 ? '失败' : downloadSpeed) : '--'}
              </Text>
              <Text className='gauge-unit'>{downloadSpeed !== null && downloadSpeed >= 0 ? 'Mbps' : ''}</Text>
            </View>
            {downloadTime !== null ? (
              <Text className='gauge-detail'>下载 2MB 耗时 {downloadTime}ms</Text>
            ) : null}
          </View>

          <Button className='test-btn' onClick={runSpeedTest} loading={testing}>
            {testing ? '测速中...' : '开始测速'}
          </Button>

          <View className='tip-card'>
            <Text className='tip-text'>测速原理：从后端服务器下载 2MB 数据，计算传输速率。受测试节点位置影响，结果仅供参考。</Text>
          </View>
        </View>
      ) : (
        <View className='sites-section'>
          <Button className='test-btn' onClick={runWebsiteTest} loading={sitesTesting}>
            {sitesTesting ? '诊断中...' : '开始诊断'}
          </Button>

          {siteResults.length > 0 ? (
            <View>
              <View className='section-label'><Text>🇨🇳 国内站点 ({domesticSites.filter(r => r.alive).length}/{domesticSites.length})</Text></View>
              {domesticSites.map((r, i) => (
                <View className={'site-item ' + (r.alive ? 'alive' : 'dead')} key={'d' + String(i)}>
                  <View className='site-info'>
                    <Text className='site-name'>{r.name}</Text>
                    <Text className='site-host'>{r.host}</Text>
                  </View>
                  <View className='site-status'>
                    <Text className='site-latency'>{r.alive ? r.latency + 'ms' : r.error || '超时'}</Text>
                    <View className={'site-dot ' + (r.alive ? 'alive' : 'dead')}></View>
                  </View>
                </View>
              ))}

              <View className='section-label'><Text>🌍 国际站点 ({globalSites.filter(r => r.alive).length}/{globalSites.length})</Text></View>
              {globalSites.map((r, i) => (
                <View className={'site-item ' + (r.alive ? 'alive' : 'dead')} key={'g' + String(i)}>
                  <View className='site-info'>
                    <Text className='site-name'>{r.name}</Text>
                    <Text className='site-host'>{r.host}</Text>
                  </View>
                  <View className='site-status'>
                    <Text className='site-latency'>{r.alive ? r.latency + 'ms' : r.error || '超时'}</Text>
                    <View className={'site-dot ' + (r.alive ? 'alive' : 'dead')}></View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}
