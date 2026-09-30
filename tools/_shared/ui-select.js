/* ui-select.js —— 全站统一下拉 / 日期组件（.sel / .cal）
 * 由 tools/_shared/admin.html 内联副本抽取，逻辑完全一致；请勿手改本文件，改源件后重跑 _extract_components.py。
 * 升级范围：select.form-select / input[type=date] / input[type=date][data-cal-range]。
 * 工具页只需给 select 加 class="form-select" 即可被自动升级（含动态渲染的 MutationObserver）。
 * 额外：原生 select 的 disabled 会透传到触发器（后台无 disabled 控件，此处为工具页补全）。
 */
(function(){
  function __sel_init(){

  var SEL_CHEVRON = '<svg class="sel-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
  var SEL_CHECK = '<svg class="sel-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  var SEL_ICONS = {
    home:     "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/></svg>",
    star:     "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/></svg>",
    bell:     "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.73 21a2 2 0 0 1-3.46 0'/></svg>",
    user:     "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>",
    image:    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>",
    tag:      "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z'/><line x1='7' y1='7' x2='7.01' y2='7'/></svg>",
    folder:   "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'/></svg>",
    file:     "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/></svg>",
    link:     "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/></svg>",
    calendar: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>",
    search:   "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>",
    plus:     "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>",
    check:    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>",
    eye:      "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>",
    grid:     "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='7' height='7'/><rect x='14' y='3' width='7' height='7'/><rect x='14' y='14' width='7' height='7'/><rect x='3' y='14' width='7' height='7'/></svg>",
    layers:   "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polygon points='12 2 2 7 12 12 22 7 12 2'/><polyline points='2 17 12 22 22 17'/><polyline points='2 12 12 17 22 12'/></svg>"
  };
/* 浮层定位：把面板挂到 document.body 并用 position:fixed 定位，
   彻底摆脱祖先的 overflow 裁剪（如 .viewport-wrap / .modal-box）与层叠上下文
   （transform / filter / backdrop-filter / 动画填充）导致的「下拉被遮挡」问题。
   打开时移出 wrap，关闭时放回 wrap；打开期间滚动 / 缩放自动跟随。 */
function floatPanel(panel, wrap) {
  var r = wrap.getBoundingClientRect();
  if (panel.parentNode !== document.body) document.body.appendChild(panel);
  panel.style.position = 'fixed';
  panel.style.zIndex = '9999';
  panel.style.top = '-99999px';           /* 先离屏量尺寸，避免闪烁 */
  panel.style.left = '0px';
  if (panel.classList.contains('sel-panel')) {
    if (wrap.classList.contains('inline')) {
      panel.style.width = 'max-content';
      panel.style.minWidth = Math.round(r.width) + 'px';
      panel.style.maxWidth = 'min(300px, calc(100vw - 16px))';
    } else {
      panel.style.width = Math.round(r.width) + 'px';
      panel.style.minWidth = '';
      panel.style.maxWidth = 'calc(100vw - 16px)';
    }
  } else {                                 /* .cal-panel / .cal-panel.range 自带固定宽度，保留 */
    panel.style.width = '';
    panel.style.minWidth = '';
    panel.style.maxWidth = 'calc(100vw - 16px)';
  }
  var ph = panel.offsetHeight, pw = panel.offsetWidth;
  var left = r.left;
  if (left + pw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - pw);
  var top = r.bottom + 4;
  /* 垂直：默认向下，下方空间不足且上方够则向上展开 */
  if (top + ph > window.innerHeight - 8 && r.top - 4 - ph >= 8) top = r.top - 4 - ph;
  panel.style.left = Math.round(left) + 'px';
  panel.style.top = Math.round(top) + 'px';
  if (!wrap.__refloat) {
    wrap.__refloat = function () { floatPanel(panel, wrap); };
    window.addEventListener('scroll', wrap.__refloat, true);
    window.addEventListener('resize', wrap.__refloat);
  }
}
function unfloatPanel(panel, wrap) {
  if (wrap && wrap.__refloat) {
    window.removeEventListener('scroll', wrap.__refloat, true);
    window.removeEventListener('resize', wrap.__refloat);
    wrap.__refloat = null;
  }
  if (panel.parentNode === document.body && wrap) wrap.appendChild(panel);
  panel.style.position = ''; panel.style.top = ''; panel.style.left = '';
  panel.style.width = ''; panel.style.minWidth = ''; panel.style.maxWidth = ''; panel.style.zIndex = '';
}
function upgradeSelect(sel) {
    if (!sel || sel.dataset.selUpgraded === '1') return;
    sel.dataset.selUpgraded = '1';
    sel.tabIndex = -1;
    var multi = !!sel.multiple;
    var searchPh = sel.dataset.selSearch || '';

    var wrap = document.createElement('div');
    wrap.className = 'sel' + (sel.hasAttribute('data-sel-inline') ? ' inline' : '');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);

    var trigger = document.createElement('button');
    trigger.type = 'button';
    if (sel.disabled) trigger.disabled = true;
    /* 布尔型 data-* 属性：裸写（无值）时 dataset 取到 '' 是 falsy，用 dataset.xxx ? 判断会静默失效 —— 必须 hasAttribute */
    trigger.className = 'sel-trigger' + (sel.hasAttribute('data-sel-pill') ? ' pill' : '') + (sel.hasAttribute('data-sel-compact') ? ' compact' : '');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    var label = document.createElement('span');
    label.className = 'sel-label';
    trigger.appendChild(label);
    trigger.insertAdjacentHTML('beforeend', SEL_CHEVRON);
    wrap.appendChild(trigger);

    var panel = document.createElement('div');
    panel.className = 'sel-panel';
    panel.setAttribute('role', 'listbox');
    panel.hidden = true;
    wrap.appendChild(panel);

    var search = null;
    if (searchPh) {
      var sw = document.createElement('div');
      sw.className = 'sel-search';
      search = document.createElement('input');
      search.type = 'text';
      search.className = 'sel-search-input';
      search.placeholder = searchPh;
      sw.appendChild(search);
      panel.appendChild(sw);
      search.addEventListener('input', function () { filter(search.value); });
      search.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); if (items[cursor]) choose(items[cursor].dataset.value); }
      });
    }

    var items = [], optEls = [], cursor = 0;
    /* 多级展开（树形）：option 用 data-parent="父value" 声明父级；有子项的自动成为可展开分组。
       点击分组只展开/收起，不选中；搜索时自动展开命中路径（否则搜到的子项藏在折叠里看不见）。 */
    var byValue = {}, childMap = {}, expanded = {}, curQuery = '';
    var SEL_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

    function rebuild() {
      Array.prototype.slice.call(panel.querySelectorAll('.sel-option')).forEach(function (n) { n.remove(); });
      items = []; optEls = [];
      /* 先建索引：value → option，父 value → 子 option 列表 */
      byValue = {}; childMap = {};
      Array.prototype.forEach.call(sel.options, function (o) {
        byValue[o.value] = o;
        if (o.dataset.parent) (childMap[o.dataset.parent] = childMap[o.dataset.parent] || []).push(o);
      });
      function depthOf(o) {
        var d = 0, pv = o.dataset.parent;
        while (pv) { d++; var p = byValue[pv]; if (!p) break; pv = p.dataset.parent; }
        return d;
      }
      Array.prototype.forEach.call(sel.options, function (o) {
        var it = document.createElement('div');
        it.className = 'sel-option';
        it.setAttribute('role', 'option');
        it.dataset.value = o.value;
        it.dataset.text = o.textContent;
        if (o.dataset.parent) { it.dataset.parent = o.dataset.parent; it.style.paddingLeft = (10 + depthOf(o) * 15) + 'px'; }
        if (o.dataset.icon) {
          var ic = document.createElement('span');
          ic.className = 'sel-opt-icon';
          var icKey = o.dataset.icon;
          /* ① 先查图标表键名（推荐写法，属性里只有 [a-z0-9-]，无引号/转义风险）
             ② 兼容早期直接内联 SVG 的旧数据  ③ 其余当纯文字或 emoji
             ⚠ 不要反过来先测 /^</ —— 转义异常时会把 <svg…> 当纯文本打印出来 */
          var icHtml = (typeof SEL_ICONS[icKey] === 'string') ? SEL_ICONS[icKey]
            : ((window.SEL_ICONS && typeof window.SEL_ICONS[icKey] === 'string') ? window.SEL_ICONS[icKey] : '');
          if (icHtml) ic.innerHTML = icHtml;
          else if (/^</.test(icKey)) ic.innerHTML = icKey;
          else ic.textContent = icKey;
          it.appendChild(ic);
        }
        if (o.dataset.color) {
          var cd = document.createElement('i');
          cd.className = 'sel-opt-dot';
          cd.style.background = o.dataset.color;
          it.appendChild(cd);
        }
        var t = document.createElement('span');
        t.className = 'sel-opt-title';
        t.textContent = o.textContent;
        it.appendChild(t);
        if ((childMap[o.value] || []).length) {
          /* 分组项：带箭头，点击只展开/收起，不参与选中（故不插 check 勾） */
          it.classList.add('is-group');
          it.dataset.group = '1';
          it.setAttribute('aria-expanded', 'false');
          var ar = document.createElement('span');
          ar.className = 'sel-opt-arrow';
          ar.innerHTML = SEL_ARROW;
          it.appendChild(ar);
          it.addEventListener('click', function () {
            expanded[o.value] = !expanded[o.value];
            refresh();
          });
        } else {
          it.insertAdjacentHTML('beforeend', SEL_CHECK);
          it.addEventListener('click', function () { choose(o.value); });
        }
        panel.appendChild(it);
        items.push(it); optEls.push(o);
      });
      /* 已选中项所在路径默认展开，否则打开面板看不到当前值在哪个分组里 */
      Array.prototype.forEach.call(sel.options, function (o) {
        if (!o.selected) return;
        var pv = o.dataset.parent;
        while (pv) { expanded[pv] = true; var p = byValue[pv]; pv = p ? p.dataset.parent : ''; }
      });
      refresh();
    }

    /* 显隐 = 搜索命中 × 父级展开。搜索时忽略展开状态，保证命中项及其祖先可见。 */
    function hasDescMatch(v, s) {
      var kids = childMap[v] || [];
      for (var i = 0; i < kids.length; i++) {
        if (String(kids[i].textContent).toLowerCase().indexOf(s) >= 0) return true;
        if (hasDescMatch(kids[i].value, s)) return true;
      }
      return false;
    }
    function refresh() {
      var s = curQuery;
      items.forEach(function (it, i) {
        var o = optEls[i];
        var hit = !s || String(it.dataset.text).toLowerCase().indexOf(s) >= 0 || hasDescMatch(o.value, s);
        var pv = it.dataset.parent;
        var open = !pv || (s ? true : !!expanded[pv]);   /* 搜索时一律展开命中链 */
        it.hidden = !(hit && open);
      });
      items.forEach(function (it) {
        if (it.dataset.group === '1') {
          it.setAttribute('aria-expanded', String(!!s || !!expanded[it.dataset.value]));
        }
      });
      cursor = 0; paint();
    }
    function filter(q) { curQuery = String(q || '').trim().toLowerCase(); refresh(); }
    function paint() {
      items.forEach(function (it, i) { it.classList.toggle('is-cursor', i === cursor); });
      if (items[cursor]) items[cursor].scrollIntoView({ block: 'nearest' });
    }
    function sync() {
      if (multi) {
        label.innerHTML = '';
        Array.prototype.forEach.call(sel.options, function (o) {
          if (!o.selected) return;
          var chip = document.createElement('span');
          chip.className = 'sel-chip';
          if (o.dataset.color) {
            var d = document.createElement('i');
            d.className = 'sel-opt-dot';
            d.style.background = o.dataset.color;
            chip.appendChild(d);
          }
          var tx = document.createElement('span');
          tx.textContent = o.textContent;
          chip.appendChild(tx);
          var x = document.createElement('button');
          x.type = 'button';
          x.className = 'sel-chip-x';
          x.innerHTML = '&times;';
          x.title = '移除';
          x.addEventListener('click', function (ev) { ev.stopPropagation(); o.selected = false; fire(); sync(); });
          chip.appendChild(x);
          label.appendChild(chip);
        });
        if (!label.children.length) {
          label.textContent = sel.dataset.selPlaceholder || '请选择…';
          label.classList.add('is-empty');
        } else {
          label.classList.remove('is-empty');
        }
        items.forEach(function (it, i) { it.setAttribute('aria-selected', String(!!(optEls[i] && optEls[i].selected))); });
      } else {
        var cur = null;
        for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === sel.value) { cur = sel.options[i]; break; } }
        label.textContent = cur ? cur.textContent : '';
        items.forEach(function (it) { it.setAttribute('aria-selected', String(it.dataset.value === sel.value)); });
      }
    }
    function fire() { sel.dispatchEvent(new Event('change', { bubbles: true })); }
    function onDocDown(e) { if (!wrap.contains(e.target) && !panel.contains(e.target)) close(); }
    function open() {
      panel.hidden = false;
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      floatPanel(panel, wrap);
      if (search) { search.value = ''; filter(''); setTimeout(function () { search.focus(); }, 0); }
      var idx = 0;
      items.forEach(function (it, i) { if (it.getAttribute('aria-selected') === 'true') idx = i; });
      cursor = idx; paint();
      setTimeout(function () { document.addEventListener('mousedown', onDocDown, true); }, 0);
    }
    function close() {
      panel.hidden = true;
      unfloatPanel(panel, wrap);
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onDocDown, true);
    }
    function choose(v) {
      var o = null;
      for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === v) { o = sel.options[i]; break; } }
      if (!o) return;
      if (multi) { o.selected = !o.selected; fire(); sync(); }        // 多选：不关闭，可连选
      else { close(); if (sel.value === v) return; sel.value = v; fire(); sync(); }
    }
    /* 跳过隐藏项（折叠的 / 被搜索过滤掉的），否则键盘游标会停在看不见的选项上，Enter 会误选 */
    function move(d) {
      for (var i = 0; i < items.length; i++) {
        cursor = (cursor + d + items.length) % items.length;
        if (!items[cursor].hidden) break;
      }
      paint();
    }

    trigger.addEventListener('click', function () { panel.hidden ? open() : close(); });
    wrap.addEventListener('keydown', function (e) {
      if (panel.hidden) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[cursor]) choose(items[cursor].dataset.value); }
      else if (e.key === 'Tab') { close(); }
    });
    sel.addEventListener('change', sync);
    rebuild();
    sync();
    if (window.MutationObserver) {
      new MutationObserver(function () { rebuild(); sync(); }).observe(sel, { childList: true, subtree: true });
    }
  }
