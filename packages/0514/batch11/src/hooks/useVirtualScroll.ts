import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

interface VirtualScrollOptions<T> {
  containerRef: { value: HTMLElement | null }
  items: T[]
  itemHeight?: number
  bufferSize?: number
  getItemKey?: (item: T, index: number) => string | number
}

export function useVirtualScroll<T>(options: VirtualScrollOptions<T>) {
  const {
    containerRef,
    items,
    itemHeight = 50,
    bufferSize = 5,
    getItemKey = (_, index) => index
  } = options

  const scrollTop = ref(0)
  const containerHeight = ref(0)
  const measuredHeights = ref<Map<string | number, number>>(new Map())

  const totalCount = computed(() => items.value?.length || 0)

  const prefixSumCache = ref<number[]>([])
  const cacheDirty = ref(true)

  const updatePrefixSumCache = () => {
    const count = totalCount.value
    const prefix = new Array(count + 1)
    prefix[0] = 0
    for (let i = 0; i < count; i++) {
      const key = getItemKey(items.value[i], i)
      prefix[i + 1] = prefix[i] + (measuredHeights.value.get(key) || itemHeight)
    }
    prefixSumCache.value = prefix
    cacheDirty.value = false
  }

  const estimatedTotalHeight = computed(() => {
    if (cacheDirty.value) {
      updatePrefixSumCache()
    }
    return prefixSumCache.value[prefixSumCache.value.length - 1] || 0
  })

  const getOffsetByIndex = (index: number): number => {
    if (cacheDirty.value) {
      updatePrefixSumCache()
    }
    return prefixSumCache.value[Math.max(0, Math.min(index, prefixSumCache.value.length - 1))] || 0
  }

  const getIndexByOffset = (offset: number): number => {
    if (cacheDirty.value) {
      updatePrefixSumCache()
    }
    const prefix = prefixSumCache.value
    let low = 0
    let high = prefix.length - 1
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (prefix[mid] <= offset) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return Math.max(0, low - 1)
  }

  const startIndex = computed(() => {
    const idx = getIndexByOffset(scrollTop.value)
    return Math.max(0, idx - bufferSize)
  })

  const endIndex = computed(() => {
    const idx = getIndexByOffset(scrollTop.value + containerHeight.value)
    return Math.min(totalCount.value - 1, idx + bufferSize)
  })

  const visibleItems = computed(() => {
    if (!items.value || items.value.length === 0) return []
    const result = []
    for (let i = startIndex.value; i <= endIndex.value; i++) {
      result.push({
        index: i,
        item: items.value[i],
        key: getItemKey(items.value[i], i),
        offset: getOffsetByIndex(i)
      })
    }
    return result
  })

  let scrollRAF: number | null = null
  
  const handleScroll = () => {
    if (scrollRAF !== null) {
      cancelAnimationFrame(scrollRAF)
    }
    scrollRAF = requestAnimationFrame(() => {
      if (containerRef.value) {
        scrollTop.value = containerRef.value.scrollTop
      }
      scrollRAF = null
    })
  }

  const measureItem = (key: string | number, element: HTMLElement | null) => {
    if (element) {
      const height = element.getBoundingClientRect().height
      const currentHeight = measuredHeights.value.get(key)
      if (currentHeight !== height) {
        measuredHeights.value.set(key, height)
        cacheDirty.value = true
      }
    }
  }

  const scrollToIndex = (index: number) => {
    if (containerRef.value && index >= 0 && index < totalCount.value) {
      containerRef.value.scrollTop = getOffsetByIndex(index)
    }
  }

  const updateContainerHeight = () => {
    if (containerRef.value) {
      containerHeight.value = containerRef.value.clientHeight
    }
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    updateContainerHeight()
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(updateContainerHeight)
      resizeObserver.observe(containerRef.value)
    }
  })

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
    if (scrollRAF !== null) {
      cancelAnimationFrame(scrollRAF)
    }
  })

  watch(() => items.value, () => {
    measuredHeights.value.clear()
  }, { deep: true })

  return {
    scrollTop,
    containerHeight,
    totalHeight: estimatedTotalHeight,
    startIndex,
    endIndex,
    visibleItems,
    handleScroll,
    measureItem,
    scrollToIndex,
    getItemKey
  }
}
