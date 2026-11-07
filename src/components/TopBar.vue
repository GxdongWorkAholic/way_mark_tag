<script setup>
import { toggleTheme } from '../core/store'
import { ui } from '../core/ui'
</script>

<template>
  <header class="topbar">
    <div class="brand"><span class="brand-dot" aria-hidden="true"></span>起始页</div>
    <div class="top-actions">
      <button type="button" class="icon-btn" id="themeToggle" aria-label="切换明暗主题" @click="toggleTheme">
        <svg class="od-icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none"/></svg>
      </button>
      <button type="button" class="icon-btn" id="settingsBtn" aria-haspopup="dialog" aria-controls="settingsDialog" @click="ui.settings.open = true">
        <svg class="od-icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="17" r="2"/></svg>
        <span class="btn-label">设置</span>
      </button>
    </div>
  </header>
</template>
