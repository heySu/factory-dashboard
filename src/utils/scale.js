import { ref, onMounted, onBeforeUnmount } from 'vue'

export const DESIGN_WIDTH = 1920
export const DESIGN_HEIGHT = 1080

/**
 * 大屏等比缩放
 * 以 1920x1080 为设计基准，按 min(宽比, 高比) 缩放并居中，保证任何分辨率下不变形。
 */
export function useScreenScale() {
  const scale = ref(1)
  const offsetX = ref(0)
  const offsetY = ref(0)

  const resize = () => {
    const sw = window.innerWidth
    const sh = window.innerHeight
    const s = Math.min(sw / DESIGN_WIDTH, sh / DESIGN_HEIGHT)
    scale.value = s
    offsetX.value = (sw - DESIGN_WIDTH * s) / 2
    offsetY.value = (sh - DESIGN_HEIGHT * s) / 2
  }

  let timer = null
  const onResize = () => {
    clearTimeout(timer)
    timer = setTimeout(resize, 100)
  }

  onMounted(() => {
    resize()
    window.addEventListener('resize', onResize)
  })

  onBeforeUnmount(() => {
    clearTimeout(timer)
    window.removeEventListener('resize', onResize)
  })

  return { scale, offsetX, offsetY }
}
