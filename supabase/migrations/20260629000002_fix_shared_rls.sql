-- Fix: custom_formations_select_shared hat "id" als fs.id aufgelöst statt custom_formations.id
-- Explizit custom_formations.id referenzieren um Namenskonflikt zu vermeiden.

drop policy if exists "custom_formations_select_shared" on public.custom_formations;

create policy "custom_formations_select_shared" on public.custom_formations
  for select using (
    exists (
      select 1 from public.formation_shares fs
      where fs.formation_id = custom_formations.id
        and fs.shared_with_id = auth.uid()
    )
  );
