/* Camada de dados e IA do app: login no Supabase, armazenamento dos documentos e chamada ao coach.
   Expõe window.claude.use("db" | "sample") no mesmo formato que o app já usa. */
(function () {
  "use strict";
  var SUPABASE_URL = "https://nixjsqusdvrdgtupdief.supabase.co";
  var SUPABASE_KEY = "sb_publishable_1A5FzY-23QRf_bgkF1GGAg_V3MaFkRq";
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  var uid = null, pronto, liberar;
  pronto = new Promise(function (r) { liberar = r; });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  /* ---------------- login ---------------- */
  var modo = "entrar";
  function el(h) { var d = document.createElement("div"); d.innerHTML = h; return d.firstElementChild; }
  function telaLogin(msg, tipo) {
    var tela = document.getElementById("login");
    if (!tela) { tela = el('<div id="login" class="login"></div>'); document.body.appendChild(tela); }
    var criar = modo === "criar", recup = modo === "recuperar", nova = modo === "nova";
    tela.innerHTML =
      '<form class="login-box" id="login-form" novalidate>' +
      '<img class="login-logo" src="icons/logo.png" alt="Logo do app" width="72" height="72">' +
      '<p class="eyebrow">TDJ · Treino, Dieta e Jiujitsu</p>' +
      '<h2>' + (criar ? "Criar conta" : recup ? "Recuperar senha" : nova ? "Nova senha" : "Entrar") + '</h2>' +
      (nova ? "" : '<label class="f"><span>E-mail</span><input type="email" id="login-email" autocomplete="email" required></label>') +
      (recup ? "" : '<label class="f"><span>' + (nova ? "Nova senha" : "Senha") + '</span><input type="password" id="login-senha" autocomplete="' + (criar || nova ? "new-password" : "current-password") + '" minlength="8" required></label>') +
      (criar ? '<p class="hint">Use pelo menos 8 caracteres.</p>' : "") +
      (msg ? '<p class="hint" style="color:' + (tipo === "ok" ? "var(--good)" : "var(--bad)") + '">' + msg + '</p>' : "") +
      '<button class="btn pri big" type="submit" id="login-ok">' + (criar ? "Criar conta" : recup ? "Enviar link por e-mail" : nova ? "Salvar nova senha" : "Entrar") + '</button>' +
      '<div class="acts">' +
      (modo === "entrar" ? '<button class="btn ghost sm" type="button" data-modo="criar">Criar conta</button><button class="btn ghost sm" type="button" data-modo="recuperar">Esqueci a senha</button>' : "") +
      (criar || recup ? '<button class="btn ghost sm" type="button" data-modo="entrar">Já tenho conta</button>' : "") +
      '</div></form>';
    tela.hidden = false;
    document.querySelector(".wrap").hidden = true;
    tela.querySelectorAll("[data-modo]").forEach(function (b) { b.onclick = function () { modo = b.dataset.modo; telaLogin(); }; });
    tela.querySelector("form").onsubmit = enviarLogin;
    var f = tela.querySelector("input"); if (f) f.focus();
  }
  function traduz(e) {
    var m = (e && e.message) || "";
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(m)) return "Confirme o e-mail pelo link que enviamos antes de entrar.";
    if (/already registered|already been registered/i.test(m)) return "Este e-mail já tem conta. Use “Já tenho conta”.";
    if (/Password should be|at least/i.test(m)) return "A senha precisa ter pelo menos 8 caracteres.";
    if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
    if (/fetch|network/i.test(m)) return "Sem conexão com o servidor. Verifique a internet.";
    return "Não foi possível concluir: " + m;
  }
  async function enviarLogin(ev) {
    ev.preventDefault();
    var email = (document.getElementById("login-email") || {}).value, senha = (document.getElementById("login-senha") || {}).value;
    var bt = document.getElementById("login-ok"); bt.disabled = true;
    var r, volta = location.origin + location.pathname;
    try {
      if (modo === "criar") {
        r = await sb.auth.signUp({ email: email, password: senha, options: { emailRedirectTo: volta } });
        if (r.error) throw r.error;
        if (!r.data.session) { modo = "entrar"; telaLogin("Conta criada. Abra o link de confirmação que enviamos para " + email + " e depois entre aqui.", "ok"); return; }
      } else if (modo === "recuperar") {
        r = await sb.auth.resetPasswordForEmail(email, { redirectTo: volta });
        if (r.error) throw r.error;
        modo = "entrar"; telaLogin("Se houver conta com esse e-mail, chegou um link para criar uma nova senha.", "ok"); return;
      } else if (modo === "nova") {
        r = await sb.auth.updateUser({ password: senha });
        if (r.error) throw r.error;
        modo = "entrar"; entrou(r.data.user); return;
      } else {
        r = await sb.auth.signInWithPassword({ email: email, password: senha });
        if (r.error) throw r.error;
      }
    } catch (e) { telaLogin(traduz(e)); return; }
    finally { if (document.getElementById("login-ok")) document.getElementById("login-ok").disabled = false; }
  }
  function entrou(user) {
    if (!user || uid === user.id) return;
    uid = user.id; window.__email = user.email || "";
    var tela = document.getElementById("login"); if (tela) tela.hidden = true;
    document.querySelector(".wrap").hidden = false;
    liberar();
  }
  window.__sair = function () { sb.auth.signOut().finally(function () { try { localStorage.removeItem("diario-treino-v1"); } catch (e) {} location.reload(); }); };

  document.addEventListener("DOMContentLoaded", async function () {
    document.querySelector(".wrap").hidden = true;
    sb.auth.onAuthStateChange(function (evento, sessao) {
      if (evento === "PASSWORD_RECOVERY") { modo = "nova"; telaLogin(); return; }
      if (sessao && sessao.user && modo !== "nova") entrou(sessao.user);
      if (evento === "SIGNED_OUT") location.reload();
    });
    var s = await sb.auth.getSession();
    if (s.data.session && modo !== "nova") entrou(s.data.session.user); else if (modo !== "nova") telaLogin();
  });

  /* ---------------- banco: documentos por coleção ---------------- */
  var cache = new Map(), ouvintes = [], carregado = null;
  function chave(col, id) { return col + "/" + id; }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function docSnap(col, id) {
    var k = chave(col, id), tem = cache.has(k);
    return { id: id, exists: tem, data: function () { return tem ? copia(cache.get(k)) : undefined; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function querySnap(col) {
    var docs = [];
    cache.forEach(function (v, k) { var i = k.indexOf("/"); if (k.slice(0, i) === col) docs.push(docSnap(col, k.slice(i + 1))); });
    docs.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function avisa(col) { ouvintes.forEach(function (o) { if (o.col === col) { try { o.fn(o.id != null ? docSnap(col, o.id) : querySnap(col)); } catch (e) { console.error(e); } } }); }
  function avisaTodos() { var cols = {}; ouvintes.forEach(function (o) { cols[o.col] = 1; }); Object.keys(cols).forEach(avisa); }
  async function carregaTudo() {
    var de = 0, passo = 1000, novo = new Map();
    for (;;) {
      var r = await sb.from("docs").select("col,id,data").range(de, de + passo - 1);
      if (r.error) throw r.error;
      r.data.forEach(function (x) { novo.set(chave(x.col, x.id), x.data); });
      if (r.data.length < passo) break;
      de += passo;
    }
    cache = novo;
  }
  var pendentes = new Set();
  function iniciaBanco() {
    if (carregado) return carregado;
    carregado = carregaTudo().then(function () {
      var primeira = true;
      sb.channel("docs-" + uid)
        .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "user_id=eq." + uid }, function (p) {
          var row = p.eventType === "DELETE" ? p.old : p.new;
          if (!row || !row.col) return;
          var k = chave(row.col, row.id);
          if (pendentes.has(k)) return;
          if (p.eventType === "DELETE") cache.delete(k); else cache.set(k, row.data);
          avisa(row.col);
        })
        .subscribe(function (st) {
          if (st === "SUBSCRIBED" && !primeira) carregaTudo().then(avisaTodos).catch(function () {});
          if (st === "SUBSCRIBED") primeira = false;
        });
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") carregaTudo().then(avisaTodos).catch(function () {}); });
    });
    return carregado;
  }
  function falha(e) { console.error(e); var c = e && (e.code === "42501" || /row-level/i.test(e.message || "")) ? "invalid_argument" : "unavailable"; return Promise.reject({ code: c, message: (e && e.message) || "erro" }); }
  function docRef(path) {
    var p = path.split("/"), col = p[0], id = p[1];
    return {
      id: id, path: path,
      get: function () { return iniciaBanco().then(function () { return docSnap(col, id); }); },
      set: function (data) {
        var k = chave(col, id), d = copia(data);
        cache.set(k, d); pendentes.add(k); avisa(col);
        return sb.from("docs").upsert({ user_id: uid, col: col, id: id, data: d }, { onConflict: "user_id,col,id" })
          .then(function (r) { pendentes.delete(k); if (r.error) return falha(r.error); }, function (e) { pendentes.delete(k); return falha(e); });
      },
      delete: function () {
        var k = chave(col, id);
        cache.delete(k); pendentes.add(k); avisa(col);
        return sb.from("docs").delete().eq("col", col).eq("id", id)
          .then(function (r) { pendentes.delete(k); if (r.error) return falha(r.error); }, function (e) { pendentes.delete(k); return falha(e); });
      },
      onSnapshot: function (fn, err) {
        var o = { col: col, id: id, fn: fn }; ouvintes.push(o);
        iniciaBanco().then(function () { fn(docSnap(col, id)); }, function (e) { if (err) err({ code: "unavailable", message: String(e && e.message) }); });
        return function () { ouvintes = ouvintes.filter(function (x) { return x !== o; }); };
      }
    };
  }
  function colRef(path) {
    var q = {
      path: path,
      limit: function () { return q; }, orderBy: function () { return q; }, where: function () { return q; },
      doc: function (id) { return docRef(path + "/" + id); },
      get: function () { return iniciaBanco().then(function () { return querySnap(path); }); },
      onSnapshot: function (fn, err) {
        var o = { col: path, id: null, fn: fn }; ouvintes.push(o);
        iniciaBanco().then(function () { fn(querySnap(path)); }, function (e) { if (err) err({ code: "unavailable", message: String(e && e.message) }); });
        return function () { ouvintes = ouvintes.filter(function (x) { return x !== o; }); };
      }
    };
    return q;
  }
  var db = Object.freeze({ doc: docRef, collection: colRef });

  /* ---------------- IA: coach via Edge Function ---------------- */
  function paraBase64(blob) {
    return new Promise(function (ok, nok) {
      var img = new Image(), url = URL.createObjectURL(blob);
      img.onload = function () {
        var max = 1568, w = img.naturalWidth, h = img.naturalHeight, f = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * f); c.height = Math.round(h * f);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); nok({ code: "image_rejected", message: "imagem inválida" }); };
      img.src = url;
    });
  }
  async function sample(input, opts) {
    opts = opts || {};
    var turns = typeof input === "string" ? [{ role: "user", content: input }] : input;
    var imgs = [];
    if (opts.images) {
      var lista = Array.prototype.slice.call(opts.images.length != null ? opts.images : [opts.images], 0, 4);
      for (var i = 0; i < lista.length; i++) imgs.push({ media_type: "image/jpeg", data: await paraBase64(lista[i]) });
    }
    var s = await sb.auth.getSession();
    if (!s.data.session) throw { code: "session_expired", message: "sem sessão" };
    var effort = opts.modelTier === "quick" ? "low" : opts.modelTier === "complex" ? "high" : "medium";
    var texto = "", res;
    try {
      res = await fetch(SUPABASE_URL + "/functions/v1/coach", {
        method: "POST", signal: opts.signal,
        headers: { "Authorization": "Bearer " + s.data.session.access_token, "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: turns, images: imgs, effort: effort, json: !!opts._json })
      });
    } catch (e) { throw { code: e && e.name === "AbortError" ? "cancelled" : "upstream_error", message: String(e && e.message) }; }
    if (!res.ok) {
      var c = "upstream_error"; try { c = (await res.json()).error || c; } catch (e) {}
      if (res.status === 401) c = "session_expired";
      throw { code: c, message: "HTTP " + res.status };
    }
    var leitor = res.body.getReader(), dec = new TextDecoder(), resto = "", fim = null;
    try {
      for (;;) {
        var p = await leitor.read();
        if (p.done) break;
        var linhas = (resto + dec.decode(p.value, { stream: true })).split("\n"); resto = linhas.pop();
        for (var j = 0; j < linhas.length; j++) {
          if (!linhas[j].trim()) continue;
          var m = JSON.parse(linhas[j]);
          if (m.d) { texto += m.d; if (opts.onText) try { opts.onText({ text: texto, delta: m.d }); } catch (e) {} }
          else if (m.error) throw { code: m.error, message: m.error, text: texto || undefined };
          else if (m.done) fim = m;
        }
      }
    } catch (e) {
      if (e && e.code) throw e;
      throw { code: e && e.name === "AbortError" ? "cancelled" : "upstream_error", message: String(e && e.message), text: texto || undefined };
    }
    if (!fim) throw { code: "upstream_error", message: "resposta incompleta", text: texto || undefined };
    if (!texto.trim()) throw { code: "empty_completion", message: "sem texto" };
    return { text: texto, truncated: !!fim.truncated, modelTierApplied: opts.modelTier || "default" };
  }
  sample.json = function (input, opts) {
    return sample(input, Object.assign({}, opts || {}, { _json: true })).then(function (r) {
      var t = r.text.trim(), m = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
      if (m) t = m[1];
      try { return JSON.parse(t); } catch (e) {
        var a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
        try { if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)); } catch (e2) {}
        throw { code: "invalid_json", message: "resposta sem JSON", text: r.text };
      }
    });
  };
  sample.limits = function () { return Promise.resolve({ maxPromptBytes: 600000, images: { maxCount: 4, maxInputBytes: 20000000, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] } }); };

  window.claude = Object.freeze({
    use: function (nome) {
      if (nome === "db") return pronto.then(function () { return iniciaBanco().then(function () { return db; }, function () { return db; }); });
      if (nome === "sample") return pronto.then(function () { return sample; });
      return Promise.resolve(null);
    }
  });
})();
