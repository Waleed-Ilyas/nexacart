// Flat product illustrations drawn as SVG, so the demo store has consistent images without stock photos.
// Each function returns the drawing for a 900x900 canvas. `art()` wraps it with a background and a floor shadow.

type Palette = { bg: [string, string]; main: string; accent: string; dark: string };
const rect = (x: number, y: number, w: number, h: number, r: number, fill: string, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const circle = (cx: number, cy: number, r: number, fill: string, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = "") =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;

const shapes: Record<string, (p: Palette) => string> = {
  lamp: (p) =>
    ellipse(450, 700, 130, 26, p.dark) +
    rect(438, 300, 24, 400, 6, p.dark) +
    ellipse(450, 470, 200, 60, p.accent, 'opacity=".18"') +
    path("M320 330 L580 330 L525 175 L375 175 Z", p.main) +
    path("M320 330 L580 330 L570 350 L330 350 Z", p.accent, 'opacity=".55"') +
    circle(450, 350, 24, "#fff7d6"),
  mug: (p) =>
    path("M590 400 C700 400 700 560 590 560", "none", `stroke="${p.main}" stroke-width="38" stroke-linecap="round"`) +
    rect(290, 330, 300, 340, 46, p.main) +
    ellipse(440, 336, 150, 34, p.dark) +
    ellipse(440, 336, 132, 24, "#5b3a29") +
    rect(320, 420, 24, 200, 12, "#ffffff", 'opacity=".18"') +
    rect(290, 560, 300, 18, 0, p.accent, 'opacity=".6"'),
  planter: (p) =>
    ellipse(440, 320, 30, 130, p.accent, 'transform="rotate(-28 440 400)"') +
    ellipse(470, 300, 28, 140, p.accent, 'transform="rotate(24 470 420)"') +
    ellipse(450, 280, 26, 150, "#4f7a55") +
    path("M330 430 L570 430 L540 690 Q450 715 360 690 Z", p.main) +
    [0, 1, 2, 3, 4, 5].map((i) => rect(348 + i * 6, 440, 4, 240, 2, "#ffffff", 'opacity=".16"')).join("") +
    rect(320, 415, 260, 34, 14, p.dark),
  headphones: (p) =>
    path("M270 520 C270 260 630 260 630 520", "none", `stroke="${p.dark}" stroke-width="40" stroke-linecap="round"`) +
    path("M290 500 C290 300 610 300 610 500", "none", `stroke="${p.accent}" stroke-width="10" stroke-linecap="round"`) +
    rect(210, 470, 110, 190, 50, p.main) +
    rect(580, 470, 110, 190, 50, p.main) +
    ellipse(300, 565, 26, 78, p.dark) +
    ellipse(600, 565, 26, 78, p.dark),
  speaker: (p) =>
    rect(270, 300, 360, 400, 60, p.main) +
    circle(450, 500, 112, p.dark) +
    circle(450, 500, 74, p.main, 'opacity=".9"') +
    circle(450, 500, 30, p.dark) +
    circle(450, 378, 30, p.dark) +
    circle(450, 378, 12, p.accent) +
    rect(400, 640, 100, 16, 8, p.accent),
  keyboard: (p) =>
    rect(170, 380, 560, 250, 34, p.dark) +
    Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => rect(196 + c * 52, 404 + r * 52, 44, 44, 9, r === 3 && c > 1 && c < 8 ? p.accent : p.main)).join(""),
    ).join("") +
    path("M170 630 L730 630 L750 660 L150 660 Z", p.main, 'opacity=".5"'),
  backpack: (p) =>
    path("M400 270 C400 200 500 200 500 270", "none", `stroke="${p.dark}" stroke-width="22" stroke-linecap="round"`) +
    rect(270, 260, 360, 460, 110, p.main) +
    rect(300, 460, 300, 190, 46, p.dark, 'opacity=".9"') +
    rect(330, 500, 240, 22, 11, p.accent) +
    path("M290 340 Q450 420 610 340", "none", `stroke="${p.dark}" stroke-width="14" stroke-linecap="round"`) +
    rect(240, 380, 34, 200, 17, p.dark) +
    rect(626, 380, 34, 200, 17, p.dark),
  bottle: (p) =>
    rect(400, 190, 100, 70, 16, p.dark) +
    rect(415, 255, 70, 60, 10, p.accent) +
    rect(345, 305, 210, 400, 70, p.main) +
    rect(345, 470, 210, 90, 0, p.accent, 'opacity=".9"') +
    rect(372, 340, 20, 320, 10, "#ffffff", 'opacity=".18"'),
  lantern: (p) =>
    path("M370 230 C370 130 530 130 530 230", "none", `stroke="${p.dark}" stroke-width="20" stroke-linecap="round"`) +
    rect(330, 225, 240, 50, 16, p.dark) +
    rect(345, 270, 210, 340, 20, "#fff2c9", 'opacity=".95"') +
    ellipse(450, 470, 150, 190, "#ffd45a", 'opacity=".55"') +
    ellipse(450, 470, 70, 110, "#fff7d6") +
    rect(345, 270, 210, 340, 20, "none", `stroke="${p.main}" stroke-width="14"`) +
    rect(450 - 7, 270, 14, 340, 0, p.main) +
    rect(320, 605, 260, 60, 20, p.dark),
  cap: (p) =>
    path("M280 560 C280 380 620 380 620 560 Z", p.main) +
    path("M450 400 L450 560", "none", `stroke="${p.dark}" stroke-width="8" opacity=".35"`) +
    path("M370 410 Q340 490 345 560", "none", `stroke="${p.dark}" stroke-width="8" opacity=".35"`) +
    path("M530 410 Q560 490 555 560", "none", `stroke="${p.dark}" stroke-width="8" opacity=".35"`) +
    path("M270 560 L650 560 Q800 570 780 620 Q560 660 270 600 Z", p.accent) +
    circle(450, 396, 20, p.dark),
  tote: (p) =>
    path("M370 320 C370 170 530 170 530 320", "none", `stroke="${p.dark}" stroke-width="26" stroke-linecap="round"`) +
    rect(250, 300, 400, 420, 20, p.main) +
    rect(250, 300, 400, 60, 0, p.dark, 'opacity=".12"') +
    rect(330, 470, 240, 150, 14, p.accent) +
    rect(345, 490, 210, 12, 6, "#ffffff", 'opacity=".55"'),
  sunglasses: (p) =>
    rect(200, 400, 210, 170, 70, p.dark) +
    rect(490, 400, 210, 170, 70, p.dark) +
    rect(214, 414, 182, 142, 58, p.main, 'opacity=".55"') +
    rect(504, 414, 182, 142, 58, p.main, 'opacity=".55"') +
    path("M410 450 Q450 420 490 450", "none", `stroke="${p.dark}" stroke-width="18" stroke-linecap="round"`) +
    path("M200 440 L150 420", "none", `stroke="${p.dark}" stroke-width="16" stroke-linecap="round"`) +
    path("M700 440 L750 420", "none", `stroke="${p.dark}" stroke-width="16" stroke-linecap="round"`) +
    path("M230 440 Q260 420 300 424", "none", 'stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".45"'),
};

