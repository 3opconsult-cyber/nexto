"""Essai de voix off GRATUITE (Piper, voix française « siwis ») : fabrique voix-courte*.mp3 calés sur le minutage des animations.

ATTENTION : ce script n'est PAS lancé par le build et aucun mp3 n'est livré dans le dépôt. Une voix synthétique ne se publie
qu'après écoute par un humain (qualité, prononciation de « PING », ton chaleureux) et vérification de la licence (CC-BY 4.0 :
citer l'auteur de la voix ; texte du modèle : https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/siwis/MODEL_CARD).

Usage (dans un dossier de travail HORS du dépôt) :
  python3 -m venv v && ./v/bin/pip install piper-tts
  curl -L -O https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx
  curl -L -O https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json
  ./v/bin/python /chemin/du/depot/brand/anim-courte/voix/fabriquer_voix_piper.py fr_FR-siwis-medium.onnx sortie/
Puis ÉCOUTER sortie/*.mp3 ; s'ils conviennent, les copier dans public/brand/files/ (voix-courte.mp3, voix-courte-client.mp3,
voix-courte-prestataire.mp3). Nécessite ffmpeg. Une phrase plus longue que sa fenêtre est signalée (« TROP LONG ») : raccourcir le texte
dans brand/anim-courte/scenarios.py puis relancer build.py."""
import pathlib
import subprocess
import sys
import wave

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import scenarios as SC  # noqa: E402
from piper import PiperVoice  # noqa: E402

model, out = sys.argv[1], pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
voice = PiperVoice.load(model)
for key, vid in SC.VIDEOS.items():
    t0, inputs, delays = 0.0, [], []
    for s in vid["shots"]:
        wav = out / f"{key}_{s['id']}.wav"
        with wave.open(str(wav), "wb") as w:
            voice.synthesize_wav(s["v"], w)
        with wave.open(str(wav)) as w:
            dur = w.getnframes() / w.getframerate()
        win = s["d"] - s.get("v0", 0.35) - (0.25 if s["k"] != "end" else 0.1)
        print(key, s["id"], f"voix {dur:.2f} s / fenêtre {win:.2f} s", "OK" if dur <= win else "TROP LONG")
        inputs.append(wav)
        delays.append(int((t0 + s.get("v0", 0.35)) * 1000))
        t0 += s["d"]
    cmd = ["ffmpeg", "-loglevel", "error", "-y"]
    for w in inputs:
        cmd += ["-i", str(w)]
    filt = "".join(f"[{i}:a]adelay={d}|{d}[a{i}];" for i, d in enumerate(delays))
    filt += "".join(f"[a{i}]" for i in range(len(inputs))) + f"amix=inputs={len(inputs)}:normalize=0,apad=whole_dur={t0:.2f}[o]"
    cmd += ["-filter_complex", filt, "-map", "[o]", "-t", f"{t0:.2f}", "-ar", "44100", "-b:a", "128k", str(out / vid["voice"])]
    subprocess.run(cmd, check=True)
    print("écrit", out / vid["voice"], f"{t0:.1f} s")
