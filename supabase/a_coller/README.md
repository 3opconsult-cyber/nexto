# SQL à coller dans Supabase (éditeur SQL), dans cet ordre

Lien direct : https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba/sql/new

1. `../migrations/014_paiement_en_ligne.sql` — paiement en ligne (éteint tant que les clés manquent)
2. `../migrations/015_suivi_anonyme.sql` — suivi des visiteurs avant inscription (stickers, QR)
3. `../migrations/016_avis_prestataire_sur_client.sql` — le prestataire note le client

Chaque fichier se colle en entier, puis « Run ». Tous sont sans danger à rejouer.
