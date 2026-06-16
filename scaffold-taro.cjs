const fs = require('fs');
const path = require('path');

const projectDir = path.join(process.cwd(), 'weapp-client');
if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir);

const files = {
  'package.json': JSON.stringify({
    name: "weapp-client",
    version: "1.0.0",
    private: true,
    description: "Network Toolkit Mini Program",
    templateInfo: { name: "default", typescript: true, css: "sass" },
    scripts: {
      "build:weapp": "taro build --type weapp",
      "dev:weapp": "taro build --type weapp --watch"
    },
    dependencies: {
      "@tarojs/components": "4.2.0",
      "@tarojs/helper": "4.2.0",
      "@tarojs/plugin-framework-react": "4.2.0",
      "@tarojs/react": "4.2.0",
      "@tarojs/runtime": "4.2.0",
      "@tarojs/shared": "4.2.0",
      "@tarojs/taro": "4.2.0",
      "react": "^18.0.0",
      "react-dom": "^18.0.0"
    },
    devDependencies: {
      "@babel/core": "^7.8.0",
      "@tarojs/cli": "4.2.0",
      "@tarojs/webpack5-runner": "4.2.0",
      "@types/react": "^18.0.0",
      "@types/webpack-env": "^1.13.6",
      "babel-preset-taro": "4.2.0",
      "sass": "^1.77.0",
      "typescript": "^5.0.0",
      "webpack": "5.78.0"
    }
  }, null, 2),
  'project.config.json': JSON.stringify({
    miniprogramRoot: "dist/",
    projectname: "weapp-client",
    description: "",
    appid: "touristappid",
    setting: { urlCheck: false, es6: false, enhance: true, postcss: false, minified: false }
  }, null, 2),
  'babel.config.js': `// babel-preset-taro 更多选项和默认值：
// https://docs.taro.zone/docs/next/babel-config
module.exports = {
  presets: [
    ['taro', {
      framework: 'react',
      ts: true
    }]
  ]
}`,
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: "es2017",
      module: "commonjs",
      removeComments: false,
      preserveConstEnums: true,
      moduleResolution: "node",
      experimentalDecorators: true,
      noImplicitAny: false,
      allowSyntheticDefaultImports: true,
      outDir: "lib",
      noUnusedLocals: true,
      noUnusedParameters: true,
      strictNullChecks: true,
      sourceMap: true,
      baseUrl: ".",
      rootDir: ".",
      jsx: "react-jsx",
      allowJs: true,
      resolveJsonModule: true,
      typeRoots: ["node_modules/@types"]
    },
    include: ["src"]
  }, null, 2),
  'config/index.js': `import { defineConfig } from '@tarojs/cli'
export default defineConfig(async (merge, { command, mode }) => {
  const baseConfig = {
    projectName: 'weapp-client',
    date: '2026-6-15',
    designWidth: 750,
    deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
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
})`,
  'config/dev.js': `module.exports = { env: { NODE_ENV: '"development"' }, defineConstants: {}, mini: {}, h5: {} }`,
  'config/prod.js': `module.exports = { env: { NODE_ENV: '"production"' }, defineConstants: {}, mini: {}, h5: {} }`,
  'src/app.config.ts': `export default defineAppConfig({ pages: ['pages/index/index'], window: { backgroundTextStyle: 'light', navigationBarBackgroundColor: '#fff', navigationBarTitleText: 'WeChat', navigationBarTextStyle: 'black' } })`,
  'src/app.tsx': `import React, { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import './app.scss'
function App({ children }: PropsWithChildren) {
  useLaunch(() => { console.log('App launched.') })
  return <>{children}</>
}
export default App`,
  'src/app.scss': `// 全局样式`,
  'src/pages/index/index.config.ts': `export default definePageConfig({ navigationBarTitleText: '首页' })`,
  'src/pages/index/index.tsx': `import React from 'react'
import { View, Text } from '@tarojs/components'
import './index.scss'
export default function Index() {
  return (
    <View className='index'>
      <Text>Hello world!</Text>
    </View>
  )
}`,
  'src/pages/index/index.scss': `.index { padding: 20px; }`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(projectDir, relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}
console.log('Taro template completely created.');
