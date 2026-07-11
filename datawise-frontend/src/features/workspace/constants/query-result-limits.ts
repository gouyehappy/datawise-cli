/** 游标「加载更多」累计行数超过此阈值时在工具栏提示用户收窄查询或导出 */
export const CURSOR_LOADED_ROWS_WARN_THRESHOLD = 10_000

/** 游标结果在内存中保留的最大行数；超出时丢弃最早批次（FIFO 滑动窗口） */
export const CURSOR_LOADED_ROWS_MAX = 15_000
