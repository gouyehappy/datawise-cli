import {expect, test} from '@playwright/test'
import {installAnalysisE2eMocks} from './helpers/mock-api'

test.describe('AI analysis SSE stream', () => {
    test('renders analysis steps and final reply from mocked stream', async ({page}) => {
        await installAnalysisE2eMocks(page)
        await page.goto('/')

        await expect(page.locator('.shell')).toBeVisible({timeout: 15000})

        await page.getByRole('button', {name: 'AI 聊天'}).click()
        await expect(page.getByRole('heading', {name: 'AI 助手', exact: true})).toBeVisible()

        const composer = page.getByPlaceholder('发消息…')
        await composer.fill('分析销售情况')
        await page.getByRole('button', {name: '发送'}).click()

        await expect(page.getByRole('button', {name: /分析进度/})).toBeVisible({timeout: 15000})
        await expect(page.getByRole('heading', {name: '分析摘要'})).toBeVisible({timeout: 15000})
        await expect(page.getByText('分析完成', {exact: true})).toBeVisible({timeout: 15000})
        await expect(page.getByText('SELECT 1')).toBeVisible()
    })
})
