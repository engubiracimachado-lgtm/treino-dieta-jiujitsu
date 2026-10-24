# TDJ — Treino, Dieta e Jiujitsu

App pessoal (PWA instalável) para planejar e registrar treinos de musculação, dieta, sono e jiujitsu, com coach por IA.

## Como funciona

- **Endereço**: https://tdj.gestorpessoal.api.br (domínio próprio no GitHub Pages; DNS no Cloudflare, registro CNAME `tdj` → `engubiracimachado-lgtm.github.io`, sem proxy).
- **Site estático** (`index.html`, `backend.js`, `sw.js`, `manifest.webmanifest`, `icons/`), publicado no GitHub Pages a cada envio para a branch `main` (`.github/workflows/deploy.yml`).
- **Dados** no Supabase: tabela `public.docs` com um documento JSON por coleção e id, protegida por RLS (cada usuário só lê e grava os próprios dados). Migração em `supabase/migrations/`.
- **Login** por e-mail e senha (Supabase Auth), com 2FA opcional por app autenticador; com o 2FA ativo, a RLS exige sessão `aal2`.
- **Topo e configurações** (`conta.js`, `conta.css`): pesquisa nos dados do app, lembretes do dia no sino e a página de Configurações pessoais (nome, senha, 2FA, aparência e quais lembretes aparecem).
- **IA**: a Edge Function `supabase/functions/coach` chama o Claude (`claude-haiku-5-5`, escolhido pelo custo) com a chave do segredo `ANTHROPIC_API_KEY`. Só aceita usuários logados.
- **Offline**: service worker *network-first*; sem internet, abre a última versão salva (os dados precisam de conexão).

## Configuração única

1. Supabase → Edge Functions → Secrets: criar `ANTHROPIC_API_KEY` com uma chave de console.anthropic.com.
2. Supabase → Authentication → URL Configuration: em **Site URL** e **Redirect URLs**, colocar https://tdj.gestorpessoal.api.br/
3. (Opcional) GitHub → Settings → Secrets → Actions: `SUPABASE_ACCESS_TOKEN` para publicar a função do coach automaticamente (`.github/workflows/supabase.yml`).

## Desenvolvimento

- `node tools/serve.js` sobe o app em http://localhost:5173.
- `node tools/build.js ../diario-de-treino.html` regenera `index.html` a partir da versão do artifact.
- `powershell -File tools/logo.ps1 -Origem assets/logo-original.webp` regenera os ícones a partir do logo.
