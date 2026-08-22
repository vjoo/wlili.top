const fs = require('fs');
const p = 'tools/school-calendar.html';
let s = fs.readFileSync(p, 'utf8');
let failed = 0;
function rep(name, oldS, newS) {
  if (!s.includes(oldS)) { console.error('MISS: ' + name); failed++; return; }
  s = s.split(oldS).join(newS);
  console.log('ok [' + name + ']');
}

rep('year-a', '            <option value="2024-2025">2024-2025</option>\r\n', '');
rep('year-b', '            <option value="2025-2026">2025-2026</option>\r\n', '');

rep('ref-block', '      <!-- \u81ea\u5b9a\u4e49\u65e5\u671f\u6807\u6ce8 -->\r\n      <div style="margin-top:20px;">',
  '      <!-- \u65f6\u95f4\u5b89\u6392\u53c2\u8003\uff08\u968f\u5b66\u671f\u5207\u6362\uff09 -->\r\n      <div class="term-reference" id="termReference" style="margin-top:20px;"></div>\r\n\r\n      <!-- \u81ea\u5b9a\u4e49\u65e5\u671f\u6807\u6ce8 -->\r\n      <div style="margin-top:20px;">');

rep('css-patch', '  .checkbox-label {',
  '  .cal-table td .event-tag.tag-workday { background: #ef6c00; }\r\n\r\n  /* \u6708\u4efd\u5e95\u8272\uff08\u4e0d\u8986\u76d6 weekend/holiday \u7684 !important\uff09 */\r\n  .cal-table td.month-8 { background-color: #eef3ff; }\r\n  .cal-table td.month-9 { background-color: #eefaf0; }\r\n  .cal-table td.month-10 { background-color: #fff7e6; }\r\n  .cal-table td.month-11 { background-color: #f5eefb; }\r\n  .cal-table td.month-12 { background-color: #eaf7f9; }\r\n  .cal-table td.month-1 { background-color: #fff0f2; }\r\n  .cal-table td.month-8 .day-num { color: #3b6fd4; }\r\n  .cal-table td.month-9 .day-num { color: #2e7d32; }\r\n  .cal-table td.month-10 .day-num { color: #b26a00; }\r\n  .cal-table td.month-11 .day-num { color: #7b1fa2; }\r\n  .cal-table td.month-12 .day-num { color: #00796b; }\r\n  .cal-table td.month-1 .day-num { color: #c2185b; }\r\n  .cal-table td:not(.col-week) { overflow: hidden; }\r\n  .cal-table td .day-num { line-height: 1.3; }\r\n  .cal-table td .event-tag { line-height: 1.2; }\r\n  .term-reference { font-size: 13px; line-height: 1.8; color: var(--ink-secondary); background: var(--bg); border: 1px dashed var(--border); border-radius: var(--radius-md); padding: 10px 14px; }\r\n  .term-reference b { color: var(--ink); }\r\n\r\n  .checkbox-label {');

rep('zhongqiu', "{ date: '2026-09-01', name: '\u5f00\u5b66', type: 'start' },", "{ date: '2026-09-01', name: '\u5f00\u5b66', type: 'start' },\r\n            { date: '2026-09-20', name: '\u56fd\u5e86\u8c03\u4f11', type: 'workday' },\r\n            { date: '2026-09-25', name: '\u4e2d\u79cb\u8282', type: 'holiday' },\r\n            { date: '2026-09-26', name: '\u4e2d\u79cb\u8282', type: 'holiday' },\r\n            { date: '2026-09-27', name: '\u4e2d\u79cb\u8282', type: 'holiday' },");

rep('guoqing10', "{ date: '2026-10-07', name: '\u56fd\u5e86\u5047', type: 'holiday' },", "{ date: '2026-10-07', name: '\u56fd\u5e86\u5047', type: 'holiday' },\r\n            { date: '2026-10-10', name: '\u56fd\u5e86\u8c03\u4f11', type: 'workday' },");

rep('yuandan', "{ date: '2027-01-01', name: '\u5143\u65e6', type: 'holiday' }\r\n          ]", "{ date: '2027-01-01', name: '\u5143\u65e6', type: 'holiday' },\r\n            { date: '2027-01-02', name: '\u5143\u65e6', type: 'holiday' },\r\n            { date: '2027-01-03', name: '\u5143\u65e6', type: 'holiday' },\r\n            { date: '2027-01-04', name: '\u5143\u65e6\u8c03\u4f11', type: 'workday' }\r\n          ]");

