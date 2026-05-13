<template>
  <div class="app-container">
    <div v-if="!isPicking" class="main-panel">
      <div class="tabs">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'picker' }"
          @click="activeTab = 'picker'"
        >
          取色器
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'converter' }"
          @click="activeTab = 'converter'"
        >
          颜色转换
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'contrast' }"
          @click="activeTab = 'contrast'"
        >
          对比度
        </button>
      </div>

      <div v-if="activeTab === 'picker'" class="tab-content">
        <div class="current-color" :style="{ backgroundColor: currentColor.hex }">
          <div class="color-info">
            <p><strong>HEX:</strong> {{ currentColor.hex }}</p>
            <p><strong>RGB:</strong> rgb({{ currentColor.r }}, {{ currentColor.g }}, {{ currentColor.b }})</p>
            <p><strong>HSL:</strong> hsl({{ currentColorHSL.h }}, {{ currentColorHSL.s }}%, {{ currentColorHSL.l }}%)</p>
          </div>
        </div>
        
        <button @click="startPicking" class="pick-btn">
          取色 (Ctrl+Shift+C)
        </button>
        
        <div class="history-section">
          <h2>历史记录</h2>
          <div class="history-list" v-if="history.length > 0">
            <div 
              v-for="(item, index) in history" 
              :key="index" 
              class="history-item"
              @click="selectColor(item)"
            >
              <div class="color-preview" :style="{ backgroundColor: item.hex }"></div>
              <div class="color-data">
                <p class="hex">{{ item.hex }}</p>
                <p class="rgb">rgb({{ item.r }}, {{ item.g }}, {{ item.b }})</p>
              </div>
              <button @click.stop="copyColor(item.hex)" class="copy-btn">复制</button>
            </div>
          </div>
          <p v-else class="no-history">暂无历史记录</p>
        </div>
      </div>

      <div v-else-if="activeTab === 'converter'" class="tab-content">
        <h2 class="section-title">颜色格式转换</h2>
        
        <div class="converter-input-group">
          <label>HEX</label>
          <input 
            type="text" 
            v-model="converterHex" 
            @input="updateFromHex"
            class="color-input"
            placeholder="#000000"
          />
        </div>

        <div class="converter-input-group">
          <label>RGB</label>
          <div class="rgb-inputs">
            <input type="number" v-model.number="converterRGB.r" @input="updateFromRGB" min="0" max="255" placeholder="R" />
            <input type="number" v-model.number="converterRGB.g" @input="updateFromRGB" min="0" max="255" placeholder="G" />
            <input type="number" v-model.number="converterRGB.b" @input="updateFromRGB" min="0" max="255" placeholder="B" />
          </div>
        </div>

        <div class="converter-input-group">
          <label>HSL</label>
          <div class="hsl-inputs">
            <input type="number" v-model.number="converterHSL.h" @input="updateFromHSL" min="0" max="360" placeholder="H" />
            <input type="number" v-model.number="converterHSL.s" @input="updateFromHSL" min="0" max="100" placeholder="S" />
            <input type="number" v-model.number="converterHSL.l" @input="updateFromHSL" min="0" max="100" placeholder="L" />
          </div>
        </div>

        <div class="color-preview-large" :style="{ backgroundColor: converterHex }"></div>

        <div class="action-buttons">
          <button @click="copyColor(converterHex)" class="action-btn">复制 HEX</button>
          <button @click="copyColor(`rgb(${converterRGB.r}, ${converterRGB.g}, ${converterRGB.b})`)" class="action-btn">复制 RGB</button>
        </div>
      </div>

      <div v-else-if="activeTab === 'contrast'" class="tab-content">
        <h2 class="section-title">WCAG 对比度检查器</h2>
        
        <div class="contrast-group">
          <label>前景色（文字）</label>
          <div class="color-picker-row">
            <input type="color" v-model="contrastForeground.hex" @input="updateContrast" />
            <input type="text" v-model="contrastForeground.hex" @input="updateContrast" class="color-input" />
          </div>
          <div 
            class="color-swatch" 
            :style="{ backgroundColor: contrastForeground.hex, color: contrastBackground.hex }"
          >
            Aa 文字示例
          </div>
        </div>

        <div class="contrast-group">
          <label>背景色</label>
          <div class="color-picker-row">
            <input type="color" v-model="contrastBackground.hex" @input="updateContrast" />
            <input type="text" v-model="contrastBackground.hex" @input="updateContrast" class="color-input" />
          </div>
          <div class="color-swatch" :style="{ backgroundColor: contrastBackground.hex }"></div>
        </div>

        <div class="preview-text" :style="{ color: contrastForeground.hex, backgroundColor: contrastBackground.hex }">
          这是预览文字，用于检查对比度效果。
        </div>

        <div class="contrast-result">
          <div class="ratio-display">
            <strong>对比度:</strong> {{ contrastRatio.toFixed(2) }}:1
          </div>
          
          <div class="levels">
            <div class="level-item" :class="levelAA.normal ? 'pass' : 'fail'">
              <span class="level-label">AA (普通)</span>
              <span class="level-status">{{ levelAA.normal ? '通过' : '失败' }}</span>
            </div>
            <div class="level-item" :class="levelAA.large ? 'pass' : 'fail'">
              <span class="level-label">AA (大字体)</span>
              <span class="level-status">{{ levelAA.large ? '通过' : '失败' }}</span>
            </div>
            <div class="level-item" :class="levelAAA.normal ? 'pass' : 'fail'">
              <span class="level-label">AAA (普通)</span>
              <span class="level-status">{{ levelAAA.normal ? '通过' : '失败' }}</span>
            </div>
            <div class="level-item" :class="levelAAA.large ? 'pass' : 'fail'">
              <span class="level-label">AAA (大字体)</span>
              <span class="level-status">{{ levelAAA.large ? '通过' : '失败' }}</span>
            </div>
          </div>
        </div>

        <div class="swap-btn-container">
          <button @click="swapColors" class="action-btn">交换颜色</button>
        </div>
      </div>
    </div>
    
    <div v-else class="picking-overlay">
      <div class="magnifier" :style="magnifierStyle">
        <canvas ref="magnifierCanvas" :width="magnifierSize" :height="magnifierSize"></canvas>
        <div class="crosshair"></div>
        <div class="color-preview-box" :style="{ backgroundColor: pickedColor.hex }"></div>
      </div>
      <div class="picking-info">
        <p><strong>HEX:</strong> {{ pickedColor.hex }}</p>
        <p><strong>RGB:</strong> rgb({{ pickedColor.r }}, {{ pickedColor.g }}, {{ pickedColor.b }})</p>
        <p class="hint">点击取色，按 ESC 取消</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'

