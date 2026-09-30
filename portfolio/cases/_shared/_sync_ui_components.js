/**
 * 组件同步工具 —— 把「自研表单组件」从作品集后台同步到综合后台，并重建演示页。
 *
 * 为什么需要它：组件 CSS/JS 在 portfolio/cases/_shared/admin.html 与 tools/_shared/admin.html
 * 各存一份（两个后台是独立单文件，没有共享文件可引）。手工复制极易漏段、漏常量、或残留旧块，
 * 已因此出过事故。此脚本一次做三件事，且可反复执行（先移除旧块再插入，幂等）。
 *
 * 用法：  node portfolio/cases/_shared/_sync_ui_components.js
 * 产出：  ① tools/_shared/admin.html 组件块更新
 *         ② portfolio/cases/_shared/_sel_showcase.html 演示页重建
 *
 * ⚠ 只做同步，不做 git 提交。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');           // wlili.top
const SRC = path.join(ROOT, 'portfolio/cases/_shared/admin.html');
const DST = path.join(ROOT, 'tools/_shared/admin.html');
const DEMO = path.join(__dirname, '_sel_showcase.html');

const src = fs.readFileSync(SRC, 'utf8');

/* ---------- 提取（大括号配对，避免正则被字符串内容干扰） ---------- */
function extractBlock(t, s) {
  let i = t.indexOf('{', s), d = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === '{') d++; else if (t[j] === '}') { d--; if (d === 0) return t.slice(s, j + 1); }
  }
  throw new Error('括号未配对: ' + t.slice(s, s + 40));
}
function fn(sig) { const s = src.indexOf(sig); if (s < 0) throw new Error('未找到 ' + sig); return extractBlock(src, s); }

const HINT = '.form-hint { font-size: 12px; color: var(--text-muted); line-height: 1.6; }';
const compCss = src.slice(src.indexOf('.sel { position: relative; }'), src.indexOf(HINT) + HINT.length);
const compConsts = src.slice(src.indexOf('  var SEL_CHEVRON ='), src.indexOf('\n', src.indexOf('  var SEL_CHECK =')) + 1);
const iS = src.indexOf('  var SEL_ICONS = {');
const selIcons = src.slice(iS, src.indexOf('};', iS) + 2);
const fnSel = fn('function upgradeSelect(sel) {');
const fnDate = fn('function upgradeDate(inp) {');
const fnRange = fn('function upgradeDateRange(inpS, inpE) {');
const fnUI = fn('function upgradeUI(root) {');
const fnFloat = fn('function floatPanel(panel, wrap) {');
const fnUnfloat = fn('function unfloatPanel(panel, wrap) {');

const BOOT = `
/* 自研表单组件：下拉 .sel-* / 日期 .cal-* / 范围 .cal-range（与作品集后台同源，配色走各分支 --accent）
   原生控件保留为真值源，样式与交互由组件接管；本后台多为动态渲染，故用 MutationObserver 自动升级。
   用法：下拉形态写 select 的 multiple / data-sel-search / data-sel-pill / compact，option 的 data-icon(键名) / data-color；
        日期写 input[type=date] 的 min/max、data-cal-placeholder；
        范围用两个 input 写同一个 data-cal-range="组名"（前者开始、后者结束，跨度上限默认 1 个月）。
   同步自 portfolio/cases/_shared/admin.html —— 请勿在此手工改动，改完源件跑 _sync_ui_components.js。 */
(function () {
  function visit(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches && el.matches('select.form-select')) upgradeSelect(el);
    if (el.matches && el.matches('input[type="date"]')) upgradeDate(el);
    if (el.querySelectorAll) {
      Array.prototype.forEach.call(el.querySelectorAll('select.form-select'), upgradeSelect);
      Array.prototype.forEach.call(el.querySelectorAll('input[type="date"]'), upgradeDate);
    }
    var groups = {}, order = [], all = [];
    if (el.matches && el.matches('input[type="date"][data-cal-range]')) all.push(el);
    if (el.querySelectorAll) {
      Array.prototype.forEach.call(el.querySelectorAll('input[type="date"][data-cal-range]'), function (i) { all.push(i); });
    }
    all.forEach(function (inp) {
      var g = inp.dataset.calRange;
      if (!groups[g]) { groups[g] = []; order.push(g); }
      if (groups[g].indexOf(inp) < 0) groups[g].push(inp);
    });
    order.forEach(function (g) { if (groups[g].length >= 2) upgradeDateRange(groups[g][0], groups[g][1]); });
  }
  upgradeUI(document);
  if (window.MutationObserver) {
    var timer = null, pending = [];
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { pending.push(n); }); });
      clearTimeout(timer);
      timer = setTimeout(function () { var b = pending; pending = []; b.forEach(visit); }, 30);
    }).observe(document.body, { childList: true, subtree: true });
  }
})();`;

