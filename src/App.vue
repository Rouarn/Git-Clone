<script setup>
import { ref, onMounted } from "vue";
import GitCloneBranch from "./GitClone/GitCloneBranch.vue";

const route = ref("");
const enterAction = ref({});

onMounted(() => {
  // 监听插件进入事件
  window.utools.onPluginEnter(action => {
    console.log("插件进入:", action);
    route.value = action.code;
    enterAction.value = action;
  });

  window.utools.onPluginOut(isKill => {
    route.value = "";
  });
});
</script>

<template>
  <div class="app-container">
    <GitCloneBranch v-if="route === 'git-clone'" :enter-action="enterAction" />
  </div>
</template>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