interface ColorInfo {
  hex: string
  r: number
  g: number
  b: number
}

interface HSL {
  h: number
  s: number
  l: number
}

interface RGB {
  r: number
  g: number
  b: number
}

const activeTab = ref<'picker' | 'converter' | 'contrast'>('picker')

const isPicking = ref(false)
const currentColor = ref<ColorInfo>({ hex: '#000000', r: 0, g: 0, b: 0 })
const pickedColor = ref<ColorInfo>({ hex: '#000000', r: 0, g: 0, b: 0 })
const history = ref<ColorInfo[]>([])
const magnifierSize = 200
const mouseX = ref(0)
const mouseY = ref(0)
const magnifierCanvas = ref<HTMLCanvasElement | null>(null)
let screenshotDataUrl = ref('')
let screenWidth = ref(0)
let screenHeight = ref(0)

const converterHex = ref('#667EEA')
const converterRGB = ref<RGB>({ r: 102, g: 126, b: 234 })
const converterHSL = ref<HSL>({ h: 229, s: 75, l: 66 })

const contrastForeground = ref({ hex: '#FFFFFF' })
const contrastBackground = ref({ hex: '#667EEA' })

const currentColorHSL = computed(() => {
  return rgbToHSL(currentColor.value.r, currentColor.value.g, currentColor.value.b)
})

const contrastRatio = computed(() => {
  const fg = hexToRGB(contrastForeground.value.hex)
  const bg = hexToRGB(contrastBackground.value.hex)
  return calculateContrastRatio(fg, bg)
})

const levelAA = computed(() => ({
  normal: contrastRatio.value >= 4.5,
  large: contrastRatio.value >= 3
}))

const levelAAA = computed(() => ({
  normal: contrastRatio.value >= 7,
  large: contrastRatio.value >= 4.5
}))

const magnifierStyle = computed(() => ({
  left: `${mouseX.value + 20}px`,
  top: `${mouseY.value + 20}px`
}))

function hexToRGB(hex: string): RGB {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('')
  }
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

function rgbToHSL(r: number, g: number, b: number): HSL {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

function hslToRGB(h: number, s: number, l: number): RGB {
  h /= 360
  s /= 100
  l /= 100
  
  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

function normalizeHex(hex: string): string {
  let h = hex.trim()
  if (!h.startsWith('#')) {
    h = '#' + h
  }
  if (h.length === 4) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) {
    return h.toUpperCase()
  }
  return '#000000'
}

function isValidHex(hex: string): boolean {
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim())
}

function updateFromHex() {
  if (!isValidHex(converterHex.value)) return
  const hex = normalizeHex(converterHex.value)
  converterHex.value = hex
  const rgb = hexToRGB(hex)
  converterRGB.value = { ...rgb }
  converterHSL.value = rgbToHSL(rgb.r, rgb.g, rgb.b)
}

