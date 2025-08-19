const fs = require('node:fs')
const path = require('node:path')
const { simpleGit } = require('simple-git')
const { exec } = require('node:child_process')
const { promisify } = require('node:util')
const execAsync = promisify(exec)

// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {
  // 读文件
  readFile (file) {
    return fs.readFileSync(file, { encoding: 'utf-8' })
  },
  // 文本写入到下载目录
  writeTextFile (text) {
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.txt')
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  // 图片写入到下载目录
  writeImageFile (base64Url) {
    const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64Url)
    if (!matchs) return
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.' + matchs[1])
    fs.writeFileSync(filePath, base64Url.substring(matchs[0].length), { encoding: 'base64' })
    return filePath
  },

  // Git仓库地址验证
  validateGitUrl (url) {
    const patterns = [
      // HTTPS格式
      /^https?:\/\/(www\.)?(github\.com|gitlab\.com|gitee\.com|bitbucket\.org)\/[\w\.-]+\/[\w\.-]+(\.git)?\/?$/i,
      // SSH格式
      /^git@(github\.com|gitlab\.com|gitee\.com|bitbucket\.org):[\w\.-]+\/[\w\.-]+(\.git)?$/i
    ]
    return patterns.some(pattern => pattern.test(url.trim()))
  },

  // 标准化Git URL
  normalizeGitUrl (url) {
    url = url.trim()
    // 如果是HTTPS格式但没有.git后缀，添加它
    if (url.match(/^https?:\/\//i) && !url.endsWith('.git')) {
      url = url.replace(/\/$/, '') + '.git'
    }
    return url
  },

  // 从URL提取仓库信息
  extractRepoInfo (url) {
    const httpsMatch = url.match(/^https?:\/\/(www\.)?(github\.com|gitlab\.com|gitee\.com|bitbucket\.org)\/([\w\.-]+)\/([\w\.-]+)(\.git)?\/?$/i)
    const sshMatch = url.match(/^git@(github\.com|gitlab\.com|gitee\.com|bitbucket\.org):([\w\.-]+)\/([\w\.-]+)(\.git)?$/i)
    
    if (httpsMatch) {
      return {
        platform: httpsMatch[2],
        owner: httpsMatch[3],
        repo: httpsMatch[4].replace(/\.git$/, ''),
        protocol: 'https'
      }
    } else if (sshMatch) {
      return {
        platform: sshMatch[1],
        owner: sshMatch[2],
        repo: sshMatch[3].replace(/\.git$/, ''),
        protocol: 'ssh'
      }
    }
    return null
  },

  // 获取用户设置
  getUserSettings () {
    try {
      const settings = window.utools.dbStorage.getItem('git-clone-settings')
      return settings ? JSON.parse(settings) : {
        defaultClonePath: '',
        autoCloneSingleBranch: true,
        showProgressDetails: true
      }
    } catch (error) {
      console.error('获取用户设置失败:', error)
      return {
        defaultClonePath: '',
        autoCloneSingleBranch: true,
        showProgressDetails: true
      }
    }
  },

  // 保存用户设置
  saveUserSettings (settings) {
    try {
      window.utools.dbStorage.setItem('git-clone-settings', JSON.stringify(settings))
      return true
    } catch (error) {
      console.error('保存用户设置失败:', error)
      return false
    }
  },

  // 获取智能默认路径
  getSmartDefaultPath (repoInfo) {
    // 确保repoInfo存在且有repo属性
    if (!repoInfo || !repoInfo.repo) {
      return null
    }
    
    const settings = this.getUserSettings()
    
    // 如果用户设置了默认路径，使用默认路径
    if (settings.defaultClonePath && fs.existsSync(settings.defaultClonePath)) {
      return path.join(settings.defaultClonePath, repoInfo.repo)
    }
    
    // 否则使用当前资源管理器路径或下载目录
    const explorerPath = this.getCurrentExplorerPath()
    if (explorerPath) {
      return path.join(explorerPath, repoInfo.repo)
    }
    
    return path.join(window.utools.getPath('downloads'), repoInfo.repo)
  },

  // 获取当前Windows资源管理器路径
  getCurrentExplorerPath () {
    try {
      // 尝试获取当前活动的文件夹路径
      const { exec } = require('child_process')
      return new Promise((resolve) => {
        exec('powershell "Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\SessionInfo\\1\\Desktop" -Name "DesktopViewModeAggregationId" 2>$null; if($?) { (New-Object -ComObject Shell.Application).Windows() | Where-Object { $_.Name -eq \"File Explorer\" } | Select-Object -First 1 | ForEach-Object { $_.Document.Folder.Self.Path } }"', (error, stdout) => {
          if (!error && stdout.trim()) {
            resolve(stdout.trim())
          } else {
            resolve(null)
          }
        })
      })
    } catch (error) {
      return Promise.resolve(null)
    }
  },

  // 获取默认克隆路径
  getDefaultClonePath () {
    const setting = window.utools.dbStorage.getItem('git-clone-path')
    return setting || path.join(window.utools.getPath('desktop'), 'GitRepos')
  },

  // 设置默认克隆路径
  setDefaultClonePath (clonePath) {
    window.utools.dbStorage.setItem('git-clone-path', clonePath)
  },

  // 获取远程分支列表
  async getRemoteBranches (repoUrl) {
    try {
      const git = simpleGit()
      
      // 使用 ls-remote 获取远程分支
      const result = await git.listRemote(['--heads', repoUrl])
      
      // 解析分支名称
      const branches = result
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split('\t')
          if (parts.length >= 2) {
            return parts[1].replace('refs/heads/', '')
          }
          return null
        })
        .filter(branch => branch !== null)
      
      return branches
    } catch (error) {
      console.error('获取远程分支失败:', error)
      throw new Error('无法获取远程分支信息')
    }
  },

  // 智能分支处理
  async getSmartBranchInfo (repoUrl) {
    try {
      const branches = await this.getRemoteBranches(repoUrl)
      const settings = this.getUserSettings()
      
      return {
        branches,
        shouldAutoClone: settings.autoCloneSingleBranch && branches.length === 1,
        defaultBranch: branches.includes('main') ? 'main' : 
                      branches.includes('master') ? 'master' : 
                      branches[0] || null
      }
    } catch (error) {
      console.error('智能分支处理失败:', error)
      return {
        branches: [],
        shouldAutoClone: false,
        defaultBranch: null,
        error: error.message
      }
    }
  },

  // 克隆Git仓库
  async cloneRepository (repoUrl, targetPath, branch = null, onProgress = null) {
    try {
      const settings = this.getUserSettings()
      
      // 确保目标目录存在
      if (!fs.existsSync(path.dirname(targetPath))) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      }

      // 检查目标目录是否已存在且不为空
      if (fs.existsSync(targetPath)) {
        const files = fs.readdirSync(targetPath)
        if (files.length > 0) {
          throw new Error('目标目录已存在且不为空')
        }
      }

      const git = simpleGit()
      const options = {
        '--progress': null
      }

      if (branch) {
        options['--branch'] = branch
      }

      // 发送开始通知
      if (onProgress) {
        onProgress('正在连接远程仓库...', 5)
      }

      // 模拟更详细的进度反馈
      const progressSteps = [
        { message: '正在解析仓库地址...', progress: 10 },
        { message: '正在建立连接...', progress: 20 },
        { message: '正在下载对象...', progress: 40 },
        { message: '正在接收对象...', progress: 70 },
        { message: '正在解压对象...', progress: 90 }
      ]

      // 如果启用了详细进度显示
      if (settings.showProgressDetails && onProgress) {
        for (const step of progressSteps) {
          onProgress(step.message, step.progress)
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      await git.clone(repoUrl, targetPath, options)
      
      // 发送完成通知
      if (onProgress) {
        onProgress('克隆完成！', 100)
      }

      return {
        success: true,
        path: targetPath,
        message: `仓库已成功克隆到: ${targetPath}`,
        branch: branch || 'default'
      }
    } catch (error) {
      console.error('克隆失败:', error)
      
      let errorMessage = '克隆失败'
      if (error.message.includes('not found')) {
        errorMessage = '仓库不存在或无访问权限'
      } else if (error.message.includes('already exists') || error.message.includes('不为空')) {
        errorMessage = '目标目录已存在且不为空'
      } else if (error.message.includes('Permission denied')) {
        errorMessage = 'SSH密钥权限不足'
      } else if (error.message.includes('timeout')) {
        errorMessage = '网络连接超时'
      } else if (error.message.includes('Authentication failed')) {
        errorMessage = '身份验证失败'
      }

      return {
        success: false,
        error: errorMessage,
        details: error.message
      }
    }
  },

  // 显示uTools通知
  showNotification (title, body, type = 'info') {
    window.utools.showNotification({
      title,
      body,
      type // info, success, warning, error
    })
  },

  // 打开文件夹
  openFolder (folderPath) {
    try {
      window.utools.shellOpenPath(folderPath)
    } catch (error) {
      console.error('打开文件夹失败:', error)
    }
  },

  // 检测剪贴板中的Git地址
  async checkClipboardForGitUrl () {
    try {
      const clipboardText = window.utools.getCopyedFiles() || []
      if (clipboardText.length === 0) {
        // 尝试获取文本剪贴板内容
        const text = await new Promise((resolve) => {
          try {
            const { clipboard } = require('electron')
            resolve(clipboard.readText())
          } catch {
            resolve('')
          }
        })
        
        if (this.validateGitUrl(text)) {
          return {
            hasGitUrl: true,
            url: text.trim(),
            repoInfo: this.extractRepoInfo(text.trim())
          }
        }
      }
      return { hasGitUrl: false }
    } catch (error) {
      console.error('检测剪贴板失败:', error)
      return { hasGitUrl: false }
    }
  },

  // 直接克隆（无界面）
  async directClone (repoUrl) {
    try {
      const repoInfo = this.extractRepoInfo(repoUrl)
      if (!repoInfo) {
        throw new Error('无效的仓库地址')
      }

      // 获取克隆路径：优先使用当前资源管理器路径，否则使用默认路径
      let basePath
      try {
        basePath = await this.getCurrentExplorerPath() || this.getDefaultClonePath()
      } catch {
        basePath = this.getDefaultClonePath()
      }
      
      const targetPath = path.join(basePath, repoInfo.repo)
      
      // 检查目录是否已存在
      if (fs.existsSync(targetPath)) {
        this.showNotification('警告', `目录 ${repoInfo.repo} 已存在`, 'warning')
        return { success: false, error: '目录已存在' }
      }

      // 显示开始通知
      this.showNotification('开始克隆', `正在克隆 ${repoInfo.owner}/${repoInfo.repo}...`, 'info')
      
      // 执行克隆
      const result = await this.cloneRepository(
        this.normalizeGitUrl(repoUrl),
        targetPath,
        null, // 使用默认分支
        (message, percent) => {
          // 静默进度更新，只在完成时通知
          if (percent === 100) {
            this.showNotification('克隆完成', `${repoInfo.repo} 已成功克隆到 ${basePath}`, 'success')
          }
        }
      )
      
      if (result.success) {
        // 询问是否打开文件夹
        setTimeout(() => {
          const openFolder = window.utools.showMessageBox({
            type: 'question',
            message: '克隆完成！是否打开文件夹？',
            buttons: ['打开', '取消']
          })
          
          if (openFolder === 0) {
            this.openFolder(result.path)
          }
        }, 500)
      }
      
      return result
    } catch (error) {
      console.error('直接克隆失败:', error)
      this.showNotification('克隆失败', error.message, 'error')
      return { success: false, error: error.message }
    }
  }
}
