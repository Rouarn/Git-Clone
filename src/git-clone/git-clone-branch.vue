<template>
  <div class="git-clone-branch">
    <div class="header">
      <h3>分支克隆</h3>
      <div class="repo-info" v-if="repoInfo">
        <span class="platform">{{ repoInfo.platform }}</span>
        <span class="repo-name">{{ repoInfo.owner }}/{{ repoInfo.repo }}</span>
      </div>
    </div>

    <!-- Git仓库输入框 -->
    <div class="repo-input-section" v-if="!hasInitialRepo">
      <div class="input-group">
        <label>Git仓库地址:</label>
        <div class="repo-input">
          <input
            v-model="manualRepoUrl"
            type="text"
            placeholder="请输入Git仓库URL (支持HTTPS/SSH格式)"
            @input="onRepoUrlInput"
            @keyup.enter="confirmRepoUrl"
            :class="{ error: repoUrlError }"
          />
          <button
            @click="confirmRepoUrl"
            :disabled="!manualRepoUrl.trim() || loadingBranches"
            class="confirm-btn"
          >
            {{ loadingBranches ? "验证中..." : "确认" }}
          </button>
        </div>
        <div class="input-hint error-hint" v-if="repoUrlError">
          {{ repoUrlError }}
        </div>
        <div class="input-hint" v-else>
          支持GitHub、GitLab、Gitee等平台的HTTPS和SSH格式
        </div>
      </div>
    </div>

    <!-- 设置弹出框 -->
    <div
      class="settings-modal"
      v-if="showSettings"
      @click="showSettings = false"
    >
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
              <button @click="selectDefaultPath" class="select-btn">
                选择
              </button>
              <button
                @click="clearDefaultPath"
                class="clear-btn"
                v-if="settings.defaultClonePath"
              >
                清除
              </button>
            </div>
            <small>设置后新仓库将默认克隆到此目录下</small>
          </div>
        </div>
      </div>
    </div>

    <div class="form-section">
      <div class="input-group" v-if="branchInfo.branches.length > 1">
        <label>分支选择:</label>
        <div class="custom-select" :class="{ disabled: loadingBranches, open: dropdownOpen }">
          <div class="select-trigger" @click="toggleDropdown" :disabled="loadingBranches">
            <span class="selected-text">{{ selectedBranch || branchInfo.defaultBranch || "默认分支" }}</span>
            <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </div>
          <div class="dropdown-menu" v-show="dropdownOpen">
            <div 
              class="dropdown-item" 
              :class="{ selected: selectedBranch === '' }"
              @click="selectBranch('')"
            >
              {{ branchInfo.defaultBranch || "默认分支" }}
            </div>
            <div 
              v-for="branch in branchInfo.branches"
              :key="branch"
              class="dropdown-item"
              :class="{ selected: selectedBranch === branch }"
              @click="selectBranch(branch)"
            >
              {{ branch }}
            </div>
          </div>
        </div>
        <button
          @click="loadBranches"
          :disabled="loadingBranches"
          class="refresh-btn"
        >
          <svg 
            v-if="!loadingBranches" 
            class="refresh-icon" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4a9 9 0 0 1-14.85 4.36L3 14"/>
          </svg>
          <svg 
            v-else 
            class="loading-icon" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          <span>{{ loadingBranches ? "加载中..." : "刷新" }}</span>
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
          <button @click="useSmartPath" class="smart-btn" v-if="repoInfo">
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
        <button @click="startClone" :disabled="cloning" class="clone-btn">
          {{ cloning ? "克隆中..." : "开始克隆" }}
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
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

const props = defineProps({
  enterAction: {
    type: Object,
    required: true,
  },
});

const repoUrl = ref("");
const manualRepoUrl = ref("");
const repoUrlError = ref("");
const hasInitialRepo = ref(false);
const clonePath = ref("");
const selectedBranch = ref("");
const dropdownOpen = ref(false);
const branchInfo = ref({
  branches: [],
  shouldAutoClone: false,
  defaultBranch: null,
});
const loadingBranches = ref(false);
const cloning = ref(false);
const progress = ref(0);
const progressText = ref("");
const repoInfo = ref(null);
const showSettings = ref(false);
const settings = ref({
  defaultClonePath: "",
  autoCloneSingleBranch: false,
  showProgressDetails: true,
});

const computedRepoInfo = computed(() => {
  if (!repoUrl.value) return null;
  return window.services.extractRepoInfo(repoUrl.value);
});

