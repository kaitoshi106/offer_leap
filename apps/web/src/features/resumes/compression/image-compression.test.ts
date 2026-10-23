import { describe, expect, it } from 'vitest';

import { fitWithin, isAlreadySmall, isCompressible, jpegName, MAX_DIMENSION } from './image-compression';

describe('image compression rules', () => {
  it('scales the longest side down to the limit, keeping the aspect ratio, and never upscales', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: MAX_DIMENSION, height: 1800 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1800, height: MAX_DIMENSION });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('keeps photos that are already small enough', () => {
    expect(isAlreadySmall(900_000, 1600, 1200)).toBe(true);
    expect(isAlreadySmall(900_000, 4000, 3000)).toBe(false); // small file but huge picture
    expect(isAlreadySmall(5_000_000, 1600, 1200)).toBe(false);
  });

  it('only recompresses photos and names the result as a JPEG', () => {
    expect(isCompressible('image/png')).toBe(true);
    expect(isCompressible('application/pdf')).toBe(false);
    expect(jpegName('CV Nguyễn An.PNG')).toBe('CV Nguyễn An.jpg');
    expect(jpegName('scan.v2.webp')).toBe('scan.v2.jpg');
    expect(jpegName('.png')).toBe('cv.jpg');
  });
});
