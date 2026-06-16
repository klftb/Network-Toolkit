import React, { useState, useEffect } from 'react'
import { View, Text, Input, Slider } from '@tarojs/components'
import './index.scss'

export default function SubnetCalculator() {
  const [ip, setIp] = useState('192.168.1.100')
  const [cidr, setCidr] = useState(24)
  const [maskInput, setMaskInput] = useState('255.255.255.0')

  const [results, setResults] = useState({
    network: '',
    broadcast: '',
    mask: '',
    usableHosts: 0,
    totalHosts: 0,
    firstUsable: '',
    lastUsable: ''
  })

  // IPv4 to integer
  const ipToInt = (ipStr: string) => {
    return ipStr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  // Integer to IPv4
  const intToIp = (int: number) => {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255
    ].join('.');
  }

  // Convert CIDR to Subnet Mask
  const cidrToMask = (c: number): string => {
    const maskInt = c === 0 ? 0 : (~0 << (32 - c)) >>> 0
    return intToIp(maskInt)
  }

  // Convert Subnet Mask to CIDR
  const maskToCidr = (maskStr: string): number | null => {
    const parts = maskStr.split('.')
    if (parts.length !== 4) return null
    const nums = parts.map(p => parseInt(p, 10))
    if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null
    
    const maskInt = ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0
    
    // Check if it's a valid subnet mask: 1s followed by 0s
    const inverted = (~maskInt) >>> 0
    if ((inverted & (inverted + 1)) !== 0) return null
    
    let count = 0
    let temp = maskInt
    while (temp & 0x80000000) {
      count++
      temp = (temp << 1) >>> 0
    }
    if (temp !== 0) return null
    return count
  }

  const handleCidrChange = (val: number) => {
    setCidr(val)
    setMaskInput(cidrToMask(val))
  }

  const handleMaskInput = (e: any) => {
    const val = e.detail.value
    setMaskInput(val)
    
    const cleanVal = val.trim()
    // Support CIDR shorthand input (e.g. "/24" or "24")
    if (/^\/?\d+$/.test(cleanVal)) {
      const num = parseInt(cleanVal.replace('/', ''), 10)
      if (num >= 0 && num <= 32) {
        setCidr(num)
        return
      }
    }
    
    // Dotted decimal mask input
    const parsedCidr = maskToCidr(cleanVal)
    if (parsedCidr !== null) {
      setCidr(parsedCidr)
    }
  }

  useEffect(() => {
    try {
      const parts = ip.split('.')
      if (parts.length !== 4 || parts.some(p => p === '' || isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
        return; // Invalid IP
      }

      const ipInt = ipToInt(ip);
      const maskInt = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
      const networkInt = (ipInt & maskInt) >>> 0;
      const broadcastInt = (networkInt | ~maskInt) >>> 0;
      
      const totalHosts = cidr === 32 ? 1 : Math.pow(2, 32 - cidr);
      const usableHosts = cidr >= 31 ? 0 : totalHosts - 2;

      let firstUsable = '--'
      let lastUsable = '--'
      if (cidr <= 30) {
        firstUsable = intToIp(networkInt + 1)
        lastUsable = intToIp(broadcastInt - 1)
      } else if (cidr === 32) {
        firstUsable = intToIp(networkInt)
        lastUsable = intToIp(networkInt)
      }

      setResults({
        network: intToIp(networkInt),
        broadcast: intToIp(broadcastInt),
        mask: intToIp(maskInt),
        usableHosts,
        totalHosts,
        firstUsable,
        lastUsable
      })
    } catch (e) {
      // ignore
    }
  }, [ip, cidr])

  return (
    <View className='subnet-page'>
      <View className='header'>
        <Text className='title'>子网掩码计算</Text>
        <Text className='subtitle'>移动端纯本地计算引擎，实时测算</Text>
      </View>

      <View className='input-card'>
        <View className='input-group'>
          <Text className='label'>IPv4 地址</Text>
          <View className='input-wrapper'>
            <Input 
              type='text' 
              value={ip} 
              onInput={(e) => setIp(e.detail.value)}
              placeholder='例如: 192.168.1.1'
            />
          </View>
        </View>

        <View className='input-group'>
          <Text className='label'>子网掩码 (支持手动填写)</Text>
          <View className='input-wrapper'>
            <Input 
              type='text' 
              value={maskInput} 
              onInput={handleMaskInput}
              placeholder='例如: 255.255.255.0'
            />
          </View>
        </View>

        <View className='slider-group'>
          <View className='slider-header'>
            <Text className='label'>子网前缀 (CIDR)</Text>
            <Text className='value'>/{cidr}</Text>
          </View>
          <Slider 
            min={0} 
            max={32} 
            value={cidr} 
            activeColor='#38bdf8' 
            backgroundColor='rgba(255,255,255,0.1)'
            onChange={(e) => handleCidrChange(e.detail.value)} 
          />
        </View>
      </View>

      <View className='results-grid'>
        <View className='result-card range-card highlight-blue'>
          <View className='info'>
            <Text className='label'>可用IP范围 (首位使用IP - 末尾使用IP)</Text>
            <Text className='value'>{results.firstUsable} ~ {results.lastUsable}</Text>
          </View>
        </View>

        <View className='result-card highlight'>
          <View className='info'>
            <Text className='label'>子网掩码 (Subnet Mask)</Text>
            <Text className='value'>{results.mask || '--'}</Text>
          </View>
        </View>
        
        <View className='result-card'>
          <View className='info'>
            <Text className='label'>网络地址 (Network Address)</Text>
            <Text className='value'>{results.network || '--'}</Text>
          </View>
        </View>

        <View className='result-card'>
          <View className='info'>
            <Text className='label'>广播地址 (Broadcast Address)</Text>
            <Text className='value'>{results.broadcast || '--'}</Text>
          </View>
        </View>

        <View className='result-card highlight-green'>
          <View className='info'>
            <Text className='label'>首位可用 IP (First Usable)</Text>
            <Text className='value'>{results.firstUsable}</Text>
          </View>
        </View>

        <View className='result-card highlight-green'>
          <View className='info'>
            <Text className='label'>末尾可用 IP (Last Usable)</Text>
            <Text className='value'>{results.lastUsable}</Text>
          </View>
        </View>

        <View className='result-card'>
          <View className='info'>
            <Text className='label'>可用主机数 (Usable Hosts)</Text>
            <Text className='value'>{results.usableHosts.toLocaleString()}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
