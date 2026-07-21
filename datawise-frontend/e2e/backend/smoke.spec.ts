import {expect, test} from '@playwright/test'

/**
 * Minimal real-backend smoke: health → guest login → shell → SQL console.
 * No API mocks; Vite proxies /api and /login to Spring Boot.
 */
test.describe('Real backend smoke', () => {
    test('health endpoint reports ok', async ({request}) => {
        const res = await request.get('/api/health')
        expect(res.ok(), `health status ${res.status()}`).toBeTruthy()
        const body = await res.json()
        expect(body.code).toBe(0)
        expect(body.data?.status).toBe('ok')
    })

    test('guest login stub returns a session', async ({request}) => {
        const res = await request.post('/login/guest', {
            form: {},
        })
        expect(res.ok(), `guest login status ${res.status()}`).toBeTruthy()
        const body = await res.json()
        expect(body.code).toBe(0)
        expect(body.data?.sessionId).toBeTruthy()
        expect(body.data?.userName).toBeTruthy()
    })

    test('shell loads and SQL console opens', async ({page}) => {
        await page.goto('/')
        await expect(page.locator('.shell')).toBeVisible({timeout: 90_000})

        await page.keyboard.press('Control+Shift+KeyL')
        const editor = page.getByRole('textbox', {name: 'Editor content'})
        await expect(editor).toBeVisible({timeout: 30_000})
    })
})