rep('t2-dates', "          startDate: '2027-02-26',\r\n          registerDate: '2027-02-25',", "          startDate: '2027-02-22',\r\n          registerDate: '2027-02-21',");
rep('t2-reg-evt', "{ date: '2027-02-25', name: '\u62a5\u5230', type: 'start' },", "{ date: '2027-02-21', name: '\u62a5\u5230', type: 'start' },");
rep('t2-start-evt', "{ date: '2027-02-26', name: '\u5f00\u5b66', type: 'start' },", "{ date: '2027-02-22', name: '\u5f00\u5b66', type: 'start' },");

rep('qingming', "{ date: '2027-04-05', name: '\u6e05\u660e\u8282', type: 'holiday' },", "{ date: '2027-04-04', name: '\u6e05\u660e\u8282', type: 'holiday' },\r\n            { date: '2027-04-05', name: '\u6e05\u660e\u8282', type: 'holiday' },\r\n            { date: '2027-04-06', name: '\u6e05\u660e\u8282', type: 'holiday' },");

rep('laodong-adj', "{ date: '2027-05-05', name: '\u52b3\u52a8\u8282', type: 'holiday' },", "{ date: '2027-05-05', name: '\u52b3\u52a8\u8282', type: 'holiday' },\r\n            { date: '2027-05-09', name: '\u52b3\u52a8\u8282\u8c03\u4f11', type: 'workday' },");

rep('duanwu', "{ date: '2027-06-19', name: '\u7aef\u5348\u8282', type: 'holiday' }\r\n          ]", "{ date: '2027-06-19', name: '\u7aef\u5348\u8282', type: 'holiday' },\r\n            { date: '2027-06-20', name: '\u7aef\u5348\u8282', type: 'holiday' },\r\n            { date: '2027-06-21', name: '\u7aef\u5348\u8282', type: 'holiday' }\r\n          ]");

rep('gather-workday', "      if (ev.type === 'holiday') {", "      if (ev.type === 'holiday' || ev.type === 'workday') {");

rep('month-cls', "      var isWeekend = (j === 5 || j === 6);\r\n      var cls = isWeekend ? 'weekend' : '';", "      var isWeekend = (j === 5 || j === 6);\r\n      var cls = isWeekend ? 'weekend' : '';\r\n      cls += ' month-' + m;");

rep('ref-update', "  var tName = term === '1' ? '\u7b2c\u4e00\u5b66\u671f' : '\u7b2c\u4e8c\u5b66\u671f';\r\n  var title = year + '\u5b66\u5e74 ' + tName + ' \u6821\u5386';",
  "  var tName = term === '1' ? '\u7b2c\u4e00\u5b66\u671f' : '\u7b2c\u4e8c\u5b66\u671f';\r\n  var title = year + '\u5b66\u5e74 ' + tName + ' \u6821\u5386';\r\n\r\n  // \u65f6\u95f4\u5b89\u6392\u53c2\u8003\uff08\u6309\u5b66\u671f\u663e\u793a\uff09\r\n  var refEl = document.getElementById('termReference');\r\n  if (refEl) {\r\n    if (term === '1') {\r\n      refEl.innerHTML = '<b>\u65f6\u95f4\u5b89\u6392\u53c2\u8003\uff08\u7b2c\u4e00\u5b66\u671f\uff09</b><br>2026\u5e748\u670831\u65e5\u62a5\u5230\u6ce8\u518c\uff0c9\u67081\u65e5\u6b63\u5f0f\u4e0a\u8bfe\uff1b\u81f32027\u5e741\u670829\u65e5\u7ed3\u675f\uff0c1\u670830\u65e5\u8d77\u653e\u5bd2\u5047\u3002';\r\n    } else {\r\n      refEl.innerHTML = '<b>\u65f6\u95f4\u5b89\u6392\u53c2\u8003\uff08\u7b2c\u4e8c\u5b66\u671f\uff09</b><br>2027\u5e742\u670821\u65e5\u62a5\u5230\u6ce8\u518c\uff0c2\u670822\u65e5\u6b63\u5f0f\u4e0a\u8bfe\uff1b\u672c\u5b66\u671f\u4e8e7\u67084\u65e5\u7ed3\u675f\uff0c7\u67085\u65e5\u8d77\u653e\u6691\u5047\u3002';\r\n    }\r\n  }");

if (failed > 0) { console.error('FAILED COUNT: ' + failed); process.exit(1); }
fs.writeFileSync(p, s, 'utf8');
console.log('ALL DONE');