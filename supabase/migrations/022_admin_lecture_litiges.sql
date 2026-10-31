-- 022 — APPLIQUÉE le 31/10/2026 (MCP). Médiation : l'admin lit mission, demande, paiements et messages.
create policy "transactions admin read" on public.transactions for select using (public.is_admin());
create policy "requests admin read" on public.requests for select using (public.is_admin());
create policy "payments admin read" on public.payments for select using (public.is_admin());
create policy "messages admin read" on public.messages for select using (public.is_admin());
