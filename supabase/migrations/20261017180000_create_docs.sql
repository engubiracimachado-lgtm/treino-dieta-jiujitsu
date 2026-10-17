-- Armazena os dados do app como documentos JSON por usuário (coleção + id), como o app já trabalha.
create table public.docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  col text not null check (col ~ '^[a-z_]{1,40}$'),
  id text not null check (char_length(id) between 1 and 200),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, col, id)
);

alter table public.docs enable row level security;

create policy "docs_select_own" on public.docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "docs_insert_own" on public.docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "docs_update_own" on public.docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "docs_delete_own" on public.docs for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.docs_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger docs_touch before update on public.docs for each row execute function public.docs_touch();

-- Sincronização entre aparelhos em tempo real
alter table public.docs replica identity full;
alter publication supabase_realtime add table public.docs;
