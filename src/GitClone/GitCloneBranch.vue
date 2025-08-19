<template>
  <div class="git-clone-branch">
    <div class="header">
      <h3>分支克隆</h3>
      <div class="repo-info" v-if="repoInfo">
        <span class="platform">{{ repoInfo.platform }}</span>
        <span class="repo-name">{{ repoInfo.owner }}/{{ repoInfo.repo }}</span>
      </div>
    </div>

    <!-- 设置弹出框 -->
    <div class="settings-modal" v-if="showSettings" @click="showSettings = false">
      <div class="settings-content" @click.stop>
        <div class="settings-header">
          <h3>克隆设置</h3>
          <button @click="showSettings = false" class="close-btn">×</button>
        </div>
        <div class="settings-body">
          <div class="setting-item">
            <label>
              <input 
                type="checkbox" 
                v-model="settings.autoCloneSingleBranch"
                @change="saveSettings"
              />
              单分支仓库自动克隆
            </label>
            <small>当仓库只有一个分支时，自动开始克隆而不等待用户选择</small>
          </div>
          <div class="setting-item">
            <label>
              <input 
                type="checkbox" 
                v-model="settings.showProgressDetails"
                @change="saveSettings"
              />
              显示详细进度信息
            </label>
            <small>显示克隆过程中的详细步骤信息</small>
          </div>
          <div class="setting-item">
            <label>默认克隆路径</label>
            <div class="path-input">
              <input 
                v-model="settings.defaultClonePath" 
                type="text" 
                placeholder="设置默认克隆目录"
                readonly
              />
              <button @click="selectDefaultPath" class="select-btn">选择</button>
              <button @click="clearDefaultPath" class="clear-btn" v-if="settings.defaultClonePath">清除</button>
            </div>
            <small>设置后新仓库将默认克隆到此目录下</small>
          </div>
        </div>
      </div>
    </div>

    <div class="form-section">
      <div class="input-group" v-if="branchInfo.branches.length > 1">
        <label>分支选择:</label>
        <select v-model="selectedBranch" :disabled="loadingBranches">
          <option value="">{{ branchInfo.defaultBranch || '默认分支' }}</option>
          <option v-for="branch in branchInfo.branches" :key="branch" :value="branch">
            {{ branch }}
          </option>
        </select>
        <button 
          @click="loadBranches" 
          :disabled="loadingBranches"
          class="refresh-btn"
        >
          {{ loadingBranches ? '加载中...' : '刷新' }}
        </button>
      </div>
      
      <div class="input-group" v-else-if="branchInfo.branches.length === 1">
        <label>分支:</label>
        <div class="single-branch">
          <span class="branch-name">{{ branchInfo.branches[0] }}</span>
          <span class="branch-note">(唯一分支)</span>
        </div>
      </div>

      <div class="info-section" v-if="branchInfo.shouldAutoClone">
        <p class="auto-clone-info">🚀 检测到单分支仓库，将自动克隆</p>
      </div>

      <div class="input-group">
        <label>存储路径:</label>
        <div class="path-input">
          <input v-model="clonePath" type="text" readonly />
          <button @click="selectPath" class="select-btn">选择</button>
          <button @click="useSmartPath" class="smart-btn" v-if="repoInfo && settings.defaultClonePath">
            智能路径
          </button>
        </div>
      </div>

      <div class="progress-section" v-if="cloning">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
          <span class="progress-percentage">{{ progress }}%</span>
        </div>
        <div class="progress-text">{{ progressText }}</div>
      </div>

      <div class="actions">
        <button 
          @click="startClone" 
          :disabled="cloning"
          class="clone-btn"
        >
          {{ cloning ? '克隆中...' : '开始克隆' }}
        </button>
        <button @click="cancel" class="cancel-btn">取消</button>
        <button @click="showSettings = true" class="settings-btn">
          ⚙️ 设置
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  enterAction: {
    type: Object,
    required: true
  }
})

const repoUrl = ref('')
const clonePath = ref('')
const selectedBranch = ref('')
const branchInfo = ref({ branches: [], shouldAutoClone: false, defaultBranch: null })
const loadingBranches = ref(false)
const cloning = ref(false)
const progress = ref(0)
const progressText = ref('')
const repoInfo = ref(null)
const showSettings = ref(false)
const settings = ref({
  defaultClonePath: '',
  autoCloneSingleBranch: false,
  showProgressDetails: true
})

