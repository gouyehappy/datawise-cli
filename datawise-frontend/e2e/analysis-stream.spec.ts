import {expect, test} from '@playwright/test'
import {installAnalysisE2eMocks} from './helpers/mock-api'

test.describe('AI analysis SSE stream', () => {
    test('renders analysis steps and final reply from mocked stream', async ({page}) => {
        await installAnalysisE2eMocks(page)
        await page.goto('/')

        await expect(page.locator('.shell')).toBeVisible({timeout: 15000})

        await page.locator('nav.tool-stripe__group').first().getByRole('button', {name: '数据库', exact: true}).click()
        await expect(page.getByText('Test MySQL')).toBeVisible({timeout: 15000})

        await page.locator('nav.tool-stripe__group').first().getByRole('button', {name: 'AI 聊天', exact: true}).click()
        await expect(page.getByRole('heading', {name: 'AI 助手', exact: true})).toBeVisible()

        const composer = page.getByPlaceholder('发消息…')
        await composer.fill('分析销售情况')
        await page.getByRole('button', {name: '发送'}).click()

        await expect(page.getByText('分析完成', {exact: true})).toBeVisible({timeout: 20_000})
        await expect(page.getByText('SELECT 1')).toBeVisible({timeout: 20_000})
    })
})
