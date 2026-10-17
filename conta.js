/* Topo do app (pesquisa, notificações, usuário) e a página de Configurações pessoais.
   Usa window.__tdjSb (cliente Supabase) e window.__tdjApp (dados e navegação do app). */
(function () {
  "use strict";
  var IC = {
    lupa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    pessoa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    chave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M15 8l2 2"/></svg>',
    escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    salvar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7M8 21v-7h8v7"/></svg>'
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sem(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function hojeISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function addDias(s, n) { var p = s.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function segunda(s) { var p = s.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); return addDias(s, -((d.getDay() + 6) % 7)); }
  function dataCurta(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, ""); }

  var sb = null, user = null, db = null, prefs = { notif: {} }, online = navigator.onLine;
  var aba = "perfil", rasc = null, senhaAberta = false, senhaMsg = null, mfa = { carregado: false, ativo: null, novo: null, msg: null, desativar: false }, salvarMsg = null;

  /* ---------------- quem está logado ---------------- */
  function nomeDe(u) {
    var m = (u && u.user_metadata) || {}, n = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
    return n || ((u && u.email) || "").split("@")[0];
  }
  function iniciais(u) {
    var m = (u && u.user_metadata) || {}, a = (m.first_name || "").trim(), b = (m.last_name || "").trim();
    if (a || b) return ((a[0] || "") + (b[0] || "")).toUpperCase() || a.slice(0, 2).toUpperCase();
    return ((u && u.email) || "?").slice(0, 2).toUpperCase();
  }

  /* ---------------- notificações (lembretes do dia) ---------------- */
  var TIPOS = [
    ["sono", "Registro do sono", "Lembra de lançar a noite de sono, a partir das 5h."],
    ["peso", "Pesagem em jejum", "Às segundas, quartas e sextas, se o peso do dia ainda não foi registrado."],
    ["treino", "Treino do dia", "Quando há treino planejado para hoje e ele ainda não foi concluído."],
    ["dieta", "Dieta do dia", "A partir do meio-dia, enquanto o dia da dieta não for concluído."],
    ["jiu", "Treino de jiujitsu", "De segunda a sábado, depois das 21h, se nenhum treino de jiujitsu foi lançado no dia."],
    ["plano", "Planejamento da próxima semana", "De sexta a domingo, se a próxima semana de treino ou de dieta ainda não foi salva."]
  ];
  function ligado(t) { return prefs.notif[t] !== false; }
  function lembretes() {
    var A = window.__tdjApp; if (!A) return [];
    var D = A.dados(), h = hojeISO(), agora = new Date(), hr = agora.getHours(), dw = agora.getDay(), L = [];
    if (ligado("sono") && hr >= 5) { var n = D.sono[h]; if (!n || !n.dormiu || !n.acordou) L.push({ t: "Registrar a noite de sono", s: "Horários e nota de hoje ainda estão em branco.", ir: { area: "home" } }); }
    if (ligado("peso") && (dw === 1 || dw === 3 || dw === 5)) { var dd = D.ddias[h]; if (!dd || dd.peso == null) L.push({ t: "Pesagem em jejum", s: "Dia de pesagem: registre o peso no Diário da dieta.", ir: { area: "dieta", dtab: "dia", dsel: h } }); }
    if (ligado("treino")) {
      var w = D.semanas[segunda(h)], k = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][dw], pd = w && w.dias && w.dias[k], s = D.sessoes[h];
      if (pd && pd.ex && pd.ex.some(function (e) { return (e.nome || "").trim(); }) && !(s && s.concluido)) L.push({ t: "Treino de hoje: " + (pd.nome || "Treino"), s: s ? "Em andamento; falta concluir." : "Ainda não começou.", ir: { area: "treino", tab: "hoje", sel: h } });
    }
    if (ligado("dieta") && hr >= 12) {
      var x = D.ddias[h], dw2 = D.dsem[segunda(h)], kk = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][dw], pl = dw2 && dw2.dias && dw2.dias[kk];
      if ((pl && pl.refs && pl.refs.length) && !(x && x.concluido)) {
        var reg = x ? x.refs.filter(function (r) { return r.kcal != null; }).length : 0, tot = x ? x.refs.filter(function (r) { return !r.opc; }).length : pl.refs.filter(function (r) { return !r.opc; }).length;
        L.push({ t: "Dieta de hoje", s: reg + " de " + tot + " refeições registradas. Conclua o dia para receber o feedback.", ir: { area: "dieta", dtab: "dia", dsel: h } });
      }
    }
    if (ligado("jiu") && dw >= 1 && dw <= 6 && hr >= 21) {
      var tem = Object.keys(D.jtreinos).some(function (id) { return D.jtreinos[id].data === h; });
      if (!tem) L.push({ t: "Treino de jiujitsu de hoje", s: "Registre tipo, técnicas e rolas enquanto está fresco.", ir: { area: "jiu", jtab: "treinos", jsel: null } });
    }
    if (ligado("plano") && (dw === 5 || dw === 6 || dw === 0)) {
      var prox = addDias(segunda(h), 7);
      if (!D.semanas[prox]) L.push({ t: "Planejar o treino da próxima semana", s: "A semana de " + dataCurta(prox) + " ainda não tem planejamento salvo.", ir: { area: "treino", tab: "plano", pw: prox } });
      if (!D.dsem[prox]) L.push({ t: "Planejar a dieta da próxima semana", s: "A semana de " + dataCurta(prox) + " ainda não tem plano alimentar salvo.", ir: { area: "dieta", dtab: "plano", dpw: prox } });
    }
    return L;
  }

  /* ---------------- pesquisa nos dados do app ---------------- */
  function pesquisa(q) {
    var A = window.__tdjApp; if (!A || sem(q).trim().length < 2) return [];
    var D = A.dados(), termos = sem(q).trim().split(/\s+/), R = [];
    function bate(txt) { var t = sem(txt); return termos.every(function (p) { return t.indexOf(p) >= 0; }); }
    function trecho(txt) {
      var t = String(txt || "").replace(/\s+/g, " "), i = sem(t).indexOf(termos[0]);
      var a = Math.max(0, i - 40), b = Math.min(t.length, i + 90);
      return (a > 0 ? "…" : "") + t.slice(a, b) + (b < t.length ? "…" : "");
    }
    function add(area, titulo, data, campos, ir) {
      for (var i = 0; i < campos.length; i++) if (campos[i] && bate(campos[i])) { R.push({ area: area, titulo: titulo, data: data, trecho: trecho(campos[i]), ir: ir }); return; }
    }
    Object.keys(D.sessoes).forEach(function (k) {
      var s = D.sessoes[k], c = [s.nome, s.notas, s.obs, s.feedback];
      (s.ex || []).forEach(function (e) { c.push(e.nome, e.obs, e.nota); });
      add("Treino", s.nome || "Treino", k, c, { area: "treino", tab: "hoje", sel: k });
    });
    Object.keys(D.semanas).forEach(function (k) {
      var w = D.semanas[k], c = [];
      Object.keys(w.dias || {}).forEach(function (d) { var p = w.dias[d]; c.push(p.nome, p.obs); (p.ex || []).forEach(function (e) { c.push(e.nome, e.nota); }); });
      add("Plano de treino", "Semana de " + dataCurta(k), k, c, { area: "treino", tab: "plano", pw: k });
    });
    Object.keys(D.ddias).forEach(function (k) {
      var x = D.ddias[k], c = [x.notas, x.feedback];
      (x.refs || []).forEach(function (r) { c.push(r.nome, r.obs, r.calc); (r.itens || []).forEach(function (i) { c.push(i.txt); }); });
      add("Dieta", "Diário alimentar", k, c, { area: "dieta", dtab: "dia", dsel: k });
    });
    Object.keys(D.dsem).forEach(function (k) {
      var w = D.dsem[k], c = [];
      Object.keys(w.dias || {}).forEach(function (d) { (w.dias[d].refs || []).forEach(function (r) { c.push(r.nome, r.itens, r.nota); }); });
      add("Plano alimentar", "Semana de " + dataCurta(k), k, c, { area: "dieta", dtab: "plano", dpw: k });
    });
    Object.keys(D.jtreinos).forEach(function (id) {
      var t = D.jtreinos[id], c = [t.aquecimento, t.notas];
      (t.tecnicas || []).forEach(function (x) { c.push(x.nome, x.desc); }); (t.rolas || []).forEach(function (x) { c.push(x.com, x.desc); });
      add("Jiujitsu", "Treino " + (t.tipo === "nogi" ? "NoGi" : t.tipo === "kimono" ? "Kimono" : ""), t.data || "", c, { area: "jiu", jtab: "treinos", jsel: id });
    });
    Object.keys(D.jnotas).forEach(function (id) {
      var n = D.jnotas[id];
      add(n.tipo === "estudo" ? "Estudo" : "Anotações", n.titulo || "Sem título", (n.atualizado || "").slice(0, 10), [n.titulo, n.texto, n.link], { area: "jiu", jtab: n.tipo === "estudo" ? "estudo" : "geral", jnsel: id });
    });
    Object.keys(D.jaulas).forEach(function (id) {
      var a = D.jaulas[id], c = [a.tema, a.aquecimento, a.notas];
      (a.tecnicas || []).forEach(function (x) { c.push(x.nome, x.desc); });
      add("Aula", a.tema || "Aula sem tema", a.data || "", c, { area: "jiu", jtab: "prof", jasel: id });
    });
    R.sort(function (a, b) { return (b.data || "").localeCompare(a.data || ""); });
    return R.slice(0, 40);
  }
  function abrePesquisa() {
    fechaPainel();
    var o = document.getElementById("busca");
    if (!o) {
      o = document.createElement("div"); o.id = "busca"; o.className = "busca"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Pesquisar");
      o.innerHTML = '<div class="busca-caixa"><div class="busca-campo">' + IC.lupa + '<input type="search" id="busca-q" placeholder="Pesquisar exercícios, refeições, técnicas, anotações…" autocomplete="off"><button class="btn ghost sm" type="button" data-c="busca-fechar">Fechar</button></div><div class="busca-res" id="busca-res"></div></div>';
      document.body.appendChild(o);
      o.addEventListener("click", function (ev) { if (ev.target === o) fechaPesquisa(); });
      o.querySelector("#busca-q").addEventListener("input", function (ev) { mostraResultados(ev.target.value); });
    }
    o.hidden = false; mostraResultados(o.querySelector("#busca-q").value);
    setTimeout(function () { o.querySelector("#busca-q").focus(); }, 0);
  }
  function fechaPesquisa() { var o = document.getElementById("busca"); if (o) o.hidden = true; }
  var ultimos = [];
  function mostraResultados(q) {
    var el = document.getElementById("busca-res"); if (!el) return;
    if (sem(q).trim().length < 2) { el.innerHTML = '<p class="hint">Digite pelo menos 2 letras. A pesquisa olha treinos, planos, dieta, jiujitsu, aulas e anotações.</p>'; return; }
    ultimos = pesquisa(q);
    el.innerHTML = ultimos.length ? ultimos.map(function (r, i) {
      return '<button type="button" class="busca-item" data-c="busca-ir" data-i="' + i + '"><span class="busca-area">' + esc(r.area) + (r.data ? " · " + esc(dataCurta(r.data)) : "") + '</span><b>' + esc(r.titulo) + '</b><span class="busca-trecho">' + esc(r.trecho) + '</span></button>';
    }).join("") : '<p class="hint">Nada encontrado para “' + esc(q) + '”.</p>';
  }

  /* ---------------- topo: pesquisa, sino e usuário ---------------- */
  var painel = null;
  function fechaPainel() { painel = null; var p = document.getElementById("notif-painel"); if (p) p.hidden = true; }
  function desenhaTopo() {
    var el = document.getElementById("topo-conta"); if (!el || !user) return;
    var L = lembretes();
    el.innerHTML = '<button class="topo-btn" type="button" data-c="busca" aria-label="Pesquisar" title="Pesquisar (Ctrl+K)">' + IC.lupa + '</button>' +
      '<div class="topo-notif"><button class="topo-btn" type="button" data-c="notif" aria-label="Notificações' + (L.length ? ", " + L.length + " pendentes" : "") + '" aria-expanded="' + (painel === "notif") + '">' + IC.sino + (L.length ? '<span class="topo-badge">' + L.length + '</span>' : "") + '</button>' +
      '<div class="notif-painel" id="notif-painel"' + (painel === "notif" ? "" : " hidden") + '><p class="eyebrow">Lembretes de hoje</p>' +
      (L.length ? L.map(function (n, i) { return '<button type="button" class="notif-item" data-c="notif-ir" data-i="' + i + '"><b>' + esc(n.t) + '</b><span>' + esc(n.s) + '</span></button>'; }).join("") : '<p class="hint">Tudo em dia por aqui.</p>') +
      '<button type="button" class="btn ghost sm" data-c="conta" data-aba="notif">Escolher lembretes</button></div></div>' +
      '<button class="topo-user" type="button" data-c="conta" data-aba="perfil" aria-label="Configurações pessoais de ' + esc(nomeDe(user)) + '"><span class="avatar">' + esc(iniciais(user)) + '<i class="' + (online ? "on" : "off") + '"></i></span><span class="topo-nome">' + esc(nomeDe(user)) + '</span>' + IC.seta + '</button>';
    el.hidden = false;
    lembretesAtuais = L;
  }
  var lembretesAtuais = [];

  /* ---------------- página de configurações ---------------- */
  function rascunho() {
    if (!rasc) { var m = (user && user.user_metadata) || {}; rasc = { first_name: m.first_name || "", last_name: m.last_name || "" }; }
    return rasc;
  }
  function temaEscolhido() { try { return localStorage.getItem("tdj-tema") || "auto"; } catch (e) { return "auto"; } }
  function htmlPerfil() {
    var r = rascunho(), mudou = r.first_name !== ((user.user_metadata || {}).first_name || "") || r.last_name !== ((user.user_metadata || {}).last_name || "");
    var h = '<div class="cfg-cab"><h3>Perfil</h3><button class="btn pri" type="button" data-c="salvar-nome"' + (mudou ? "" : " disabled") + '>' + IC.salvar + ' Salvar</button></div>';
    if (salvarMsg) h += '<p class="hint" style="color:' + (salvarMsg.ok ? "var(--good)" : "var(--bad)") + '">' + esc(salvarMsg.t) + '</p>';
    h += '<div class="cfg-id"><span class="avatar grande">' + esc(iniciais(user)) + '</span><div class="cfg-id-txt"><b>' + esc(nomeDe(user)) + '</b><span>' + esc(user.email || "") + '</span></div><span class="pill ' + (online ? "on" : "") + '"><i></i>' + (online ? "Online" : "Offline") + '</span></div>';
    h += '<div class="cfg-linha"><div class="cfg-rot"><b>Nome</b></div><div class="cfg-campo dois"><label class="f"><span>Nome</span><input type="text" id="cfg-nome" data-cfg="first_name" value="' + esc(r.first_name) + '" autocomplete="given-name"></label><label class="f"><span>Sobrenome</span><input type="text" id="cfg-sobrenome" data-cfg="last_name" value="' + esc(r.last_name) + '" autocomplete="family-name"></label></div></div>';
    h += '<div class="cfg-linha"><div class="cfg-rot"><b>Senha</b></div><div class="cfg-campo">';
    if (!senhaAberta) h += '<button class="btn" type="button" data-c="senha-abrir">' + IC.chave + ' Alterar senha</button>';
    else h += '<div class="cfg-campo dois"><label class="f"><span>Nova senha</span><input type="password" id="cfg-senha1" autocomplete="new-password" minlength="8"></label><label class="f"><span>Repita a nova senha</span><input type="password" id="cfg-senha2" autocomplete="new-password" minlength="8"></label></div><div class="acts"><button class="btn pri" type="button" data-c="senha-salvar">Salvar nova senha</button><button class="btn ghost" type="button" data-c="senha-fechar">Cancelar</button></div>';
    if (senhaMsg) h += '<p class="hint" style="color:' + (senhaMsg.ok ? "var(--good)" : "var(--bad)") + '">' + esc(senhaMsg.t) + '</p>';
    h += '</div></div>';
    h += '<div class="cfg-linha"><div class="cfg-rot"><b>Duas etapas (2FA)</b><span>Código do app autenticador no login.</span></div><div class="cfg-campo">';
    if (!mfa.carregado) h += '<p class="hint">Verificando…</p>';
    else if (mfa.ativo) {
      h += '<div class="acts"><span class="chip good">2FA ativo</span>' + (mfa.desativar ? '<span class="hint">Desativar a verificação em duas etapas?</span><button class="btn danger" type="button" data-c="mfa-desativar2">Desativar</button><button class="btn ghost" type="button" data-c="mfa-desativar0">Cancelar</button>' : '<button class="btn ghost sm" type="button" data-c="mfa-desativar1">Desativar 2FA</button>') + '</div>';
    } else if (mfa.novo) {
      h += '<p class="hint">1. Abra o app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…) e leia o QR code.</p><div class="mfa-qr"><img src="' + esc(mfa.novo.qr) + '" alt="QR code para o app autenticador" width="180" height="180"></div><p class="hint">Sem câmera? Digite a chave: <code class="mfa-chave">' + esc(mfa.novo.secret) + '</code></p>' +
        '<label class="f" style="max-width:220px"><span>2. Código de 6 dígitos</span><input type="text" id="cfg-mfa-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></label><div class="acts"><button class="btn pri" type="button" data-c="mfa-confirmar">Confirmar e ativar</button><button class="btn ghost" type="button" data-c="mfa-cancelar">Cancelar</button></div>';
    } else h += '<button class="btn" type="button" data-c="mfa-ativar">' + IC.escudo + ' Ativar 2FA</button>';
    if (mfa.msg) h += '<p class="hint" style="color:' + (mfa.msg.ok ? "var(--good)" : "var(--bad)") + '">' + esc(mfa.msg.t) + '</p>';
    h += '<p class="hint">Guarde o código de recuperação do seu app autenticador. Perdendo o acesso ao aparelho, hoje só um administrador com acesso ao banco consegue remover o 2FA da conta.</p></div></div>';
    var t = temaEscolhido();
    h += '<div class="cfg-linha"><div class="cfg-rot"><b>Aparência</b></div><div class="cfg-campo"><div class="temas" role="radiogroup" aria-label="Aparência">' +
      [["light", "Claro"], ["dark", "Escuro"], ["auto", "Auto"]].map(function (o) { return '<button type="button" class="tema-op" role="radio" aria-checked="' + (t === o[0]) + '" data-c="tema" data-v="' + o[0] + '"><span class="tema-prev ' + o[0] + '"><i></i><i></i><i></i></span><span>' + o[1] + '</span></button>'; }).join("") + '</div></div></div>';
    h += '<div class="cfg-linha"><div class="cfg-rot"><b>Sessão</b></div><div class="cfg-campo"><button class="btn ghost" type="button" data-c="sair">Sair da conta</button></div></div>';
    return h;
  }
  function htmlNotif() {
    var h = '<div class="cfg-cab"><h3>Notificações</h3></div><p class="hint">Os lembretes aparecem no sino do topo enquanto a tarefa do dia estiver pendente e somem quando você a conclui. Por enquanto eles ficam só dentro do app, sem aviso no celular com o app fechado.</p>';
    TIPOS.forEach(function (t) {
      h += '<div class="cfg-linha"><div class="cfg-rot"><b>' + esc(t[1]) + '</b><span>' + esc(t[2]) + '</span></div><div class="cfg-campo"><button type="button" class="chave" role="switch" aria-checked="' + ligado(t[0]) + '" data-c="notif-pref" data-v="' + t[0] + '"><i></i><span>' + (ligado(t[0]) ? "Ligado" : "Desligado") + '</span></button></div></div>';
    });
    return h;
  }
  function html() {
    if (!user) return "";
    if (!mfa.carregado) carregaMfa();
    return '<div class="head"><p class="eyebrow">Conta</p><h2>Configurações pessoais</h2><div class="sub">Seu perfil, segurança, aparência e notificações.</div></div>' +
      '<div class="cfg"><nav class="cfg-nav" aria-label="Seções">' +
      '<button type="button" data-c="cfg-aba" data-aba="perfil" aria-current="' + (aba === "perfil") + '">' + IC.pessoa + ' Perfil</button>' +
      '<button type="button" data-c="cfg-aba" data-aba="notif" aria-current="' + (aba === "notif") + '">' + IC.sino + ' Notificações</button></nav>' +
      '<div class="panel cfg-painel">' + (aba === "notif" ? htmlNotif() : htmlPerfil()) + '</div></div>';
  }
  function redesenha() { var A = window.__tdjApp; if (A) A.render(); }

  async function carregaMfa() {
    if (mfa.carregando) return; mfa.carregando = true;
    try {
      var r = await sb.auth.mfa.listFactors();
      var v = r.data && (r.data.totp || []).filter(function (f) { return f.status === "verified"; })[0];
      mfa.ativo = v || null;
    } catch (e) { mfa.ativo = null; }
    mfa.carregado = true; mfa.carregando = false; redesenha();
  }
  function traduz(e) {
    var m = (e && e.message) || String(e || "");
    if (/same.*password|different from the old/i.test(m)) return "A nova senha precisa ser diferente da atual.";
    if (/at least|Password should/i.test(m)) return "A senha precisa ter pelo menos 8 caracteres.";
    if (/Invalid TOTP|invalid.*code|code.*invalid/i.test(m)) return "Código inválido. Confira o horário do celular e digite o código atual.";
    if (/reauthentication|recent login/i.test(m)) return "Por segurança, saia e entre de novo antes de trocar a senha.";
    if (/aal2|AAL2/i.test(m)) return "Confirme o código do 2FA no login antes de fazer essa alteração.";
    return "Não foi possível concluir: " + m;
  }

  /* ---------------- cliques e campos ---------------- */
  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-c]");
    if (!b) { if (painel && !ev.target.closest(".topo-notif")) { fechaPainel(); desenhaTopo(); } return; }
    var c = b.dataset.c, A = window.__tdjApp;
    if (c === "busca") { abrePesquisa(); return; }
    if (c === "busca-fechar") { fechaPesquisa(); return; }
    if (c === "busca-ir") { var r = ultimos[+b.dataset.i]; fechaPesquisa(); if (r && A) A.ir(r.ir); return; }
    if (c === "notif") { painel = painel === "notif" ? null : "notif"; desenhaTopo(); return; }
    if (c === "notif-ir") { var n = lembretesAtuais[+b.dataset.i]; fechaPainel(); if (n && A) A.ir(n.ir); return; }
    if (c === "conta") { aba = b.dataset.aba || "perfil"; fechaPainel(); rasc = null; salvarMsg = null; senhaMsg = null; if (A) A.ir({ area: "conta" }); return; }
    if (c === "cfg-aba") { aba = b.dataset.aba; redesenha(); return; }
    if (c === "sair") { if (window.__sair) window.__sair(); return; }
    if (c === "tema") {
      var v = b.dataset.v;
      try { if (v === "auto") localStorage.removeItem("tdj-tema"); else localStorage.setItem("tdj-tema", v); } catch (e) {}
      if (v === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", v);
      if (window.__tdjPintaTema) window.__tdjPintaTema();
      redesenha(); return;
    }
    if (c === "notif-pref") {
      prefs.notif[b.dataset.v] = !ligado(b.dataset.v);
      if (db) db.doc("config/usuario").set(JSON.parse(JSON.stringify(prefs))).catch(function () {});
      redesenha(); desenhaTopo(); return;
    }
    if (c === "salvar-nome") {
      b.disabled = true;
      var res = await sb.auth.updateUser({ data: { first_name: rascunho().first_name.trim(), last_name: rascunho().last_name.trim() } });
      if (res.error) salvarMsg = { ok: false, t: traduz(res.error) }; else { user = res.data.user; window.__tdjUser = user; window.__email = user.email; rasc = null; salvarMsg = { ok: true, t: "Nome salvo." }; }
      redesenha(); desenhaTopo(); return;
    }
    if (c === "senha-abrir") { senhaAberta = true; senhaMsg = null; redesenha(); return; }
    if (c === "senha-fechar") { senhaAberta = false; senhaMsg = null; redesenha(); return; }
    if (c === "senha-salvar") {
      var s1 = document.getElementById("cfg-senha1").value, s2 = document.getElementById("cfg-senha2").value;
      if (s1.length < 8) { senhaMsg = { ok: false, t: "A senha precisa ter pelo menos 8 caracteres." }; redesenha(); return; }
      if (s1 !== s2) { senhaMsg = { ok: false, t: "As duas senhas não são iguais." }; redesenha(); return; }
      b.disabled = true;
      var rs = await sb.auth.updateUser({ password: s1 });
      if (rs.error) senhaMsg = { ok: false, t: traduz(rs.error) }; else { senhaAberta = false; senhaMsg = { ok: true, t: "Senha alterada." }; }
      redesenha(); return;
    }
    if (c === "mfa-ativar") {
      b.disabled = true; mfa.msg = null;
      try {
        var lst = await sb.auth.mfa.listFactors();
        var velhos = ((lst.data && lst.data.all) || []).filter(function (f) { return f.status !== "verified"; });
        for (var i = 0; i < velhos.length; i++) await sb.auth.mfa.unenroll({ factorId: velhos[i].id });
        var en = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "TDJ " + new Date().toISOString().slice(0, 16) });
        if (en.error) throw en.error;
        mfa.novo = { id: en.data.id, qr: en.data.totp.qr_code, secret: en.data.totp.secret };
      } catch (e) { mfa.msg = { ok: false, t: traduz(e) }; }
      redesenha(); return;
    }
    if (c === "mfa-cancelar") { if (mfa.novo) sb.auth.mfa.unenroll({ factorId: mfa.novo.id }).catch(function () {}); mfa.novo = null; mfa.msg = null; redesenha(); return; }
    if (c === "mfa-confirmar") {
      var cod = (document.getElementById("cfg-mfa-cod").value || "").replace(/\D/g, "");
      if (cod.length !== 6) { mfa.msg = { ok: false, t: "Digite os 6 dígitos do app autenticador." }; redesenha(); return; }
      b.disabled = true;
      var vr = await sb.auth.mfa.challengeAndVerify({ factorId: mfa.novo.id, code: cod });
      if (vr.error) mfa.msg = { ok: false, t: traduz(vr.error) }; else { mfa.novo = null; mfa.carregado = false; mfa.msg = { ok: true, t: "2FA ativado. Nos próximos logins o app vai pedir o código do autenticador." }; }
      redesenha(); return;
    }
    if (c === "mfa-desativar1") { mfa.desativar = true; redesenha(); return; }
    if (c === "mfa-desativar0") { mfa.desativar = false; redesenha(); return; }
    if (c === "mfa-desativar2") {
      b.disabled = true;
      var ur = await sb.auth.mfa.unenroll({ factorId: mfa.ativo.id });
      mfa.desativar = false;
      if (ur.error) mfa.msg = { ok: false, t: traduz(ur.error) }; else { mfa.carregado = false; mfa.msg = { ok: true, t: "2FA desativado." }; await sb.auth.refreshSession().catch(function () {}); }
      redesenha(); return;
    }
  });
  document.addEventListener("input", function (ev) {
    var k = ev.target.dataset && ev.target.dataset.cfg; if (!k) return;
    rascunho()[k] = ev.target.value; salvarMsg = null;
    var bt = document.querySelector('[data-c="salvar-nome"]'), m = user.user_metadata || {};
    if (bt) bt.disabled = rasc.first_name === (m.first_name || "") && rasc.last_name === (m.last_name || "");
  });
  document.addEventListener("keydown", function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k" && user) { ev.preventDefault(); abrePesquisa(); }
    if (ev.key === "Escape") { fechaPesquisa(); if (painel) { fechaPainel(); desenhaTopo(); } }
  });
  window.addEventListener("online", function () { online = true; desenhaTopo(); });
  window.addEventListener("offline", function () { online = false; desenhaTopo(); });
  setInterval(desenhaTopo, 60000);

  /* ---------------- ligação com o app ---------------- */
  window.__tdjConta = {
    html: html,
    depois: function () { desenhaTopo(); }
  };
  document.addEventListener("tdj:login", async function () {
    sb = window.__tdjSb; user = window.__tdjUser;
    desenhaTopo();
    db = await window.claude.use("db");
    if (db) db.doc("config/usuario").onSnapshot(function (s) { prefs = s.exists ? Object.assign({ notif: {} }, s.data()) : { notif: {} }; desenhaTopo(); });
  });
})();