const loadBranches = async () => {
  if (!repoUrl.value || !window.services.validateGitUrl(repoUrl.value)) {
    return;
  }

  loadingBranches.value = true;

  // 显示开始加载的提示
  showNotification("正在获取仓库分支信息...");

  try {
    // 使用智能分支处理
    if (window.services.getSmartBranchInfo) {
      branchInfo.value = await window.services.getSmartBranchInfo(
        repoUrl.value
      );

      // 如果启用了自动克隆且是单分支，自动开始克隆
      if (branchInfo.value.shouldAutoClone && clonePath.value) {
        selectedBranch.value = branchInfo.value.branches[0];
        // 延迟一点时间让用户看到状态
        setTimeout(() => {
          if (settings.value.autoCloneSingleBranch) {
            startClone();
          }
        }, 1000);
      }
    } else {
      // 兼容旧版本
      const branches = await window.services.getRemoteBranches(repoUrl.value);
      branchInfo.value = {
        branches,
        shouldAutoClone: branches.length === 1,
        defaultBranch: branches.includes("main")
          ? "main"
          : branches.includes("master")
          ? "master"
          : branches[0],
      };
    }

    // 成功获取分支后的提示
    const branchCount = branchInfo.value.branches.length;
    if (branchCount > 0) {
      showNotification(`成功获取到 ${branchCount} 个分支`);
    } else {
      showNotification("未找到任何分支");
    }
  } catch (error) {
    console.error("加载分支失败:", error);
    showNotification("❌ 加载分支失败: " + error.message);
    branchInfo.value = {
      branches: [],
      shouldAutoClone: false,
      defaultBranch: null,
      error: error.message,
    };
  } finally {
    loadingBranches.value = false;
  }
};

const selectPath = () => {
  try {
    // 获取跨平台的默认路径
    const defaultPath =
      clonePath.value || window.services.getDefaultClonePath();

    const result = window.utools.showOpenDialog({
      properties: ["openDirectory"],
      defaultPath: defaultPath,
    });

    if (result && result.length > 0) {
      const repoName = repoInfo.value?.repo || "repository";
      // 使用window.services的路径拼接方法
      if (window.services.joinPath) {
        clonePath.value = window.services.joinPath(result[0], repoName);
      } else {
        // 简单的路径拼接作为后备方案
        clonePath.value =
          result[0] +
          (result[0].endsWith("\\") || result[0].endsWith("/") ? "" : "\\") +
          repoName;
      }
    }
  } catch (error) {
    showNotification("选择路径失败: " + error.message);
  }
};

const startClone = async () => {
  if (!repoUrl.value || cloning.value) return;

  console.log("开始克隆:", {
    repoUrl: repoUrl.value,
    clonePath: clonePath.value,
    selectedBranch: selectedBranch.value,
  });

  cloning.value = true;
  progress.value = 0;
  progressText.value = "准备克隆...";

  try {
    // 验证必要参数
    if (!window.services) {
      throw new Error("services对象未定义");
    }

    if (!window.services.cloneRepository) {
      throw new Error("cloneRepository方法未定义");
    }

    const result = await window.services.cloneRepository(
      repoUrl.value,
      clonePath.value,
      selectedBranch.value || null,
      (message, percent) => {
        progressText.value = message;
        progress.value = percent;
      }
    );

    if (result.success) {
      showNotification("克隆完成！");
      progressText.value = "克隆成功";

      // 尝试打开文件夹
      try {
        window.services.openFolder(result.path);
      } catch (error) {}

      // 关闭插件
      setTimeout(() => {
        window.utools.hideMainWindow();
      }, 1500);
    } else {
      showNotification("克隆失败: " + result.error);
      progressText.value = result.error;
    }
  } catch (error) {
    showNotification("克隆过程中发生错误: " + error.message);
    progressText.value = "克隆失败";
  } finally {
    cloning.value = false;
  }
};

// 自定义下拉组件控制函数
const toggleDropdown = () => {
  if (!loadingBranches.value) {
    dropdownOpen.value = !dropdownOpen.value;
  }
};

const selectBranch = (branch) => {
  selectedBranch.value = branch;
  dropdownOpen.value = false;
};

// 点击外部关闭下拉菜单
const closeDropdown = (event) => {
  if (!event.target.closest('.custom-select')) {
    dropdownOpen.value = false;
  }
};

