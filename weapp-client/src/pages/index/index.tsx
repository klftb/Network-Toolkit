import React, { useState, useEffect } from 'react'
import { View, Text, Navigator } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Index() {
  const [networkType, setNetworkType] = useState('检测中...')
  const [online, setOnline] = useState(true)
  const [greeting, setGreeting] = useState('Welcome Back')

  useEffect(() => {
    // 获取当前网络状态
    Taro.getNetworkType({
      success: (res) => {
        setNetworkType(res.networkType ? res.networkType.toUpperCase() : '未知')
        setOnline(res.networkType !== 'none')
      },
      fail: () => {
        setNetworkType('离线')
        setOnline(false)
      }
    })

    // 监听网络状态切换
    const handleNetworkChange = (res: any) => {
      setNetworkType(res.networkType ? res.networkType.toUpperCase() : '未知')
      setOnline(res.isConnected)
    }

    Taro.onNetworkStatusChange(handleNetworkChange)
    
    // 设置问候语
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')

    return () => {
      Taro.offNetworkStatusChange(handleNetworkChange)
    }
  }, [])

  return (
    <View className='home-page'>
      {/* 顶部状态栏 */}
      <View className='top-bar'>
        <View className='brand'>
          <Text className='brand-title'>NETWORK</Text>
          <Text className='brand-subtitle'>TOOLKIT</Text>
        </View>
        
        <View className='status-indicator'>
          <Text className='status-label'>STATUS</Text>
          <View className='status-value'>
            <View className={`dot ${online ? 'online' : 'offline'}`}></View>
            <Text className={`text ${online ? 'online' : 'offline'}`}>{online ? 'Connected' : 'Offline'}</Text>
          </View>
        </View>
      </View>

      <View className='greeting-row'>
        <Text className='greeting-text'>{greeting}</Text>
      </View>

      {/* 5 大核心模块网格 */}
      <View className='dashboard-grid'>
        
        {/* 1. 网络测速 */}
        <Navigator url='/pages/speedtest/index' className='dash-card card-speed' hoverClass='card-active'>
          <Text className='card-title'>Speed Test</Text>
          <View className='card-icon speed-icon'>
            <View className='gauge-arc'></View>
            <View className='gauge-needle'></View>
          </View>
          <View className='card-data'>
            <Text className='data-val'>网络测速</Text>
            <Text className='data-sub'>CDN 带宽与下行速率</Text>
          </View>
          <View className='card-glow glow-cyan'></View>
        </Navigator>

        {/* 2. 目标诊断 */}
        <Navigator url='/pages/target/index' className='dash-card card-target' hoverClass='card-active'>
          <Text className='card-title'>Target Diagnostics</Text>
          <View className='card-icon radar-icon'>
            <View className='radar-circle'></View>
            <View className='radar-line'></View>
          </View>
          <View className='card-data'>
            <Text className='data-val'>目标诊断</Text>
            <Text className='data-sub'>IP归属·端口·DNS·Header</Text>
          </View>
          <View className='card-glow glow-purple'></View>
        </Navigator>

        {/* 3. 连通性测试 */}
        <Navigator url='/pages/connect/index' className='dash-card card-connect' hoverClass='card-active'>
          <Text className='card-title'>Connectivity</Text>
          <View className='card-icon wave-icon'>
            <View className='wave-line'></View>
          </View>
          <View className='card-data'>
            <Text className='data-val'>连通性测试</Text>
            <Text className='data-sub'>TCP Ping·多节点对比</Text>
          </View>
          <View className='card-glow glow-blue'></View>
        </Navigator>

        {/* 4. 本地网络报告 */}
        <Navigator url='/pages/report/index' className='dash-card card-local' hoverClass='card-active'>
          <Text className='card-title'>Local Network</Text>
          <View className='card-icon wifi-icon'>
            <View className='wifi-arc a1'></View>
            <View className='wifi-arc a2'></View>
            <View className='wifi-arc a3'></View>
            <View className='wifi-dot'></View>
          </View>
          <View className='card-data'>
            <Text className='data-val'>网络状态诊断</Text>
            <Text className='data-sub'>内外网拓扑与网关探测</Text>
          </View>
          <View className='card-glow glow-pink'></View>
        </Navigator>

        {/* 5. 子网掩码计算 (跨两列居中或独占一行) */}
        <Navigator url='/pages/subnet/index' className='dash-card card-subnet' hoverClass='card-active'>
          <Text className='card-title'>Subnet Calculator</Text>
          <View className='card-icon subnet-icon'>
            <View className='subnet-grid'>
              <View className='s-box'></View>
              <View className='s-box fill'></View>
              <View className='s-box'></View>
              <View className='s-box fill'></View>
            </View>
          </View>
          <View className='card-data'>
            <Text className='data-val'>子网掩码计算</Text>
            <Text className='data-sub'>离线计算局域网可用IP段</Text>
          </View>
          <View className='card-glow glow-orange'></View>
        </Navigator>

      </View>

      <View className='footer-area'>
        <Text className='footer-text'>Network Toolkit</Text>
      </View>
    </View>
  )
}