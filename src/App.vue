<script setup>
import { ref, onMounted } from "vue";
import GitCloneBranch from "./git-clone/git-clone-branch.vue";

const route = ref("");
const enterAction = ref({});

onMounted(() => {
  if (window.utools) {
    // 监听插件进入事件
    window.utools.onPluginEnter(action => {
      console.log("插件进入:", action);
      route.value = action.code;
      enterAction.value = action;
    });

    window.utools.onPluginOut(isKill => {
      route.value = "";
    });
  }
});
</script>

<template>
  <div class="app-container">
    <GitCloneBranch v-if="route === 'git-clone'" :enter-action="enterAction" />
    <h1 v-else>插件未加载</h1>
  </div>
</template>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
