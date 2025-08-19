# uTools Git 克隆插件

一个功能强大的 uTools 插件，用于快速克隆 Git 仓库。支持 GitHub、GitLab、Gitee 和 Bitbucket 等主流 Git 平台。

## 功能特性

### 🚀 核心功能

- **智能识别**: 自动识别并验证 Git 仓库地址格式
- **多平台支持**: 支持 GitHub、GitLab、Gitee、Bitbucket 等平台
- **双协议支持**: 同时支持 HTTPS 和 SSH 克隆协议
- **分支选择**: 提供分支选择功能，默认使用 main/master 分支
- **自定义路径**: 支持自定义本地存储路径设置
- **后台克隆**: 无需界面，直接在后台完成仓库克隆操作

### 🎯 用户体验

- **快速触发**: 在 uTools 搜索框直接粘贴 Git 仓库地址即可触发
- **进度反馈**: 在 uTools 通知中心显示克隆进度和结果
- **智能错误处理**: 识别并提示常见错误（无效地址、权限不足等）
- **自定义路径**: 支持自定义本地存储路径设置
- **一键打开**: 克隆完成后可直接打开目标文件夹

## 使用方法

### 1. 基本使用

1. 复制 Git 仓库地址（支持 HTTPS 或 SSH 格式）
2. 打开 uTools（Alt + Space）
3. 粘贴仓库地址，插件会自动识别并显示
4. 选择分支（可选，默认使用主分支）
5. 确认存储路径
6. 点击「开始克隆」

### 2. 支持的仓库地址格式

#### HTTPS 格式

```
https://github.com/username/repository.git
https://gitlab.com/username/repository.git
https://gitee.com/username/repository.git
https://bitbucket.org/username/repository.git
```

#### SSH 格式

```
git@github.com:username/repository.git
git@gitlab.com:username/repository.git
git@gitee.com:username/repository.git
git@bitbucket.org:username/repository.git
```

### 3. 设置自定义路径

1. 在插件界面点击「设置」按钮
2. 选择默认克隆路径
3. 点击「保存」

## 错误处理

插件内置了完善的错误处理机制，能够识别并提示以下常见错误：

- **仓库不存在或无访问权限**: 检查仓库地址是否正确，或是否有访问权限
- **目标目录已存在**: 选择其他路径或删除现有目录
- **SSH 密钥权限不足**: 检查 SSH 密钥配置
- **网络连接超时**: 检查网络连接或尝试使用其他协议
- **无效的仓库地址**: 确保仓库地址格式正确

## 开发环境

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

### 构建插件

```bash
pnpm build
```

## 技术栈

- **前端框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **Git 操作**: simple-git
- **网络请求**: node-fetch
- **uTools API**: utools-api-types

## 项目结构

```
├── public/
│   ├── plugin.json          # uTools 插件配置
│   ├── logo.png             # 插件图标
│   └── preload/
│       └── services.js     # Node.js 服务层
├── src/
│   ├── App.vue             # 主应用组件
│   ├── GitClone/
│   │   └── index.vue       # Git 克隆组件
│   ├── main.js             # 应用入口
│   └── main.css            # 全局样式
├── package.json            # 项目配置
└── vite.config.js          # Vite 配置
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个插件！
