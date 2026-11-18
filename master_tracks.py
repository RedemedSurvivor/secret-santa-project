import os
import subprocess

downloads_dir = "e:/cool_stuff/secret-santa-review/audio/downloads"
out_dir = "e:/cool_stuff/secret-santa-review/audio"

tracks = [
    {
        "src": "Water ｜ Tyla ｜ Brendan Ross Saxophone version.mp3",
        "dest": "water_tyla_sax.mp3",
        "title": "Tyla - Water (Brendan Ross Saxophone Cover)"
    },
    {
        "src": "Espresso - Graziatto (Sabrina Carpenter Sax Cover).mp3",
        "dest": "espresso_sabrina_sax.mp3",
        "title": "Sabrina Carpenter - Espresso (Graziatto Sax Cover)"
    },
    {
        "src": "BIRDS OF A  FEATHER  ｜ Billie Eilish ｜ Saxophone Version ｜ Brendan Ross.mp3",
        "dest": "birds_billie_sax.mp3",
        "title": "Billie Eilish - Birds of a Feather (Brendan Ross Sax Cover)"
    },
    {
        "src": "Burna_Boy_Tested_Approved_Trusted_Sax.mp3",
        "dest": "burna_boy_sax.mp3",
        "title": "Burna Boy - Tested, Approved & Trusted (Sax Cover)"
    }
]

# Audio filter chain:
# 1. highpass=f=75: eliminates muddy sub-bass rumble
# 2. lowpass=f=13500: soft analog roll-off
# 3. equalizer cuts boxiness and enhances sax clarity
# 4. loudnorm=I=-18.5:LRA=7:TP=-2.0: standard background bed loudness
af = "highpass=f=75,lowpass=f=13500,equalizer=f=250:width_type=o:width=1.5:g=-2.0,equalizer=f=2400:width_type=o:width=1.0:g=+1.2,loudnorm=I=-18.5:LRA=7:TP=-2.0"

for t in tracks:
    src_path = os.path.join(downloads_dir, t["src"])
    dest_path = os.path.join(out_dir, t["dest"])
    print(f"Mastering: {t['title']}...")
    cmd = [
        "ffmpeg", "-y", "-i", src_path,
        "-af", af,
        "-b:a", "192k",
        dest_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode == 0:
        size_kb = os.path.getsize(dest_path) // 1024
        print(f"  -> Successfully mastered {t['dest']} ({size_kb} KB)")
    else:
        print(f"  -> Error mastering {t['dest']}: {res.stderr[-200:]}")

# Copy the flagship (Tyla Water Sax) to bgm.mp3 as the default
flagship_src = os.path.join(out_dir, "water_tyla_sax.mp3")
flagship_dest = os.path.join(out_dir, "bgm.mp3")
import shutil
shutil.copy2(flagship_src, flagship_dest)
print("Copied water_tyla_sax.mp3 to default bgm.mp3")
