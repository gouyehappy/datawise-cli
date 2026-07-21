import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {humanizeUpdaterError} from '../../../electron/updater-errors'

describe('humanizeUpdaterError', () => {
    it('maps missing latest.yml to a short publish hint', () => {
        const msg = humanizeUpdaterError(
            'Cannot find latest.yml in the latest release artifacts (https://example/latest.yml): ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
        )
        assert.match(msg, /latest\.yml/)
        assert.match(msg, /Publish a desktop build/)
        assert.ok(msg.length < 200)
    })

    it('maps GitHub 406 / latest-version failures', () => {
        const msg = humanizeUpdaterError(
            'Unable to find latest version on GitHub (https://github.com/x/y/releases/latest), please ensure a production release exists: HttpError: 406',
        )
        assert.match(msg, /published \(non-draft\) release/)
        assert.ok(!msg.includes('HttpError'))
    })

    it('truncates Atom XML dumps from feed parse errors', () => {
        const xml = `Cannot parse releases feed: Error: Unable to find latest version,\nXML:\n<?xml version="1.0"?><feed>${'x'.repeat(500)}</feed>`
        const msg = humanizeUpdaterError(xml)
        assert.ok(!msg.includes('<feed>'))
        assert.ok(msg.length < 300)
    })
})