const computedRepoInfo = computed(() => {
  if (!repoUrl.value) return null
  return window.services.extractRepoInfo(repoUrl.value)
})

const loadBranches = async () => {
  if (!repoUrl.value || !window.services.validateGitUrl(repoUrl.value)) {
    return
  }
  
  loadingBranches.value = true
  
  try {
    // 使用智能分支处理
    if (window.services.getSmartBranchInfo) {
      branchInfo.value = await window.services.getSmartBranchInfo(repoUrl.value)
      
      // 如果启用了自动克隆且是单分支，自动开始克隆
      if (branchInfo.value.shouldAutoClone && clonePath.value) {
        selectedBranch.value = branchInfo.value.branches[0]
        // 延迟一点时间让用户看到状态
        setTimeout(() => {
          if (settings.value.autoCloneSingleBranch) {
            startClone()
          }
        }, 1000)
      }
    } else {
      // 兼容旧版本
      const branches = await window.services.getRemoteBranches(repoUrl.value)
      branchInfo.value = {
        branches,
        shouldAutoClone: branches.length === 1,
        defaultBranch: branches.includes('main') ? 'main' : branches.includes('master') ? 'master' : branches[0]
      }
    }
  } catch (error) {
    console.error('加载分支失败:', error)
    window.utools.showNotification('加载分支失败: ' + error.message)
    branchInfo.value = { branches: [], shouldAutoClone: false, defaultBranch: null, error: error.message }
  } finally {
    loadingBranches.value = false
  }
}

const selectPath = () => {
  try {
    const result = window.utools.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: clonePath.value || 'C:\\'
    })
    
    console.log('选择路径结果:', result)
    
    if (result && result.length > 0) {
      const repoName = repoInfo.value?.repo || 'repository'
      // 使用Windows路径分隔符，因为这是Windows环境
      const separator = '\\'
      clonePath.value = result[0] + separator + repoName
      console.log('设置克隆路径:', clonePath.value)
    } else {
      console.log('用户取消选择或选择失败')
    }
  } catch (error) {
    console.error('选择路径时出错:', error)
    window.utools.showNotification('选择路径失败: ' + error.message)
  }
}

const startClone = async () => {
  if (!repoUrl.value || cloning.value) return
  
  console.log('开始克隆:', {
    repoUrl: repoUrl.value,
    clonePath: clonePath.value,
    selectedBranch: selectedBranch.value
  })
  
  cloning.value = true
  progress.value = 0
  progressText.value = '准备克隆...'
  
  try {
    // 验证必要参数
    if (!window.services) {
      throw new Error('services对象未定义')
    }
    
    if (!window.services.cloneRepository) {
      throw new Error('cloneRepository方法未定义')
    }
    
    const result = await window.services.cloneRepository(
      repoUrl.value,
      clonePath.value,
      selectedBranch.value || null,
      (message, percent) => {
        console.log('克隆进度:', message, percent + '%')
        progressText.value = message
        progress.value = percent
      }
    )
    
    console.log('克隆结果:', result)
    
    if (result.success) {
      window.utools.showNotification('克隆完成！')
      progressText.value = '克隆成功'
      
      // 尝试打开文件夹
      try {
        window.services.openFolder(result.path)
      } catch (error) {
        console.log('无法打开文件夹:', error)
      }
      
      // 关闭插件
      setTimeout(() => {
        window.utools.hideMainWindow()
      }, 1500)
    } else {
      window.utools.showNotification('克隆失败: ' + result.error)
      progressText.value = result.error
    }
  } catch (error) {
    console.error('克隆过程出错:', error)
    window.utools.showNotification('克隆过程中发生错误: ' + error.message)
    progressText.value = '克隆失败'
  } finally {
    cloning.value = false
  }
}

const cancel = () => {
  window.utools.hideMainWindow()
}

// 加载用户设置
const loadSettings = () => {
  if (window.services && window.services.getUserSettings) {
    const userSettings = window.services.getUserSettings()
    settings.value = { ...settings.value, ...userSettings }
  }
}

// 保存用户设置
const saveSettings = () => {
  if (window.services && window.services.saveUserSettings) {
    window.services.saveUserSettings(settings.value)
  }
}

// 选择默认路径
const selectDefaultPath = async () => {
  try {
    const result = await window.utools.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择默认克隆目录'
    })
    
    if (result && result.length > 0) {
      settings.value.defaultClonePath = result[0]
      saveSettings()
    }
  } catch (error) {
    console.error('选择默认路径失败:', error)
  }
}