const snippet = `
<style>
${compCss}
</style>
<script>
${compConsts}
${selIcons}
${fnFloat}
${fnUnfloat}
${fnSel}
${fnDate}
${fnRange}
${fnUI}
${BOOT}
</script>
`;

/* ---------- ① 同步到综合后台（原子写） ---------- */
let dst = fs.readFileSync(DST, 'utf8');
const marker = '\n<style>\n.sel { position: relative; }';
const oldStart = dst.indexOf(marker);
if (oldStart >= 0) {
  const e = dst.indexOf('</script>', oldStart);
  if (e < 0) throw new Error('旧组件块未闭合，请手工检查 tools/_shared/admin.html');
  dst = dst.slice(0, oldStart) + dst.slice(e + '</script>'.length);
  console.log('① 已移除 tools 旧组件块');
}
const bi = dst.lastIndexOf('</body>');
if (bi < 0) throw new Error('tools 后台未找到 </body>');
/* 幂等：把 </body> 前的换行收敛成恰好一个，并去掉 snippet 自带的前导换行，避免每次同步多出一个空行 */
dst = dst.slice(0, bi).replace(/\n+$/, '') + '\n' + snippet.replace(/^\n+/, '') + dst.slice(bi);
const tmp = DST + '.tmp';
const fd = fs.openSync(tmp, 'w');
fs.writeFileSync(fd, dst, 'utf8');
fs.fsyncSync(fd);
fs.closeSync(fd);
fs.renameSync(tmp, DST);
console.log('   已写入 tools/_shared/admin.html（组件 ' + Math.round(snippet.length / 1024) + 'KB）');

/* ---------- ② 重建演示页（样式 + 脚本都要换，只换脚本会留下旧 CSS 导致新形态没样式） ---------- */
let page = fs.readFileSync(DEMO, 'utf8');

/* ②-1 组件 CSS：替换演示页 <style> 中 .sel 起 → .form-hint 止的那一段 */
const cs = page.indexOf('.sel { position: relative; }');
const ce = page.indexOf(HINT);
if (cs < 0 || ce < 0 || ce < cs) throw new Error('演示页未找到组件 CSS 区段');
page = page.slice(0, cs) + compCss + page.slice(ce + HINT.length);
console.log('② 演示页组件 CSS 已同步（' + Math.round(compCss.length / 1024) + 'KB）');

/* ②-2 组件脚本 */
const sIdx = page.lastIndexOf('<script>');
const eIdx = page.indexOf('</script>', sIdx);
if (sIdx < 0 || eIdx < 0) throw new Error('演示页未找到组件脚本块');
const demoScript = [
  compConsts, selIcons, fnFloat, fnUnfloat, fnSel, fnDate, fnRange, fnUI,
  `try { upgradeUI(document); } catch (e) { window.__errs.push('upgradeUI: ' + e.message); }
document.getElementById('err').textContent = window.__errs.length ? ('脚本错误：' + window.__errs.join(' | ')) : '';`
].join('\n\n');
page = page.slice(0, sIdx) + '<script>\n' + demoScript + '\n</script>' + page.slice(eIdx + 9);
fs.writeFileSync(DEMO, page, 'utf8');
console.log('   演示页组件脚本已同步，总计', Math.round(page.length / 1024) + 'KB');

console.log('\n完成。下一步：语法与渲染自检（node --check 不适用内联脚本，用浏览器打开演示页看 #err 是否为空）。');
