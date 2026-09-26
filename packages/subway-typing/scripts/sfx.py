"""Cut the page's sound effects out of Kenney's CC0 packs into src/assets/sfx/.

The page may not fetch anything, so every sound is a file the build inlines.
Each one is trimmed of its leading silence (a click that starts 25 ms late
feels late), cut to length, faded out and peak-normalised; the page sets each
one's level. Short sounds stay WAV: an MP3 starts with the encoder's padding.
Run it again only to change a sound: `yarn workspace @skkuverse/subway-typing sfx`
(needs ffmpeg).
"""
import io
import re
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/assets/sfx'

# (output, pack, file in the pack, longest it may run in seconds)
SOUNDS = [
    ('key1.wav', 'ui-audio', 'click3.ogg', 0.06),
    ('key2.wav', 'ui-audio', 'click4.ogg', 0.06),
    ('key3.wav', 'ui-audio', 'click5.ogg', 0.06),
    ('slip.wav', 'interface-sounds', 'bong_001.ogg', 0.12),
    ('arrive.mp3', 'interface-sounds', 'confirmation_001.ogg', 0.4),
    ('transfer.mp3', 'interface-sounds', 'question_002.ogg', 0.4),
    ('finish.mp3', 'music-jingles', 'jingles_PIZZI10.ogg', 1.2),
]

PEAK_DB = -1.0
FADE_S = 0.01


def pack(name: str) -> zipfile.ZipFile:
    page = urllib.request.urlopen(f'https://kenney.nl/assets/{name}').read().decode()
    url = re.search(r'https://kenney\.nl/media/pages/assets/[^"]+\.zip', page)
    if not url:
        raise SystemExit(f'no download link on the {name} page')
    return zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url.group(0)).read()))


def ffmpeg(*args: str) -> str:
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', *args], capture_output=True, text=True, check=True).stderr


def cut(src: Path, out: Path, length: float) -> None:
    shape = (
        'silenceremove=start_periods=1:start_threshold=-45dB,'
        f'atrim=end={length},afade=t=out:st={length - FADE_S}:d={FADE_S}'
    )
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', ffmpeg('-i', str(src), '-af', f'{shape},volumedetect', '-f', 'null', '-')).group(1))
    codec = ['-c:a', 'pcm_s16le'] if out.suffix == '.wav' else ['-c:a', 'libmp3lame', '-b:a', '64k']
    ffmpeg(
        '-i', str(src),
        '-af', f'{shape},volume={PEAK_DB - peak}dB',
        '-ac', '1', '-ar', '44100', *codec,
        '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
        str(out),
    )


OUT.mkdir(parents=True, exist_ok=True)
packs: dict[str, zipfile.ZipFile] = {}
with tempfile.TemporaryDirectory() as tmp:
    for out, name, file, length in SOUNDS:
        z = packs.setdefault(name, pack(name))
        member = next(m for m in z.namelist() if m.endswith('/' + file))
        src = Path(tmp) / file
        src.write_bytes(z.read(member))
        cut(src, OUT / out, length)
        print(f'wrote {OUT / out} ({(OUT / out).stat().st_size} B) from {name}/{file}')
