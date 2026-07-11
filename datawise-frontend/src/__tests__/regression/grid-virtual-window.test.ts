import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {computed, ref} from 'vue'
import {
    GRID_ROW_HEIGHT,
    GRID_VIRTUAL_THRESHOLD,
    useGridVirtualWindow,
} from '@/core/composables/useGridVirtualWindow'

describe('grid-virtual-window', () => {
    it('threshold matches explorer tree scale', () => {
        assert.ok(GRID_VIRTUAL_THRESHOLD >= 50)
        assert.ok(GRID_VIRTUAL_THRESHOLD <= 120)
        assert.equal(GRID_ROW_HEIGHT, 30)
    })

    it('returns all rows when below threshold', () => {
        const scrollContainer = ref<HTMLElement | null>(null)
        const rows = ref([{id: '1'}, {id: '2'}])
        const {useVirtual, visibleRows} = useGridVirtualWindow(scrollContainer, rows)
        assert.equal(useVirtual.value, false)
        assert.equal(visibleRows.value.length, 2)
        assert.equal(visibleRows.value[0]?.index, 0)
    })

    it('slices visible window when virtual mode enabled', () => {
        const scrollEl = {
            scrollTop: 0,
            clientHeight: 300,
            addEventListener: () => {},
            removeEventListener: () => {},
        } as unknown as HTMLElement
        const scrollContainer = ref<HTMLElement | null>(scrollEl)

        const rows = ref(Array.from({length: 120}, (_, index) => ({id: String(index)})))
        const enabled = computed(() => true)
        const {useVirtual, visibleRows, paddingTop, paddingBottom} = useGridVirtualWindow(
            scrollContainer,
            rows,
            {enabled},
        )

        assert.equal(useVirtual.value, true)
        assert.ok(visibleRows.value.length < rows.value.length)
        assert.equal(paddingTop.value, 0)
        assert.ok(paddingBottom.value > 0)
        assert.equal(visibleRows.value[0]?.index, 0)
    })
})