// 通知函数 - 兼容开发环境和生产环境
const showNotification = (message, type = 'info') => {
  if (typeof window !== 'undefined' && window.utools && window.utools.showNotification) {
    // 生产环境 - 使用utools通知
    window.utools.showNotification(message);
  } else {
    // 开发环境 - 使用浏览器通知或console
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Git Clone', { body: message });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Git Clone', { body: message });
        } else {
          console.log(`[通知] ${message}`);
        }
      });
    } else {
      console.log(`[通知] ${message}`);
    }
  }
};

const cancel = () => {
  window.utools.hideMainWindow();
};

// 加载用户设置
const loadSettings = () => {
  if (window.services && window.services.getUserSettings) {
    const userSettings = window.services.getUserSettings();
    settings.value = { ...settings.value, ...userSettings };
  }
};

// 保存用户设置
const saveSettings = () => {
  if (window.services && window.services.saveUserSettings) {
    window.services.saveUserSettings(settings.value);
  }
};

// 选择默认路径
const selectDefaultPath = async () => {
  try {
    const result = await window.utools.showOpenDialog({
      properties: ["openDirectory"],
      title: "选择默认克隆目录",
    });

    if (result && result.length > 0) {
      settings.value.defaultClonePath = result[0];
      saveSettings();
    }
  } catch (error) {}
};

// 清除默认路径
const clearDefaultPath = () => {
  settings.value.defaultClonePath = "";
  saveSettings();
};

// 使用智能路径
const useSmartPath = () => {
  if (repoInfo.value && window.services.getSmartDefaultPath) {
    const smartPath = window.services.getSmartDefaultPath(repoInfo.value);
    if (smartPath) {
      clonePath.value = smartPath;
    }
  }
};

// 自动设置克隆路径
const setAutoClonePath = async repoInfo => {
  if (!repoInfo) return;

  try {
    // 优先使用用户设置的默认克隆路径
    if (settings.value.defaultClonePath) {
      // 使用window.services的路径拼接方法
      if (window.services.joinPath) {
        clonePath.value = window.services.joinPath(
          settings.value.defaultClonePath,
          repoInfo.repo
        );
      } else {
        // 简单的路径拼接作为后备方案
        clonePath.value =
          settings.value.defaultClonePath +
          (settings.value.defaultClonePath.endsWith("\\") ||
          settings.value.defaultClonePath.endsWith("/")
            ? ""
            : "\\") +
          repoInfo.repo;
      }
    } else {
      // 否则获取智能路径：优先使用当前资源管理器路径
      let basePath;
      try {
        basePath =
          (await window.services.getCurrentExplorerPath()) ||
          window.services.getDefaultClonePath();
      } catch {
        basePath = window.services.getDefaultClonePath();
      }

      // 使用window.services的路径拼接方法
      if (window.services.joinPath) {
        clonePath.value = window.services.joinPath(basePath, repoInfo.repo);
      } else {
        // 简单的路径拼接作为后备方案
        clonePath.value =
          basePath +
          (basePath.endsWith("\\") || basePath.endsWith("/") ? "" : "\\") +
          repoInfo.repo;
      }
    }
  } catch (error) {
    console.error("设置自动克隆路径失败:", error);
  }
};

// 处理手动输入仓库URL
const onRepoUrlInput = () => {
  repoUrlError.value = "";
};

// 确认仓库URL
const confirmRepoUrl = async () => {
  const url = manualRepoUrl.value.trim();
  if (!url) {
    repoUrlError.value = "请输入Git仓库地址";
    return;
  }

  // 验证URL格式
  if (!window.services.validateGitUrl(url)) {
    repoUrlError.value = "无效的Git仓库地址格式";
    return;
  }

  // 设置仓库URL并加载分支
  repoUrl.value = url;
  repoInfo.value = window.services.extractRepoInfo(url);
  repoUrlError.value = "";

  // 加载分支信息
  await loadBranches();
};

// 监听器
watch(repoInfo, async newInfo => {
  if (newInfo) {
    await setAutoClonePath(newInfo);
  }
});

// 组件卸载时移除事件监听器
onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});

// 生命周期
onMounted(async () => {
  // 添加全局点击事件监听器
  document.addEventListener('click', closeDropdown);
  loadSettings();
  if (props.enterAction && props.enterAction.payload !== "git克隆") {
    repoUrl.value = props.enterAction.payload;
    repoInfo.value = window.services.extractRepoInfo(repoUrl.value);
    hasInitialRepo.value = true;

    // 自动设置克隆路径
    await setAutoClonePath(repoInfo.value);

    // 自动加载分支
    loadBranches();
  } else {
    hasInitialRepo.value = false;

    // 即使没有初始仓库，也尝试设置默认路径
    if (settings.value.defaultClonePath) {
      // 如果有默认路径设置，先设置一个基础路径
      clonePath.value = settings.value.defaultClonePath;
    }
  }
});
</script>

