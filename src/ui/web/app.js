      // ============================================================
      // petite-vue overlay layer: Modal, Toast, BulkBar
      // Exposes: window.smModal(opts) -> Promise<boolean>
      //          window.smToast(opts | text)
      //          window.smBulk (reactive state; see configureBulkBar)
      // ============================================================
      (function initOverlays(){
        if (typeof PetiteVue === "undefined" || !PetiteVue.createApp) {
          // Defensive fallback: keep native confirm/alert
          window.smModal = function (opts) {
            const txt = (opts && (opts.title ? opts.title + "\n\n" : "") + (opts.body || "")) || "Confirm?";
            return Promise.resolve(window.confirm(txt));
          };
          window.smToast = function (opts) {
            const text = typeof opts === "string" ? opts : (opts && opts.text) || "";
            if (text) window.alert(text);
          };
          window.smBulk = { configure(){}, set(){}, clear(){} };
          return;
        }
        const { createApp, reactive } = PetiteVue;

        function getLang(){
          try { const v = localStorage.getItem("sm_lang"); return v === "en" ? "en" : "zh"; } catch { return "zh"; }
        }
        const T = {
          zh: {
            confirm: "确认", cancel: "取消", preview: "将发生的变更",
            bulkEnable: "批量启用", bulkDisable: "批量禁用", clear: "清空选择",
            pin: "加入 unified.select", unpin: "从 unified.select 移除",
            countLabel: (n) => `已选 ${n} 项`,
            progressLabel: (done, total) => `执行中 ${done}/${total}`,
          },
          en: {
            confirm: "Confirm", cancel: "Cancel", preview: "Planned changes",
            bulkEnable: "Bulk enable", bulkDisable: "Bulk disable", clear: "Clear",
            pin: "Pin to unified.select", unpin: "Unpin from unified.select",
            countLabel: (n) => `${n} selected`,
            progressLabel: (done, total) => `Running ${done}/${total}`,
          },
        };
        function tr(){ return T[getLang()] || T.zh; }

        // ---- Modal ----
        const modalState = reactive({
          open: false,
          title: "",
          bodyHtml: "",
          preview: null,
          tone: "default",
          confirmText: "",
          t: { confirm: tr().confirm, cancel: tr().cancel, preview: tr().preview },
          _resolve: null,
          cancel(){ const r = this._resolve; this._resolve = null; this.open = false; if (r) r(false); },
          confirm(){ const r = this._resolve; this._resolve = null; this.open = false; if (r) r(true); },
        });
        // ModalHost/BulkBar/ToastHost previously used as v-scope="ModalHost()" returned a pre-reactive
        // singleton; petite-vue's et() snapshots property descriptors at mount time and the new scope
        // no longer tracked subsequent mutations, so opening the modal silently failed. The fix is to
        // pass the reactive state object directly as createApp(state)'s global scope and use empty
        // v-scope on the root element. Functions kept here only for backward reference / debugging.

        // ---- Toast ----
        const toastState = reactive({
          items: [],
          _id: 0,
          push(text, tone, ttl){
            const id = ++this._id;
            this.items.push({ id, text: String(text), tone: tone || "info" });
            if (ttl > 0) setTimeout(() => this.dismiss(id), ttl);
            return id;
          },
          dismiss(id){
            const i = this.items.findIndex(x => x.id === id);
            if (i >= 0) this.items.splice(i, 1);
          },
        });


        // ---- Bulk action bar ----
        const bulkState = reactive({
          visible: false,
          busy: false,
          selected: 0,
          tab: "",
          canPin: false,
          progress: { done: 0, total: 0 },
          t: { enable: tr().bulkEnable, disable: tr().bulkDisable, clear: tr().clear, pin: tr().pin, unpin: tr().unpin },
          _onClear: null,
          _onAction: null,
          _onPin: null,
          get countLabel(){ return tr().countLabel(this.selected); },
          get progressLabel(){ return tr().progressLabel(this.progress.done, this.progress.total); },
          clear(){ if (this._onClear) this._onClear(); },
          async doBulk(action){
            if (!this._onAction) return;
            this.busy = true;
            try { await this._onAction(action); } finally { this.busy = false; }
          },
          async doPin(mode){
            if (!this._onPin) return;
            this.busy = true;
            try { await this._onPin(mode); } finally { this.busy = false; }
          },
        });

        function mount(){
          // Each overlay is its own petite-vue app whose global scope IS the singleton reactive state.
          // Root divs use empty v-scope so bindings (:style, {{expr}}, @click) resolve against this scope.
          createApp(modalState).mount("#smModal");
          createApp(bulkState).mount("#smBulk");
          createApp(toastState).mount("#smToast");
        }
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", mount);
        } else {
          mount();
        }

        // ---- Public API ----
        function escHtml(s){
          return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        }
        window.smModal = function smModal(opts){
          opts = opts || {};
          // Refresh i18n on each open in case lang changed
          modalState.t = { confirm: tr().confirm, cancel: tr().cancel, preview: tr().preview };
          modalState.title = opts.title || "";
          if (typeof opts.bodyHtml === "string") {
            modalState.bodyHtml = opts.bodyHtml;
          } else {
            modalState.bodyHtml = escHtml(opts.body || "").replace(/\n/g, "<br/>");
          }
          modalState.preview = Array.isArray(opts.preview) && opts.preview.length ? opts.preview : null;
          modalState.tone = opts.tone === "danger" ? "danger" : "default";
          modalState.confirmText = opts.confirmText || "";
          return new Promise((resolve) => {
            modalState._resolve = resolve;
            modalState.open = true;
          });
        };
        window.smToast = function smToast(opts){
          const text = typeof opts === "string" ? opts : (opts && opts.text) || "";
          if (!text) return -1;
          const tone = (typeof opts === "object" && opts && opts.tone) || "info";
          const ttl = (typeof opts === "object" && opts && typeof opts.ttl === "number") ? opts.ttl : (tone === "error" ? 7000 : 4000);
          return toastState.push(text, tone, ttl);
        };
        window.smBulk = {
          configure(opts){
            bulkState._onClear = opts && opts.onClear ? opts.onClear : null;
            bulkState._onAction = opts && opts.onAction ? opts.onAction : null;
            bulkState._onPin = opts && opts.onPin ? opts.onPin : null;
          },
          set(count, ctx){
            bulkState.selected = count;
            bulkState.visible = count > 0;
            if (ctx && typeof ctx.tab === "string") bulkState.tab = ctx.tab;
            if (ctx && typeof ctx.canPin === "boolean") bulkState.canPin = ctx.canPin;
            bulkState.t = { enable: tr().bulkEnable, disable: tr().bulkDisable, clear: tr().clear, pin: tr().pin, unpin: tr().unpin };
          },
          progress(done, total){
            bulkState.progress = { done, total };
          },
          hide(){ bulkState.visible = false; bulkState.selected = 0; },
        };
      })();

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
        // Bulk selection per tab. Keys are `${tool}:${id}:${path}` strings.
        selected: { skills: new Set(), agents: new Set(), mcp: new Set() },
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
        drawerStrategyWrap: document.getElementById("drawerStrategyWrap"),
        drawerStrategy: document.getElementById("drawerStrategy"),
        drawerStrategyLabel: document.getElementById("drawerStrategyLabel"),
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

      function rowKey(item){
        return (item.tool || "?") + ":" + (item.id || "?") + ":" + (item.path || "?");
      }

      function renderTable(columns, rows, onRowClick, opts){
        const selectable = !!(opts && opts.selectable);
        const tab = opts && opts.tab ? opts.tab : state.tab;
        const sel = selectable ? state.selected[tab] : null;
        if(!rows.length){
          return '<div class="empty">' + t().empty + '</div>';
        }

        let theadCols = "";
        if (selectable) {
          const allChecked = rows.every(r => sel.has(rowKey(r)));
          const someChecked = !allChecked && rows.some(r => sel.has(rowKey(r)));
          const checkedAttr = allChecked ? " checked" : "";
          // visually indicate partial selection via title
          const titleAttr = someChecked ? ' title="partial"' : '';
          theadCols += '<th class="col-check"><input type="checkbox" data-bulk="all"' + checkedAttr + titleAttr + ' /></th>';
        }
        theadCols += columns.map(c => "<th>" + c.label + "</th>").join("");
        const thead = "<thead><tr>" + theadCols + "</tr></thead>";

        const tbody = "<tbody>" + rows.map((r) => {
          let tds = "";
          if (selectable) {
            const k = rowKey(r);
            const checked = sel.has(k) ? " checked" : "";
            tds += '<td class="col-check"><input type="checkbox" data-bulk-row="' + escapeAttr(k) + '"' + checked + ' /></td>';
          }
          tds += columns.map(c => "<td>" + c.render(r) + "</td>").join("");
          return "<tr>" + tds + "</tr>";
        }).join("") + "</tbody>";
        const html = "<table>" + thead + tbody + "</table>";

        // bind events after paint
        setTimeout(() => {
          const trs = el.panel.querySelectorAll("tbody tr");
          trs.forEach((tr, i) => {
            tr.addEventListener("click", (e) => {
              if (e.target && e.target.closest && e.target.closest('input[type="checkbox"]')) return;
              onRowClick(rows[i]);
            });
          });
          if (selectable) {
            const all = el.panel.querySelector('input[data-bulk="all"]');
            if (all) {
              all.addEventListener("change", (e) => {
                const checked = e.target.checked;
                rows.forEach(r => {
                  const k = rowKey(r);
                  if (checked) sel.add(k); else sel.delete(k);
                });
                refreshBulkBar();
                render();
              });
            }
            el.panel.querySelectorAll('input[data-bulk-row]').forEach(cb => {
              cb.addEventListener("change", (e) => {
                const k = e.target.getAttribute("data-bulk-row");
                if (e.target.checked) sel.add(k); else sel.delete(k);
                refreshBulkBar();
                // light update of header checkbox state
                const all = el.panel.querySelector('input[data-bulk="all"]');
                if (all) {
                  const allChecked = rows.every(r => sel.has(rowKey(r)));
                  all.checked = allChecked;
                }
              });
            });
          }
        }, 0);
        return html;
      }

      function refreshBulkBar(){
        if (!window.smBulk) return;
        const tab = state.tab;
        if (tab === "config") { window.smBulk.set(0, { tab, canPin: false }); return; }
        const sel = state.selected[tab];
        const count = sel ? sel.size : 0;
        const canPin = count > 0 && (tab === "skills" || tab === "agents" || tab === "mcp");
        window.smBulk.set(count, { tab, canPin });
      }

      function selectedRecords(tab){
        const sel = state.selected[tab];
        if (!sel || sel.size === 0) return [];
        const rows = state.data[tab] || [];
        const map = new Map(rows.map(r => [rowKey(r), r]));
        return Array.from(sel).map(k => map.get(k)).filter(Boolean);
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
        // strategy selector only for skills tab
        if (el.drawerStrategyWrap){
          el.drawerStrategyWrap.style.display = (state.tab === "skills" && d) ? "inline-flex" : "none";
        }
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
        // honor per-tab persisted tool filter; fallback to in-memory; finally "all"
        let keep = state.tool;
        try {
          const persisted = localStorage.getItem("sm_tool_" + state.tab);
          if (persisted && (persisted === "all" || tools.includes(persisted))) keep = persisted;
        } catch {}
        el.tool.innerHTML = '<option value="all">all</option>' + tools.map(t => '<option value="'+t+'">'+t+'</option>').join("");
        if(keep === "all" || tools.includes(keep)) el.tool.value = keep; else el.tool.value = "all";
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
          }, { selectable: true, tab: "skills" });
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
          }, { selectable: true, tab: "agents" });
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
          }, { selectable: true, tab: "mcp" });
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
            if (saveBtn) saveBtn.addEventListener("click", () => doSaveConfig().catch(err => window.smToast({ tone: "error", text: err.message || String(err) })));

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

      // Build a best-effort preview of what a single mutation will touch.
      // Pure heuristics over the record + strategy; no server roundtrip.
      function buildPreview(action, tab, d, strategy){
        const out = [];
        if (!d) return out;
        const home = "~";
        const archiveBase = home + "/.config/skill-manager/archive";
        if (tab === "skills"){
          const strat = strategy || "auto";
          const isBuiltin = d.skillKind === "cursor-builtin";
          if (isBuiltin) {
            out.push({ kind: "blocked", text: "Cursor built-in skill — toggle inside Cursor Settings." });
            return out;
          }
          if (strat === "managed") {
            if (action === "disable") {
              out.push({ kind: "move", text: d.path + "  →  " + archiveBase + "/skills/" + d.tool + "/" + d.id });
            } else {
              out.push({ kind: "restore", text: archiveBase + "/skills/" + d.tool + "/" + d.id + "  →  " + d.path });
            }
          } else if (strat === "native" || strat === "auto") {
            const flag = action === "disable" ? "true" : "(removed)";
            out.push({ kind: "edit", text: d.path + "/SKILL.md  ← frontmatter disable-model-invocation: " + flag });
          }
        } else if (tab === "agents"){
          if (action === "disable") {
            out.push({ kind: "move", text: d.path + "  →  " + archiveBase + "/agents/" + d.tool + "/" + d.id + ".md" });
          } else {
            out.push({ kind: "restore", text: archiveBase + "/agents/" + d.tool + "/" + d.id + ".md  →  " + d.path });
          }
        } else if (tab === "mcp"){
          if (action === "disable") {
            out.push({ kind: "edit", text: "Remove server '" + d.id + "' from " + d.path });
            out.push({ kind: "stash", text: "Stash original entry into ~/.config/skill-manager/state.json (reversible)" });
          } else {
            out.push({ kind: "edit", text: "Restore server '" + d.id + "' into " + d.path + " (from state stash)" });
          }
          if ((d.path || "").endsWith(".claude.json")) {
            out.push({ kind: "backup", text: "Auto-create timestamped backup beside ~/.claude.json before edit" });
          }
        }
        return out;
      }

      async function doDisable(){
        const d = currentDetail;
        if(!d) return;
        if(state.tab === "skills"){
          const strategy = (el.drawerStrategy && el.drawerStrategy.value) || "auto";
          const ok = await window.smModal({
            title: t().drawer.disable + ": " + d.id,
            body: t().confirm.skillDisable,
            preview: buildPreview("disable", "skills", d, strategy),
            tone: "danger",
            confirmText: t().drawer.disable,
          });
          if (!ok) return;
          await postJson("/api/v1/skills/disable", { tool: d.tool, id: d.id, path: d.path, force: true, strategy });
        } else if(state.tab === "agents"){
          const ok = await window.smModal({
            title: t().drawer.disable + ": " + d.id,
            body: t().confirm.agentDisable,
            preview: buildPreview("disable", "agents", d),
            tone: "danger",
            confirmText: t().drawer.disable,
          });
          if (!ok) return;
          await postJson("/api/v1/agents/disable", { tool: d.tool, id: d.id, path: d.path, force: true });
        } else if(state.tab === "mcp"){
          const ro = Boolean(state.data.config && state.data.config.config && state.data.config.config.mcp && state.data.config.config.mcp.readOnly);
          if(ro){
            window.smToast({ tone: "error", text: t().confirm.mcpReadOnly });
            return;
          }
          const isClaudeJson = (d.path || "").endsWith(".claude.json");
          const ok = await window.smModal({
            title: t().drawer.disable + ": " + d.id,
            body: isClaudeJson ? (t().confirm.mcpClaude1 + "\n" + t().confirm.mcpDisable) : t().confirm.mcpDisable,
            preview: buildPreview("disable", "mcp", d),
            tone: "danger",
            confirmText: t().drawer.disable,
          });
          if (!ok) return;
          await postJson("/api/v1/mcp/disable", { tool: d.tool, id: d.id, path: d.path, force: true });
        }
        await loadAll();
        buildToolOptions();
        render();
        window.smToast({ tone: "success", text: t().drawer.disable + " ✓ " + d.id });
      }

      async function doEnable(){
        const d = currentDetail;
        if(!d) return;
        if(state.tab === "skills"){
          const strategy = (el.drawerStrategy && el.drawerStrategy.value) || "auto";
          const ok = await window.smModal({
            title: t().drawer.enable + ": " + d.id,
            body: t().confirm.skillEnable,
            preview: buildPreview("enable", "skills", d, strategy),
            confirmText: t().drawer.enable,
          });
          if (!ok) return;
          await postJson("/api/v1/skills/enable", { tool: d.tool, id: d.id, path: d.path, force: true, strategy });
        } else if(state.tab === "agents"){
          const ok = await window.smModal({
            title: t().drawer.enable + ": " + d.id,
            body: t().confirm.agentEnable,
            preview: buildPreview("enable", "agents", d),
            confirmText: t().drawer.enable,
          });
          if (!ok) return;
          await postJson("/api/v1/agents/enable", { tool: d.tool, id: d.id, path: d.path, force: true });
        } else if(state.tab === "mcp"){
          const ro = Boolean(state.data.config && state.data.config.config && state.data.config.config.mcp && state.data.config.config.mcp.readOnly);
          if(ro){
            window.smToast({ tone: "error", text: t().confirm.mcpReadOnly });
            return;
          }
          const isClaudeJson = (d.path || "").endsWith(".claude.json");
          const ok = await window.smModal({
            title: t().drawer.enable + ": " + d.id,
            body: isClaudeJson ? (t().confirm.mcpClaude1 + "\n" + t().confirm.mcpEnable) : t().confirm.mcpEnable,
            preview: buildPreview("enable", "mcp", d),
            confirmText: t().drawer.enable,
          });
          if (!ok) return;
          await postJson("/api/v1/mcp/enable", { tool: d.tool, id: d.id, path: d.path, force: true });
        }
        await loadAll();
        buildToolOptions();
        render();
        window.smToast({ tone: "success", text: t().drawer.enable + " ✓ " + d.id });
      }

      el.drawerDisable.addEventListener("click", () => doDisable().catch(e => window.smToast({ tone: "error", text: (e && e.message) || String(e) })));
      el.drawerEnable.addEventListener("click", () => doEnable().catch(e => window.smToast({ tone: "error", text: (e && e.message) || String(e) })));

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
        try { localStorage.setItem("sm_tab", tab); } catch {}
        document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        buildToolOptions();
        refreshBulkBar();
        render();
      }

      // ============================================================
      // Bulk action engine — runs `action` on currently selected rows
      // of the active tab with limited concurrency and a single
      // confirm modal that aggregates the planned changes.
      // ============================================================
      async function runBulk(action){
        const tab = state.tab;
        if (tab === "config") return;
        const records = selectedRecords(tab);
        if (records.length === 0) return;

        // MCP readOnly guard
        if (tab === "mcp") {
          const ro = Boolean(state.data.config && state.data.config.config && state.data.config.config.mcp && state.data.config.config.mcp.readOnly);
          if (ro) {
            window.smToast({ tone: "error", text: t().confirm.mcpReadOnly });
            return;
          }
        }

        // Aggregate preview (cap at 12 lines for readability)
        const previewAll = [];
        const cap = 12;
        for (const r of records) {
          const items = buildPreview(action, tab, r, tab === "skills" ? "managed" : undefined);
          for (const it of items) {
            previewAll.push({ kind: it.kind, text: "[" + r.id + "] " + it.text });
            if (previewAll.length >= cap) break;
          }
          if (previewAll.length >= cap) break;
        }
        if (records.length > cap) {
          previewAll.push({ kind: "more", text: "… and " + (records.length - cap) + " more" });
        }

        const isDanger = action === "disable";
        const titleKey = action === "disable" ? t().drawer.disable : t().drawer.enable;
        const bodyText =
          (state.lang === "en"
            ? "About to " + action + " " + records.length + " " + tab + (tab === "mcp" ? " server(s)." : (tab === "agents" ? " agent(s)." : " skill(s).")) +
              (tab === "skills" && action === "disable" ? " Strategy: managed (archive directories; safe for read-only files)." : "")
            : "即将" + (action === "disable" ? "批量禁用" : "批量启用") + " " + records.length + " 个" +
              (tab === "mcp" ? " MCP server" : (tab === "agents" ? "代理" : "技能")) + "。" +
              (tab === "skills" && action === "disable" ? "策略：managed（整目录归档，规避只读文件权限问题）。" : ""));

        const ok = await window.smModal({
          title: titleKey + " × " + records.length,
          body: bodyText,
          preview: previewAll,
          tone: isDanger ? "danger" : "default",
          confirmText: titleKey,
        });
        if (!ok) return;

        // Run with limited concurrency (3) and progress reporting.
        const concurrency = 3;
        let done = 0;
        const failures = [];
        window.smBulk.progress(0, records.length);

        async function runOne(rec){
          try {
            if (tab === "skills") {
              const url = "/api/v1/skills/" + action;
              await postJson(url, { tool: rec.tool, id: rec.id, path: rec.path, force: true, strategy: action === "disable" ? "managed" : "auto" });
            } else if (tab === "agents") {
              const url = "/api/v1/agents/" + action;
              await postJson(url, { tool: rec.tool, id: rec.id, path: rec.path, force: true });
            } else if (tab === "mcp") {
              const url = "/api/v1/mcp/" + action;
              await postJson(url, { tool: rec.tool, id: rec.id, path: rec.path, force: true });
            }
          } catch (e) {
            failures.push({ id: rec.id, message: (e && e.message) || String(e) });
          } finally {
            done += 1;
            window.smBulk.progress(done, records.length);
          }
        }

        const queue = records.slice();
        async function worker(){
          while (queue.length) {
            const r = queue.shift();
            await runOne(r);
          }
        }
        const workers = Array.from({ length: Math.min(concurrency, records.length) }, () => worker());
        await Promise.all(workers);

        await loadAll();
        // Clear selection of items that succeeded; keep failed for retry.
        const failedKeys = new Set(failures.map(f => records.find(r => r.id === f.id)).filter(Boolean).map(rowKey));
        const newSel = new Set();
        for (const k of state.selected[tab]) if (failedKeys.has(k)) newSel.add(k);
        state.selected[tab] = newSel;
        refreshBulkBar();
        buildToolOptions();
        render();

        if (failures.length === 0) {
          window.smToast({ tone: "success", text: titleKey + " ✓ " + records.length });
        } else {
          const okCount = records.length - failures.length;
          window.smToast({
            tone: "error",
            text: (state.lang === "en"
              ? okCount + "/" + records.length + " ok; " + failures.length + " failed: " + failures.slice(0, 3).map(f => f.id + " (" + f.message + ")").join("; ")
              : "成功 " + okCount + "/" + records.length + "；失败 " + failures.length + " 项：" + failures.slice(0, 3).map(f => f.id + "（" + f.message + "）").join("；")),
            ttl: 12000,
          });
        }
      }

      // ============================================================
      // Pin/Unpin selected rows to/from configEditor.form.selectXxxText
      // (purely client-side; user still has to click "Save" on the
      // Config tab to persist into ~/.config/skill-manager/config.json)
      // ============================================================
      function runPin(mode){
        const tab = state.tab;
        if (tab !== "skills" && tab !== "agents" && tab !== "mcp") return;
        const records = selectedRecords(tab);
        if (records.length === 0) return;

        const formKey = tab === "skills" ? "selectSkillsText" : (tab === "agents" ? "selectAgentsText" : "selectMcpText");
        const editor = state.configEditor;
        const current = (editor.form[formKey] || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const set = new Set(current);

        const ids = records.map(r => r.id).filter(Boolean);
        let changed = 0;
        if (mode === "add") {
          for (const id of ids) {
            if (!set.has(id)) { set.add(id); changed += 1; }
          }
        } else if (mode === "remove") {
          for (const id of ids) {
            if (set.has(id)) { set.delete(id); changed += 1; }
          }
        }

        const next = Array.from(set);
        editor.form[formKey] = next.join("\n");

        // Mirror into the JSON view so it's not stale when user toggles tabs.
        try {
          const parsed = editor.jsonText ? JSON.parse(editor.jsonText) : {};
          parsed.unified = parsed.unified || {};
          parsed.unified.select = parsed.unified.select || {};
          parsed.unified.select[tab] = next;
          editor.jsonText = JSON.stringify(parsed, null, 2);
        } catch {
          // jsonText might be empty or malformed; ignore — form is the source of truth.
        }

        // If currently viewing the Config tab, repaint to reflect the textarea.
        if (state.tab === "config") render();

        const verb = mode === "add" ? (state.lang === "en" ? "Pinned" : "已加入") : (state.lang === "en" ? "Unpinned" : "已移除");
        const tail = state.lang === "en"
          ? ` (${changed}/${ids.length}). Open the Config tab and click Save to persist.`
          : `（${changed}/${ids.length}）。请到「配置」标签点保存以写入磁盘。`;
        window.smToast({ tone: changed > 0 ? "success" : "info", text: verb + " " + ids.length + " → unified.select." + tab + tail });
      }

      // Wire bulk bar to the runtime once at startup.
      if (window.smBulk && typeof window.smBulk.configure === "function") {
        window.smBulk.configure({
          onClear: () => {
            const tab = state.tab;
            if (tab === "config") return;
            state.selected[tab] = new Set();
            refreshBulkBar();
            render();
          },
          onAction: (action) => runBulk(action),
          onPin: (mode) => runPin(mode),
        });
      }

      document.querySelectorAll(".tab").forEach(btn => {
        btn.addEventListener("click", () => setTab(btn.dataset.tab));
      });

      el.q.addEventListener("input", () => {
        state.q = el.q.value.trim();
        try { localStorage.setItem("sm_q", state.q); } catch {}
        render();
      });
      el.tool.addEventListener("change", () => {
        state.tool = el.tool.value;
        try { localStorage.setItem("sm_tool_" + state.tab, state.tool); } catch {}
        render();
      });
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
          // restore tab + query + per-tab tool filter
          try {
            const savedTab = localStorage.getItem("sm_tab");
            if (savedTab === "skills" || savedTab === "agents" || savedTab === "mcp" || savedTab === "config") {
              state.tab = savedTab;
              document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === state.tab));
            }
            const savedQ = localStorage.getItem("sm_q");
            if (typeof savedQ === "string") {
              state.q = savedQ;
              if (el.q) el.q.value = savedQ;
            }
          } catch {}
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

          // ---- live updates: SSE + doctor banner ----
          startLiveUpdates();
          loadDoctor();
        } catch (e){
          el.panel.innerHTML = '<div class="empty">' + t().errLoad((e && e.message ? e.message : String(e))) + '</div>';
        }
      })();

      // ============================================================
      // Live updates over Server-Sent Events. The server emits a
      // `change` event when any mutation succeeds OR when fs.watch
      // detects an external edit. We debounce and refresh once.
      // ============================================================
      let _liveDebounce = null;
      let _liveSource = null;
      function startLiveUpdates(){
        if (typeof EventSource === "undefined") return;
        try {
          const es = new EventSource("/api/v1/events");
          _liveSource = es;
          es.addEventListener("change", () => {
            if (_liveDebounce) clearTimeout(_liveDebounce);
            _liveDebounce = setTimeout(async () => {
              _liveDebounce = null;
              try {
                await loadAll();
                buildToolOptions();
                render();
              } catch (e) {
                window.smToast({ tone: "error", text: (e && e.message) || String(e) });
              }
            }, 600);
          });
          es.onerror = () => {
            // browser auto-reconnects; nothing to do beyond logging
            try { console.warn("[skills-manager] SSE connection dropped, will retry"); } catch {}
          };
        } catch (e) {
          try { console.warn("[skills-manager] SSE init failed", e); } catch {}
        }
      }

      async function loadDoctor(){
        const banner = document.getElementById("doctorBanner");
        const txt = document.getElementById("doctorBannerText");
        const dismissBtn = document.getElementById("doctorDismiss");
        if (!banner || !txt) return;
        try {
          const dismissed = localStorage.getItem("sm_doctor_dismissed_at");
          if (dismissed) {
            const age = Date.now() - Number(dismissed);
            if (age < 12 * 3600 * 1000) return; // hide for 12h
          }
        } catch {}
        try {
          const res = await fetch("/api/v1/doctor");
          if (!res.ok) return;
          const data = await res.json();
          const issues = (data && Array.isArray(data.issues)) ? data.issues : [];
          if (issues.length === 0) return;
          const errors = issues.filter(i => i.level === "error");
          banner.classList.toggle("error", errors.length > 0);
          const lead = errors.length
            ? (state.lang === "en" ? `${errors.length} error(s) detected` : `检测到 ${errors.length} 个错误`)
            : (state.lang === "en" ? `${issues.length} warning(s) detected` : `检测到 ${issues.length} 项警告`);
          const sample = issues[0].message;
          txt.textContent = lead + " — " + sample + (issues.length > 1 ? (state.lang === "en" ? ` (+${issues.length - 1} more)` : `（其余 ${issues.length - 1} 项可在 CLI 运行 doctor 查看）`) : "");
          banner.style.display = "flex";
          if (dismissBtn) {
            dismissBtn.onclick = () => {
              banner.style.display = "none";
              try { localStorage.setItem("sm_doctor_dismissed_at", String(Date.now())); } catch {}
            };
          }
        } catch {
          /* doctor is optional; ignore failures */
        }
      }
