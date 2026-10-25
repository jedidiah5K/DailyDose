# Draws the Daily Dose app icon (night sky, moon, skyline with lit windows) and writes the PNG sizes
# phones and the Play Store need. Pure Python, no extra installs: python tools/icons.py
import struct, zlib, math

def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y * w * 3:(y + 1) * w * 3]) for y in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def draw(n):
    s = n / 512
    px = bytearray(n * n * 3)
    def put(x, y, c, a=1.0):
        if 0 <= x < n and 0 <= y < n:
            i = (y * n + x) * 3
            for k in range(3): px[i + k] = int(px[i + k] * (1 - a) + c[k] * a)
    # sky: deep indigo to dusk purple
    top, mid, bot = (6, 8, 24), (35, 33, 90), (122, 61, 92)
    for y in range(n):
        t = y / n
        c = [int(top[k] + (mid[k] - top[k]) * (t / .6)) if t < .6 else int(mid[k] + (bot[k] - mid[k]) * ((t - .6) / .4)) for k in range(3)]
        for x in range(n): put(x, y, c)
    # stars
    for (sx, sy, r) in [(90, 80, 4), (160, 140, 3), (410, 70, 3), (300, 120, 2.5), (60, 200, 2.5), (230, 60, 3), (460, 180, 2.5)]:
        for y in range(int((sy - r) * s), int((sy + r) * s) + 1):
            for x in range(int((sx - r) * s), int((sx + r) * s) + 1):
                d = math.hypot(x - sx * s, y - sy * s)
                if d <= r * s: put(x, y, (255, 255, 255), max(0, 1 - d / (r * s)) * .9)
    # moon with a soft glow
    mx, my, mr = 360 * s, 170 * s, 72 * s
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - mx, y - my)
            if d < mr * 2.2: put(x, y, (255, 220, 150), max(0, (1 - d / (mr * 2.2))) ** 2 * .35)
            if d <= mr: put(x, y, (255, 246, 222), min(1, mr - d + .5))
    # skyline
    blds = [(0, 330, 70), (62, 270, 60), (116, 360, 54), (164, 230, 74), (232, 300, 58), (284, 250, 66), (344, 340, 52), (390, 280, 70), (454, 320, 60)]
    for (bx, by, bw) in blds:
        for y in range(int(by * s), n):
            for x in range(int(bx * s), min(n, int((bx + bw - 6) * s))): put(x, y, (9, 11, 28))
        # windows: a grid, some warm
        for wy in range(by + 22, 500, 30):
            for wx in range(bx + 12, bx + bw - 16, 20):
                lit = (wx * 7 + wy * 3) % 5 < 2
                col = (255, 200, 97) if lit else (30, 37, 70)
                for y in range(int(wy * s), int((wy + 10) * s)):
                    for x in range(int(wx * s), int((wx + 7) * s)): put(x, y, col)
    return px

for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
    png(f'public/icons/{name}', size, size, draw(size))
    print('wrote', name)
