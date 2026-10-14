/* Giving Campaignリスト：画面の動き。データは Supabase に保存します（設定は config.js）。 */
(function () {
  "use strict";
  var REGIONS = [
    ["北海道", ["北海道"]],
    ["東北", ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"]],
    ["関東", ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"]],
    ["中部", ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"]],
    ["近畿", ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"]],
    ["中国", ["鳥取県", "島根県", "岡山県", "広島県", "山口県"]],
    ["四国", ["徳島県", "香川県", "愛媛県", "高知県"]],
    ["九州・沖縄", ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]],
    ["海外・その他", ["海外・その他"]],
    ["都道府県未入力", [""]]
  ];
  var PREF_REGION = {}, PREF_ORDER = {}, order = 0;
  REGIONS.forEach(function (r) {
    r[1].forEach(function (p) { PREF_REGION[p] = r[0]; PREF_ORDER[p] = order++; });
  });
  var OTHER = "海外・その他", NO_PREF = "都道府県未入力";

  var $ = function (id) { return document.getElementById(id); };
  var form = $("entryForm"), fUniv = $("fUniv"), fOrg = $("fOrg"), fPref = $("fPref"),
      fContact = $("fContact"), fMemo = $("fMemo"), saveBtn = $("saveBtn"),
      cancelBtn = $("cancelBtn"), formMsg = $("formMsg"), statusEl = $("status"),
      chipsEl = $("chips"), groupsEl = $("groups"), qEl = $("q");
  var fNoUniv = $("fNoUniv"), fContactOther = $("fContactOther"),
      fVoteDate = $("fVoteDate"), fVoteTime = $("fVoteTime"), fComment = $("fComment"), fReply = $("fReply"),
      fNVoteDate = $("fNVoteDate"), fNVoteTime = $("fNVoteTime"), fNComment = $("fNComment");
  var fUnion = $("fUnion");
  var NO_UNIV = "その他（大学名なし）";
  var CONTACTS = ["X", "Instagram", "CrossCampus"];

  function fmtDate(s) { return s ? String(s).replace(/-/g, "/") : ""; }
  function fmtTime(s) { return s ? String(s).slice(0, 5) : ""; }
  function replyPill(e) {
    var done = e.reply === "done";
    return el("span", "pill " + (done ? "done" : "pending"), done ? "返信済み" : "未返信");
  }
  // チェックや選択に合わせて、入力欄の有効・表示を切り替える
  function syncForm() {
    fUniv.disabled = fNoUniv.checked;
    if (fNoUniv.checked) fUniv.value = "";
    $("contactOtherWrap").hidden = fContact.value !== "__other";
    if (typeof showDupHint === "function") showDupHint();
    if (typeof showUnionHint === "function") showUnionHint();
  }

  // ---- 設定の確認 ----
  var cfg = window.MEIBO_CONFIG;
  var rawUrl = String((cfg && cfg.supabaseUrl) || "").trim(), key = String((cfg && cfg.supabaseKey) || "").trim();
  // URL の後ろに /rest/v1/ などが付いていても、https://xxxx.supabase.co の部分だけを使う
  var um = rawUrl.match(/^https:\/\/[a-z0-9-]+\.supabase\.co/i);
  var url = um ? um[0] : "";
  // 設定がうまくいっていない理由（初期設定の画面に表示する）
  var setupReason = "";
  if (!cfg) setupReason = "config.js を読み込めませんでした。index.html と同じフォルダに「config.js」という名前で入っているか、書き換えたときに \" や , を消していないかを確かめてください。";
  else if (!rawUrl && !key) setupReason = "config.js の supabaseUrl と supabaseKey が両方とも空です。書き換えた config.js が保存されているか、index.html と同じフォルダにあるかを確かめてください。";
  else if (!rawUrl) setupReason = "config.js の supabaseUrl が空です。";
  else if (!url) setupReason = "config.js の supabaseUrl の形が違います。https://xxxx.supabase.co の形にしてください。（今の値：" + rawUrl.slice(0, 60) + "）";
  else if (!key) setupReason = "config.js の supabaseKey が空です。";
  else if (key.length <= 20) setupReason = "config.js の supabaseKey が短すぎます。キー全体をコピーできているか確かめてください。";
  else if (!(window.supabase && window.supabase.createClient)) setupReason = "接続用の部品を読み込めませんでした。インターネットにつながっているかを確かめて、ページを開き直してください。";
  var configured = !setupReason;
  var sb = configured ? window.supabase.createClient(url, key) : null;

  // ---- お試しモード：Supabase を設定する前に動作を確かめるためのもの ----
  // データはこのブラウザの中（localStorage）だけに保存され、他の人や他の端末には共有されません。
  var TRIAL_KEY = "meibo-trial-entries";
  var trial = false, mem = [];
  try { mem = JSON.parse(localStorage.getItem(TRIAL_KEY) || "[]") || []; } catch (e) { mem = []; }
  function persist() { try { localStorage.setItem(TRIAL_KEY, JSON.stringify(mem)); } catch (e) {} }
  var ok = function (data) { return Promise.resolve({ data: data || null, error: null }); };
  var store = {
    ready: function () { return !!sb || trial; },
    list: function () { return trial ? ok(mem.slice()) : sb.from("entries").select("*"); },
    insert: function (row) {
      if (!trial) return sb.from("entries").insert(row);
      row.id = "t" + Date.now() + Math.random().toString(36).slice(2, 7);
      row.created_at = new Date().toISOString();
      mem.push(row); persist(); return ok();
    },
    update: function (id, row) {
      if (!trial) return sb.from("entries").update(row).eq("id", id);
      mem = mem.map(function (x) { return x.id === id ? Object.assign({}, x, row) : x; });
      persist(); return ok();
    },
    remove: function (id) {
      if (!trial) return sb.from("entries").delete().eq("id", id);
      mem = mem.filter(function (x) { return x.id !== id; });
      persist(); return ok();
    }
  };

  var initialView = location.hash === "#list" ? "list" : "register";
  var dupCounts = {}, unionCount = 0;
  var initialSort = "region";
  try { var sv = localStorage.getItem("meibo-sort"); if (sv === "created" || sv === "kana" || sv === "vote" || sv === "nvote") initialSort = sv; } catch (e) {}
  var state = { sort: initialSort, view: initialView, user: null, loaded: false, entries: [], region: "", q: "",
                editingId: null, confirmId: null, busy: false, failed: false };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  (function buildPrefSelect() {
    var first = el("option", null, "選んでください（例：北海道）");
    first.value = "";
    fPref.appendChild(first);
    REGIONS.forEach(function (r) {
      if (r[0] === NO_PREF) return;
      var g = document.createElement("optgroup");
      g.label = r[0];
      r[1].forEach(function (p) {
        var o = el("option", null, p); o.value = p; g.appendChild(o);
      });
      fPref.appendChild(g);
    });
  })();

  function regionOf(e) { return PREF_REGION[e.pref] || OTHER; }
  function setMsg(text, isErr) { formMsg.textContent = text || ""; formMsg.className = isErr ? "err" : ""; }
  function setView(v) { state.view = v; try { history.replaceState(null, "", "#" + v); } catch (e) {} render(); }

  // どの画面を出すか：setup（未設定）／login（ログイン前）／app（名簿）
  function showMode() {
    var mode = state.user ? "app" : (configured ? "login" : "setup");
    $("trialNote").hidden = !trial;
    $("logoutBtn").textContent = trial ? "お試しを終了" : "ログアウト";
    $("viewSetup").hidden = mode !== "setup";
    $("viewLogin").hidden = mode !== "login";
    $("tabs").hidden = mode !== "app";
    $("viewRegister").hidden = mode !== "app" || state.view === "list";
    $("viewList").hidden = mode !== "app" || state.view !== "list";
    if (mode === "setup") statusEl.textContent = "初期設定が必要です";
    if (mode === "login") statusEl.textContent = "ログインしてください";
    return mode;
  }

  function applyFormState() {
    $("formTitle").textContent = state.editingId ? "登録内容を直す" : "新しく登録する";
    saveBtn.disabled = !state.user || state.busy;
    saveBtn.textContent = state.editingId ? "更新する" : "登録する";
    cancelBtn.hidden = !state.editingId;
  }

  function matches(e) {
    if (state.region && regionOf(e) !== state.region) return false;
    if (!state.q) return true;
    var hay = [e.univ || NO_UNIV, e.org, e.pref, e.contact, e.memo].join(" ").toLowerCase();
    return hay.indexOf(state.q.toLowerCase()) !== -1;
  }

  function render() {
    if (showMode() !== "app") return;
    var isList = state.view === "list";
    if (isList) { $("tabList").setAttribute("aria-current", "page"); $("tabRegister").removeAttribute("aria-current"); }
    else { $("tabRegister").setAttribute("aria-current", "page"); $("tabList").removeAttribute("aria-current"); }
    $("tabCount").textContent = state.loaded ? String(state.entries.length) : "";

    dupCounts = {};
    state.entries.forEach(function (e) {
      if (e.univ) { var k0 = normUniv(e.univ); dupCounts[k0] = (dupCounts[k0] || 0) + 1; }
    });

    // 登録ページ：最近の登録（新しい順に5件）
    var recent = $("recent"); recent.textContent = "";
    var latest = state.entries.slice().sort(function (a, b) {
      return String(b.created_at).localeCompare(String(a.created_at));
    }).slice(0, 5);
    $("recentWrap").hidden = !latest.length;
    latest.forEach(function (e) { recent.appendChild(recentEl(e)); });

    dupCounts = {};
    state.entries.forEach(function (e) {
      if (e.univ) { var k = normUniv(e.univ); dupCounts[k] = (dupCounts[k] || 0) + 1; }
    });
    unionCount = state.entries.filter(function (e) { return e.student_union; }).length;
    Array.prototype.forEach.call(document.querySelectorAll("#sortChips button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-sort") === state.sort));
    });

    var counts = {};
    state.entries.forEach(function (e) { var r = regionOf(e); counts[r] = (counts[r] || 0) + 1; });

    chipsEl.textContent = "";
    var mk = function (label, value, n) {
      var b = el("button", "chip" + (n === 0 ? " zero" : ""), label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(state.region === value));
      b.appendChild(el("span", "n", String(n)));
      b.addEventListener("click", function () { state.region = value; render(); });
      chipsEl.appendChild(b);
    };
    mk("すべて", "", state.entries.length);
    REGIONS.forEach(function (r) {
      if ((r[0] === OTHER || r[0] === NO_PREF) && !counts[r[0]]) return;
      mk(r[0], r[0], counts[r[0]] || 0);
    });

    var dl = $("univList"); dl.textContent = "";
    var seen = {};
    state.entries.forEach(function (e) {
      if (e.univ && !seen[e.univ]) { seen[e.univ] = 1; var o = document.createElement("option"); o.value = e.univ; dl.appendChild(o); }
    });

    groupsEl.textContent = "";
    if (state.failed) {
      var x = el("div", "empty");
      x.appendChild(el("strong", null, "名簿を読み込めませんでした"));
      x.appendChild(document.createTextNode("通信状態を確かめて「最新の状態にする」を押してください。直らない場合は README の「うまくいかないとき」を見てください。"));
      groupsEl.appendChild(x);
      return;
    }
    if (!state.loaded) { groupsEl.appendChild(el("div", "empty", "名簿を読み込んでいます…")); return; }
    if (!state.entries.length) {
      var em = el("div", "empty");
      em.appendChild(el("strong", null, "まだ登録がありません"));
      em.appendChild(document.createTextNode("右上の「登録」から大学名を入れて「登録する」を押すと、ここに地域ごとに並びます。"));
      groupsEl.appendChild(em);
      return;
    }
    var shown = state.entries.filter(matches);
    var voted = shown.filter(function (e) { return e.voted; });
    shown = shown.filter(function (e) { return !e.voted; });
    if (!shown.length && !voted.length) {
      groupsEl.appendChild(el("div", "empty", "条件に合う登録がありません。検索語や地域を変えてみてください。"));
      return;
    }
    if (state.sort === "region") {
      REGIONS.forEach(function (r) {
        var rows = shown.filter(function (e) { return regionOf(e) === r[0]; });
        if (!rows.length) return;
        groupsEl.appendChild(sectionEl(r[0], rows.sort(sorter())));
      });
    } else if (shown.length) {
      groupsEl.appendChild(sectionEl(SORT_TITLE[state.sort] || SORT_TITLE.created, shown.sort(sorter())));
    }
    // 投票済みにチェックしたものは、最後の「投票済み」にまとめる
    if (voted.length) groupsEl.appendChild(sectionEl("投票済み", voted.sort(sorter()), "voted"));
  }

  // 今の並べ替えに合わせた比べ方
  function sorter() {
    if (state.sort === "region") return function (a, b) { return (PREF_ORDER[a.pref] - PREF_ORDER[b.pref]) || byKana(a, b); };
    if (state.sort === "kana") return byKana;
    if (state.sort === "vote") return byVote;
    if (state.sort === "nvote") return byNVote;
    return function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); };
  }

  // 五十音順：大学名の文字で比べる（漢字は読みではなく文字の順）。大学名なしは最後。
  function sortKey(e) { return e.univ; }
  // 投票日順：早い日が上。同じ日は時間の早い順。投票日が未入力のものは最後。
  function byVote(a, b) {
    return (!a.vote_date - !b.vote_date) || a.vote_date.localeCompare(b.vote_date) ||
           (!a.vote_time - !b.vote_time) || a.vote_time.localeCompare(b.vote_time) || byKana(a, b);
  }
  // Nociws投票日順：Nociws側の投票日が早い順。同じ日は時間の早い順。未入力のものは最後。
  function byNVote(a, b) {
    return (!a.n_vote_date - !b.n_vote_date) || a.n_vote_date.localeCompare(b.n_vote_date) ||
           (!a.n_vote_time - !b.n_vote_time) || a.n_vote_time.localeCompare(b.n_vote_time) || byKana(a, b);
  }
  var SORT_TITLE = { created: "登録順（新しい順）", kana: "五十音順", vote: "投票日順（早い順）", nvote: "Nociws投票日順（早い順）" };
  function byKana(a, b) {
    return (!a.univ - !b.univ) || sortKey(a).localeCompare(sortKey(b), "ja") || a.org.localeCompare(b.org, "ja");
  }
  // 同じ大学かどうかを比べるための形（前後や途中の空白、全角・半角の違いを無視）
  function normUniv(s) { return String(s || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase(); }
  function isDup(e) { return !!e.univ && dupCounts[normUniv(e.univ)] > 1; }
  function dupBadge() { return el("span", "badge-dup", "重複"); }

  function sectionEl(title, rows, cls) {
    var sec = el("section", "region" + (cls ? " " + cls : ""));
    var h = el("h3", null, title);
    h.appendChild(el("span", "n", rows.length + "件"));
    sec.appendChild(h);
    var table = el("table"), thead = el("thead"), hr = el("tr"), tbody = el("tbody");
    [["投票済み"], ["大学名"], ["団体名"], ["都道府県"], ["連絡手段"], ["投票日"], ["投票時間"], ["応援コメント"], ["返信確認"],
     ["Nociws 投票日", "nz"], ["Nociws 投票時間"], ["Nociws 応援コメント"], ["メモ"], ["操作"]]
      .forEach(function (c) { var th = el("th", c[1], c[0]); th.scope = "col"; hr.appendChild(th); });
    thead.appendChild(hr); table.appendChild(thead);
    rows.forEach(function (e) { tbody.appendChild(trEl(e)); });
    table.appendChild(tbody);
    var sc = el("div", "scroll"); sc.appendChild(table); sec.appendChild(sc);
    return sec;
  }

  function trEl(e) {
    var tr = el("tr");
    var tv = el("td", "t-voted"), cb = el("input");
    cb.type = "checkbox"; cb.checked = e.voted;
    cb.setAttribute("aria-label", (e.univ || e.org || NO_UNIV) + " を投票済みにする");
    cb.addEventListener("change", function () { setVoted(e, cb.checked); });
    tv.appendChild(cb); tr.appendChild(tv);
    var tu = el("td", "t-univ wide" + (isDup(e) ? " dup" : ""), e.univ || NO_UNIV);
    if (isDup(e)) tu.appendChild(dupBadge());
    // 学生連合にチェックした登録が2件以上あるときは、その行の大学名の下に警告を出す
    if (e.student_union && unionCount >= 2) tu.appendChild(el("span", "union-warn", "学生連合は既に登録されています"));
    tr.appendChild(tu);
    tr.appendChild(el("td", "wide", e.org));
    tr.appendChild(el("td", "t-pref", e.pref));
    tr.appendChild(el("td", null, e.contact));
    tr.appendChild(el("td", "nw", fmtDate(e.vote_date)));
    tr.appendChild(el("td", "nw", fmtTime(e.vote_time)));
    tr.appendChild(el("td", "mark", e.comment || "ー"));
    var rp = el("td"); rp.appendChild(replyPill(e)); tr.appendChild(rp);
    tr.appendChild(el("td", "nw nz", fmtDate(e.n_vote_date)));
    tr.appendChild(el("td", "nw", fmtTime(e.n_vote_time)));
    tr.appendChild(el("td", "mark", e.n_comment || "ー"));
    tr.appendChild(el("td", "wide", e.memo));
    var td = el("td", "t-acts"), acts = el("div", "acts");
    if (state.confirmId === e.id) {
      var yes = el("button", "btn small danger", "削除する"); yes.type = "button";
      yes.addEventListener("click", function () { removeEntry(e.id); });
      var no = el("button", "btn small ghost", "やめる"); no.type = "button";
      no.addEventListener("click", function () { state.confirmId = null; render(); });
      acts.appendChild(yes); acts.appendChild(no);
    } else {
      var ed = el("button", "btn small ghost", "編集"); ed.type = "button";
      ed.addEventListener("click", function () { startEdit(e); });
      var del = el("button", "btn small ghost", "削除"); del.type = "button";
      del.addEventListener("click", function () { state.confirmId = e.id; render(); });
      acts.appendChild(ed); acts.appendChild(del);
    }
    td.appendChild(acts); tr.appendChild(td);
    return tr;
  }

  function recentEl(e) {
    var row = el("div", "row"), body = el("div", "body");
    var name = el("div", "name" + (isDup(e) ? " dup" : ""), e.univ || NO_UNIV);
    if (isDup(e)) name.appendChild(dupBadge());
    if (e.org) name.appendChild(el("span", "org", e.org));
    body.appendChild(name);
    var meta = el("div", "meta");
    meta.appendChild(el("span", "pref", e.pref || NO_PREF));
    if (e.contact) meta.appendChild(el("span", null, e.contact));
    if (e.vote_date) meta.appendChild(el("span", null, "投票日 " + fmtDate(e.vote_date)));
    meta.appendChild(replyPill(e));
    if (e.memo) meta.appendChild(el("span", null, e.memo));
    body.appendChild(meta);
    row.appendChild(body);
    return row;
  }

  // ---- データの読み書き ----
  function load() {
    if (!store.ready() || !state.user) return;
    store.list().then(function (res) {
      if (res.error) {
        state.failed = true; state.loaded = true;
        statusEl.textContent = "名簿を読み込めませんでした";
      } else {
        state.entries = (res.data || []).map(function (v) {
          return { id: v.id, univ: String(v.univ || ""), org: String(v.org || ""),
                   pref: String(v.pref || ""), contact: String(v.contact || ""),
                   memo: String(v.memo || ""), created_at: v.created_at || "",
                   vote_date: String(v.vote_date || ""), vote_time: String(v.vote_time || ""),
                   comment: String(v.comment || ""), reply: v.reply === "done" ? "done" : "pending",
                   n_vote_date: String(v.n_vote_date || ""), n_vote_time: String(v.n_vote_time || ""),
                   n_comment: String(v.n_comment || ""), voted: v.voted === true,
                   student_union: v.student_union === true };
        });
        state.failed = false; state.loaded = true;
        statusEl.textContent = "全 " + state.entries.length + " 件";
        showUnionHint();
      }
      render();
    }, function () {
      state.failed = true; state.loaded = true;
      statusEl.textContent = "名簿を読み込めませんでした"; render();
    });
  }

  function startEdit(e) {
    state.editingId = e.id; state.confirmId = null;
    fUniv.value = e.univ; fNoUniv.checked = !e.univ; fOrg.value = e.org;
    fPref.value = PREF_REGION[e.pref] != null ? e.pref : OTHER;
    var known = !e.contact || CONTACTS.indexOf(e.contact) !== -1;
    fContact.value = known ? e.contact : "__other";
    fContactOther.value = known ? "" : e.contact;
    fVoteDate.value = e.vote_date; fVoteTime.value = fmtTime(e.vote_time);
    fComment.value = e.comment; fReply.value = e.reply;
    fNVoteDate.value = e.n_vote_date; fNVoteTime.value = fmtTime(e.n_vote_time);
    fNComment.value = e.n_comment; fMemo.value = e.memo;
    fUnion.checked = e.student_union;
    syncForm();
    setMsg(""); applyFormState(); setView("register"); (e.univ ? fUniv : fOrg).focus();
  }

  function resetForm() { state.editingId = null; form.reset(); syncForm(); applyFormState(); }

  var SAVE_ERR = "保存できませんでした。通信状態を確かめて、もう一度押してください。";

  function saveEntry(ev) {
    ev.preventDefault();
    if (!store.ready() || !state.user || state.busy) return;
    var univ = fNoUniv.checked ? "" : fUniv.value.trim();
    if (!univ && !fNoUniv.checked) {
      setMsg("大学名を入力するか、「その他（大学名なし）」にチェックを入れてください。", true); fUniv.focus(); return;
    }
    var contact = fContact.value === "__other" ? fContactOther.value.trim() : fContact.value;
    if (fContact.value === "__other" && !contact) {
      setMsg("連絡手段（その他の内容）を入力してください。", true); fContactOther.focus(); return;
    }
    var row = { univ: univ, org: fOrg.value.trim(), pref: fPref.value,
                contact: contact, memo: fMemo.value.trim(),
                vote_date: fVoteDate.value, vote_time: fVoteTime.value,
                comment: fComment.value, reply: fReply.value,
                n_vote_date: fNVoteDate.value, n_vote_time: fNVoteTime.value,
                n_comment: fNComment.value, student_union: fUnion.checked };
    var editing = state.editingId, q;
    if (editing) {
      row.updated_at = new Date().toISOString();
      q = store.update(editing, row);
    } else {
      q = store.insert(row);
    }
    state.busy = true; applyFormState(); setMsg("保存しています…");
    var fail = function () { state.busy = false; setMsg(SAVE_ERR, true); applyFormState(); };
    q.then(function (res) {
      if (res.error) { fail(); return; }
      state.busy = false;
      resetForm();
      setMsg(editing ? "更新しました。" : "登録しました。");
      if (editing) setView("list"); else fUniv.focus();
      load();
    }, fail);
  }

  // 一覧のチェックボックス：先に画面を切り替え、保存に失敗したら元に戻す
  function setVoted(e, on) {
    if (!store.ready() || !state.user) return;
    e.voted = on; render();
    var fail = function () {
      e.voted = !on; render();
      statusEl.textContent = "投票済みを保存できませんでした。setup.sql を Supabase で実行し直したか確かめてください。";
    };
    store.update(e.id, { voted: on, updated_at: new Date().toISOString() }).then(function (res) {
      if (res.error) fail();
    }, fail);
  }

  function removeEntry(id) {
    if (!store.ready() || !state.user) return;
    state.confirmId = null;
    var fail = function () { statusEl.textContent = "削除できませんでした。もう一度お試しください。"; render(); };
    store.remove(id).then(function (res) {
      if (res.error) { fail(); return; }
      if (state.editingId === id) resetForm();
      load();
    }, fail);
  }

  // ---- ログイン ----
  function setUser(user) {
    var prev = state.user ? state.user.id : null, next = user ? user.id : null;
    state.user = user;
    if (prev === next) return;
    state.entries = []; state.loaded = false; state.failed = false;
    if (user) statusEl.textContent = "名簿を読み込んでいます…";
    applyFormState(); render();
    if (user) setTimeout(load, 0);
  }

  $("loginForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!sb) return;
    var msg = $("loginMsg"), btn = $("loginBtn");
    msg.textContent = "確認しています…"; msg.className = ""; btn.disabled = true;
    var fail = function (text) { btn.disabled = false; msg.textContent = text; msg.className = "err"; };
    sb.auth.signInWithPassword({ email: $("lEmail").value.trim(), password: $("lPass").value })
      .then(function (res) {
        if (res.error) { fail("ログインできませんでした。メールアドレスとパスワードを確かめてください。"); return; }
        btn.disabled = false; msg.textContent = ""; $("lPass").value = "";
      }, function () { fail("通信できませんでした。少し待ってから、もう一度お試しください。"); });
  });
  $("logoutBtn").addEventListener("click", function () {
    if (trial) { trial = false; resetForm(); setMsg(""); setUser(null); return; }
    if (sb) sb.auth.signOut();
  });
  $("trialBtn").addEventListener("click", function () { trial = true; setUser({ id: "trial" }); });

  // 登録済みの大学名を入れたら、都道府県とよみがなを自動で入れ、重複を知らせる
  function sameUniv() {
    var k = normUniv(fUniv.value);
    if (!k) return [];
    return state.entries.filter(function (e) { return e.id !== state.editingId && normUniv(e.univ) === k; });
  }
  function showDupHint() {
    var n = sameUniv().length;
    $("dupHint").hidden = !n;
    $("dupHint").textContent = n ? "注意：この大学はすでに " + n + " 件登録されています。" : "";
  }
  // 学生連合にチェックした登録が（この入力を含めて）2件以上になるときに警告する
  function showUnionHint() {
    var others = state.entries.filter(function (e) { return e.id !== state.editingId && e.student_union; }).length;
    $("unionHint").hidden = !(fUnion.checked && others + 1 >= 2);
  }
  fUnion.addEventListener("change", showUnionHint);
  fUniv.addEventListener("input", showDupHint);
  fUniv.addEventListener("change", function () {
    var hit = sameUniv()[0];
    if (hit && !fPref.value && hit.pref) fPref.value = hit.pref;
    showDupHint();
  });
  Array.prototype.forEach.call(document.querySelectorAll("#sortChips button"), function (b) {
    b.addEventListener("click", function () {
      state.sort = b.getAttribute("data-sort");
      try { localStorage.setItem("meibo-sort", state.sort); } catch (e) {}
      render();
    });
  });
  fNoUniv.addEventListener("change", syncForm);
  fContact.addEventListener("change", function () {
    syncForm();
    if (fContact.value === "__other") fContactOther.focus();
  });
  form.addEventListener("submit", saveEntry);
  cancelBtn.addEventListener("click", function () { resetForm(); setMsg(""); setView("list"); });
  $("tabRegister").addEventListener("click", function () { setView("register"); });
  $("tabList").addEventListener("click", function () { setView("list"); });
  $("reloadBtn").addEventListener("click", load);
  qEl.addEventListener("input", function () { state.q = qEl.value.trim(); render(); });
  window.addEventListener("focus", function () { if (state.user && !state.busy) load(); });

  if (setupReason) {
    var why = el("p", "msg err", "原因：" + setupReason);
    var hints = $("viewSetup").querySelectorAll(".hint");
    $("viewSetup").insertBefore(why, hints.length > 1 ? hints[1] : null);
  }
  applyFormState(); render();
  if (sb) {
    sb.auth.onAuthStateChange(function (event, session) { setUser(session ? session.user : null); });
  }
})();