export const PALETTES: Record<string, Palette> = {
  lamp: { bg: ["#f7efe1", "#efe1c8"], main: "#e0a458", accent: "#f2c879", dark: "#3a3a3f" },
  mug: { bg: ["#f4e9e2", "#ead6ca"], main: "#c9694b", accent: "#e9a486", dark: "#5d3b2e" },
  planter: { bg: ["#e9f0e6", "#d6e4d1"], main: "#d9c9a8", accent: "#7fae82", dark: "#a8956f" },
  headphones: { bg: ["#e6ebf5", "#cfd9ec"], main: "#2f3a55", accent: "#8fa3d6", dark: "#1a2033" },
  speaker: { bg: ["#efe9f5", "#ddd1ec"], main: "#4a4359", accent: "#b39ddb", dark: "#25212f" },
  keyboard: { bg: ["#e8f0f2", "#d1e2e7"], main: "#dfe6ea", accent: "#4ba3a8", dark: "#2a3439" },
  backpack: { bg: ["#e9efe3", "#d5e2c8"], main: "#4f6b45", accent: "#c9a24b", dark: "#2f4029" },
  bottle: { bg: ["#e5f0f5", "#cce3ee"], main: "#3f7fa6", accent: "#e9eef2", dark: "#22384a" },
  lantern: { bg: ["#f3ece0", "#e6d8bf"], main: "#5c6b4a", accent: "#a58d57", dark: "#33382b" },
  cap: { bg: ["#f5e9e6", "#ecd3cd"], main: "#b8443a", accent: "#e8b0a2", dark: "#5a1f1a" },
  tote: { bg: ["#f3eee6", "#e4dac8"], main: "#e6dcc6", accent: "#3f5c7a", dark: "#8a7a5c" },
  sunglasses: { bg: ["#f1e8f0", "#e3d0e0"], main: "#7b4a7a", accent: "#e0a1c4", dark: "#241a24" },
};

export function art(kind: string): string {
  const p = PALETTES[kind];
  const draw = shapes[kind];
  if (!p || !draw) throw new Error(`No artwork for "${kind}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"/></linearGradient></defs>
<rect width="900" height="900" fill="url(#bg)"/>
<ellipse cx="450" cy="742" rx="240" ry="26" fill="#000" opacity=".14"/>
${draw(p)}
</svg>`;
}

export const ART_KINDS = Object.keys(shapes);
