# Builds the home backgrounds from the original scene PNGs: extends each picture outwards so it fills
# any screen shape (sides mirrored, the awning's top row and the counter's bottom row repeated), and
# saves it at good quality. The layout in hub.js stays in the original picture's pixels; the page
# offsets the bigger picture by the padding below.
#   python -I tools/extend-bg.py design/cafe/art/gpt/Daily_Dose_Assets public/art/home
import sys
import numpy as np
from PIL import Image

PAD = {'wide': (300, 600, 300), 'tall': (400, 300, 600)}   # top, each side, bottom (keep in sync with EXT in hub.js)

def extend(a, top, side, bottom):
    a = np.concatenate([a[:, side:0:-1], a, a[:, -2:-side - 2:-1]], axis=1)   # mirror the sides
    return np.concatenate([np.repeat(a[:1], top, 0), a, np.repeat(a[-1:], bottom, 0)], axis=0)

src, out = sys.argv[1], sys.argv[2]
FILES = {('tall', 'day'): '01_Background_Phone_Day', ('tall', 'night'): '02_Background_Phone_Night',
         ('wide', 'day'): '03_Background_Wide_Day', ('wide', 'night'): '04_Background_Wide_Night'}
for (shape, t), name in FILES.items():
        a = np.asarray(Image.open(f'{src}/{name}.png').convert('RGB'))
        im = Image.fromarray(extend(a, *PAD[shape]))
        im.save(f'{out}/{shape}-{t}-x.webp', quality=92, method=6)
        print(shape, t, im.size)