// 清除默认路径
const clearDefaultPath = () => {
  settings.value.defaultClonePath = ''
  saveSettings()
}

// 使用智能路径
const useSmartPath = () => {
  if (repoInfo.value && window.services.getSmartDefaultPath) {
    const smartPath = window.services.getSmartDefaultPath(repoInfo.value)
    if (smartPath) {
      clonePath.value = smartPath
    }
  }
}

// 监听器
watch(repoInfo, async (newInfo) => {
  if (newInfo) {
    // 获取默认路径：优先使用当前资源管理器路径
    let basePath
    try {
      basePath = await window.services.getCurrentExplorerPath() || window.services.getDefaultClonePath()
    } catch {
      basePath = window.services.getDefaultClonePath()
    }
    // 使用Windows路径分隔符，因为这是Windows环境
    const separator = '\\'
    clonePath.value = basePath + separator + newInfo.repo
  }
})

// 生命周期
onMounted(() => {
  loadSettings()
  if (props.enterAction && props.enterAction.payload) {
    repoUrl.value = props.enterAction.payload
    repoInfo.value = window.services.extractRepoInfo(repoUrl.value)
    // 自动加载分支
    loadBranches()
  }
})
</script>

<style scoped>
.git-clone-branch {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header h3 {
  margin: 0;
  color: #333;
  font-size: 20px;
  font-weight: 600;
}

.settings-btn {
  padding: 10px 20px;
  background: #f6f8fa;
  color: #586069;
  border: 1px solid #d1d5da;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  white-space: nowrap;
}

.settings-btn:hover {
  background: #e1e4e8;
}

.settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e1e5e9;
}

.settings-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.settings-body {
  padding: 20px;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  font-weight: 500;
  margin-bottom: 5px;
}

.setting-item input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.setting-item small {
  display: block;
  color: #666;
  font-size: 12px;
  margin-top: 5px;
  line-height: 1.4;
}

.repo-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.platform {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.repo-name {
  font-weight: 600;
  color: #586069;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.input-group label {
  font-weight: 500;
  color: #24292e;
  font-size: 14px;
}

.input-group select,
.input-group input {
  padding: 8px 12px;
  border: 1px solid #d1d5da;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  box-sizing: border-box;
}

.input-group select:focus,
.input-group input:focus {
  outline: none;
  border-color: #0366d6;
  box-shadow: 0 0 0 3px rgba(3, 102, 214, 0.1);
}

.path-input {
  display: flex;
  gap: 8px;
}

.path-input input {
  flex: 1;
  background: #f6f8fa;
}

.refresh-btn,
.select-btn,
.smart-btn,
.clear-btn {
  padding: 8px 12px;
  background: #f6f8fa;
  border: 1px solid #d1d5da;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  transition: all 0.2s;
}

.refresh-btn:hover,
.select-btn:hover {
  background: #e1e4e8;
}

.smart-btn {
  background: #e3f2fd;
  border-color: #2196f3;
  color: #1976d2;
}

.smart-btn:hover {
  background: #bbdefb;
}

.clear-btn {
  background: #ffebee;
  border-color: #f44336;
  color: #d32f2f;
}

.clear-btn:hover {
  background: #ffcdd2;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-section {
  margin: 15px 0;
}

.auto-clone-info {
  background: #e8f5e8;
  border: 1px solid #4caf50;
  border-radius: 6px;
  padding: 10px;
  margin: 0;
  font-size: 14px;
  color: #2e7d32;
  text-align: center;
}

.progress-section {
  margin: 10px 0;
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 24px;
  background: #e1e4e8;
  border-radius: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #34d058);
  transition: width 0.3s ease;
  border-radius: 12px;
}

.progress-percentage {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  font-weight: 600;
  color: #333;
  text-shadow: 0 0 3px rgba(255,255,255,0.8);
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
  color: #586069;
  font-weight: 500;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.clone-btn {
  flex: 1;
  padding: 10px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.2s;
}

.clone-btn:hover:not(:disabled) {
  background: #22863a;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.clone-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 10px 20px;
  background: #f6f8fa;
  color: #586069;
  border: 1px solid #d1d5da;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #e1e4e8;
}

.single-branch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #f0f8ff;
  border: 1px solid #b3d9ff;
  border-radius: 6px;
}

.branch-name {
  font-weight: 600;
  color: #1976d2;
}

.branch-note {
  font-size: 12px;
  color: #666;
}
</style>