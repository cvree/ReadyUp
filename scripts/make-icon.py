"""Draws build/icon.png: the three ready-check slots (focus, move, play) on ink.
Run: python3 scripts/make-icon.py  (requires Pillow)"""
from PIL import Image, ImageDraw

S = 1024  # draw large, downsample for smooth edges
INK = (12, 15, 21, 255)
SLOTS = [(169, 184, 245, 255), (243, 154, 107, 255), (239, 203, 114, 255)]  # moonlight, ember, gold

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=INK)

w, h, gap, slant = 196, 470, 46, 92
total = 3 * w + 2 * gap + slant
x0 = (S - total) / 2
y0 = (S - h) / 2
for i, color in enumerate(SLOTS):
    x = x0 + i * (w + gap)
    d.polygon([(x + slant, y0), (x + slant + w, y0), (x + w, y0 + h), (x, y0 + h)], fill=color)

img.resize((512, 512), Image.LANCZOS).save("build/icon.png")
print("wrote build/icon.png")