function updateFromRGB() {
  converterRGB.value.r = Math.max(0, Math.min(255, converterRGB.value.r))
  converterRGB.value.g = Math.max(0, Math.min(255, converterRGB.value.g))
  converterRGB.value.b = Math.max(0, Math.min(255, converterRGB.value.b))
  
  converterHex.value = rgbToHex(converterRGB.value.r, converterRGB.value.g, converterRGB.value.b)
  converterHSL.value = rgbToHSL(converterRGB.value.r, converterRGB.value.g, converterRGB.value.b)
}

function updateFromHSL() {
  converterHSL.value.h = Math.max(0, Math.min(360, converterHSL.value.h))
  converterHSL.value.s = Math.max(0, Math.min(100, converterHSL.value.s))
  converterHSL.value.l = Math.max(0, Math.min(100, converterHSL.value.l))
  
  const rgb = hslToRGB(converterHSL.value.h, converterHSL.value.s, converterHSL.value.l)
  converterRGB.value = { ...rgb }
  converterHex.value = rgbToHex(rgb.r, rgb.g, rgb.b)
}

function linearizeChannel(c: number): number {
  c = c / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function calculateLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearizeChannel(r) + 
         0.7152 * linearizeChannel(g) + 
         0.0722 * linearizeChannel(b)
}

function calculateContrastRatio(rgb1: RGB, rgb2: RGB): number {
  const l1 = calculateLuminance(rgb1.r, rgb1.g, rgb1.b)
  const l2 = calculateLuminance(rgb2.r, rgb2.g, rgb2.b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function updateContrast() {
  if (!isValidHex(contrastForeground.value.hex)) {
    contrastForeground.value.hex = '#FFFFFF'
  }
  if (!isValidHex(contrastBackground.value.hex)) {
    contrastBackground.value.hex = '#000000'
  }
}

function swapColors() {
  const temp = contrastForeground.value.hex
  contrastForeground.value.hex = contrastBackground.value.hex
  contrastBackground.value.hex = temp
}

async function loadHistory() {
  try {
    const saved = await invoke<ColorInfo[]>('load_color_history')
    if (saved) {
      history.value = saved
    }
  } catch (e) {
    console.error('加载历史记录失败:', e)
  }
}

async function saveColor(color: ColorInfo) {
  const exists = history.value.some(h => h.hex === color.hex)
  if (!exists) {
    history.value.unshift(color)
    if (history.value.length > 20) {
      history.value.pop()
    }
    try {
      await invoke('save_color_history', { history: history.value })
    } catch (e) {
      console.error('保存历史记录失败:', e)
    }
  }
}

async function startPicking() {
  isPicking.value = true
  try {
    const data = await invoke<{ image: string; width: number; height: number }>('capture_screen')
    screenshotDataUrl.value = data.image
    screenWidth.value = data.width
    screenHeight.value = data.height
  } catch (e) {
    console.error('截图失败:', e)
    isPicking.value = false
  }
}

function updateMagnifier() {
  if (!magnifierCanvas.value || !screenshotDataUrl.value) return
  
  const ctx = magnifierCanvas.value.getContext('2d')
  if (!ctx) return
  
  const img = new Image()
  img.onload = () => {
    const zoom = 4
    const half = magnifierSize / 2 / zoom
    
    const sx = Math.max(0, mouseX.value - half)
    const sy = Math.max(0, mouseY.value - half)
    
    ctx.clearRect(0, 0, magnifierSize, magnifierSize)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      img,
      sx, sy, magnifierSize / zoom, magnifierSize / zoom,
      0, 0, magnifierSize, magnifierSize
    )
    
    const pixelX = Math.floor(mouseX.value)
    const pixelY = Math.floor(mouseY.value)
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = 1
    tempCanvas.height = 1
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx) {
      tempCtx.drawImage(img, pixelX, pixelY, 1, 1, 0, 0, 1, 1)
      const pixelData = tempCtx.getImageData(0, 0, 1, 1).data
      updateColor(pixelData[0], pixelData[1], pixelData[2])
    }
  }
  img.src = screenshotDataUrl.value
}

function updateColor(r: number, g: number, b: number) {
  const hex = rgbToHex(r, g, b)
  pickedColor.value = { hex, r, g, b }
}

function pickColor() {
  currentColor.value = { ...pickedColor.value }
  saveColor(currentColor.value)
  isPicking.value = false
}

function cancelPicking() {
  isPicking.value = false
}

function selectColor(color: ColorInfo) {
  currentColor.value = { ...color }
}

async function copyColor(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    console.error('复制失败:', e)
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!isPicking.value) return
  mouseX.value = e.clientX
  mouseY.value = e.clientY
  updateMagnifier()
}

