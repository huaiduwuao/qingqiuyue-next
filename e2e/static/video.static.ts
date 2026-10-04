import { COMMON, VIDEO, VIDEO_ID } from './fixtures';
import { expect, installMocks, test } from './mock';

test('视频详情:播放器挂载、播放进度推进、拖进度条能 seek', async ({ page, errors }) => {
  const api = await installMocks(page, { rules: [...COMMON, ...VIDEO] });
  await page.goto(`/detail/video-detail?id=${VIDEO_ID}`);
  await expect(page.getByText('E2E 测试视频').first()).toBeVisible();

  const video = page.locator('video').first();
  await expect(video).toBeAttached();
  // 元数据到手:真实时长 6 秒
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => Math.round(v.duration))).toBe(6);

  // 静音后点播放(无用户手势的有声自动播放会被浏览器拦)
  await video.evaluate((v: HTMLVideoElement) => (v.muted = true));
  const vb = (await video.boundingBox())!;
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2); // 唤出控制条
  await page.getByRole('button', { name: '播放', exact: true }).first().click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 8_000 }).toBeGreaterThan(0.3);

  // 进度条跟着走
  const slider = page.getByRole('slider', { name: '播放进度' }).first();
  await expect.poll(async () => Number(await slider.getAttribute('aria-valuenow'))).toBeGreaterThan(0);

  // 暂停后点进度条约 75% 处 → currentTime 跳到 4~5.5 秒
  await page.getByRole('button', { name: '暂停', exact: true }).first().click();
  // role=slider 是 MUI 视觉隐藏的 <input>,点击要落在整条轨道(.MuiSlider-root)上
  const track = slider.locator('xpath=ancestor::*[contains(@class,"MuiSlider-root")][1]');
  const box = (await track.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(3.8);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeLessThan(5.6);
  expect(await video.evaluate((v: HTMLVideoElement) => v.error)).toBeNull();

  expect(api.unmatched).toEqual([]);
  expect(errors).toEqual([]);
});
