#!/bin/sh
# Assemble la page d'audit (artefact) et la copie servie sur /maquette.
D=$(dirname "$0")
python3 - "$D" <<'PY'
import sys,os
d=sys.argv[1]
src=open(os.path.join(d,'index.html')).read()
data=open(os.path.join(d,'data.js')).read()
out=src.replace('/*DATA*/',data,1)
open(os.path.join(d,'artefact.html'),'w').write(out)
open(os.path.join(d,'../../../public/maquette.html'),'w').write('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="robots" content="noindex, nofollow">\n'+out.replace('<header class="head">','</head>\n<body>\n<header class="head">',1)+'\n</body>\n</html>\n')
PY
