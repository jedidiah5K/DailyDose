# Stand-in game backdrops (Job, 2026-11-20): the home café picture, blurred and washed in each game's
# colour, so every game still sits "in the café" until its own pixel-art scene is drawn.
#   python -I tools/game-bg.py
from PIL import Image, ImageFilter, ImageEnhance

SRC = 'public/art/home/tall-day.webp'
COLORS = {'shot': '#FFC93C', 'blend': '#FF8A5B', 'rush': '#F0452B', 'hilo': '#1F9A5D', 'link': '#3D6FD9', 'ladder': '#C9A46A'}

base = Image.open(SRC).convert('RGB').resize((490, 801), Image.LANCZOS)   # half size: it's blurred anyway
base = base.filter(ImageFilter.GaussianBlur(9))
base = ImageEnhance.Color(base).enhance(.6)
for k, hexc in COLORS.items():
    tint = Image.new('RGB', base.size, hexc)
    im = Image.blend(base, tint, .55)
    im.save(f'public/art/worlds/{k}-cafe.webp', quality=82, method=6)
    print(k, im.size)
