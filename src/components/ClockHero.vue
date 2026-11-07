<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const clockTime = ref('00:00')
const clockSec = ref('00')
const greeting = ref('你好')
const today = ref('')
const datetime = ref('')

let lastMinute = -1

function greetingFor(hour) {
  if (hour < 5) return '夜深了，注意休息'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function tick() {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  clockTime.value = hh + ':' + mm
  clockSec.value = ss
  datetime.value = now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0') + 'T' + hh + ':' + mm

  if (now.getMinutes() !== lastMinute) {
    lastMinute = now.getMinutes()
    greeting.value = greetingFor(now.getHours())
    today.value = (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日 · 星期'
      + '日一二三四五六'.charAt(now.getDay())
  }
}

let timer = 0

onMounted(() => {
  tick()
  timer = window.setInterval(tick, 1000)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <p class="greeting" id="greeting">{{ greeting }}</p>
  <div class="clock">
    <time class="clock-time" id="clockTime" :datetime="datetime">{{ clockTime }}</time>
    <span class="clock-sec" id="clockSec" aria-hidden="true">{{ clockSec }}</span>
  </div>
  <p class="today" id="today">{{ today }}</p>
</template>
