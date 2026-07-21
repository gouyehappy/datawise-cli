import {expect, test} from '@playwright/test'
import {installWorkspaceE2eMocks} from './helpers/mock-api'

async function ensureExplorerVisible(page: import('@playwright/test').Page) {
    const explorer = page.locator('.explorer')
    if (await explorer.isVisible().catch(() => false)) return
    await page.locator('nav.tool-stripe__group').first().getByRole('button', {name: /数据库|Database/}).click()
    await expect(explorer).toBeVisible({timeout: 15_000})
}

test.describe('Core product paths', () => {
    test('shell loads with explorer connection after auth bootstrap', async ({page}) => {
        await installWorkspaceE2eMocks(page)
        await page.goto('/')

        await expect(page.locator('.shell')).toBeVisible({timeout: 15_000})
        await ensureExplorerVisible(page)
        await expect(page.getByText('Test MySQL')).toBeVisible({timeout: 15_000})
    })

    test('open SQL console from explorer path', async ({page}) => {
        await installWorkspaceE2eMocks(page)
        await page.goto('/')
        await expect(page.locator('.shell')).toBeVisible({timeout: 15_000})
        await ensureExplorerVisible(page)

        await page.keyboard.press('Control+Shift+KeyL')
        const editor = page.getByRole('textbox', {name: 'Editor content'})
        await expect(editor).toBeVisible({timeout: 15_000})
    })
})
