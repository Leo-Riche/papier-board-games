<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app-wrapper">
    <RouterView />
  </div>
</template>

<style>
:root {
  font-family: 'Inter', sans-serif;
  background-color: #121212;
  color: #ffffff;
}

body {
  margin: 0;
  padding: 0;
}

.app-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>