-- Quem ativou o 2FA só acessa os dados depois de confirmar o código (sessão aal2).
-- Contas sem 2FA continuam entrando só com e-mail e senha.
create policy "docs_mfa_quando_ativo" on public.docs
  as restrictive
  for all
  to authenticated
  using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  )
  with check (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
