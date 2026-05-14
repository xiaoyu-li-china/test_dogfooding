<script setup lang="ts">
import { ref, onMounted } from 'vue'
import VirtualList from './components/VirtualList.vue'
import type { ListItem } from './types'

const items = ref<ListItem[]>([])

const renderCount = ref(0)

const generateData = (count: number): ListItem[] => {
  const result: ListItem[] = []
  for (let i = 0; i < count; i++) {
    const height = 40 + Math.floor(Math.random() * 80)
    result.push({
      id: i,
      title: `Item ${i + 1}`,
      description: `This is a dynamic height item with random height ${height}px. Lorem ipsum dolor sit amet.`,
      height
    })
  }
  return result
}

onMounted(() => {
  items.value = generateData(100000)
})

const getItemStyle = (offset: number) => ({
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  transform: `translate3d(0, ${offset}px, 0)`,
  willChange: 'transform' as const,
  padding: '12px 16px',
  borderBottom: '1px solid #eee',
  background: '#fff'
})
</script>

<template>
  <div>
    <h1 style="margin-bottom: 20px; color: #333;">Vue 3 虚拟滚动列表 - {{ items.length.toLocaleString() }} 条数据</h1>
    
    <div style="margin-bottom: 20px; padding: 16px; background: #e3f2fd; border-radius: 8px;">
      <p><strong>功能说明：</strong></p>
      <ul style="margin-left: 20px; margin-top: 8px; line-height: 1.8;">
        <li>支持 10 万条数据流畅滚动</li>
        <li>只渲染视口内 ±5 条数据（buffer）</li>
        <li>支持动态高度（每个列表项高度不同）</li>
        <li>使用前缀和数组 + 二分查找优化性能</li>
      </ul>
    </div>

    <VirtualList
      :items="items"
      :item-height="60"
      :buffer-size="5"
      :height="600"
      :get-item-key="(item) => item.id"
    >
      <template #default="{ item, index, offset, measure }">
        <div
          :ref="(el) => measure(el as HTMLElement | null)"
          :style="getItemStyle(offset)"
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #1976d2;">{{ item.title }}</strong>
            <span style="font-size: 12px; color: #999;">Index: {{ index }}</span>
          </div>
          <p style="margin-top: 8px; font-size: 14px; color: #666; line-height: 1.5;">
            {{ item.description }}
          </p>
          <div style="margin-top: 8px; font-size: 12px; color: #999;">
            Height: {{ item.height }}px | ID: {{ item.id }}
          </div>
        </div>
      </template>
    </VirtualList>

    <div style="margin-top: 20px; padding: 16px; background: #f5f5f5; border-radius: 8px; font-size: 14px;">
      <p><strong>性能统计：</strong></p>
      <p>总数据量: {{ items.length.toLocaleString() }} 条</p>
      <p>预计总高度: ~{{ Math.round(items.length * 60 / 1000) }}m</p>
    </div>
  </div>
</template>
