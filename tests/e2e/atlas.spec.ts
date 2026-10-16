import { expect, test, type Page } from '@playwright/test'

const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
})
test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]) })

const ready = async (page: Page) => {
  await page.goto('/')
  await expect(page.getByTestId('viewport')).toHaveAttribute('data-ready', 'true')
}
const selectPart = async (page: Page, name: string) => {
  await page.getByRole('button', { name: /^Элементы/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(name) }).click()
  await expect(page.getByTestId('part-card').getByRole('heading', { name })).toBeVisible()
}

test('реальная 3D-сцена, без ошибок JS и WebGL; адаптивная компоновка', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await ready(page)
  await expect(page.getByRole('heading', { name: /АК—47/ })).toBeVisible()
  const result = await page.evaluate(() => {
    const c = document.querySelector('canvas')!, gl = c.getContext('webgl2')!
    return { width: c.width, height: c.height, error: gl.getError(), overflow: document.documentElement.scrollWidth > window.innerWidth }
  })
  expect(result.width).toBeGreaterThan(300); expect(result.height).toBeGreaterThan(150)
  expect(result.error).toBe(0); expect(result.overflow).toBe(false)
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-overview.png` })
  expect(errors).toEqual([])
})

test('все режимы, карточки, фокус и возврат модели', async ({ page }, testInfo) => {
  await ready(page)
  await selectPart(page, 'Деревянный приклад')
  await page.getByRole('button', { name: 'Рассмотреть', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Фокус на детали', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Следующий элемент' }).click()
  await expect(page.getByRole('heading', { name: 'Ствольная коробка', exact: true })).toBeVisible()
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-focus.png` })
  await page.getByRole('button', { name: 'Внутренний обзор', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Центральная группа', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Следующий элемент' }).click()
  await expect(page.getByRole('heading', { name: 'Задняя внутренняя область', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Музейная экспозиция', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Вернуть модель', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Выбрать: Деревянный приклад', exact: true })).toBeVisible()
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-exhibit.png` })
  await page.getByRole('button', { name: 'Вернуть модель', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Общий вид', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('part-card')).toHaveCount(0)
})

test('камера меняет изображение; выбор видимой геометрии мышью или касанием', async ({ page, isMobile }) => {
  await ready(page)
  const canvas = page.getByTestId('atlas-canvas'), before = await canvas.screenshot()
  await page.getByLabel('Ракурс камеры', { exact: true }).selectOption('right')
  await page.waitForTimeout(250)
  const after = await canvas.screenshot()
  expect(before.equals(after)).toBe(false)
  await page.getByLabel('Ракурс камеры', { exact: true }).selectOption('left')
  await page.waitForTimeout(250)
  // Search a small horizontal band across the actual projected silhouette.
  const box = (await canvas.boundingBox())!
  let selected = false
  for (const y of [.35, .44, .5, .58]) {
    for (const x of [.3, .4, .5, .6]) {
      if (isMobile) await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * y)
      else await page.mouse.click(box.x + box.width * x, box.y + box.height * y)
      if (await page.getByTestId('part-card').count()) { selected = true; break }
    }
    if (selected) break
  }
  expect(selected).toBe(true)
  await page.getByRole('button', { name: 'Закрыть карточку' }).click()
  await page.getByRole('button', { name: 'Приблизить', exact: true }).click()
  await page.waitForTimeout(200)
  expect((await canvas.screenshot()).equals(after)).toBe(false)
})

test('список деталей, настройки качества, помощь и скрытие интерфейса', async ({ page }) => {
  await ready(page)
  await page.getByRole('button', { name: 'Настройки качества' }).click()
  await page.getByRole('button', { name: 'Низкое', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Низкое', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Закрыть окно' }).click()
  await page.getByRole('button', { name: 'Помощь по управлению' }).click()
  await expect(page.getByRole('heading', { name: 'Всё начинается с движения' })).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть окно' }).click()
  await page.getByRole('button', { name: 'Скрыть интерфейс' }).click()
  await expect(page.getByRole('button', { name: 'Показать интерфейс' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Режим просмотра' })).not.toBeVisible()
  await page.getByRole('button', { name: 'Показать интерфейс' }).click()
  await selectPart(page, 'Изогнутый магазин')
  await expect.poll(async () => {
    const card = await page.getByTestId('part-card').boundingBox(), canvas = await page.getByTestId('atlas-canvas').boundingBox()
    return !!card && !!canvas && (card.y >= canvas.y + canvas.height - 2 || card.x >= canvas.x + canvas.width - 2)
  }).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('сокращённое движение и клавиатурное управление', async ({ page, isMobile }) => {
  await ready(page)
  await expect(page.getByRole('button', { name: 'Включить вращение' })).toBeDisabled()
  if (!isMobile) {
    await page.getByRole('button', { name: /^Элементы/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.keyboard.press('+'); await page.keyboard.press('r')
  }
})

test('перетаскивание и жест масштаба меняют настоящую 3D-сцену', async ({ page, isMobile }) => {
  await ready(page)
  const canvas = page.getByTestId('atlas-canvas'), before = await canvas.screenshot(), box = (await canvas.boundingBox())!
  const x = box.x + box.width * .5, y = box.y + box.height * .5
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 35, y, id: 1 }, { x: x + 35, y, id: 2 }] })
    for (const distance of [40, 50, 60, 70]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - distance, y, id: 1 }, { x: x + distance, y, id: 2 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  } else {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 110, y + 35, { steps: 10 }); await page.mouse.up()
  }
  await page.waitForTimeout(200)
  expect((await canvas.screenshot()).equals(before)).toBe(false)
  await expect(page.getByTestId('part-card')).toHaveCount(0)
})

test('плавное разнесение, возвращение и вращение без сокращения движения', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await ready(page)
  await page.getByRole('button', { name: 'Включить вращение' }).click()
  await expect(page.getByRole('button', { name: 'Остановить вращение' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Музейная экспозиция', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Выбрать: Изогнутый магазин', exact: true })).toBeVisible()
  await page.waitForTimeout(800)
  const spread = await page.getByTestId('atlas-canvas').screenshot()
  await page.getByRole('button', { name: 'Вернуть модель', exact: true }).click()
  await page.waitForTimeout(800)
  expect((await page.getByTestId('atlas-canvas').screenshot()).equals(spread)).toBe(false)
})


test('потеря WebGL-контекста объясняется и восстанавливается повторным запуском', async ({ page }) => {
  await ready(page)
  const lost = await page.getByTestId('atlas-canvas').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')!
    const extension = gl.getExtension('WEBGL_lose_context')
    if (!extension) return false
    extension.loseContext(); return true
  })
  expect(lost).toBe(true)
  await expect(page.getByRole('alert')).toContainText('Графический контекст прерван')
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByTestId('viewport')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('atlas-canvas')).toHaveCount(1)
})
