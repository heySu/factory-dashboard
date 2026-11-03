<template>
  <nav class="nav">
    <div class="nav__list">
      <router-link v-for="(r, i) in items" :key="r.path" :to="r.path" class="nav__item">
        <span class="nav__idx">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="nav__label">{{ r.meta.title }}</span>
        <i class="nav__line"></i>
      </router-link>
    </div>

    <div class="nav__tools">
      <button class="tool-btn" :class="{ 'is-on': autoplay }" @click="$emit('toggle-autoplay')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7" />
          <path d="M17 3v4h-4M7 21v-4h4" />
        </svg>
        <span>自动轮播 {{ autoplay ? '开' : '关' }}</span>
      </button>
      <span class="nav__sec">{{ autoSeconds }}s / 页</span>
    </div>
  </nav>
</template>

<script setup>
import { routes } from '@/router'

defineProps({
  autoplay: { type: Boolean, default: true },
  autoSeconds: { type: Number, default: 20 }
})
defineEmits(['toggle-autoplay'])

// 过滤掉 redirect 与 404
const items = routes.filter((r) => r.meta && r.meta.title)
</script>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 0 20px;
  flex-shrink: 0;
  position: relative;
}

.nav__list {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
}

.nav__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 18px;
  text-decoration: none;
  color: var(--text-sub);
  font-size: 14px;
  letter-spacing: 1px;
  background: linear-gradient(180deg, rgba(18, 52, 92, 0.55), rgba(10, 28, 52, 0.35));
  border: 1px solid rgba(46, 108, 170, 0.26);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  transition: all 0.22s ease;
}

.nav__item:hover {
  color: #cfe9ff;
  border-color: rgba(51, 214, 255, 0.45);
}

.nav__idx {
  font-family: var(--font-num);
  font-size: 10px;
  color: rgba(110, 165, 210, 0.65);
  letter-spacing: 0.5px;
}

.nav__label {
  white-space: nowrap;
}

.nav__line {
  position: absolute;
  left: 14%;
  right: 14%;
  bottom: -1px;
  height: 2px;
  background: var(--c-cyan);
  box-shadow: 0 0 12px var(--c-cyan);
  opacity: 0;
  transition: opacity 0.22s;
}

.nav__item.is-active,
.nav__item.router-link-active {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(45, 130, 220, 0.55), rgba(20, 64, 116, 0.45));
  border-color: rgba(51, 214, 255, 0.72);
  box-shadow: 0 0 18px rgba(51, 214, 255, 0.22), inset 0 0 18px rgba(51, 214, 255, 0.14);
}
.nav__item.router-link-active .nav__idx {
  color: var(--c-cyan);
}
.nav__item.router-link-active .nav__line {
  opacity: 1;
}

.nav__tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 11px;
  font-size: 12px;
  color: var(--text-sub);
  border: 1px solid rgba(46, 108, 170, 0.35);
  border-radius: 3px;
  background: rgba(12, 36, 64, 0.5);
  transition: all 0.2s;
}
.tool-btn:hover {
  color: #cfe9ff;
  border-color: rgba(51, 214, 255, 0.5);
}
.tool-btn.is-on {
  color: var(--c-cyan);
  border-color: rgba(51, 214, 255, 0.55);
  background: rgba(51, 214, 255, 0.1);
}

.nav__sec {
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-num);
}
</style>
