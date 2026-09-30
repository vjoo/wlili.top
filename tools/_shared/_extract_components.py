# -*- coding: utf-8 -*-
"""从 tools/_shared/admin.html 精确抽取 .sel/.cal 组件，生成共享 ui-select.css / ui-select.js。
用「标记定位」而非固定行号，避免源文件增删行后抽取错位。
仅新增：:root 主题默认值、禁用态透传、DOMContentLoaded 守卫，不改变组件原有逻辑。"""
import io, os

SRC = r"D:/wl共享文件夹/自创AI工具/wlili.top/tools/_shared/admin.html"
OUT = r"D:/wl共享文件夹/自创AI工具/wlili.top/tools/_shared"

s = io.open(SRC, encoding="utf-8").read()

# ---- 定位 CSS 区块：.sel 规则前的 <style> .. 对应 </style> ----
css_anchor = s.find("\n.sel { position: relative; }")
assert css_anchor > 0, "未找到 .sel 规则锚点"
style_open = s.rfind("<style>", 0, css_anchor)
assert style_open > 0, "未找到 .sel 前的 <style>"
css_start = style_open + len("<style>")
style_close = s.find("</style>", css_anchor)
assert style_close > 0, "未找到 </style>"
css_body = s[css_start:style_close]

# ---- 定位 JS 区块：var SEL_CHEVRON 前的 <script> .. 对应 </script> ----
js_anchor = s.find("var SEL_CHEVRON")
assert js_anchor > 0, "未找到 SEL_CHEVRON 锚点"
script_open = s.rfind("<script>", 0, js_anchor)
assert script_open > 0, "未找到 SEL_CHEVRON 前的 <script>"
js_start = script_open + len("<script>")
script_close = s.find("</script>", js_anchor)
assert script_close > 0, "未找到 </script>"
js_body = s[js_start:script_close]

# ---- CSS 文件 ----
css_header = """/* ui-select.css —— 全站统一下拉 / 日期组件（.sel / .cal）
 * 单一来源：由 tools/_shared/admin.html 的 .sel/.cal 区块抽取（脚本 _extract_components.py）。
 * 本文件只新增 :root 主题变量默认值（亮色，与后台一致），逻辑与后台完全一致。
 * 各分支 / 工具页可定义 --accent-color / --accent 等变量覆盖主题色。
 */
:root{
  --border-color:#e5e7eb;
  --bg-primary:#ffffff;
  --bg-secondary:#f3f4f6;
  --bg-hover:#f3f4f6;
  --text-primary:#1f2937;
  --text-secondary:#4b5563;
  --text-muted:#9ca3af;
  --border-light:#f0f1f3;
  --accent-color:#6366f1;
  --accent-light:rgba(99,102,241,0.1);
  --danger-color:#ef4444;
}
"""
css_footer = """
/* 禁用态：原生 select 带 disabled 时，组件触发器同步不可交互（如 unit-converter 的金额单位） */
.sel-trigger:disabled, .sel-trigger[disabled]{ opacity:.5; cursor:not-allowed; }
.sel-trigger:disabled:hover, .sel-trigger[disabled]:hover{ border-color:var(--border-color); }
"""
io.open(os.path.join(OUT, "ui-select.css"), "w", encoding="utf-8").write(css_header + css_body + css_footer)

# ---- JS 文件 ----
needle = "    trigger.type = 'button';\n"
assert needle in js_body, "未找到注入点 trigger.type"
js_body2 = js_body.replace(needle, needle + "    if (sel.disabled) trigger.disabled = true;\n", 1)

js_header = """/* ui-select.js —— 全站统一下拉 / 日期组件（.sel / .cal）
 * 由 tools/_shared/admin.html 内联副本抽取，逻辑完全一致；请勿手改本文件，改源件后重跑 _extract_components.py。
 * 升级范围：select.form-select / input[type=date] / input[type=date][data-cal-range]。
 * 工具页只需给 select 加 class="form-select" 即可被自动升级（含动态渲染的 MutationObserver）。
 * 额外：原生 select 的 disabled 会透传到触发器（后台无 disabled 控件，此处为工具页补全）。
 */
(function(){
  function __sel_init(){
"""
js_footer = """
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', __sel_init);
  else __sel_init();
})();
"""
io.open(os.path.join(OUT, "ui-select.js"), "w", encoding="utf-8").write(js_header + js_body2 + js_footer)

print("css bytes:", len(css_body), "| js bytes:", len(js_body))
print("has floatPanel:", "function floatPanel" in js_body)
print("has unfloatPanel:", "function unfloatPanel" in js_body)
print("floatPanel calls:", js_body.count("floatPanel(panel, wrap);"))
print("unfloatPanel calls:", js_body.count("unfloatPanel(panel, wrap);"))
print("onDocDown updated:", js_body.count("&& !panel.contains(e.target)"))
