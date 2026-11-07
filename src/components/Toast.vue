<script setup>
import { ui } from '../core/ui'
</script>

<template>
  <div class="toast" id="toast" role="status" aria-live="polite" :class="{ show: ui.toast.visible }">{{ ui.toast.text }}</div>
</template>
