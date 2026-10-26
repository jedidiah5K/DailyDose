# Draws the Daily Dose app icon (four game-colour squares on white, like a puzzle grid) and writes the
# PNG sizes phones need, plus icon.svg. Pure Python, no extra installs: python tools/icons.py
import struct, zlib

TILES = [((0x6A, 0xA5, 0xEC), 104, 104), ((0xF2, 0xC9, 0x4C), 268, 104), ((0xF2, 0x90, 0x6F), 104, 268), ((0xB9, 0xA0, 0xEC), 268, 268)]
SIDE, R = 140, 22

def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y * w * 3:(y + 1) * w * 3]) for y in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def inside(x, y, x0, y0):
    # rounded square test in 512-space
    if not (x0 <= x <= x0 + SIDE and y0 <= y <= y0 + SIDE): return False
    cx = min(max(x, x0 + R), x0 + SIDE - R); cy = min(max(y, y0 + R), y0 + SIDE - R)
    return (x - cx) ** 2 + (y - cy) ** 2 <= R * R

def draw(n):
    s = 512 / n
    px = bytearray(bytes([0xFA, 0xF7, 0xF2]) * (n * n))
    for y in range(n):
        for x in range(n):
            for col, x0, y0 in TILES:
                if inside((x + .5) * s, (y + .5) * s, x0, y0):
                    i = (y * n + x) * 3; px[i:i + 3] = bytes(col)
    return px

for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    png(f'public/icons/{name}', size, size, draw(size))
    print('wrote', name)
svg = ''.join(f'<rect x="{x0}" y="{y0}" width="{SIDE}" height="{SIDE}" rx="{R}" fill="#{c[0]:02X}{c[1]:02X}{c[2]:02X}"/>' for c, x0, y0 in TILES)
open('public/icons/icon.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#FAF7F2"/>{svg}</svg>\n')
