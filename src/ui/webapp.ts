export const WEBAPP_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>skills-manager</title>
    <style>
      :root{
        --bg: #0b0f17;
        --panel: rgba(255,255,255,.06);
        --panel2: rgba(255,255,255,.09);
        --text: rgba(255,255,255,.9);
        --muted: rgba(255,255,255,.65);
        --faint: rgba(255,255,255,.45);
        --border: rgba(255,255,255,.14);
        --good: #33d17a;
        --warn: #f5c211;
        --bad: #ff4d4f;
        --accent: #7aa2ff;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      }
      html,body{height:100%}
      body{
        margin:0;
        font-family: var(--sans);
        color: var(--text);
        background:
          radial-gradient(1200px 800px at 20% 10%, rgba(122,162,255,.18), transparent 60%),
          radial-gradient(900px 700px at 85% 30%, rgba(51,209,122,.10), transparent 60%),
          radial-gradient(1000px 700px at 40% 95%, rgba(245,194,17,.08), transparent 60%),
          var(--bg);
      }
      .wrap{max-width: 1120px; margin: 0 auto; padding: 28px 18px 60px;}
      .topbar{display:flex; align-items:center; justify-content:space-between; gap: 16px; margin-bottom: 18px;}
      .brand{display:flex; flex-direction:column; gap: 4px;}
      .title{font-size: 18px; font-weight: 700; letter-spacing: .2px}
      .subtitle{font-size: 12px; color: var(--muted)}
      .controls{display:flex; align-items:center; gap: 10px; flex-wrap: wrap;}
      .pill{
        display:inline-flex; align-items:center; gap: 8px;
        padding: 8px 10px; border: 1px solid var(--border);
        border-radius: 999px; background: var(--panel); backdrop-filter: blur(10px);
      }
      .pill input, .pill select{
        background: transparent; border: none; outline: none; color: var(--text);
        font-size: 13px;
      }
      .pill input{width: 220px}
      .btn{
        cursor:pointer;
        font-size: 13px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--panel);
        color: var(--text);
      }
      .btn:hover{background: var(--panel2)}
      .tabs{display:flex; gap: 8px; margin: 18px 0 12px;}
      .tab{
        cursor:pointer;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--muted);
        font-size: 13px;
      }
      .tab.active{background: var(--panel); color: var(--text); border-color: rgba(122,162,255,.35)}
      .panel{
        border: 1px solid var(--border);
        border-radius: 14px;
        background: rgba(255,255,255,.04);
        overflow: hidden;
      }
      table{width:100%; border-collapse: collapse; font-size: 13px;}
      thead{background: rgba(255,255,255,.05)}
      thead th{position: sticky; top: 0; z-index: 1; backdrop-filter: blur(10px);}
      th,td{padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08); vertical-align: top;}
      th{color: var(--muted); font-weight: 600; text-align:left; white-space: nowrap;}
      td{color: var(--text)}
      tbody tr{cursor: pointer}
      tbody tr:nth-child(2n){background: rgba(255,255,255,.02)}
      tbody tr:hover{background: rgba(122,162,255,.08)}
      .muted{color: var(--muted)}
      .mono{font-family: var(--mono)}
      .badge{display:inline-flex; align-items:center; gap: 6px; padding: 2px 8px; border-radius: 999px; border:1px solid var(--border); color: var(--muted); font-size: 12px;}
      .dot{width: 8px; height: 8px; border-radius: 999px; background: var(--faint)}
      .dot.good{background: var(--good)}
      .dot.bad{background: var(--bad)}
      .dot.warn{background: var(--warn)}
      .statusPill{
        display:inline-flex;
        align-items:center;
        gap: 8px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: .2px;
        border: none;
        background: rgba(255,255,255,.04);
        color: rgba(255,255,255,.82);
        white-space: nowrap;
      }
      .statusPill .mark{
        width: 10px;
        height: 10px;
        border-radius: 999px;
        box-shadow: none;
      }
      .statusPill.on{
        background: rgba(51,209,122,.10);
        color: rgba(220,255,235,.92);
      }
      .statusPill.on .mark{ background: var(--good); }
      .statusPill.off{
        background: rgba(255,77,79,.10);
        color: rgba(255,230,230,.92);
      }
      .statusPill.off .mark{ background: var(--bad); }
      .rowbtn{cursor:pointer; color: var(--accent); text-decoration: none}
      .rowbtn:hover{text-decoration: underline}
      .empty{padding: 18px; color: var(--muted)}
      .footer{margin-top: 14px; color: var(--faint); font-size: 12px}
      .drawerMask{
        position: fixed; inset:0;
        background: rgba(0,0,0,.55);
        display:none;
      }
      .drawer{
        position: fixed; top:0; right:0; height:100%; width: min(520px, 92vw);
        background: rgba(16,22,34,.92);
        backdrop-filter: blur(12px);
        border-left: 1px solid rgba(255,255,255,.12);
        transform: translateX(100%);
        transition: transform .18s ease;
        display:flex; flex-direction:column;
      }
      .drawerMask.open{display:block}
      .drawerMask.open .drawer{transform: translateX(0)}
      .drawerHeader{padding: 14px 14px 10px; border-bottom: 1px solid rgba(255,255,255,.10); display:flex; justify-content:space-between; gap: 10px;}
      .drawerActions{display:flex; gap: 8px; align-items:center;}
      .btn.danger{border-color: rgba(255,77,79,.45); color: rgba(255,240,240,.95)}
      .btn.danger:hover{background: rgba(255,77,79,.12)}
      .btn.primary{border-color: rgba(122,162,255,.45)}
      .btn.primary:hover{background: rgba(122,162,255,.12)}
      .btn:disabled{opacity:.5; cursor:not-allowed}
      .drawerTitle{font-weight: 700}
      .drawerBody{padding: 14px; overflow:auto}
      pre{margin:0; padding: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.10); border-radius: 12px; overflow:auto; font-family: var(--mono); font-size: 12px; color: rgba(255,255,255,.85)}
      .kvs{display:grid; grid-template-columns: 130px 1fr; gap: 10px 12px; margin: 10px 0 14px;}
      .k{color: var(--muted); font-size: 12px}
      .v{color: var(--text); font-size: 13px; word-break: break-word}
      .desc{color: var(--muted); line-height: 1.35; max-width: 56ch}
      .desc .langTag{display:inline-flex; align-items:center; padding: 1px 6px; border: 1px solid rgba(255,255,255,.14); border-radius: 999px; font-size: 11px; color: rgba(255,255,255,.55); margin-right: 6px}
      .desc .sep{opacity:.5; padding: 0 6px}

      .seg{display:flex; gap: 8px; align-items:center; flex-wrap: wrap;}
      .seg .btn{padding: 6px 10px; border-radius: 999px;}
      .seg .btn.active{background: rgba(122,162,255,.14); border-color: rgba(122,162,255,.45); color: rgba(235,242,255,.95)}
      .fieldGrid{display:grid; grid-template-columns: 180px 1fr; gap: 10px 12px; align-items: start; margin-top: 10px;}
      .fieldGrid .label{color: var(--muted); font-size: 12px; padding-top: 8px;}
      .fieldGrid input[type="text"], .fieldGrid select, .fieldGrid textarea{
        width:100%;
        box-sizing:border-box;
        font-size: 13px;
        color: var(--text);
        background: rgba(255,255,255,.05);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 10px;
        padding: 8px 10px;
        outline: none;
      }
      .fieldGrid textarea{min-height: 96px; font-family: var(--mono); font-size: 12px; line-height: 1.35;}
      .help{color: rgba(255,255,255,.55); font-size: 12px; margin-top: 6px; line-height: 1.35;}
      .errorBox{margin-top: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,77,79,.35); background: rgba(255,77,79,.10); color: rgba(255,230,230,.92); font-size: 12px;}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="topbar">
        <div class="brand">
          <div class="title">skills-manager</div>
          <div class="subtitle" id="subtitle">本地面板 • 默认只读 • 不展示密钥</div>
        </div>
        <div class="controls">
          <div class="pill">
            <span class="muted" id="labelSearch">搜索</span>
            <input id="q" placeholder="id / 描述 / 路径…" />
          </div>
          <div class="pill">
            <span class="muted" id="labelTool">工具</span>
            <select id="tool">
              <option value="all">all</option>
            </select>
          </div>
          <div class="pill">
            <span class="muted" id="labelLang">语言</span>
            <select id="lang">
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <div class="pill">
            <span class="muted" id="labelDescMode">描述</span>
            <select id="descMode">
              <option value="auto">Auto</option>
              <option value="both">双语</option>
              <option value="raw">原始</option>
            </select>
          </div>
          <button class="btn" id="refresh">刷新</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="skills" id="tabSkills">技能</button>
        <button class="tab" data-tab="agents" id="tabAgents">代理</button>
        <button class="tab" data-tab="mcp" id="tabMcp">MCP</button>
        <button class="tab" data-tab="config" id="tabConfig">配置</button>
      </div>

      <div class="panel" id="panel"></div>
      <div class="footer" id="footer"></div>
    </div>

    <div class="drawerMask" id="drawerMask">
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawerHeader">
          <div>
            <div class="drawerTitle" id="drawerTitle">Details</div>
            <div class="muted" style="font-size:12px" id="drawerSubtitle"></div>
          </div>
          <div class="drawerActions">
            <button class="btn danger" id="drawerDisable">禁用</button>
            <button class="btn primary" id="drawerEnable">启用</button>
            <button class="btn" id="closeDrawer">关闭</button>
          </div>
        </div>
        <div class="drawerBody">
          <div class="kvs" id="drawerKvs"></div>
          <pre id="drawerJson"></pre>
        </div>
      </div>
    </div>

    <script>
      const I18N = {
        zh: {
          subtitle: "本地面板 • 默认只读 • 不展示密钥",
          search: "搜索",
          searchPh: "id / 描述 / 路径…",
          tool: "工具",
          lang: "语言",
          descMode: "描述",
          descModeOptions: { auto: "本地化", both: "双语", raw: "原始" },
          refresh: "刷新",
          tabs: { skills: "技能", agents: "代理", mcp: "MCP", config: "配置" },
          drawer: { close: "关闭", enable: "启用", disable: "禁用", details: "详情" },
          status: { enabled: "启用", disabled: "禁用" },
          empty: "暂无数据。",
          footerLoaded: (s) => "加载于 " + s,
          footerShown: (a,b) => " • 显示 " + a + "/" + b,
          errLoad: (msg) => "加载失败：" + msg,
          confirm: {
            skillDisable: "禁用该技能？这可能会移动文件或修改 frontmatter。是否继续？",
            skillEnable: "启用该技能？是否继续？",
            agentDisable: "禁用该代理（会归档其 markdown 文件）？是否继续？",
            agentEnable: "启用该代理（如需则从归档恢复）？是否继续？",
            mcpReadOnly: "MCP 写入被配置禁止（mcp.readOnly=true）。",
            mcpDisable: "禁用该 MCP Server？这会修改配置文件。是否继续？",
            mcpEnable: "启用该 MCP Server？这会修改配置文件。是否继续？",
            mcpClaude1: "将修改 ~/.claude.json（敏感文件），并会自动创建备份。是否继续？",
            mcpClaude2: "最终确认：确定要修改 ~/.claude.json 吗？",
          },
          labels: {
            skills: { status: "状态", tool: "工具", id: "ID", source: "来源", path: "路径", desc: "描述" },
            agents: { status: "状态", tool: "工具", id: "ID", source: "来源", path: "路径", notes: "备注" },
            mcp: { tool: "工具", id: "ID", transport: "传输", cmd: "命令/URL", config: "配置文件", env: "环境变量键" },
            kv: { status: "状态", sourceKind: "来源", path: "路径", enabledSemantic: "判定", skillKind: "类型", transport: "传输", configPath: "配置文件", envKeys: "环境变量键" },
            configTitle: "合并后的配置（不含密钥）",
          }
        },
        en: {
          subtitle: "Local dashboard • read-only by default • no secrets shown",
          search: "Search",
          searchPh: "id / description / path…",
          tool: "Tool",
          lang: "Language",
          descMode: "Description",
          descModeOptions: { auto: "Localized", both: "Bilingual", raw: "Raw" },
          refresh: "Refresh",
          tabs: { skills: "Skills", agents: "Agents", mcp: "MCP", config: "Config" },
          drawer: { close: "Close", enable: "Enable", disable: "Disable", details: "Details" },
          status: { enabled: "enabled", disabled: "disabled" },
          empty: "No items.",
          footerLoaded: (s) => "Loaded " + s,
          footerShown: (a,b) => " • " + a + "/" + b + " shown",
          errLoad: (msg) => "Failed to load: " + msg,
          confirm: {
            skillDisable: "Disable this skill? This may move files or edit frontmatter. Continue?",
            skillEnable: "Enable this skill? Continue?",
            agentDisable: "Disable this agent (archive its markdown file)? Continue?",
            agentEnable: "Enable this agent (restore from archive if needed)? Continue?",
            mcpReadOnly: "MCP writes are disabled by config (mcp.readOnly=true).",
            mcpDisable: "Disable this MCP server? This will edit the config file. Continue?",
            mcpEnable: "Enable this MCP server? This will edit the config file. Continue?",
            mcpClaude1: "This edits ~/.claude.json (sensitive). A backup will be created. Continue?",
            mcpClaude2: "Final confirmation: edit ~/.claude.json?",
          },
          labels: {
            skills: { status: "status", tool: "tool", id: "id", source: "source", path: "path", desc: "desc" },
            agents: { status: "status", tool: "tool", id: "id", source: "source", path: "path", notes: "notes" },
            mcp: { tool: "tool", id: "id", transport: "transport", cmd: "command/url", config: "config-path", env: "env keys" },
            kv: { status: "status", sourceKind: "sourceKind", path: "path", enabledSemantic: "enabledSemantic", skillKind: "skillKind", transport: "transport", configPath: "config path", envKeys: "envKeys" },
            configTitle: "Merged config (no secrets)",
          }
        }
      };

      const state = {
        tab: "skills",
        q: "",
        tool: "all",
        lang: "zh",
        descMode: "auto", // auto | both | raw
        data: { skills: [], agents: [], mcp: [], config: null },
        lastLoadedAt: null,
        configEditor: {
          scope: "project", // project | global
          view: "form", // form | json
          form: {
            strategy: "auto",
            mcpReadOnly: true,
            extraSkillRootsText: "",
            extraAgentRootsText: "",
            unifiedSkillsRoot: "",
            unifiedAgentsRoot: "",
            unifiedMcpRoot: "",
            selectSkillsText: "",
            selectAgentsText: "",
            selectMcpText: "",
          },
          jsonText: "",
          lastError: "",
        },
      };

      const el = {
        panel: document.getElementById("panel"),
        footer: document.getElementById("footer"),
        q: document.getElementById("q"),
        tool: document.getElementById("tool"),
        lang: document.getElementById("lang"),
        descMode: document.getElementById("descMode"),
        refresh: document.getElementById("refresh"),
        subtitle: document.getElementById("subtitle"),
        labelSearch: document.getElementById("labelSearch"),
        labelTool: document.getElementById("labelTool"),
        labelLang: document.getElementById("labelLang"),
        labelDescMode: document.getElementById("labelDescMode"),
        tabSkills: document.getElementById("tabSkills"),
        tabAgents: document.getElementById("tabAgents"),
        tabMcp: document.getElementById("tabMcp"),
        tabConfig: document.getElementById("tabConfig"),
        drawerMask: document.getElementById("drawerMask"),
        closeDrawer: document.getElementById("closeDrawer"),
        drawerTitle: document.getElementById("drawerTitle"),
        drawerSubtitle: document.getElementById("drawerSubtitle"),
        drawerKvs: document.getElementById("drawerKvs"),
        drawerJson: document.getElementById("drawerJson"),
        drawerDisable: document.getElementById("drawerDisable"),
        drawerEnable: document.getElementById("drawerEnable"),
      };

      function uniq(arr) { return Array.from(new Set(arr)); }

      function t() { return I18N[state.lang] || I18N.zh; }

      function toolOf(item) { return item.tool || "unknown"; }

      function matchesQ(item, q){
        if(!q) return true;
        const hay = [
          item.id,
          item.displayName,
          item.description,
          item.path,
          item.notes,
          item.pluginKey,
          item.transport,
          item.command,
          item.url
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q.toLowerCase());
      }

      function statusDot(enabled){
        const cls = enabled ? "on" : "off";
        const label = enabled ? t().status.enabled : t().status.disabled;
        return '<span class="statusPill ' + cls + '"><span class="mark" aria-hidden="true"></span>' + label + '</span>';
      }

      function renderTable(columns, rows, onRowClick){
        if(!rows.length){
          return '<div class="empty">' + t().empty + '</div>';
        }
        const thead = "<thead><tr>" + columns.map(c => "<th>" + c.label + "</th>").join("") + "</tr></thead>";
        const tbody = "<tbody>" + rows.map((r, idx) => {
          return "<tr>" + columns.map(c => {
            const v = c.render(r);
            return "<td>" + v + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody>";
        const html = "<table>" + thead + tbody + "</table>";
        // bind click after paint
        setTimeout(() => {
          const trs = el.panel.querySelectorAll("tbody tr");
          trs.forEach((tr, i) => tr.addEventListener("click", () => onRowClick(rows[i])));
        }, 0);
        return html;
      }

      let currentDetail = null;

      async function postJson(path, body){
        const res = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body || {}),
        });
        const j = await res.json().catch(() => ({}));
        if(!res.ok){
          throw new Error(j && j.error ? j.error : ("HTTP " + res.status));
        }
        return j;
      }

      function setDrawerActionsForCurrent(){
        const d = currentDetail;
        if(!d){
          el.drawerDisable.disabled = true;
          el.drawerEnable.disabled = true;
          return;
        }
        // Config tab: no actions
        if(state.tab === "config"){
          el.drawerDisable.disabled = true;
          el.drawerEnable.disabled = true;
          return;
        }
        // MCP: actions disabled when readOnly
        if(state.tab === "mcp"){
          const ro = Boolean(state.data.config && state.data.config.config && state.data.config.config.mcp && state.data.config.config.mcp.readOnly);
          el.drawerDisable.disabled = ro;
          el.drawerEnable.disabled = ro;
          return;
        }
        // Skills/Agents
        el.drawerDisable.disabled = false;
        el.drawerEnable.disabled = false;
      }

      function openDrawer(title, subtitle, kvs, obj){
        el.drawerTitle.textContent = title;
        el.drawerSubtitle.textContent = subtitle || "";
        el.drawerKvs.innerHTML = kvs.map(([k,v]) => '<div class="k">' + k + '</div><div class="v">' + v + '</div>').join("");
        el.drawerJson.textContent = JSON.stringify(obj, null, 2);
        currentDetail = obj;
        setDrawerActionsForCurrent();
        el.drawerMask.classList.add("open");
      }

      function closeDrawer(){
        el.drawerMask.classList.remove("open");
      }

      el.closeDrawer.addEventListener("click", closeDrawer);
      el.drawerMask.addEventListener("click", (e) => { if(e.target === el.drawerMask) closeDrawer(); });
      document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeDrawer(); });

      async function fetchJson(path){
        const res = await fetch(path);
        if(!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      }

      async function loadAll(){
        const [skills, agents, mcp, cfg] = await Promise.all([
          fetchJson("/api/v1/skills"),
          fetchJson("/api/v1/agents"),
          fetchJson("/api/v1/mcp"),
          fetchJson("/api/v1/config"),
        ]);
        state.data = { skills, agents, mcp, config: cfg };
        state.lastLoadedAt = new Date();
      }

      function buildToolOptions(){
        const items = state.tab === "skills" ? state.data.skills :
                      state.tab === "agents" ? state.data.agents :
                      state.tab === "mcp" ? state.data.mcp : [];
        const tools = uniq(items.map(toolOf)).sort();
        const keep = state.tool;
        el.tool.innerHTML = '<option value="all">all</option>' + tools.map(t => '<option value="'+t+'">'+t+'</option>').join("");
        if(tools.includes(keep)) el.tool.value = keep; else el.tool.value = "all";
        state.tool = el.tool.value;
      }

      function applyI18nStatic(){
        document.documentElement.setAttribute("lang", state.lang === "en" ? "en" : "zh-CN");
        el.subtitle.textContent = t().subtitle;
        el.labelSearch.textContent = t().search;
        el.q.placeholder = t().searchPh;
        el.labelTool.textContent = t().tool;
        el.labelLang.textContent = t().lang;
        el.labelDescMode.textContent = t().descMode;
        el.descMode.querySelector('option[value="auto"]').textContent = t().descModeOptions.auto;
        el.descMode.querySelector('option[value="both"]').textContent = t().descModeOptions.both;
        el.descMode.querySelector('option[value="raw"]').textContent = t().descModeOptions.raw;
        el.refresh.textContent = t().refresh;
        el.tabSkills.textContent = t().tabs.skills;
        el.tabAgents.textContent = t().tabs.agents;
        el.tabMcp.textContent = t().tabs.mcp;
        el.tabConfig.textContent = t().tabs.config;
        el.closeDrawer.textContent = t().drawer.close;
        el.drawerEnable.textContent = t().drawer.enable;
        el.drawerDisable.textContent = t().drawer.disable;
      }

      function pickDesc(item){
        const raw = (item && item.description ? String(item.description) : "").trim();
        const i18n = item && item.descriptionI18n ? item.descriptionI18n : null;
        const zh = i18n && typeof i18n.zh === "string" ? i18n.zh.trim() : "";
        const en = i18n && typeof i18n.en === "string" ? i18n.en.trim() : "";

        if(state.descMode === "raw"){
          const v = raw || (state.lang === "en" ? (en || zh) : (zh || en)) || "—";
          const tag = state.lang === "en" ? "EN" : "ZH";
          return '<span class="desc"><span class="langTag">' + tag + '</span>' + escapeHtml(v) + '</span>';
        }
        if(state.descMode === "both"){
          const zhV = zh || "";
          const enV = en || "";
          const rawV = raw || "";
          // If only raw exists (common today), treat it as English for display clarity.
          const showZh = zhV || "";
          const showEn = enV || rawV || "";
          const missingZh = !showZh;
          const missingEn = !showEn;
          const zhText = showZh || (state.lang === "zh" ? "（无中文）" : "(no zh)");
          const enText = showEn || (state.lang === "zh" ? "（无英文）" : "(no en)");
          const same = showZh && showEn && showZh === showEn;
          if(same){
            return '<span class="desc"><span class="langTag">ZH/EN</span>' + escapeHtml(showEn) + '</span>';
          }
          return '<span class="desc">' +
            '<span class="langTag">ZH</span>' + escapeHtml(zhText) +
            '<span class="sep">|</span>' +
            '<span class="langTag">EN</span>' + escapeHtml(enText) +
            (missingZh || missingEn ? '' : '') +
            '</span>';
        }
        // auto: localized if available, fallback to raw
        const preferred = state.lang === "en" ? (en || "") : (zh || "");
        const fallback = raw || (state.lang === "en" ? zh : en) || "";
        const safe = (preferred || fallback || "—").trim();
        const tag =
          safe === zh ? "ZH" :
          safe === en ? "EN" :
          (state.lang === "en" ? "EN*" : "ZH*");
        return '<span class="desc" title="' + escapeAttr(raw || safe) + '">' +
          '<span class="langTag">' + tag + '</span>' +
          escapeHtml(safe) +
        '</span>';
      }

      function escapeHtml(s){
        return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
      }
      function escapeAttr(s){
        return escapeHtml(s);
      }

      function render(){
        const q = state.q;
        const tool = state.tool;

        const filter = (item) => matchesQ(item, q) && (tool === "all" || toolOf(item) === tool);

        if(state.tab === "skills"){
          const rows = state.data.skills.filter(filter);
          const columns = [
            { label: t().labels.skills.status, render: (r) => statusDot(r.enabled) },
            { label: t().labels.skills.tool, render: (r) => '<span class="badge">' + r.tool + '</span>' },
            { label: t().labels.skills.id, render: (r) => '<a class="rowbtn" href="javascript:void(0)">' + r.id + '</a>' },
            { label: t().labels.skills.source, render: (r) => '<span class="muted">' + r.sourceKind + '</span>' },
            { label: t().labels.skills.path, render: (r) => '<span class="mono muted">' + (r.path || "—") + '</span>' },
            { label: t().labels.skills.desc, render: (r) => pickDesc(r) },
          ];
          el.panel.innerHTML = renderTable(columns, rows, (r) => {
            openDrawer(
              r.id,
              r.tool,
              [
                [t().labels.kv.status, r.enabled ? t().status.enabled : t().status.disabled],
                [t().labels.kv.sourceKind, r.sourceKind],
                [t().labels.kv.path, '<span class="mono">' + r.path + '</span>'],
                [t().labels.kv.enabledSemantic, r.enabledSemantic],
                [t().labels.kv.skillKind, r.skillKind],
              ],
              r
            );
          });
        } else if(state.tab === "agents"){
          const rows = state.data.agents.filter(filter);
          const columns = [
            { label: t().labels.agents.status, render: (r) => statusDot(r.enabled) },
            { label: t().labels.agents.tool, render: (r) => '<span class="badge">' + r.tool + '</span>' },
            { label: t().labels.agents.id, render: (r) => '<a class="rowbtn" href="javascript:void(0)">' + r.id + '</a>' },
            { label: t().labels.agents.source, render: (r) => '<span class="muted">' + r.sourceKind + '</span>' },
            { label: t().labels.agents.path, render: (r) => '<span class="mono muted">' + (r.path || "—") + '</span>' },
            { label: t().labels.agents.notes, render: (r) => '<span class="muted">' + (r.notes || "—") + '</span>' },
          ];
          el.panel.innerHTML = renderTable(columns, rows, (r) => {
            openDrawer(
              r.id,
              r.tool,
              [
                [t().labels.kv.status, r.enabled ? t().status.enabled : t().status.disabled],
                [t().labels.kv.sourceKind, r.sourceKind],
                [t().labels.kv.path, '<span class="mono">' + r.path + '</span>'],
                [t().labels.kv.enabledSemantic, r.enabledSemantic],
              ],
              r
            );
          });
        } else if(state.tab === "mcp"){
          const rows = state.data.mcp.filter(filter);
          const columns = [
            { label: t().labels.mcp.tool, render: (r) => '<span class="badge">' + r.tool + '</span>' },
            { label: t().labels.mcp.id, render: (r) => '<a class="rowbtn" href="javascript:void(0)">' + r.id + '</a>' },
            { label: t().labels.mcp.transport, render: (r) => '<span class="muted">' + r.transport + '</span>' },
            { label: t().labels.mcp.cmd, render: (r) => '<span class="mono muted">' + (r.url ? r.url : (r.command ? [r.command].concat(r.args||[]).join(" ") : "—")) + '</span>' },
            { label: t().labels.mcp.config, render: (r) => '<span class="mono muted">' + r.path + '</span>' },
            { label: t().labels.mcp.env, render: (r) => '<span class="mono muted">' + (r.envKeys && r.envKeys.length ? r.envKeys.join(", ") : "—") + '</span>' },
          ];
          el.panel.innerHTML = renderTable(columns, rows, (r) => {
            openDrawer(
              r.id,
              r.tool,
              [
                [t().labels.kv.transport, r.transport],
                [t().labels.kv.sourceKind, r.sourceKind],
                [t().labels.kv.configPath, '<span class="mono">' + r.path + '</span>'],
                [t().labels.kv.envKeys, (r.envKeys||[]).join(", ") || "—"],
              ],
              r
            );
          });
        } else if(state.tab === "config"){
          const cfg = state.data.config;
          const editor = state.configEditor;
          const files = cfg && cfg.files ? cfg.files : null;
          const projectDir = cfg && cfg.projectDir ? String(cfg.projectDir) : "";
          const canProject = Boolean(projectDir);
          const scope = canProject ? editor.scope : "global";
          const fileInfo =
            scope === "global"
              ? (files && files.global ? files.global : null)
              : (files && files.project ? files.project : null);
          const filePath = !fileInfo ? "—" : (fileInfo.format === "json" ? fileInfo.jsonPath : fileInfo.yamlPath);
          const fileFmt = !fileInfo || !fileInfo.format ? "new (yaml)" : fileInfo.format;

          const header =
            '<div class="muted" style="margin-bottom:10px">' + t().labels.configTitle + '</div>' +
            '<div class="seg" style="margin-bottom:10px">' +
              '<button class="btn ' + (scope === "global" ? "active" : "") + '" id="cfgScopeGlobal">' + (state.lang === "zh" ? "全局" : "Global") + '</button>' +
              (canProject ? '<button class="btn ' + (scope === "project" ? "active" : "") + '" id="cfgScopeProject">' + (state.lang === "zh" ? "项目" : "Project") + '</button>' : '') +
              '<span class="badge"><span class="dot ' + (fileInfo && fileInfo.exists ? "good" : "warn") + '"></span>' + escapeHtml(fileFmt) + '</span>' +
              '<span class="mono muted" style="font-size:12px">' + escapeHtml(filePath) + '</span>' +
            '</div>' +
            '<div class="seg" style="margin-bottom:10px">' +
              '<button class="btn ' + (editor.view === "form" ? "active" : "") + '" id="cfgViewForm">' + (state.lang === "zh" ? "表单" : "Form") + '</button>' +
              '<button class="btn ' + (editor.view === "json" ? "active" : "") + '" id="cfgViewJson">' + (state.lang === "zh" ? "JSON" : "JSON") + '</button>' +
              '<button class="btn primary" id="cfgSave">' + (state.lang === "zh" ? "保存" : "Save") + '</button>' +
            '</div>';

          const formHtml =
            '<div class="fieldGrid">' +
              '<div class="label">' + (state.lang === "zh" ? "默认策略" : "Default strategy") + '</div>' +
              '<div>' +
                '<select id="cfgStrategy">' +
                  '<option value="auto">auto</option>' +
                  '<option value="native">native</option>' +
                  '<option value="managed">managed</option>' +
                  '<option value="symlink">symlink</option>' +
                '</select>' +
                '<div class="help">' + (state.lang === "zh" ? "控制技能/代理启用禁用时使用的策略。" : "Strategy used when enabling/disabling skills/agents.") + '</div>' +
              '</div>' +

              '<div class="label">mcp.readOnly</div>' +
              '<div>' +
                '<label class="pill" style="display:inline-flex; gap:10px; padding: 8px 10px">' +
                  '<input type="checkbox" id="cfgMcpReadOnly" />' +
                  '<span class="muted">' + (state.lang === "zh" ? "禁止写入 MCP 配置" : "Disable MCP writes") + '</span>' +
                '</label>' +
                '<div class="help">' + (state.lang === "zh" ? "为 true 时，UI/CLI 将拒绝修改 MCP 配置文件。" : "When true, UI/CLI will refuse to edit MCP config files.") + '</div>' +
              '</div>' +

              '<div class="label">' + (state.lang === "zh" ? "额外技能目录" : "Extra skill roots") + '</div>' +
              '<div>' +
                '<textarea id="cfgExtraSkillRoots" spellcheck="false" placeholder="' + (state.lang === "zh" ? "每行一个路径（支持 ~）" : "One path per line (supports ~)") + '"></textarea>' +
                '<div class="help">' + (state.lang === "zh" ? "用于扫描额外的 skills 根目录。" : "Additional roots to scan for skills.") + '</div>' +
              '</div>' +

              '<div class="label">' + (state.lang === "zh" ? "额外代理目录" : "Extra agent roots") + '</div>' +
              '<div>' +
                '<textarea id="cfgExtraAgentRoots" spellcheck="false" placeholder="' + (state.lang === "zh" ? "每行一个路径（支持 ~）" : "One path per line (supports ~)") + '"></textarea>' +
                '<div class="help">' + (state.lang === "zh" ? "用于扫描额外的 subagents 根目录。" : "Additional roots to scan for subagents.") + '</div>' +
              '</div>' +

              '<div class="label">' + (state.lang === "zh" ? "统一 Skills 目录" : "Unified skills root") + '</div>' +
              '<div>' +
                '<input type="text" id="cfgUnifiedSkillsRoot" placeholder="' + (state.lang === "zh" ? "例如：~/x/unified/skills" : "e.g. ~/x/unified/skills") + '" />' +
                '<div class="help">' + (state.lang === "zh" ? "选中条目将被移动到这里，并通过软链接挂载到各工具目录。" : "Selected items are moved here and mounted via symlink into tool directories.") + '</div>' +
              '</div>' +

              '<div class="label">' + (state.lang === "zh" ? "统一 Agents 目录" : "Unified agents root") + '</div>' +
              '<div>' +
                '<input type="text" id="cfgUnifiedAgentsRoot" placeholder="' + (state.lang === "zh" ? "例如：~/x/unified/agents" : "e.g. ~/x/unified/agents") + '" />' +
                '<div class="help">' + (state.lang === "zh" ? "用于 subagents 的统一存储；启用时在 .cursor/.claude/.codex 下创建软链接。" : "Canonical storage for subagents; enable creates symlink under .cursor/.claude/.codex.") + '</div>' +
              '</div>' +

              '<div class="label">' + (state.lang === "zh" ? "统一 MCP 目录" : "Unified mcp root") + '</div>' +
              '<div>' +
                '<input type="text" id="cfgUnifiedMcpRoot" placeholder="' + (state.lang === "zh" ? "例如：~/x/unified/mcp" : "e.g. ~/x/unified/mcp") + '" />' +
                '<div class="help">' + (state.lang === "zh" ? "用于 MCP server 的统一管理：每个 server 一个文件，通过 enabled 软链接决定是否写回 mcp.json/.mcp.json。" : "Canonical storage for MCP servers: one file per server; enabled symlink decides whether it's written back to config.") + '</div>' +
              '</div>' +

              '<div class="label">' + (state.lang === "zh" ? "选择纳入 Skills（tool:id）" : "Select skills (tool:id)") + '</div>' +
              '<div>' +
                '<textarea id="cfgSelectSkills" spellcheck="false" placeholder="cursor:foo\nclaude-code:bar"></textarea>' +
                '<div class="help">' + (state.lang === "zh" ? "每行一个：<tool>:<id>。命中的条目会自动走 symlink 策略。" : "One per line: <tool>:<id>. Matched entries use symlink strategy automatically.") + '</div>' +
              '</div>' +

              '<div class="label">' + (state.lang === "zh" ? "选择纳入 Agents（tool:id）" : "Select agents (tool:id)") + '</div>' +
              '<div>' +
                '<textarea id="cfgSelectAgents" spellcheck="false" placeholder="cursor:verifier\nclaude-code:reviewer"></textarea>' +
              '</div>' +

              '<div class="label">' + (state.lang === "zh" ? "选择纳入 MCP（tool:id）" : "Select mcp (tool:id)") + '</div>' +
              '<div>' +
                '<textarea id="cfgSelectMcp" spellcheck="false" placeholder="cursor:serverA\nclaude-code:serverB"></textarea>' +
                '<div class="help">' + (state.lang === "zh" ? "每行一个：<tool>:<id>。命中的 server 将通过软链接启停，并自动同步到对应 MCP 配置文件。" : "One per line: <tool>:<id>. Selected servers are toggled via symlink and synced into MCP config automatically.") + '</div>' +
              '</div>' +
            '</div>';

          const jsonHtml =
            '<div>' +
              '<textarea id="cfgJson" spellcheck="false" style="min-height: 360px"></textarea>' +
              '<div class="help">' + (state.lang === "zh" ? "粘贴/编辑配置 JSON（将按 schema 校验后保存为 YAML/JSON 文件）。" : "Edit config JSON (validated before saving to YAML/JSON file).") + '</div>' +
            '</div>';

          const mergedHtml =
            '<div style="margin-top:12px">' +
              '<div class="muted" style="margin: 10px 0 8px">' + (state.lang === "zh" ? "当前合并结果（只读）" : "Merged result (read-only)") + '</div>' +
              '<pre>' + JSON.stringify(cfg, null, 2) + '</pre>' +
            '</div>';

          const errorHtml = editor.lastError ? '<div class="errorBox">' + escapeHtml(editor.lastError) + '</div>' : '';

          el.panel.innerHTML =
            '<div style="padding: 16px">' +
              header +
              (editor.view === "json" ? jsonHtml : formHtml) +
              errorHtml +
              mergedHtml +
            '</div>';

          // bind config editor
          setTimeout(() => {
            const cfgData = state.data.config;
            if (!cfgData || !cfgData.config) return;
            const canProjectNow = Boolean(cfgData.projectDir);
            const e = state.configEditor;

            const btnG = document.getElementById("cfgScopeGlobal");
            const btnP = document.getElementById("cfgScopeProject");
            if (btnG) btnG.addEventListener("click", () => { e.scope = "global"; render(); });
            if (btnP && canProjectNow) btnP.addEventListener("click", () => { e.scope = "project"; render(); });

            const btnForm = document.getElementById("cfgViewForm");
            const btnJson = document.getElementById("cfgViewJson");
            if (btnForm) btnForm.addEventListener("click", () => { syncEditorFromUi(); e.view = "form"; render(); });
            if (btnJson) btnJson.addEventListener("click", () => { syncEditorFromUi(); e.view = "json"; render(); });

            const saveBtn = document.getElementById("cfgSave");
            if (saveBtn) saveBtn.addEventListener("click", () => doSaveConfig().catch(err => alert(err.message || String(err))));

            const st = document.getElementById("cfgStrategy");
            const ro = document.getElementById("cfgMcpReadOnly");
            const es = document.getElementById("cfgExtraSkillRoots");
            const ea = document.getElementById("cfgExtraAgentRoots");
            const us = document.getElementById("cfgUnifiedSkillsRoot");
            const ua = document.getElementById("cfgUnifiedAgentsRoot");
            const um = document.getElementById("cfgUnifiedMcpRoot");
            const ss = document.getElementById("cfgSelectSkills");
            const sa = document.getElementById("cfgSelectAgents");
            const sm = document.getElementById("cfgSelectMcp");
            const jt = document.getElementById("cfgJson");

            if (st) st.value = e.form.strategy;
            if (ro) ro.checked = Boolean(e.form.mcpReadOnly);
            if (es) es.value = e.form.extraSkillRootsText;
            if (ea) ea.value = e.form.extraAgentRootsText;
            if (us) us.value = e.form.unifiedSkillsRoot;
            if (ua) ua.value = e.form.unifiedAgentsRoot;
            if (um) um.value = e.form.unifiedMcpRoot;
            if (ss) ss.value = e.form.selectSkillsText;
            if (sa) sa.value = e.form.selectAgentsText;
            if (sm) sm.value = e.form.selectMcpText;
            if (jt) jt.value = e.jsonText;
          }, 0);
        }

        const counts = state.tab === "skills" ? state.data.skills.length :
                       state.tab === "agents" ? state.data.agents.length :
                       state.tab === "mcp" ? state.data.mcp.length : 0;
        const shown = state.tab === "config" ? 1 :
                      (state.tab === "skills" ? state.data.skills.filter(filter).length :
                       state.tab === "agents" ? state.data.agents.filter(filter).length :
                       state.data.mcp.filter(filter).length);
        el.footer.textContent =
          (state.lastLoadedAt ? t().footerLoaded(state.lastLoadedAt.toLocaleString()) : t().errLoad("Not loaded")) +
          t().footerShown(shown, counts);
      }

      async function doDisable(){
        const d = currentDetail;
        if(!d) return;
        if(state.tab === "skills"){
          if(!confirm(t().confirm.skillDisable)) return;
          await postJson("/api/v1/skills/disable", { tool: d.tool, id: d.id, path: d.path, force: true });
        } else if(state.tab === "agents"){
          if(!confirm(t().confirm.agentDisable)) return;
          await postJson("/api/v1/agents/disable", { tool: d.tool, id: d.id, path: d.path, force: true });
        } else if(state.tab === "mcp"){
          const ro = Boolean(state.data.config && state.data.config.config && state.data.config.config.mcp && state.data.config.config.mcp.readOnly);
          if(ro){
            alert(t().confirm.mcpReadOnly);
            return;
          }
          if((d.path||"").endsWith(".claude.json")){
            if(!confirm(t().confirm.mcpClaude1)) return;
            if(!confirm(t().confirm.mcpClaude2)) return;
            await postJson("/api/v1/mcp/disable", { tool: d.tool, id: d.id, path: d.path, force: true });
          } else {
            if(!confirm(t().confirm.mcpDisable)) return;
            await postJson("/api/v1/mcp/disable", { tool: d.tool, id: d.id, path: d.path, force: true });
          }
        }
        await loadAll();
        buildToolOptions();
        render();
      }

      async function doEnable(){
        const d = currentDetail;
        if(!d) return;
        if(state.tab === "skills"){
          if(!confirm(t().confirm.skillEnable)) return;
          await postJson("/api/v1/skills/enable", { tool: d.tool, id: d.id, path: d.path, force: true });
        } else if(state.tab === "agents"){
          if(!confirm(t().confirm.agentEnable)) return;
          await postJson("/api/v1/agents/enable", { tool: d.tool, id: d.id, path: d.path, force: true });
        } else if(state.tab === "mcp"){
          const ro = Boolean(state.data.config && state.data.config.config && state.data.config.config.mcp && state.data.config.config.mcp.readOnly);
          if(ro){
            alert(t().confirm.mcpReadOnly);
            return;
          }
          if((d.path||"").endsWith(".claude.json")){
            if(!confirm(t().confirm.mcpClaude1)) return;
            if(!confirm(t().confirm.mcpClaude2)) return;
            await postJson("/api/v1/mcp/enable", { tool: d.tool, id: d.id, path: d.path, force: true });
          } else {
            if(!confirm(t().confirm.mcpEnable)) return;
            await postJson("/api/v1/mcp/enable", { tool: d.tool, id: d.id, path: d.path, force: true });
          }
        }
        await loadAll();
        buildToolOptions();
        render();
      }

      el.drawerDisable.addEventListener("click", () => doDisable().catch(e => alert(e.message || String(e))));
      el.drawerEnable.addEventListener("click", () => doEnable().catch(e => alert(e.message || String(e))));

      function formFromConfig(c){
        const rootsToText = (arr) => (Array.isArray(arr) ? arr.map(x => String(x)).join("\n") : "");
        const vToText = (arr) => (Array.isArray(arr) ? arr.map(x => String(x)).join("\n") : "");
        state.configEditor.form = {
          strategy: (c && c.defaults && (c.defaults.strategy === "auto" || c.defaults.strategy === "native" || c.defaults.strategy === "managed" || c.defaults.strategy === "symlink")) ? c.defaults.strategy : "auto",
          mcpReadOnly: Boolean(c && c.mcp && c.mcp.readOnly),
          extraSkillRootsText: rootsToText(c && c.scan ? c.scan.extraSkillRoots : []),
          extraAgentRootsText: rootsToText(c && c.scan ? c.scan.extraAgentRoots : []),
          unifiedSkillsRoot: (c && c.unified && c.unified.roots && c.unified.roots.skills) ? String(c.unified.roots.skills) : "",
          unifiedAgentsRoot: (c && c.unified && c.unified.roots && c.unified.roots.agents) ? String(c.unified.roots.agents) : "",
          unifiedMcpRoot: (c && c.unified && c.unified.roots && c.unified.roots.mcp) ? String(c.unified.roots.mcp) : "",
          selectSkillsText: vToText(c && c.unified && c.unified.select ? c.unified.select.skills : []),
          selectAgentsText: vToText(c && c.unified && c.unified.select ? c.unified.select.agents : []),
          selectMcpText: vToText(c && c.unified && c.unified.select ? c.unified.select.mcp : []),
        };
      }

      function configFromForm(){
        const e = state.configEditor;
        const splitLines = (s) =>
          String(s || "")
            .split(/\r?\n/)
            .map(x => x.trim())
            .filter(Boolean);
        const out = {
          version: 1,
          scan: {
            extraSkillRoots: splitLines(e.form.extraSkillRootsText),
            extraAgentRoots: splitLines(e.form.extraAgentRootsText),
          },
          defaults: { strategy: e.form.strategy },
          mcp: { readOnly: Boolean(e.form.mcpReadOnly) },
        };
        const uRoots = {
          skills: e.form.unifiedSkillsRoot.trim() ? e.form.unifiedSkillsRoot.trim() : undefined,
          agents: e.form.unifiedAgentsRoot.trim() ? e.form.unifiedAgentsRoot.trim() : undefined,
          mcp: e.form.unifiedMcpRoot.trim() ? e.form.unifiedMcpRoot.trim() : undefined,
        };
        const uSelect = {
          skills: splitLines(e.form.selectSkillsText),
          agents: splitLines(e.form.selectAgentsText),
          mcp: splitLines(e.form.selectMcpText),
        };
        const hasUnified = uRoots.skills || uRoots.agents || uRoots.mcp || uSelect.skills.length || uSelect.agents.length || uSelect.mcp.length;
        if (hasUnified) {
          out.unified = {
            mode: "symlink",
            roots: uRoots,
            select: uSelect,
          };
        }
        return out;
      }

      function syncEditorFromUi(){
        const e = state.configEditor;
        if (state.tab !== "config") return;
        if (e.view === "form"){
          const st = document.getElementById("cfgStrategy");
          const ro = document.getElementById("cfgMcpReadOnly");
          const es = document.getElementById("cfgExtraSkillRoots");
          const ea = document.getElementById("cfgExtraAgentRoots");
          const us = document.getElementById("cfgUnifiedSkillsRoot");
          const ua = document.getElementById("cfgUnifiedAgentsRoot");
          const um = document.getElementById("cfgUnifiedMcpRoot");
          const ss = document.getElementById("cfgSelectSkills");
          const sa = document.getElementById("cfgSelectAgents");
          const sm = document.getElementById("cfgSelectMcp");
          if (st) e.form.strategy = st.value === "native" ? "native" : st.value === "managed" ? "managed" : st.value === "symlink" ? "symlink" : "auto";
          if (ro) e.form.mcpReadOnly = Boolean(ro.checked);
          if (es) e.form.extraSkillRootsText = es.value;
          if (ea) e.form.extraAgentRootsText = ea.value;
          if (us) e.form.unifiedSkillsRoot = us.value;
          if (ua) e.form.unifiedAgentsRoot = ua.value;
          if (um) e.form.unifiedMcpRoot = um.value;
          if (ss) e.form.selectSkillsText = ss.value;
          if (sa) e.form.selectAgentsText = sa.value;
          if (sm) e.form.selectMcpText = sm.value;
          e.jsonText = JSON.stringify(configFromForm(), null, 2);
        } else {
          const jt = document.getElementById("cfgJson");
          if (jt) e.jsonText = jt.value;
          try {
            const parsed = JSON.parse(e.jsonText || "{}");
            formFromConfig(parsed);
          } catch {
            // keep form as-is if JSON invalid
          }
        }
      }

      async function doSaveConfig(){
        const cfg = state.data.config;
        if (!cfg || !cfg.config) throw new Error("Config not loaded");
        const e = state.configEditor;
        syncEditorFromUi();
        e.lastError = "";
        const scope = (cfg.projectDir ? e.scope : "global");
        let obj;
        try {
          obj = e.view === "json" ? JSON.parse(e.jsonText || "{}") : configFromForm();
        } catch (err) {
          e.lastError = err && err.message ? err.message : String(err);
          render();
          return;
        }
        try{
          await postJson("/api/v1/config/save", { scope, config: obj });
        } catch (err){
          e.lastError = err && err.message ? err.message : String(err);
          render();
          return;
        }
        await loadAll();
        // Re-init editor from merged config after save (keeps consistent view)
        const next = state.data.config && state.data.config.config ? state.data.config.config : null;
        if (next){
          formFromConfig(next);
          e.jsonText = JSON.stringify(next, null, 2);
        }
        render();
      }

      function setTab(tab){
        state.tab = tab;
        document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        buildToolOptions();
        render();
      }

      document.querySelectorAll(".tab").forEach(btn => {
        btn.addEventListener("click", () => setTab(btn.dataset.tab));
      });

      el.q.addEventListener("input", () => { state.q = el.q.value.trim(); render(); });
      el.tool.addEventListener("change", () => { state.tool = el.tool.value; render(); });
      el.descMode.addEventListener("change", () => {
        state.descMode = el.descMode.value === "both" ? "both" : (el.descMode.value === "raw" ? "raw" : "auto");
        localStorage.setItem("sm_descMode", state.descMode);
        render();
      });
      el.refresh.addEventListener("click", async () => {
        el.refresh.disabled = true;
        try{
          await loadAll();
          buildToolOptions();
          render();
        } finally {
          el.refresh.disabled = false;
        }
      });

      (async () => {
        try{
          // default language: zh, but allow persistent override
          const saved = localStorage.getItem("sm_lang");
          if(saved === "en" || saved === "zh") state.lang = saved;
          el.lang.value = state.lang;
          const savedDesc = localStorage.getItem("sm_descMode");
          if(savedDesc === "auto" || savedDesc === "both" || savedDesc === "raw") state.descMode = savedDesc;
          el.descMode.value = state.descMode;
          el.lang.addEventListener("change", async () => {
            state.lang = el.lang.value === "en" ? "en" : "zh";
            localStorage.setItem("sm_lang", state.lang);
            applyI18nStatic();
            buildToolOptions();
            render();
          });

          await loadAll();
          // init config editor from merged config
          if(state.data && state.data.config && state.data.config.config){
            formFromConfig(state.data.config.config);
            state.configEditor.jsonText = JSON.stringify(state.data.config.config, null, 2);
          }
          applyI18nStatic();
          buildToolOptions();
          render();
        } catch (e){
          el.panel.innerHTML = '<div class="empty">' + t().errLoad((e && e.message ? e.message : String(e))) + '</div>';
        }
      })();
    </script>
  </body>
</html>`;

