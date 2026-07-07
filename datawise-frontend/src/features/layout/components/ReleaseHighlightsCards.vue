<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {
    isReleaseHighlightsDismissed,
    markReleaseHighlightsDismissed,
    RELEASE_HIGHLIGHT_CARDS,
    RELEASE_HIGHLIGHTS_VERSION,
    type ReleaseHighlightAction,
    type ReleaseHighlightScope,
} from '@/features/layout/services/release-highlights.service'

const props = defineProps<{
    scope: ReleaseHighlightScope
}>()

const emit = defineEmits<{
    action: [action: ReleaseHighlightAction]
}>()

const {t} = useI18n()
const dismissed = ref(isReleaseHighlightsDismissed(props.scope))

const cards = computed(() => RELEASE_HIGHLIGHT_CARDS)

const visible = computed(() => !dismissed.value && cards.value.length > 0)

function dismiss() {
    dismissed.value = true
    markReleaseHighlightsDismissed(props.scope)
}
</script>

<template>
  <section v-if="visible" class="release-cards" :aria-label="t('platform.release.title')">
    <header class="release-cards__head">
      <div>
        <p class="release-cards__eyebrow">{{ RELEASE_HIGHLIGHTS_VERSION }}</p>
        <h3 class="release-cards__title">{{ t('platform.release.title') }}</h3>
        <p class="release-cards__sub">{{ t('platform.release.subtitle') }}</p>
      </div>
      <button type="button" class="release-cards__dismiss" @click="dismiss">
        {{ t('platform.release.dismiss') }}
      </button>
    </header>

    <div class="release-cards__grid">
      <article
          v-for="card in cards"
          :key="card.id"
          class="release-card"
      >
        <h4>{{ t(`platform.release.cards.${card.id}.title`) }}</h4>
        <p>{{ t(`platform.release.cards.${card.id}.desc`) }}</p>
        <button
            v-if="card.action"
            type="button"
            class="release-card__cta"
            @click="emit('action', card.action)"
        >
          {{ t(`platform.release.cards.${card.id}.cta`) }}
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.release-cards {
  margin: 0 0 12px;
  padding: 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 12px;
  background: linear-gradient(145deg, var(--dw-bg), color-mix(in srgb, var(--dw-primary) 4%, var(--dw-bg)));
}

.release-cards__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.release-cards__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--dw-primary);
}

.release-cards__title {
  margin: 2px 0 0;
  font-size: 15px;
}

.release-cards__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--dw-text-muted);
}

.release-cards__dismiss {
  border: none;
  background: transparent;
  color: var(--dw-text-muted);
  font-size: 12px;
  cursor: pointer;
}

.release-cards__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.release-card {
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  padding: 10px;
  background: var(--dw-bg-panel);
}

.release-card h4 {
  margin: 0;
  font-size: 13px;
}

.release-card p {
  margin: 6px 0 8px;
  font-size: 12px;
  color: var(--dw-text-muted);
}

.release-card__cta {
  border: 1px solid var(--dw-primary);
  color: var(--dw-primary);
  background: transparent;
  border-radius: 7px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

@media (max-width: 980px) {
  .release-cards__grid {
    grid-template-columns: 1fr;
  }
}
</style>

