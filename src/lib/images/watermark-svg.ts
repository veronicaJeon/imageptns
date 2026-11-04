const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};

function pixelTextRects(text: string, x: number, y: number, unit: number, opacity: number) {
  let cursor = x;
  const rects: string[] = [];
  for (const char of text.toUpperCase()) {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, colIndex) => {
        if (pixel !== "1") return;
        rects.push(
          `<rect x="${cursor + colIndex * unit}" y="${y + rowIndex * unit}" width="${unit}" height="${unit}" rx="${unit * 0.16}" fill="white" fill-opacity="${opacity}"/>`,
        );
      });
    });
    cursor += (glyph[0].length + 1) * unit;
  }
  return rects.join("");
}

function pixelTextWidth(text: string, unit: number) {
  return [...text.toUpperCase()].reduce((width, char) => {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    return width + (glyph[0].length + 1) * unit;
  }, 0);
}

export function pixelWatermarkImage(unit: number) {
  const label = "IMAGE PARTNERS";
  const width = pixelTextWidth(label, unit);
  const height = 7 * unit;
  const data = new Uint8ClampedArray(width * height * 4);
  let cursor = 0;

  for (const char of label) {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, colIndex) => {
        if (pixel !== "1") return;
        for (let y = 0; y < unit; y += 1) {
          for (let x = 0; x < unit; x += 1) {
            const targetX = cursor + colIndex * unit + x;
            const targetY = rowIndex * unit + y;
            const offset = (targetY * width + targetX) * 4;
            data[offset] = 255;
            data[offset + 1] = 255;
            data[offset + 2] = 255;
            data[offset + 3] = 255;
          }
        }
      });
    });
    cursor += (glyph[0].length + 1) * unit;
  }

  return { data, width, height };
}

export function watermarkSvg(width: number, height: number) {
  const label = "IMAGE PARTNERS";
  const unit = Math.max(3, Math.min(14, Math.round(Math.min(width, height) * 0.008)));
  const labelWidth = pixelTextWidth(label, unit);
  const labelHeight = 7 * unit;
  const smallUnit = Math.max(2, Math.round(unit * 0.42));
  const smallWidth = pixelTextWidth(label, smallUnit);
  const safePadding = Math.max(12, Math.round(Math.min(width, height) * 0.025));

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>
    <g transform="rotate(-24 ${width / 2} ${height / 2})">
      ${pixelTextRects(label, (width - labelWidth) / 2, (height - labelHeight) / 2, unit, 0.26)}
    </g>
    <g>
      ${pixelTextRects(label, width - safePadding - smallWidth, height - safePadding - 7 * smallUnit, smallUnit, 0.72)}
    </g>
  </svg>`;
}
