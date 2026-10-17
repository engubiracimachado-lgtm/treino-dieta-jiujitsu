// Gera app/index.html a partir do app do artifact (diario-de-treino.html), trocando o que é próprio do Claude
// pelo que o app instalável precisa. Uso: node tools/build.js ../diario-de-treino.html
const fs = require("fs"), path = require("path");
const src = process.argv[2] || path.join(__dirname, "..", "..", "diario-de-treino.html");
let s = fs.readFileSync(src, "utf8").replace(/\r\n/g, "\n");
function todos(a, b) { if (!s.includes(a)) throw new Error("trecho não encontrado: " + a.slice(0, 70)); s = s.split(a).join(b); }
function rep(a, b) { if (s.split(a).length !== 2) throw new Error("trecho não encontrado ou repetido: " + a.slice(0, 70)); s = s.replace(a, () => b); }

// textos que falavam do link do Claude
todos('O coach responde quando o painel é aberto pelo link do Claude, com a sua conta. Nesta cópia ele fica desligado.', 'O coach não está disponível agora. Verifique a conexão e entre de novo.');
todos('A pesquisa responde quando o painel é aberto pelo link do Claude, com a sua conta. Nesta cópia ela fica desligada.', 'A pesquisa não está disponível agora. Verifique a conexão e entre de novo.');
todos('A primeira pergunta pede a sua permissão para usar o Claude. As respostas contam no limite de uso da sua conta.', 'As respostas são geradas pelo Claude, pela API da Anthropic, cobrada por uso.');
todos('O cálculo automático só funciona com o painel aberto pelo link do Claude, na sua conta.', 'O cálculo automático não está disponível agora. Verifique a conexão e tente de novo.');
todos('Sem o cálculo automático nesta visualização; usei o plano na proporção dos itens comidos.', 'Sem o cálculo automático agora; usei o plano na proporção dos itens comidos.');
todos('As fotos vão para o Claude só para essa resposta e não ficam guardadas no aplicativo.', 'As fotos vão para o Claude só para essa resposta e não ficam guardadas.');

// erros novos da Edge Function
rep('var COACH_ERRO={', 'var COACH_ERRO={bad_key:"A chave da API da Anthropic salva no Supabase foi recusada. Confira se ela está ativa e se a conta da Anthropic tem crédito.",no_key:"A IA ainda não foi configurada: falta a chave da API da Anthropic no Supabase (segredo ANTHROPIC_API_KEY).",invalid_request:"A IA recusou o pedido por um problema de formato. Tente de novo; se repetir, avise o desenvolvedor.",');
// registrar refeição é uma tarefa curta: esforço baixo
rep('sampleFn.json?sampleFn.json(prompt,{signal:dRegCtl.signal})', 'sampleFn.json?sampleFn.json(prompt,{signal:dRegCtl.signal,modelTier:"quick"})');

// início: conta conectada e sair
rep(`'<button class="area" data-act="area" data-a="jiu">`, `'<button class="area" data-act="area" data-a="jiu">`);
rep(`</span></button></div>'+renderSono();`, `</span></button></div>'+renderSono()+'<div class="acts"><span class="hint">Conectado como '+esc(window.__email||"")+'</span><button class="btn ghost sm" data-act="sair">Sair da conta</button></div>';`);
rep('  if(a.indexOf("d-")===0){dClick(a,b);return}', '  if(a==="sair"){if(window.__sair)window.__sair();return}\n  if(a.indexOf("d-")===0){dClick(a,b);return}');

// nome comercial: TDJ
rep('<h1 id="marca">Treino, Dieta e Jiujitsu</h1>', '<h1 id="marca">TDJ</h1>');
rep('area==="jiu"?"Jiujitsu":"Treino, Dieta e Jiujitsu"', 'area==="jiu"?"Jiujitsu":area==="conta"?"Configurações":"TDJ"');
// configurações pessoais e topo (conta.js): a área "conta" e os ganchos de dados e navegação
rep('app.innerHTML=area==="dieta"?renderDietaArea():area==="jiu"?renderJiuArea():renderHome();setStatus();return}', 'app.innerHTML=area==="dieta"?renderDietaArea():area==="jiu"?renderJiuArea():area==="conta"&&window.__tdjConta?window.__tdjConta.html():renderHome();setStatus();return}');
rep('function render(){\n  needsRender=false;', 'function render(){\n  needsRender=false;\n  if(window.__tdjConta)setTimeout(window.__tdjConta.depois,0);');
rep('if(window.claude&&window.claude.use)window.claude.use("sample")', 'window.__tdjApp={dados:function(){return{plano:plano,semanas:semanas,sessoes:sessoes,sono:sono,dsem:dsem,ddias:ddias,jtreinos:jtreinos,jnotas:jnotas,jaulas:jaulas}},ir:function(o){if(o.area)area=o.area;if(o.tab)tab=o.tab;if(o.sel)sel=o.sel;if(o.dtab)dtab=o.dtab;if(o.dsel)dsel=o.dsel;if(o.jtab)jtab=o.jtab;if("jsel" in o)jsel=o.jsel;if("jnsel" in o)jnsel=o.jnsel;if("jasel" in o)jasel=o.jasel;if(o.pw){pw=o.pw;editW=null}if(o.dpw){dpw=o.dpw;deditW=null}window.scrollTo(0,0);render()},render:function(){render()}};\nif(window.claude&&window.claude.use)window.claude.use("sample")');

// botão de modo claro/escuro no cabeçalho
rep('<div class="status" id="status" role="status"><i></i><span>Conectando…</span></div>', '<div class="brand-dir"><div class="status" id="status" role="status"><i></i><span>Conectando…</span></div><div class="topo-conta" id="topo-conta" hidden></div></div>');
rep('.brand{display:flex;align-items:baseline;', '.brand-dir{display:flex;align-items:center;gap:10px}\n.tema-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer}\n.tema-btn svg{width:16px;height:16px;flex:none}\n.brand{display:flex;align-items:center;');

// logo no cabeçalho
rep('<div class="marca"><button class="btn sm" id="voltar"', '<div class="marca"><img class="marca-logo" src="icons/logo.png" alt="" width="32" height="32"><button class="btn sm" id="voltar"');

// tela de login
rep('.hint{font-size:14px', '.login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px}\n.login-box{width:100%;max-width:380px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:24px 20px;display:flex;flex-direction:column;gap:14px}\n.marca-logo{width:32px;height:32px;border-radius:7px;flex:none}\n.login-topo{display:flex;justify-content:flex-end;margin-bottom:-8px}\n.login-logo{width:72px;height:72px;border-radius:16px;align-self:center}\n.login-box h2{font-family:var(--display);font-weight:700;font-size:34px;text-transform:uppercase;margin:0;line-height:1}\ninput[type=email],input[type=password]{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:11px 10px;font-size:16px}\n.hint{font-size:14px');

const head = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#111111">
<meta name="description" content="Treino, dieta e jiujitsu: planejamento da semana, registro diário, histórico, sono e coach.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="TDJ">
<style>html{-webkit-text-size-adjust:100%}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
<script>try{var t=localStorage.getItem("tdj-tema");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>
<link rel="stylesheet" href="conta.css">
<script src="backend.js"></script>
<script src="conta.js"></script>
</head>
<body>
`;
s = head + s.replace("<title>Diário de Treino</title>", "<title>TDJ</title>") + "\n</body>\n</html>\n";
fs.writeFileSync(path.join(__dirname, "..", "index.html"), s);
console.log("index.html gerado", Math.round(s.length / 1024) + " KB");
