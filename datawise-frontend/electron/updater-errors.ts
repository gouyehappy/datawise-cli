/** Operator-facing messages for electron-updater / GitHub Releases failures. */

export function humanizeUpdaterError(raw: string): string {
    const text = raw.trim()
    if (!text) return 'Update check failed'
    if (/ERR_UPDATER_CHANNEL_FILE_NOT_FOUND|Cannot find latest\.yml/i.test(text)) {
        return 'GitHub Release is missing latest.yml / installer assets. Publish a desktop build (electron-builder --publish).'
    }
    if (/ERR_UPDATER_LATEST_VERSION_NOT_FOUND|Unable to find latest version on GitHub|HTTP_STATUS_CODE_406|status code 406/i.test(text)) {
        return 'Could not resolve the latest GitHub Release. Ensure a published (non-draft) release exists with installer assets.'
    }
    if (/ERR_UPDATER_INVALID_RELEASE_FEED|Cannot parse releases feed/i.test(text)) {
        return 'Could not parse GitHub release metadata. Prefer the generic latest.yml feed; republish the desktop build if this persists.'
    }
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::ERR_/i.test(text)) {
        return 'Network error while contacting GitHub Releases. Check outbound HTTPS access.'
    }
    // Keep UI readable when electron-updater dumps the full Atom XML body.
    if (text.length > 280 || /<\?xml|<\/feed>/i.test(text)) {
        const head = text.split(/,\nXML:|\nXML:/i)[0]?.trim() || text.slice(0, 200)
        return head.length > 240 ? `${head.slice(0, 240)}…` : head
    }
    return text
}
