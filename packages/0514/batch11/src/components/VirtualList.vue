<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVirtualScroll } from '../hooks/useVirtualScroll'

interface VirtualListProps<T> {
  items: T[]
  itemHeight?: number
  bufferSize?: number
  getItemKey?: (item: T, index: number) => string | number
  height?: string | number
}

const props = withDefaults(defineProps<VirtualListProps<any>>(), {
  itemHeight: 50,
  bufferSize: 10,
  height: '500px',
  getItemKey: (_, index) => index
})

const containerRef = ref<HTMLElement | null>(null)

const itemsRef = computed(() => props.items)

const {
  totalHeight,
  visibleItems,
  handleScroll,
  measureItem
} = useVirtualScroll({
  containerRef,
  items: itemsRef,
  itemHeight: props.itemHeight,
  bufferSize: props.bufferSize,
  getItemKey: props.getItemKey
})

const containerStyle = computed(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  overflow: 'auto',
  position: 'relative' as const
}))

const phantomStyle = computed(() => ({
  height: `${totalHeight.value}px`,
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  zIndex: -1
}))
</script>

<template>
  <div ref="containerRef" :style="containerStyle" @scroll="handleScroll">
    <div :style="phantomStyle"></div>
    <div style="position: relative; top: 0; left: 0; width: 100%;">
      <slot
        v-for="{ item, index, key, offset } in visibleItems"
        :key="key"
        :item="item"
        :index="index"
        :offset="offset"
        :measure="(el: HTMLElement | null) => measureItem(key, el)"
      />
    </div>
  </div>
</template>
