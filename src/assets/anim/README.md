Sister animation sheets go here: `<id>_<anim>.png`, 256 x 384 (a 2 x 2 grid of 128 x 192 frames).

Don't drop ChatGPT's 1024 x 1536 exports in directly. Run them through the intake first:

    python3 tools/intake_anims.py path/to/folder-or.zip

Animations: idle, run, attack, skill, litany, hit, death, victory. Any Sister with sheets plays
them in real-time fights; the rest keep the motion built from their still figure.