function upgradeDate(inp) {
    if (!inp || inp.dataset.calUpgraded === '1') return;
    inp.dataset.calUpgraded = '1';
    inp.tabIndex = -1;   /* 隐藏的原生输入不进 Tab 序：键盘交互统一走可见的 trigger */

    var WEEK = ['一', '二', '三', '四', '五', '六', '日'];   /* 周一起始（getDay(): 0=周日 → (d+6)%7 换算） */
    var wrap = document.createElement('div');
    wrap.className = 'cal';
    inp.parentNode.insertBefore(wrap, inp);
    wrap.appendChild(inp);

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cal-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    var label = document.createElement('span');
    label.className = 'cal-label';
    trigger.appendChild(label);
    trigger.insertAdjacentHTML('beforeend',
      '<svg class="cal-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>');
    /* 继承原生控件上的内联尺寸（如 style="max-width:160px"），否则替换后宽度会失控 */
    if (inp.style.maxWidth) trigger.style.maxWidth = inp.style.maxWidth;
    if (inp.style.minWidth) trigger.style.minWidth = inp.style.minWidth;
    wrap.appendChild(trigger);

    var panel = document.createElement('div');
    panel.className = 'cal-panel';
    panel.hidden = true;
    wrap.appendChild(panel);

    var curY, curM;          /* 当前展示的年月 */
    var cells = [];          /* 42 格（6 行 × 7 列，固定行数避免翻月时面板高度跳动） */
    var focused = '';        /* 键盘游标所在的 yyyy-mm-dd */

    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function parse(s) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    function inRange(d) {
      var v = ymd(d);
      if (inp.min && v < inp.min) return false;
      if (inp.max && v > inp.max) return false;
      return true;
    }
    var todayStr = ymd(new Date());

    function render() {
      panel.innerHTML = '';
      var head = document.createElement('div');
      head.className = 'cal-head';
      var prev = document.createElement('button');
      prev.type = 'button'; prev.className = 'cal-nav'; prev.setAttribute('aria-label', '上一月');
      prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
      var title = document.createElement('span');
      title.className = 'cal-title';
      title.textContent = curY + '年' + (curM + 1) + '月';
      var next = document.createElement('button');
      next.type = 'button'; next.className = 'cal-nav'; next.setAttribute('aria-label', '下一月');
      next.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
      head.appendChild(prev); head.appendChild(title); head.appendChild(next);
      panel.appendChild(head);

      var wk = document.createElement('div');
      wk.className = 'cal-week';
      WEEK.forEach(function (w) { var s = document.createElement('span'); s.textContent = w; wk.appendChild(s); });
      panel.appendChild(wk);

      var grid = document.createElement('div');
      grid.className = 'cal-grid';
      var startIdx = (new Date(curY, curM, 1).getDay() + 6) % 7;   /* 周一起始 */
      var start = new Date(curY, curM, 1 - startIdx);
      cells = [];
      for (var i = 0; i < 42; i++) {
        (function (d) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'cal-day';
          b.textContent = d.getDate();
          var key = ymd(d);
          b.dataset.date = key;
          if (d.getMonth() !== curM) b.classList.add('is-out');
          if (key === todayStr) b.classList.add('is-today');
          if (key === inp.value) b.classList.add('is-sel');
          if (!inRange(d)) b.disabled = true;
          b.addEventListener('click', function () { pick(key); });
          grid.appendChild(b);
          cells.push(b);
        })(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
      }
      panel.appendChild(grid);

      var foot = document.createElement('div');
      foot.className = 'cal-foot';
      var tBtn = document.createElement('button');
      tBtn.type = 'button'; tBtn.className = 'cal-btn'; tBtn.textContent = '今天';
      tBtn.addEventListener('click', function () { pick(todayStr); });
      var cBtn = document.createElement('button');
      cBtn.type = 'button'; cBtn.className = 'cal-btn muted'; cBtn.textContent = '清除';
      cBtn.addEventListener('click', function () { setVal(''); close(); trigger.focus(); });
      foot.appendChild(tBtn); foot.appendChild(cBtn);
      panel.appendChild(foot);
    }

    function step(n) {
      var d = new Date(curY, curM + n, 1);
      curY = d.getFullYear(); curM = d.getMonth();
      render();
      if (focused) moveCursorByDate(focused);
    }
    function moveCursor(i) {
      cells.forEach(function (c) { c.classList.remove('is-cursor'); });
      if (cells[i]) { cells[i].classList.add('is-cursor'); focused = cells[i].dataset.date; }
    }
    function moveCursorByDate(key) {
      for (var i = 0; i < cells.length; i++) { if (cells[i].dataset.date === key) { moveCursor(i); return; } }
    }
    function sync() {
      var d = parse(inp.value);
      label.textContent = d ? ymd(d) : (inp.dataset.calPlaceholder || '选择日期');
      label.classList.toggle('is-empty', !d);
    }
    function setVal(v) {
      if (inp.value === v) { sync(); return; }
      inp.value = v;
      inp.dispatchEvent(new Event('change', { bubbles: true }));   /* 走原有取值 / data-bind 链路 */
      sync();
    }
    function pick(key) { setVal(key); close(); trigger.focus(); }
    function onDocDown(e) { if (!wrap.contains(e.target) && !panel.contains(e.target)) close(); }
    function open() {
      var d = parse(inp.value) || new Date();
      curY = d.getFullYear(); curM = d.getMonth();
      render();
      panel.hidden = false;
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      floatPanel(panel, wrap);
      moveCursorByDate(inp.value || todayStr);
      setTimeout(function () { document.addEventListener('mousedown', onDocDown, true); }, 0);
    }
    function close() {
      panel.hidden = true;
      unfloatPanel(panel, wrap);
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onDocDown, true);
    }

    trigger.addEventListener('click', function () { panel.hidden ? open() : close(); });
    wrap.addEventListener('keydown', function (e) {
      if (panel.hidden) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); return; }
      var idx = -1;
      for (var i = 0; i < cells.length; i++) { if (cells[i].classList.contains('is-cursor')) { idx = i; break; } }
      if (idx < 0) idx = 0;
      if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(Math.min(idx + 1, cells.length - 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(Math.max(idx - 1, 0)); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(Math.min(idx + 7, cells.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(Math.max(idx - 7, 0)); }
      else if (e.key === 'PageDown') { e.preventDefault(); step(1); }
      else if (e.key === 'PageUp') { e.preventDefault(); step(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (cells[idx]) pick(cells[idx].dataset.date); }
      else if (e.key === 'Tab') { close(); }
    });
    inp.addEventListener('change', sync);   /* 外部 / 程序赋值改值时回显同步 */
    sync();
  }
function upgradeDateRange(inpS, inpE) {
    if (!inpS || !inpE) return;
    if (inpS.dataset.calUpgraded === '1' || inpE.dataset.calUpgraded === '1') return;
    inpS.dataset.calUpgraded = '1'; inpE.dataset.calUpgraded = '1';
    inpS.tabIndex = -1; inpE.tabIndex = -1;

    var MAX_DAYS = parseInt(inpS.dataset.calMaxspan || '', 10);   /* >0 时按天限制，否则按 1 个月 */
    var WEEK = ['一', '二', '三', '四', '五', '六', '日'];
    var wrap = document.createElement('div');
    wrap.className = 'cal';
    inpS.parentNode.insertBefore(wrap, inpS);
    wrap.appendChild(inpS);

    /* 结束输入移入同一 wrap 作为值源；它原来的容器若不再含其它字段则整体隐藏，
       否则表单里会留下一个「结束日期：」的空标签。 */
    var oldHost = inpE.parentNode;
    var otherFields = Array.prototype.filter.call(
      oldHost.querySelectorAll('input,select,textarea'), function (o) { return o !== inpE; });
    wrap.appendChild(inpE);
    if (!otherFields.length && oldHost !== wrap) oldHost.style.display = 'none';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cal-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    var label = document.createElement('span');
    label.className = 'cal-label';
    trigger.appendChild(label);
    trigger.insertAdjacentHTML('beforeend',
      '<svg class="cal-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>');
    wrap.appendChild(trigger);

    var panel = document.createElement('div');
    panel.className = 'cal-panel range';
    panel.hidden = true;
    wrap.appendChild(panel);

    var curY, curM, cells = [], focused = '';
    /* 草稿值：面板内的选择先落在这里，**点「确认」才写回原生 input**。
       这样误点不会立即生效（原实现选完即关闭并写入，容易选错）；
       直接关闭面板 / Esc / 点外部 = 放弃本次修改，保持原值。 */
    var draftS = inpS.value, draftE = inpE.value, okRef = null;

    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function parse(s) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    function maxEnd(s) {
      if (MAX_DAYS > 0) return new Date(s.getTime() + MAX_DAYS * 864e5);
      return new Date(s.getFullYear(), s.getMonth() + 1, s.getDate());
    }
    var todayStr = ymd(new Date());

    /* 区间着色：中段 in-range（浅底，grid 无 gap 故连成色带），两端主色实心；
       单日区间（只选了开始日）两端重合 → 仍是完整圆形。 */
    function paintRange(sv, ev) {
      var s = (sv === undefined) ? draftS : sv;
      var e = (ev === undefined) ? draftE : ev;
      cells.forEach(function (b) {
        var k = b.dataset.date;
        b.classList.remove('in-range', 'range-start', 'range-end');
        if (s && e && k >= s && k <= e) {
          b.classList.add('in-range');
          if (k === s) b.classList.add('range-start');
          if (k === e) b.classList.add('range-end');
        } else if (s && !e && k === s) {
          b.classList.add('range-start', 'range-end');
        }
      });
    }
    /* 鼠标悬停预览：已选开始、未选结束时，实时画出 [开始, 悬停] 的候选区间 */
    function preview(hoverKey) {
      var s = parse(draftS);
      if (!s || draftE || !hoverKey) { paintRange(); return; }
      var h = parse(hoverKey);
      if (!h || h <= s || h > maxEnd(s)) { paintRange(); return; }
      paintRange(draftS, hoverKey);
    }

    function monthBlock(y, m, withPrev, withNext) {
      var box = document.createElement('div');
      box.className = 'cal-month';
      var head = document.createElement('div');
      head.className = 'cal-head';
      function navBtn(dir, label) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'cal-nav'; b.setAttribute('aria-label', label);
        b.innerHTML = dir < 0
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        b.addEventListener('click', function () { step(dir); });
        return b;
      }
      function spacer() { var s = document.createElement('span'); s.style.width = '26px'; s.style.flex = 'none'; return s; }
      var title = document.createElement('span');
      title.className = 'cal-title';
      title.textContent = y + '年' + (m + 1) + '月';
      if (withPrev) head.appendChild(navBtn(-1, '上一月')); else head.appendChild(spacer());
      head.appendChild(title);
      if (withNext) head.appendChild(navBtn(1, '下一月')); else head.appendChild(spacer());
      box.appendChild(head);

      var wk = document.createElement('div');
      wk.className = 'cal-week';
      WEEK.forEach(function (w) { var s = document.createElement('span'); s.textContent = w; wk.appendChild(s); });
      box.appendChild(wk);

      var grid = document.createElement('div');
      grid.className = 'cal-grid';
      var startIdx = (new Date(y, m, 1).getDay() + 6) % 7;
      var start = new Date(y, m, 1 - startIdx);
      for (var i = 0; i < 42; i++) {
        (function (d) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'cal-day';
          b.textContent = d.getDate();
          var key = ymd(d);
          b.dataset.date = key;
          if (d.getMonth() !== m) b.classList.add('is-out');
          if (key === todayStr) b.classList.add('is-today');
          b.addEventListener('click', function () { pick(key); });
          b.addEventListener('mouseenter', function () { preview(key); });
          grid.appendChild(b);
          cells.push(b);
        })(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
      }
      box.appendChild(grid);
      return box;
    }

    function setHint() {
      var old = panel.querySelector('.cal-hint');
      if (old) old.parentNode.removeChild(old);
      var h = document.createElement('div');
      h.className = 'cal-hint';
      if (draftS && draftE) {
        var a = parse(draftS), b2 = parse(draftE);
        h.textContent = '已选 ' + draftS + ' → ' + draftE
          + '（共 ' + Math.round((b2 - a) / 864e5) + ' 天，点「确认」生效）';
      } else if (draftS) {
        h.innerHTML = '开始 ' + draftS + '，请选择结束日期（最多 '
          + (MAX_DAYS > 0 ? MAX_DAYS + ' 天' : '1 个月') + '）';
      } else {
        h.textContent = '请选择开始日期';
      }
      panel.insertBefore(h, panel.querySelector('.cal-months'));
    }

    function render() {
      panel.innerHTML = '';
      cells = [];
      var months = document.createElement('div');
      months.className = 'cal-months';
      var d0 = new Date(curY, curM, 1);
      var d1 = new Date(curY, curM + 1, 1);
      months.appendChild(monthBlock(d0.getFullYear(), d0.getMonth(), true, false));
      months.appendChild(monthBlock(d1.getFullYear(), d1.getMonth(), false, true));
      panel.appendChild(months);

      var foot = document.createElement('div');
      foot.className = 'cal-foot';
      var cBtn = document.createElement('button');
      cBtn.type = 'button'; cBtn.className = 'cal-btn muted'; cBtn.textContent = '清除';
      cBtn.addEventListener('click', function () {
        draftS = ''; draftE = ''; setHint(); paintRange(); updateFoot();
      });
      var okBtn = document.createElement('button');
      okBtn.type = 'button'; okBtn.className = 'cal-btn'; okBtn.textContent = '确认';
      okBtn.addEventListener('click', function () {
        if (!draftS || !draftE) return;                 /* 区间不完整时不提交，避免产生半截值 */
        setRange(draftS, draftE); close(); trigger.focus();
      });
      foot.appendChild(cBtn); foot.appendChild(okBtn);
      panel.appendChild(foot);
      okRef = okBtn;
      updateFoot();

      setHint();
      paintRange();
    }
    /* 只有起止都选了才允许确认 —— 防止误点一下就提交出「只有开始日」的半截区间 */
    function updateFoot() { if (okRef) okRef.disabled = !(draftS && draftE); }

    function step(n) {
      var d = new Date(curY, curM + n, 1);
      curY = d.getFullYear(); curM = d.getMonth();
      render();
      if (focused) moveCursorByDate(focused);
    }
    function setRange(sv, ev) {
      if (inpS.value !== sv) { inpS.value = sv; inpS.dispatchEvent(new Event('change', { bubbles: true })); }
      if (inpE.value !== ev) { inpE.value = ev; inpE.dispatchEvent(new Event('change', { bubbles: true })); }
      sync();
      if (!panel.hidden) { setHint(); paintRange(); }
    }
    /* 点击只更新草稿，**不关闭面板也不写回 input** —— 可反复调整，直到点「确认」。 */
    function pick(key) {
      var d = parse(key), s = parse(draftS);
      if (!s || draftE) { draftS = key; draftE = ''; }                  /* 第一轮：只设开始 */
      else if (d <= s || d > maxEnd(s)) { draftS = key; draftE = ''; }  /* 早于开始 / 超上限 → 重开一轮 */
      else { draftE = key; }
      setHint(); paintRange(); updateFoot();
    }
    function sync() {
      var s = inpS.value, e = inpE.value;
      label.textContent = s ? (e ? (s + ' → ' + e) : (s + ' → …')) : (inpS.dataset.calPlaceholder || '选择日期范围');
      label.classList.toggle('is-empty', !s);
    }
    function moveCursor(i) {
      cells.forEach(function (c) { c.classList.remove('is-cursor'); });
      if (cells[i]) { cells[i].classList.add('is-cursor'); focused = cells[i].dataset.date; }
    }
    function moveCursorByDate(key) {
      for (var i = 0; i < cells.length; i++) { if (cells[i].dataset.date === key) { moveCursor(i); return; } }
    }
    function onDocDown(e) { if (!wrap.contains(e.target) && !panel.contains(e.target)) close(); }
    function open() {
      var d = parse(inpS.value) || new Date();
      /* 每次打开以「已确认值」为起点：上次未确认就关掉的选择自动作废 */
      draftS = inpS.value; draftE = inpE.value;
      curY = d.getFullYear(); curM = d.getMonth();
      render();
      panel.hidden = false;
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      floatPanel(panel, wrap);
      moveCursorByDate(inpS.value || todayStr);
      setTimeout(function () { document.addEventListener('mousedown', onDocDown, true); }, 0);
    }
    function close() {
      panel.hidden = true;
      unfloatPanel(panel, wrap);
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onDocDown, true);
    }

    trigger.addEventListener('click', function () { panel.hidden ? open() : close(); });
    panel.addEventListener('mouseleave', function () { preview(null); });
    wrap.addEventListener('keydown', function (e) {
      if (panel.hidden) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); return; }
      var idx = -1;
      for (var i = 0; i < cells.length; i++) { if (cells[i].classList.contains('is-cursor')) { idx = i; break; } }
      if (idx < 0) idx = 0;
      if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(Math.min(idx + 1, cells.length - 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(Math.max(idx - 1, 0)); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(Math.min(idx + 7, cells.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(Math.max(idx - 7, 0)); }
      else if (e.key === 'PageDown') { e.preventDefault(); step(1); }
      else if (e.key === 'PageUp') { e.preventDefault(); step(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (cells[idx]) pick(cells[idx].dataset.date); }
      else if (e.key === 'Tab') { close(); }
    });
    inpS.addEventListener('change', sync);
    inpE.addEventListener('change', sync);
    sync();
  }
function upgradeUI(root) {
    var scope = root || document;
    /* 先处理范围选择：两个 input 用同一个 data-cal-range 组名配对（按 DOM 顺序 = 开始、结束） */
    var groups = {}, order = [];
    Array.prototype.forEach.call(scope.querySelectorAll('input[type="date"][data-cal-range]'), function (inp) {
      var g = inp.dataset.calRange;
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(inp);
    });
    order.forEach(function (g) {
      if (groups[g].length >= 2) upgradeDateRange(groups[g][0], groups[g][1]);
    });
    /* 其余控件：已升级过的（含 range 的两个 input）靠 dataset 标记自动跳过 */
    Array.prototype.forEach.call(scope.querySelectorAll('select.form-select'), upgradeSelect);
    Array.prototype.forEach.call(scope.querySelectorAll('input[type="date"]'), upgradeDate);
  }

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
  /* 初始扫描：upgradeUI 会查询 select.form-select / input[type=date]，能覆盖静态 DOM；
     visit() 因 document.nodeType!==1 会直接返回，原本只适合 MutationObserver 增量节点。 */
  upgradeUI(document);
  if (window.MutationObserver) {
    var timer = null, pending = [];
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { pending.push(n); }); });
      clearTimeout(timer);
      timer = setTimeout(function () { var b = pending; pending = []; b.forEach(visit); }, 30);
    }).observe(document.body, { childList: true, subtree: true });
  }
})();

  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', __sel_init);
  else __sel_init();
})();
