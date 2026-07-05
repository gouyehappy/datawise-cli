import {nextTick, watch, type ComputedRef, type Ref} from 'vue'

/** 消息列表滚动到底部 */
export function useAiChatScroll(
    listRef: Ref<HTMLElement | undefined> | ComputedRef<HTMLElement | undefined>,
    activeSessionId: Ref<string | null>,
) {
    async function scrollToBottom() {
        await nextTick()
        listRef.value?.scrollTo({top: listRef.value.scrollHeight, behavior: 'smooth'})
    }

    watch(activeSessionId, () => {
        void scrollToBottom()
    })

    return {scrollToBottom}
}
