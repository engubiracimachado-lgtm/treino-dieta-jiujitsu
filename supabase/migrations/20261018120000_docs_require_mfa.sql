-- Quem ativou o 2FA só acessa os dados depois de confirmar o código (sessão aal2).
-- Contas sem 2FA continuam entrando só com e-mail e senha.
-- A verificação fica numa função "security definer" porque o usuário não tem permissão de ler auth.mfa_factors
-- (a primeira versão lia a tabela direto na regra e bloqueava todas as leituras).
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

create or replace function privado.aal_permitido() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;
revoke all on function privado.aal_permitido() from public;
grant execute on function privado.aal_permitido() to authenticated;

drop policy if exists "docs_mfa_quando_ativo" on public.docs;
create policy "docs_mfa_quando_ativo" on public.docs
  as restrictive for all to authenticated
  using ((select privado.aal_permitido()))
  with check ((select privado.aal_permitido()));