function handleClick(e: MouseEvent) {
  if (!isPicking.value) return
  e.preventDefault()
  pickColor()
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isPicking.value) {
    cancelPicking()
  }
}

async function setupGlobalShortcut() {
  try {
    await listen('start-color-picker', () => {
      if (!isPicking.value) {
        activeTab.value = 'picker'
        startPicking()
      }
    })
  } catch (e) {
    console.error('注册快捷键事件失败:', e)
  }
}

watch(currentColor, (newColor) => {
  converterHex.value = newColor.hex
  converterRGB.value = { r: newColor.r, g: newColor.g, b: newColor.b }
  converterHSL.value = rgbToHSL(newColor.r, newColor.g, newColor.b)
}, { immediate: true })

onMounted(() => {
  loadHistory()
  setupGlobalShortcut()
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('click', handleClick)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('click', handleClick)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
}

.main-panel {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  margin-bottom: 20px;
  background: #e9ecef;
  border-radius: 10px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: #666;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #333;
}

.tab-btn.active {
  background: white;
  color: #667eea;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  text-align: center;
  color: #2c3e50;
}

.current-color {
  width: 100%;
  height: 140px;
  border-radius: 12px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.color-info {
  background: rgba(255, 255, 255, 0.95);
  padding: 12px 24px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.color-info p {
  margin: 4px 0;
  font-size: 13px;
}

.pick-btn {
  width: 100%;
  padding: 16px;
  font-size: 18px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-bottom: 30px;
}

.pick-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.pick-btn:active {
  transform: translateY(0);
}

.history-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.history-section h2 {
  font-size: 18px;
  margin-bottom: 16px;
  color: #2c3e50;
}

.history-list {
  max-height: 250px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:hover {
  background: #e9ecef;
}

.color-preview {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  margin-right: 16px;
  border: 1px solid #ddd;
}

.color-data {
  flex: 1;
}

.color-data .hex {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 2px;
}

.color-data .rgb {
  font-size: 12px;
  color: #666;
}

.copy-btn {
  padding: 6px 12px;
  font-size: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.no-history {
  text-align: center;
  color: #999;
  padding: 20px;
}

.converter-input-group {
  margin-bottom: 20px;
}

.converter-input-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #2c3e50;
}

.color-input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', monospace;
  transition: border-color 0.2s;
}

.color-input:focus {
  outline: none;
  border-color: #667eea;
}

.rgb-inputs,
.hsl-inputs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.rgb-inputs input,
.hsl-inputs input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  text-align: center;
  font-family: 'Monaco', 'Menlo', monospace;
}

.rgb-inputs input:focus,
.hsl-inputs input:focus {
  outline: none;
  border-color: #667eea;
}

.color-preview-large {
  width: 100%;
  height: 100px;
  border-radius: 12px;
  margin: 20px 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-buttons,
.swap-btn-container {
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background: #667eea;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover {
  background: #5568d4;
}

.contrast-group {
  margin-bottom: 24px;
}

.contrast-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #2c3e50;
}

.color-picker-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.color-picker-row input[type="color"] {
  width: 50px;
  height: 48px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  padding: 0;
}

.color-picker-row input[type="text"] {
  flex: 1;
}

.color-swatch {
  width: 100%;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.preview-text {
  width: 100%;
  padding: 20px;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.contrast-result {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.ratio-display {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 20px;
}

.levels {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.level-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
}

.level-item.pass {
  background: #d4edda;
  color: #155724;
}

.level-item.fail {
  background: #f8d7da;
  color: #721c24;
}

.level-label {
  font-weight: 500;
}

.level-status {
  font-weight: 700;
}

.picking-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.01);
  cursor: crosshair;
  z-index: 9999;
}

.magnifier {
  position: fixed;
  width: 200px;
  height: 200px;
  border-radius: 8px;
  border: 3px solid #333;
  overflow: hidden;
  pointer-events: none;
  background: white;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
}

.magnifier canvas {
  display: block;
}

.crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  pointer-events: none;
}

.crosshair::before,
.crosshair::after {
  content: '';
  position: absolute;
  background: red;
}

.crosshair::before {
  width: 2px;
  height: 100%;
  left: 50%;
  transform: translateX(-50%);
}

.crosshair::after {
  width: 100%;
  height: 2px;
  top: 50%;
  transform: translateY(-50%);
}

.color-preview-box {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  border: 2px solid #fff;
  border-radius: 4px;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

.picking-info {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 16px 24px;
  border-radius: 10px;
  text-align: center;
  pointer-events: none;
}

.picking-info p {
  margin: 4px 0;
}

.picking-info .hint {
  font-size: 12px;
  color: #aaa;
  margin-top: 8px;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}
</style>
