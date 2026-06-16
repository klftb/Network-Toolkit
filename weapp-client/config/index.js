import { defineConfig } from '@tarojs/cli'
export default defineConfig(async (merge, { command, mode }) => {
  const baseConfig = {
    projectName: 'weapp-client',
    date: '2026-6-15',
    designWidth: 375,
    deviceRatio: { 375: 2, 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {},
    copy: { patterns: [], options: {} },
    framework: 'react',
    compiler: 'webpack5',
    mini: {
      postcss: {
        pxtransform: { enable: true, config: {} },
        url: { enable: true, config: { limit: 1024 } },
        cssModules: { enable: false, config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' } }
      }
    }
  }
  return merge({}, baseConfig, mode === 'development' ? require('./dev') : require('./prod'))
})