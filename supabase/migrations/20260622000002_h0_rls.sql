-- H0: Custom-Formationen — RLS

alter table public.custom_formations enable row level security;
alter table public.formation_shares  enable row level security;
alter table public.app_config        enable row level security;

-- custom_formations: Lesen
create policy "custom_formations_select_own" on public.custom_formations
  for select using (owner_id = auth.uid());

create policy "custom_formations_select_shared" on public.custom_formations
  for select using (
    exists (select 1 from public.formation_shares fs
            where fs.formation_id = id and fs.shared_with_id = auth.uid())
  );

-- Bibliothek: öffentlich lesbar, auch für Gäste
create policy "custom_formations_select_library" on public.custom_formations
  for select using (is_library = true);

-- Schreiben komplett gesperrt — nur via SECURITY DEFINER RPCs
revoke insert, update, delete on public.custom_formations from anon, authenticated;
revoke insert, update, delete on public.formation_shares   from anon, authenticated;

-- app_config: lesbar für alle (Feature-Flags müssen im Client auswertbar sein)
create policy "app_config_select_all" on public.app_config for select using (true);
revoke insert, update, delete on public.app_config from anon, authenticated;

-- formation_shares: Lesen
create policy "formation_shares_select" on public.formation_shares
  for select using (shared_with_id = auth.uid() or shared_by_id = auth.uid());
