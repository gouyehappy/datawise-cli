import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {buildShareEmbedSnippet} from '@/features/dashboard/services/share-embed.service'

describe('share-embed.service', () => {
    it('builds iframe snippet with defaults', () => {
        const snippet = buildShareEmbedSnippet('tok-abc', {title: 'Orders'})
        assert.match(snippet, /src="[^"]*\/share\/tok-abc"/)
        assert.match(snippet, /title="Orders"/)
        assert.match(snippet, /height="480"/)
        assert.match(snippet, /width="100%"/)
        assert.match(snippet, /<iframe /)
    })
})
