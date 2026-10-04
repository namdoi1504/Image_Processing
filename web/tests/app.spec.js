import { test, expect } from '@playwright/test';
import path from 'node:path';

test('ASCII controls, request, text download and invalidation', async ({ page }) => {
  await page.route('https://image.arthurdoi.id.vn/predict', async route => {
    const body = route.request().postDataBuffer().toString();
    expect(body).toContain('name="ascii_columns"\r\n\r\n160');
    expect(body).toContain('name="demo"\r\n\r\nascii');
    await route.fulfill({ json: {
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nFkAAAAASUVORK5CYII=',
      model: 'ASCII Art', elapsed_seconds: 0.01, width: 1920, height: 1200,
      ascii_text: '@@..\n  ##', items: [],
    } });
  });
  await page.goto('/');
  await page.locator('.demo-card[data-demo="ascii"]').click();
  await expect(page.locator('#sample-run')).toBeHidden();
  await page.locator('#parameter').fill('160');
  await expect(page.locator('#parameter-value')).toHaveText('160 cột');
  await page.locator('#run').click();
  await expect(page.locator('#result-summary')).toContainText('ASCII Art');
  const download = page.waitForEvent('download');
  await page.locator('#download-text').click();
  expect((await download).suggestedFilename()).toBe('visionlab-ascii.txt');
  await page.locator('#parameter').fill('120');
  await expect(page.locator('#download-text')).toBeHidden();
  await expect(page.locator('#download')).toBeDisabled();
});

test('saved examples, comparison, download and mode switching', async ({ page }) => {
  await page.goto('/');
  await page.locator('#sample-run').click();
  await expect(page.locator('#canvas-label')).toHaveText('KẾT QUẢ MẪU ĐÃ LƯU');
  await page.locator('#compare').click();
  await expect(page.locator('#overlay')).toBeVisible();
  await page.locator('#split').fill('70');
  await expect(page.locator('#overlay')).toHaveCSS('clip-path', 'inset(0px 0px 0px 70%)');
  const download = page.waitForEvent('download');
  await page.locator('#download').click();
  expect((await download).suggestedFilename()).toBe('visionlab-detection.jpg');
  await page.locator('.demo-card[data-demo="style"]').click();
  await expect(page.locator('#download')).toBeDisabled();
  await page.locator('#sample-run').click();
  await expect(page.locator('#preview')).toHaveAttribute('src', '/samples/monalisa-result.jpg');
  await page.locator('.demo-card[data-demo="segmentation"]').click();
  await page.locator('#sample-run').click();
  await expect(page.locator('#preview')).toHaveAttribute('src', '/samples/cycling-result.png');
  await page.locator('#connection').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
});

test('upload, API contract, result invalidation and API failure', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vision-api', ''));
  await page.route('https://image.arthurdoi.id.vn/predict', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataBuffer().toString()).toContain('name="confidence"');
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nFkAAAAASUVORK5CYII=';
    await route.fulfill({ json: { image, model: 'Test model', elapsed_seconds: 0.5, width: 1, height: 1, items: [{label: '<script>test</script>', value:'90%'}] } });
  });
  await page.goto('/');
  await page.locator('#file').setInputFiles(path.resolve('public/samples/zebras.jpg'));
  await expect(page.locator('#filename')).toHaveText('zebras.jpg');
  await page.locator('#run').click();
  await expect(page.locator('#result-summary')).toContainText('Test model');
  await expect(page.locator('#result-details')).toContainText('<script>test</script>');
  await expect(page.locator('#result-details script')).toHaveCount(0);
  await page.locator('#parameter').fill('65');
  await expect(page.locator('#download')).toBeDisabled();
  await page.route('https://image.arthurdoi.id.vn/predict', route => route.fulfill({ status: 503, json: {detail:'Máy chủ đang bận.'} }));
  await page.locator('#run').click();
  await expect(page.locator('#status')).toHaveText('Máy chủ đang bận.');
  await expect(page.locator('#run')).toBeEnabled();
});

test('invalid upload and mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#file').setInputFiles({ name:'bad.txt', mimeType:'text/plain', buffer:Buffer.from('invalid') });
  await expect(page.locator('#status')).toContainText('Vui lòng chọn ảnh');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('desktop without JavaScript errors', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.locator('#preview').evaluate(img => img.decode());
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
