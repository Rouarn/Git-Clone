<script setup>
import { ref, onMounted } from "vue";
import GitCloneBranch from "./GitClone/GitCloneBranch.vue";

const route = ref("");
const enterAction = ref({});

onMounted(() => {
  // 开发环境模拟utools对象
  if (!window.utools) {
    window.utools = {
      onPluginEnter: (callback) => {
        // 模拟插件进入事件
        setTimeout(() => {
          callback({ code: 'git-clone', type: 'over', payload: '' })
        }, 100)
      },
      onPluginOut: (callback) => {
        // 模拟插件退出事件
      },
      showNotification: (text) => {
        console.log('通知:', text)
      },
      hideMainWindow: () => {
        console.log('隐藏主窗口')
      },
      outPlugin: () => {
        console.log('退出插件')
      },
      showOpenDialog: (options) => {
        return new Promise((resolve) => {
          // 模拟文件选择对话框
          resolve(['C:\\Users\\Default\\Downloads'])
        })
      }
    }
  }

  // 开发环境模拟services对象
  if (!window.services) {
    const mockSettings = {
      defaultClonePath: '',
      autoCloneSingleBranch: false,
      showProgressDetails: true
    };
    
    window.services = {
      validateGitUrl: (url) => {
        const patterns = [
          /^https?:\/\/(www\.)?(github\.com|gitlab\.com|gitee\.com|bitbucket\.org)\/[\w\.-]+\/[\w\.-]+(\.git)?\/?$/i,
          /^git@(github\.com|gitlab\.com|gitee\.com|bitbucket\.org):[\w\.-]+\/[\w\.-]+(\.git)?$/i
        ];
        return patterns.some(pattern => pattern.test(url.trim()));
      },
      extractRepoInfo: (url) => {
        const match = url.match(/\/([\w\.-]+)\/([\w\.-]+)(\.git)?/);
        if (match) {
          return {
            platform: 'github.com',
            owner: match[1],
            name: match[2].replace(/\.git$/, '')
          };
        }
        return null;
      },
      getUserSettings: () => {
        return { ...mockSettings };
      },
      saveUserSettings: (settings) => {
        Object.assign(mockSettings, settings);
        console.log('保存设置:', settings);
        return true;
      },
      getSmartDefaultPath: (repoInfo) => {
        if (mockSettings.defaultClonePath) {
          return `${mockSettings.defaultClonePath}\\${repoInfo.name}`;
        }
        return `C:\\Rouarn\\DEV\\${repoInfo.name}`;
      },
      getRemoteBranches: async (repoUrl) => {
        // 模拟获取分支
        await new Promise(resolve => setTimeout(resolve, 500));
        return ['main', 'develop', 'feature/test'];
      },
      getSmartBranchInfo: async (repoUrl) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        const branches = ['main'];
        return {
          branches,
          shouldAutoClone: mockSettings.autoCloneSingleBranch && branches.length === 1,
          defaultBranch: 'main'
        };
      },
      cloneRepository: async (repoUrl, targetPath, branch, onProgress) => {
        console.log('模拟克隆:', { repoUrl, targetPath, branch });
        
        // 模拟详细进度
        if (onProgress) {
          const steps = [
            { message: '正在连接远程仓库...', progress: 5 },
            { message: '正在解析仓库地址...', progress: 10 },
            { message: '正在建立连接...', progress: 20 },
            { message: '正在下载对象...', progress: 40 },
            { message: '正在接收对象...', progress: 70 },
            { message: '正在解压对象...', progress: 90 },
            { message: '克隆完成！', progress: 100 }
          ];
          
          for (const step of steps) {
            onProgress(step.message, step.progress);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
        
        return {
          success: true,
          path: targetPath,
          message: `仓库已成功克隆到: ${targetPath}`,
          branch: branch || 'main'
        };
      }
    };
  }

  // 监听插件进入事件
  window.utools.onPluginEnter((action) => {
    console.log("插件进入:", action);
    route.value = action.code;
    enterAction.value = action;
  });

  window.utools.onPluginOut((isKill) => {
    route.value = "";
  });
});


</script>

<template>
  <div class="app-container">
    <GitCloneBranch
      v-if="route === 'git-clone'"
      :enter-action="enterAction"
    />
  </div>
</template>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
