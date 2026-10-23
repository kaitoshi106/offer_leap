import { completeOnboarding, expect, registerAndVerify, test } from './support';

test.describe('CV photo compression', () => {
  test('shrinks a large phone photo in a Web Worker before uploading it', async ({ page }) => {
    await registerAndVerify(page, 'Minh Photo');
    await completeOnboarding(page);
    // Playwright can't read file parts of a multipart body, so the page notes what each upload carried.
    await page.addInitScript(() => {
      const sent: { name: string; type: string; size: number }[] = [];
      Object.assign(window, { sentFiles: sent });
      const fetch = window.fetch;
      window.fetch = (input, init) => {
        if (init?.body instanceof FormData)
          for (const value of init.body.values())
            if (value instanceof File) sent.push({ name: value.name, type: value.type, size: value.size });
        return fetch(input, init);
      };
    });
    await page.goto('/vi/profile');

    // A 3000×2000 "phone photo": a gradient with faint per-pixel sensor noise, which PNG can't squeeze much (a few
    // MB, under the 10 MB limit) but JPEG handles well.
    const photo = Buffer.from(
      await page.evaluate(async () => {
        const [width, height] = [3000, 2000];
        const pixels = new ImageData(width, height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const x = (i / 4) % width;
          pixels.data[i] = (x / width) * 255;
          pixels.data[i + 1] = 120 + Math.random() * 12;
          pixels.data[i + 2] = 200;
          pixels.data[i + 3] = 255;
        }
        const canvas = new OffscreenCanvas(width, height);
        canvas.getContext('2d')!.putImageData(pixels, 0, 0);
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        return [...new Uint8Array(await blob.arrayBuffer())];
      }),
    );
    expect(photo.length).toBeGreaterThan(2_000_000);
    expect(photo.length).toBeLessThan(10 * 1024 * 1024);

    const cvs = page.getByRole('region', { name: 'CV đã tải lên' });
    await cvs
      .getByLabel(/Kéo thả CV/)
      .setInputFiles({ name: 'CV chụp màn hình.png', mimeType: 'image/png', buffer: photo });

    // What left the browser is a JPEG, much smaller than the photo that was picked.
    await expect(cvs.getByRole('listitem').filter({ hasText: 'CV chụp màn hình.jpg' })).toBeVisible();
    const [sent] = await page.evaluate(
      () => (window as unknown as { sentFiles: { name: string; type: string; size: number }[] }).sentFiles,
    );
    expect(sent).toMatchObject({ name: 'CV chụp màn hình.jpg', type: 'image/jpeg' });
    expect(sent!.size).toBeLessThan(photo.length / 2);
  });
});
