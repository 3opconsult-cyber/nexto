import re
src=open('/home/user/nexto/public/maquette.html').read()
css=src[src.index('<style>')+7:src.index('</style>')]
js=src[src.index('<script>')+8:src.rindex('</script>')]
qc=open('qc.js').read()
# --- CSS : jetons + thème ---
light=":root{--teal:#12B39C;--tealD:#0C8F7E;--navy:#123644;--gold:#F2A93B;--orange:#E8743B;--paper:#F3F6F5;--card:#fff;--ink:#123644;--slate:#4E6470;--line:#DCE5E3;--land:#EAF1EC;--water:#BFE3F0;--bg:#EEF3F2;--ok:#1a8f4c;--red:#c0503a;--road:#fff;--park:#CFE6D2}"
darkv="--paper:#0F232C;--card:#17323D;--ink:#EAF4F2;--slate:#A9BEC6;--line:#2A4753;--land:#1B3540;--water:#1E4B63;--bg:#0A171D;--road:#2E4E5A;--park:#21483F;--navy:#EAF4F2;--tealD:#4FD1BC;--ok:#5FD08F;--red:#F08A70;color-scheme:dark"
css=re.sub(r":root\{--teal[^}]*\}\n:root\[data-theme=dark\]\{[^}]*\}", light+"\n@media (prefers-color-scheme:dark){:root:not([data-theme=light]){"+darkv+"}}\n:root[data-theme=dark]{"+darkv+"}", css)
css=css.replace("body{font-family:Inter,system-ui,sans-serif;background:var(--bg);","body{font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--bg);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));")
css+="""
.head{max-width:1180px;margin:0 auto;padding-block:22px 6px}
.head h1{font:700 30px Quicksand,sans-serif;text-wrap:balance;color:var(--ink)}
.head p{color:var(--slate);max-width:70ch;margin-top:6px;font-size:15px}
.navp{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px;align-items:center}
.navp button{padding:10px 16px;border-radius:999px;font-weight:700;font-size:14px;color:var(--ink);background:var(--card);border:1px solid var(--line);min-height:44px}
.navp button.on{background:var(--teal);border-color:var(--teal);color:#06241f}
.navp .sep{width:1px;height:26px;background:var(--line);margin:0 4px}
.navp .theme{margin-left:auto;font-weight:600}
.wrap{max-width:1180px;margin:0 auto}
.pane{max-width:1180px}
.lead{color:var(--slate);margin-bottom:12px;max-width:80ch}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.vrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
.vrow .nm{flex:1;min-width:180px;font-weight:600}
.vbtn{padding:8px 12px;border-radius:999px;border:1px solid var(--line);font-weight:700;font-size:13px;min-height:40px;background:var(--card)}
.vbtn.ok{background:#E3F6F2;color:#0C6F61;border-color:#9fd9cd}.vbtn.ko{background:#FFF1D6;color:#8A5A00;border-color:#efcf8f}
.vrow textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:8px 10px;font:inherit;background:var(--card);color:var(--ink);min-height:40px}
.done{display:inline-block;white-space:nowrap;padding:5px 11px;border-radius:999px;font-weight:700;font-size:12.5px;background:#E3F6F2;color:#0C6F61;min-height:32px}
.prodc{display:inline-block;padding:5px 11px;border-radius:999px;font-weight:700;font-size:12.5px;background:#FFF1D6;color:#8A5A00}
@media (max-width:820px){.navp .theme{margin-left:0}.head h1{font-size:24px}}
"""
css=css.replace(".top{position:sticky","/* .top retiré */.topx{position:sticky")
# --- JS ---
js=js.replace("const view=$('#view'),tabbar=$('#tabbar');","const view=$('#view'),tabbar=$('#tabbar');\n"+qc)
js=js.replace(" document.querySelectorAll('#roles button').forEach(b=>b.classList.toggle('on',b.dataset.role===S.role));"," syncNav();")
js=js.replace(" const r=e.target.closest('#roles button');if(r){setRole(r.dataset.role)}"," const r=e.target.closest('.navp [data-v]');if(r){showView(r.dataset.v)}")
js=js.replace("document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));['mock','audit','qc'].forEach(t=>$('#p_'+t).hidden=t!==b.dataset.tab);if(b.dataset.tab==='audit')auditPane();if(b.dataset.tab==='qc')qcPane()});",
"""const VIEWS={public:'public',client:'client',pro:'prestataire',admin:'admin',apres:'apres-lancement',audit:'audit',qc:'controle-qualite',valid:'validation'};
let CURV='client';
function syncNav(){document.querySelectorAll('.navp [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===CURV))}
function showView(v,keep){CURV=v;const role=['public','client','pro','admin'].includes(v);$('#p_mock').hidden=!role;['apres','audit','qc','valid'].forEach(t=>$('#p_'+t).hidden=t!==v);
 if(role){if(!keep)setRole(v)}else{({apres:apresPane,audit:auditPane,qc:qcPane,valid:validPane})[v]()}
 syncNav();try{const h='#'+VIEWS[v];if(location.hash!==h)history.replaceState(null,'',h)}catch(e){}}
addEventListener('hashchange',()=>{const v=Object.keys(VIEWS).find(k=>'#'+VIEWS[k]===location.hash);if(v&&v!==CURV)showView(v)});""")
js=js.replace("function jump(role,screen){setRole(role,null);if(screen){const root=S.stack[0];S.stack=screen===root?[root]:[root,screen];S.arg=null}paint();document.querySelector('#tabs button[data-tab=mock]').click();window.scrollTo(0,0)}",
"function jump(role,screen){CURV=role;showView(role,true);setRole(role,null);if(screen){const root=S.stack[0];S.stack=screen===root?[root]:[root,screen];S.arg=null}paint();window.scrollTo(0,0)}")
# QC pane : remplacer l'ancienne fonction par la nouvelle
a=js.index("function qcPane(){");b=js.index("/* thème */")
js=js[:a]+"""function qcPane(){
 const re={'certifié':/certifi/i,'garanti':/garanti/i,'noms de marques tierces':/airbnb|uber|booking|wecasa|taskrabbit|leboncoin|nextdoor/i,'bientôt':/bientôt/i,'emoji colorés':/[\\u{1F300}-\\u{1FAFF}\\u{2700}-\\u{27BF}]/u};
 const hits={};Object.keys(re).forEach(k=>hits[k]=0);let n=0;const keep=[S.role,S.stack,S.arg];const box=document.createElement('div');
 Object.keys(GOTO).forEach(r=>GOTO[r].forEach(g=>{S.role=r;S.stack=[g[0]];n++;try{box.innerHTML=render(g[0]);const t=box.textContent+(META[g[0]]||[]).flat(2).join(' ');Object.keys(re).forEach(k=>{if(re[k].test(t))hits[k]++})}catch(e){}}));
 [S.role,S.stack,S.arg]=keep;
 const prod=QC.filter(q=>/production|en base/.test(q[3])).length;
 $('#p_qc').innerHTML=`<h2>Contrôle qualité</h2><p class="lead">Tour complet des quatre profils selon les objectifs de départ : simplicité, compréhension, fluidité, retour arrière, aucun saut de page. Sources : les cinq audits du 07/11 et les remarques de Romain. <b>${QC.length} incohérences trouvées</b> : ${QC.length-prod} corrigées dans la maquette, ${prod} à corriger en production (sans écran à dessiner).</p>
 <div class="tablewrap"><table class="t"><tr><th>Profil</th><th>Écran</th><th>Priorité</th><th>Incohérence trouvée</th><th>Correction</th><th>Voir</th></tr>${QC.map(q=>{const p=/production|en base/.test(q[3]);return `<tr><td>${q[0]}</td><td><b>${q[1]}</b></td><td><span class="sev ${q[6].toLowerCase()}">${q[6]}</span></td><td>${q[2]}</td><td>${q[3]}</td><td>${p?'<span class="prodc">En production</span>':`<button class="done" onclick="jump('${q[4]}','${q[5]}')">Corrigé · voir</button>`}</td></tr>`}).join('')}</table></div>
 <h2 style="margin-top:22px">Mots interdits</h2><p class="lead">Recherche automatique sur les ${n} écrans de la maquette.</p><div class="card">${Object.keys(re).map(k=>`<div class="row"><span class="grow">« ${k} »</span><span class="tag ${hits[k]?'red':''}">${hits[k]} occurrence${hits[k]>1?'s':''}</span></div>`).join('')}</div>
 <h2 style="margin-top:22px">Suggestions non réalisées, par impact</h2><div class="tablewrap"><table class="t"><tr><th>Suggestion</th><th>Impact</th></tr>
 <tr><td>Connexion par lien magique (sans mot de passe)</td><td>Fort : moins d'abandon à l'inscription</td></tr>
 <tr><td>Carte vectorielle libre aux couleurs PING, tuiles gratuites</td><td>Fort : look plus convivial, fin de la dépendance aux serveurs publics de cartes</td></tr>
 <tr><td>Alerte « nouvelle demande près de vous » pour les prestataires</td><td>Fort : réactivité</td></tr>
 <tr><td>Catalogue de services en base</td><td>Fort : nouveaux services sans programmer</td></tr>
 <tr><td>« Refaire avec le même prestataire » depuis une mission terminée</td><td>Moyen : fidélité</td></tr></table></div>
 <p class="lead" style="margin-top:12px">Non vérifié : rendu sur vrai iPhone et en application installée ; conditions d'usage de la carte gratuite ; veille concurrentielle chiffrée.</p>`}
function apresPane(){$('#p_apres').innerHTML=`<h2>Après le lancement</h2><p class="lead">Ce qui est prêt mais éteint, ce qui est proposé, et les offres à venir. Aucun tarif inventé : la commission en vigueur est celle réglée dans l'admin.</p><div class="grid2">
 ${[['Prêt, éteint','Paiement en ligne sous séquestre','Module codé pour trois prestataires de paiement. S\\'allume quand un prestataire de paiement est choisi et ses clés posées.'],
 ['Prêt, éteint','Avance immédiate du crédit d\\'impôt','Code prêt pour l\\'API de l\\'Urssaf. Demande une habilitation et des prestataires déclarés en services à la personne.'],
 ['À faire','CESU','Branchement à reprendre (prévu), avec la liste de ce qui manque.'],
 ['Prêt, éteint','Notifications par e-mail','Codées. Demandent une clé d\\'envoi d\\'e-mails et un domaine vérifié.'],
 ['Proposé','Carte plus conviviale','Carte vectorielle libre aux couleurs PING, gratuite (conditions à vérifier).'],
 ['Proposé','Nouveaux services','Catalogue de services en base : ajouter un service sans programmer.'],
 ['En vigueur','Commission','8 % côté client et 17 % côté prestataire, réglables dans l\\'admin sans redéploiement.'],
 ['Proposé','Connexion par lien magique','Se connecter sans mot de passe, par un lien reçu par e-mail.']].map(c=>`<div class="card"><span class="tag ${c[0]==='En vigueur'?'':c[0]==='Proposé'?'gray':'warn'}">${c[0]}</span><h3 style="font:700 16px Quicksand,sans-serif;margin:8px 0 4px">${c[1]}</h3><p style="color:var(--slate)">${c[2]}</p></div>`).join('')}</div>`}
function validPane(){let st={};try{st=JSON.parse(localStorage.getItem('ping_valid')||'{}')}catch(e){}
 const all=[];Object.keys(GOTO).forEach(r=>GOTO[r].forEach(g=>all.push([r,g[0],({public:'Site public',client:'Client',pro:'Prestataire',admin:'Admin'})[r]+' · '+g[1]])));
 const ok=all.filter(a=>(st[a[0]+a[1]]||{}).v==='ok').length,ko=all.filter(a=>(st[a[0]+a[1]]||{}).v==='ko').length;
 $('#p_valid').innerHTML=`<h2>Validation page par page</h2><p class="lead">Ouvrez chaque écran, puis marquez-le « Validé » ou « À revoir » avec une remarque. <b>${ok} validés, ${ko} à revoir, ${all.length-ok-ko} à regarder</b> sur ${all.length}. Vos choix restent dans ce navigateur : envoyez-moi les remarques dans la conversation pour que je les applique.</p>
 <div class="card">${all.map(a=>{const k=a[0]+a[1],s=st[k]||{};return `<div class="vrow"><span class="nm">${a[2]}</span><button class="vbtn" onclick="jump('${a[0]}','${a[1]}')">Voir</button><button class="vbtn ${s.v==='ok'?'ok':''}" onclick="setV('${k}','ok')" aria-pressed="${s.v==='ok'}">Validé</button><button class="vbtn ${s.v==='ko'?'ko':''}" onclick="setV('${k}','ko')" aria-pressed="${s.v==='ko'}">À revoir</button>${s.v==='ko'?`<textarea id="c_${k}" placeholder="Ce qui ne va pas" oninput="setC('${k}',this.value)">${(s.c||'').replace(/</g,'&lt;')}</textarea>`:''}</div>`}).join('')}</div>`}
function saveV(st){try{localStorage.setItem('ping_valid',JSON.stringify(st))}catch(e){}}
window.setV=(k,v)=>{let st={};try{st=JSON.parse(localStorage.getItem('ping_valid')||'{}')}catch(e){};st[k]=Object.assign(st[k]||{},{v:st[k]&&st[k].v===v?'':v});saveV(st);validPane()};
window.setC=(k,c)=>{let st={};try{st=JSON.parse(localStorage.getItem('ping_valid')||'{}')}catch(e){};st[k]=Object.assign(st[k]||{},{c});saveV(st)};
"""+js[b:]
# thème : système / clair / sombre
a=js.index("$('#theme').onclick");b=js.index("/* échelle")
js=js[:a]+"""const TH=['','light','dark'],THL=['système','clair','sombre'];let ti=0;try{ti=Math.max(0,TH.indexOf(localStorage.getItem('pm_theme')||''))}catch(e){}
function applyTh(){if(TH[ti])document.documentElement.dataset.theme=TH[ti];else delete document.documentElement.dataset.theme;$('#theme').textContent='Thème : '+THL[ti]}
$('#theme').onclick=()=>{ti=(ti+1)%3;applyTh();try{localStorage.setItem('pm_theme',TH[ti])}catch(e){}};applyTh();
"""+js[b:]
js=js.replace("function fit(){const pw=$('#pw'),ph=$('#phone');if(innerWidth<=820){ph.style.transform='none';pw.style.height='auto';return}const s=Math.min(1,(innerHeight-150)/844);","function fit(){const pw=$('#pw'),ph=$('#phone');if(innerWidth<=820){ph.style.transform='none';pw.style.height='auto';return}const s=Math.min(1,Math.max(.7,(innerHeight-40)/844));")
js=js.replace("const q=new URLSearchParams(location.search);const r0=q.get('role');\nsetRole(['public','client','pro','admin'].includes(r0)?r0:'client');",
"const v0=Object.keys(VIEWS).find(k=>'#'+VIEWS[k]===location.hash)||'client';setRole(['public','client','pro','admin'].includes(v0)?v0:'client');showView(v0);")
mock=src[src.index('<div id="p_mock"'):src.index('<div id="p_audit"')]
html=f"""<title>Maquettes PING</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Quicksand:wght@600;700&display=swap" rel="stylesheet">
<style>{css}</style>
<header class="head">
<h1>Maquettes PING</h1>
<p>Quatre parcours cliquables (site public, client, prestataire, admin), de la première visite à l'usage quotidien. Touchez les écrans comme sur un téléphone : retour, onglets et état sont conservés. Données fictives, rien n'est enregistré.</p>
<nav class="navp" aria-label="Sections">
<button data-v="public">Site public</button><button data-v="client" class="on">Client</button><button data-v="pro">Prestataire</button><button data-v="admin">Admin</button><span class="sep" aria-hidden="true"></span><button data-v="apres">Après le lancement</button><button data-v="audit">Audit des manques</button><button data-v="qc">Contrôle qualité</button><button data-v="valid">Validation</button>
<button class="theme" id="theme">Thème : système</button>
</nav>
</header>
{mock}
<div id="p_apres" class="pane" hidden></div>
<div id="p_audit" class="pane" hidden></div>
<div id="p_qc" class="pane" hidden></div>
<div id="p_valid" class="pane" hidden></div>
<script>{js}</script>
"""
open('index.html','w').write(html)
print(len(html))
