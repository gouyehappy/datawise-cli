import {expect, test} from '@playwright/test'
import {installWorkspaceE2eMocks} from './helpers/mock-api'

test.describe('Workspace main path', () => {
    test('connect, execute SQL, and export result grid', async ({page}) => {
        await installWorkspaceE2eMocks(page)
        await page.goto('/')

        await expect(page.locator('.shell')).toBeVisible({timeout: 15000})

        await page.locator('nav.tool-stripe__group').first().getByRole('button', {name: '数据库', exact: true}).click()
        await expect(page.getByText('Test MySQL')).toBeVisible({timeout: 15000})

        await page.keyboard.press('Control+Shift+KeyL')

        const editor = page.getByRole('textbox', {name: 'Editor content'})
        await expect(editor).toBeVisible({timeout: 15000})
        await editor.focus()
        await page.keyboard.press('Control+A')
        await page.keyboard.type('SELECT 1 AS id')

        await page.locator('.console-run-btn').click()

        await expect(page.locator('.data-grid .th-label', {hasText: 'id'})).toBeVisible({timeout: 15000})
        await expect(page.locator('.data-grid .data-cell').filter({hasText: /^1$/})).toBeVisible()

        const downloadPromise = page.waitForEvent('download')
        await page.locator('.data-grid .export-btn').click()
        await page.getByText('CSV (.csv)').click()
        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/\.csv$/i)
    })
})
