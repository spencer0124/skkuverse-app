"""Cut the train from the app's Tossface font into src/assets/metro.png.

The page draws Tossface's 🚇 (U+1F687) on its line map, as the web version did
with the Tossface web font. A bundled page may not load a font from a CDN, and
an sbix colour font is not drawn by every Android WebView, so the glyph's own
PNG is taken out of the font's largest bitmap strike instead. Run it again only
if the font changes: `yarn workspace @skkuverse/subway-typing art`.
"""
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / '../../apps/mobile/assets/fonts/TossFaceFontMac.ttf'
OUT = ROOT / 'src/assets/metro.png'

font = TTFont(FONT)
glyph = font.getBestCmap()[0x1F687]
strikes = font['sbix'].strikes
OUT.write_bytes(strikes[max(strikes)].glyphs[glyph].imageData)
print(f'wrote {OUT}')
