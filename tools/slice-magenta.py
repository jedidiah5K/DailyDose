"""Cut sprites out of a magenta (#FF00FF) sheet: key the magenta to transparent, then save each
separate object as <out>/<name>_<n>.png, numbered left-to-right, top-to-bottom (rows by overlap).
Run: python -I tools/slice-magenta.py <sheet.png> <outdir> <name> [merge_px]"""
import sys, os
import numpy as np, cv2
from PIL import Image

src, out, name = sys.argv[1:4]
merge = int(sys.argv[4]) if len(sys.argv) > 4 else 12
a = np.array(Image.open(src).convert('RGB')).astype(int)
r, g, b = a[...,0], a[...,1], a[...,2]
# magenta and its pink fringe: red and blue both high, green well below them
bgm = (r > 140) & (b > 140) & (g < np.minimum(r, b) * 0.62)
alpha = (~bgm).astype(np.uint8) * 255
alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((3,3), np.uint8))  # drop 1px specks
# despill: pull leftover pink tint out of edge pixels
edge = cv2.dilate(bgm.astype(np.uint8), np.ones((5,5), np.uint8)).astype(bool) & ~bgm
m = np.minimum(r, b); spill = edge & (m > g + 30)
a[...,0] = np.where(spill, np.minimum(r, g + 40), r); a[...,2] = np.where(spill, np.minimum(b, g + 40), b)
# group pixels into objects; merge_px joins small parts that belong together (sparkle lines, zzz)
joined = cv2.dilate(alpha, np.ones((merge, merge), np.uint8))
n, lab, stats, _ = cv2.connectedComponentsWithStats(joined)
boxes = [tuple(stats[i][:4]) for i in range(1, n) if stats[i][4] > 400]
# reading order: group into rows by vertical overlap, then left to right
boxes.sort(key=lambda s: s[1]); rows = []
for bx in boxes:
    for row in rows:
        if bx[1] < row[0][1] + row[0][3] * 0.6: row.append(bx); break
    else: rows.append([bx])
os.makedirs(out, exist_ok=True)
rgba = np.dstack([a.clip(0,255).astype(np.uint8), alpha])
k = 0
for row in rows:
    for x, y, w, h in sorted(row):
        piece = rgba[y:y+h, x:x+w].copy()
        piece[..., 3] = np.where(lab[y:y+h, x:x+w] == lab[y + h//2, x + w//2] if False else True, piece[..., 3], 0)
        ys, xs = np.nonzero(piece[..., 3])
        if len(xs) == 0: continue
        piece = piece[ys.min():ys.max()+1, xs.min():xs.max()+1]
        k += 1; Image.fromarray(piece).save(f'{out}/{name}_{k}.png')
        print(f'{name}_{k}', piece.shape[1], piece.shape[0])