<style lang="scss" scoped>
.git-clone-branch {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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

.repo-input-section {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
}

.repo-input {
  display: flex;
  gap: 10px;
  align-items: center;
}

.repo-input input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  background: #ffffff;
  transition: border-color 0.3s ease;
}

.repo-input input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
}

.repo-input input.error {
  border-color: #dc3545;
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
}

.confirm-btn {
  padding: 5px 0;
  background: linear-gradient(135deg, #007acc, #0056b3);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.3);
  min-width: 100px;
  white-space: nowrap;
}

.confirm-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0056b3, #004085);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 122, 204, 0.4);
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.input-hint {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
  line-height: 1.4;
}

.error-hint {
  color: #dc3545;
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
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  background: linear-gradient(135deg, #ffffff, #f8f9fa);
  box-sizing: border-box;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  font-weight: 500;
  color: #333;
}

.input-group select:focus,
.input-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #ffffff, #f0f4ff);
  transform: translateY(-1px);
}

.input-group select:hover {
  border-color: #b3c6ff;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.input-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: linear-gradient(135deg, #f5f5f5, #e9ecef);
  transform: none;
}

.input-group select option {
  padding: 12px 16px;
  background: white;
  color: #333;
  font-weight: 500;
  border: none;
}

.input-group select option:hover {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.input-group select option:checked {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
}

/* 自定义下拉组件样式 */
.custom-select {
  position: relative;
  width: 100%;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  background: linear-gradient(135deg, #ffffff, #f8f9fa);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  font-weight: 500;
  color: #333;
  user-select: none;
}

.select-trigger:hover {
  border-color: #b3c6ff;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.custom-select.open .select-trigger {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #ffffff, #f0f4ff);
  transform: translateY(-1px);
}

.custom-select.disabled .select-trigger {
  opacity: 0.6;
  cursor: not-allowed;
  background: linear-gradient(135deg, #f5f5f5, #e9ecef);
  transform: none;
}

.selected-text {
  flex: 1;
  text-align: left;
}

.dropdown-arrow {
  width: 16px;
  height: 16px;
  margin-left: 8px;
  transition: transform 0.3s ease;
  flex-shrink: 0;
}

.custom-select.open .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #667eea;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  animation: dropdownSlide 0.2s ease-out;
}

@keyframes dropdownSlide {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  transform: translateX(2px);
}

.dropdown-item.selected {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
  position: relative;
}

.dropdown-item.selected::after {
  content: '✓';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-weight: bold;
}

.path-input {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.path-input input {
  flex: 1;
  min-width: 200px;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  background: #ffffff;
  transition: border-color 0.3s ease;
}

.path-input input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
}

.refresh-btn {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  min-width: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  position: relative;
  overflow: hidden;
}

.refresh-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.refresh-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
}

.refresh-btn:hover:not(:disabled)::before {
  left: 100%;
}

.refresh-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.refresh-btn:disabled {
  background: linear-gradient(135deg, #a0aec0 0%, #718096 100%);
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

.refresh-icon,
.loading-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.refresh-icon {
  transition: transform 0.3s ease;
}

.refresh-btn:hover:not(:disabled) .refresh-icon {
  transform: rotate(180deg);
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.refresh-btn span {
  font-size: 13px;
  font-weight: 600;
}

.select-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #007acc, #0056b3);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.3);
  min-width: 80px;
  white-space: nowrap;
}

.select-btn:hover {
  background: linear-gradient(135deg, #0056b3, #004085);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 122, 204, 0.4);
}

.select-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.3);
}

.smart-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
  margin-left: 8px;
  min-width: 100px;
  white-space: nowrap;
}

.smart-btn:hover {
  background: linear-gradient(135deg, #20c997, #17a2b8);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
}

.smart-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.clear-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #dc3545, #c82333);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  margin-left: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
  white-space: nowrap;
}

.clear-btn:hover {
  background: linear-gradient(135deg, #c82333, #bd2130);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(220, 53, 69, 0.4);
}

.clear-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
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
  text-shadow: 0 0 3px rgba(255, 255, 255, 0.8);
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
