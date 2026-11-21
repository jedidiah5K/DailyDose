# Mugs for Emoji Decode and Imposter (2026-11-21): an existing mug recoloured, its cream glyph painted out
# and a new pixel glyph drawn in the same cream. Game mugs, home-window mugs and coasters.
#   python -I tools/new-mugs.py
import colorsys
from PIL import Image

# key: (source game, home art no., new home art no., hue shift in turns, value scale, glyph)
NEW = {'emoji': ('shot', 1, 13, -0.075, 0.97, 'smile'), 'imposter': ('rush', 3, 14, -0.045, 0.86, 'eye')}
GLYPH = {  # 9x9, '#' = cream
  'smile': ['..#####..', '.#.....#.', '#.......#', '#.##.##.#', '#.......#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..'],
  'eye':   ['.........', '..#####..', '.#.....#.', '#..###..#', '#.#####.#', '#..###..#', '.#.....#.', '..#####..', '.........'],
}

def cream(p):
  r, g, b, a = p
  return a > 200 and r > 215 and g > 195 and b > 160 and r - b < 70

def recolour(im, dh, dv):
  px = im.load()
  for y in range(im.height):
    for x in range(im.width):
      r, g, b, a = px[x, y]
      if not a or cream(px[x, y]): continue
      h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
      if s < .35: continue  # outlines and coffee stay as they are
      r, g, b = colorsys.hsv_to_rgb((h + dh) % 1, s, v * dv)
      px[x, y] = (round(r * 255), round(g * 255), round(b * 255), a)

def reglyph(im, glyph):
  px = im.load(); w, h = im.size
  # the old glyph: cream pixels in the body, below the rim (top third holds the rim and the cup's inside)
  pts = [(x, y) for y in range(int(h * .38), h) for x in range(w) if cream(px[x, y])]
  if not pts: return
  x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts); y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
  x0, x1, y0, y1 = x0 - 2, x1 + 2, y0 - 2, y1 + 2
  for y in range(y0, y1 + 1):  # paint out: blend the body colour across from just left to just right of the glyph
    l, r = px[x0 - 1, y], px[x1 + 1, y]
    for x in range(x0, x1 + 1):
      t = (x - x0) / (x1 - x0)
      px[x, y] = tuple(round(l[i] * (1 - t) + r[i] * t) for i in range(3)) + (255,)
  ink = (241, 226, 201, 255)
  n = len(GLYPH[glyph]); cell = max(2, round(w * .042))  # about the art's own pixel size
  cx, cy = (x0 + x1) // 2 - cell * n // 2, (y0 + y1) // 2 - cell * n // 2
  for j, row in enumerate(GLYPH[glyph]):
    for i, ch in enumerate(row):
      if ch == '#':
        for yy in range(cell):
          for xx in range(cell): px[cx + i * cell + xx, cy + j * cell + yy] = ink

for key, (src, art, new, dh, dv, glyph) in NEW.items():
  jobs = [(f'mugs/{src}-{s}', f'mugs/{key}-{s}', True) for s in ('empty', 'full')]
  jobs += [(f'home/mug_{art}', f'home/mug_{new}', True), (f'home/mug_{art + 6}', f'home/mug_{new + 6}', True),
           (f'home/coaster_{art}', f'home/coaster_{new}', False)]
  for a, b, g in jobs:
    im = Image.open(f'public/art/{a}.webp').convert('RGBA')
    recolour(im, dh, dv)
    if g: reglyph(im, glyph)
    im.save(f'public/art/{b}.webp', lossless=True)
    print(b, im.size)
