<script setup>
import TopBar from './components/TopBar.vue'
import ClockHero from './components/ClockHero.vue'
import SearchBar from './components/SearchBar.vue'
import Board from './components/Board.vue'
import SiteDialog from './components/SiteDialog.vue'
import PromptDialog from './components/PromptDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import MoveDialog from './components/MoveDialog.vue'
import LinkMenu from './components/LinkMenu.vue'
import CtxMenu from './components/CtxMenu.vue'
import Toast from './components/Toast.vue'
</script>

<template>
  <div class="app">
    <TopBar />
    <main class="main">
      <section class="hero" aria-labelledby="greeting">
        <ClockHero />
        <SearchBar />
      </section>
      <Board />
    </main>
  </div>

  <SiteDialog />
  <PromptDialog />
  <SettingsDialog />
  <ConfirmDialog />
  <MoveDialog />

  <LinkMenu />
  <CtxMenu />
  <Toast />
</template>
