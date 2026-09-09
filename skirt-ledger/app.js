/* 裙子账本 —— 数据全部存在本机 localStorage
   金额口径：总价 = 定金 + 尾款；尾款没付清的部分算「待付尾款」；配饰单独记，不进裙子总价 */
(function () {
  'use strict';

  var STORE_KEY = 'skirt_ledger_v1';
  var VERSION = 'v8';

  var TYPES = ['JSK', 'OP', 'SK', '开衫', '衬衫'];
  var TYPE_EMOJI = { 'JSK': '🎀', 'OP': '👗', 'SK': '🥻', '开衫': '🧥', '衬衫': '👚' };
  var OLD_TYPE_MAP = { '连衣裙': 'OP', '半身裙': 'SK', 'A字裙': 'SK', '包臀裙': 'SK', '百褶裙': 'SK', '吊带裙': 'OP', '其他': 'SK' };
  var COLORS = [
    { n: '黑', c: '#3A3A3C' }, { n: '白', c: '#F4F1EC' }, { n: '米杏', c: '#E3D3BE' },
    { n: '粉', c: '#F3B8C4' }, { n: '红', c: '#D9565F' }, { n: '蓝', c: '#7E9CC7' },
    { n: '绿', c: '#7FAE8B' }, { n: '黄', c: '#EFC163' }, { n: '紫', c: '#A88BC0' },
    { n: '灰', c: '#A8A5A4' }, { n: '棕', c: '#A87B5C' }, { n: '花色', c: 'linear-gradient(135deg,#F3B8C4,#7E9CC7)' }
  ];
  var GRADIENTS = [
    'linear-gradient(135deg,#FBD3D8,#F8E2D2)',
    'linear-gradient(135deg,#E3D9F5,#F5DCEA)',
    'linear-gradient(135deg,#D9EBE4,#F3EDD6)',
    'linear-gradient(135deg,#FCE1D4,#F6D9E2)',
    'linear-gradient(135deg,#DCE6F7,#EEDCF1)',
    'linear-gradient(135deg,#F6EEDC,#E4EFE3)'
  ];
  var SORTS = [
    { k: 'new', t: '最新' }, { k: 'ph', t: '价高' }, { k: 'pl', t: '价低' }, { k: 'due', t: '待付' }
  ];

  var state = { items: [], filter: 'all', sort: 'new', q: '', type: '', colors: [], hasAcc: 'no' };

  /* ---------------- 工具 ---------------- */
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function money(n) {
    n = Number(n) || 0;
    return n.toLocaleString('zh-CN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function grad(id) { return GRADIENTS[hash(String(id)) % GRADIENTS.length]; }
  function emojiOf(it) { return TYPE_EMOJI[it.type] || '👗'; }
  // 名称（系列）单独存，款式单独存；展示时拼成「系列 款式」
  function displayName(it) { return (it.name || '') + (it.style ? ' ' + it.style : ''); }
  function colorHex(name) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].n === name) return COLORS[i].c;
    return '#DDD';
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer = setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  /* 金额 */
  function totalOf(it) { return (Number(it.deposit) || 0) + (Number(it.balance) || 0); }
  function paidOf(it) { return (Number(it.deposit) || 0) + (it.paid === false ? 0 : (Number(it.balance) || 0)); }
  function dueOf(it) { return it.paid === false ? (Number(it.balance) || 0) : 0; }
  // 配饰：既支持「定金+尾款」，也支持「全款」
  function accTotalOf(a) {
    if (!a) return 0;
    return a.mode === 'full' ? (Number(a.full) || 0) : ((Number(a.deposit) || 0) + (Number(a.balance) || 0));
  }
  function accDueOf(a) {
    if (!a || a.mode !== 'split') return 0;
    return a.paid === false ? (Number(a.balance) || 0) : 0;
  }
  function accOf(it) {
    return (it.acc || []).reduce(function (a, b) { return a + accTotalOf(b); }, 0);
  }
  function accDueSum(it) {
    return (it.acc || []).reduce(function (a, b) { return a + accDueOf(b); }, 0);
  }

  /* ---------------- 存取 ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      state.items = raw ? JSON.parse(raw) : [];
    } catch (e) { state.items = []; }
    migrate();
  }
  function migrate() {
    var dirty = false;
    state.items = state.items.map(function (it) {
      if (typeof it.deposit === 'undefined') {
        it.deposit = Number(it.price) || 0;
        it.balance = 0;
        it.paid = true;
        dirty = true;
      }
      if (typeof it.paid === 'undefined') { it.paid = true; dirty = true; }
      if (typeof it.style === 'undefined') { it.style = ''; dirty = true; }
      if (it.type && TYPES.indexOf(it.type) < 0) {
        it.type = OLD_TYPE_MAP[it.type] || '';
        dirty = true;
      }
      if (typeof it.acc === 'undefined') { it.acc = []; }
      if (it.acc && it.acc.length) {
        it.acc = it.acc.map(function (a) {
          if (typeof a.mode !== 'undefined' || typeof a.full !== 'undefined') {
            if (typeof a.style === 'undefined') a.style = '';
            return a;
          }
          dirty = true;
          return { name: a.name || '', style: '', mode: 'full', deposit: 0, balance: 0, paid: true, full: Number(a.price) || 0 };
        });
      }
      delete it.price;
      delete it.wears;
      return it;
    });
    if (dirty) save();
  }
  /* stripOnFull=true 时（用户主动保存），存满才允许牺牲照片保住金额；
     自动保存（如数据迁移）绝不能这么做，否则会悄悄清掉用户照片 */
  function save(stripOnFull) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.items));
      return true;
    } catch (e) {
      if (stripOnFull) {
        try {
          var stripped = state.items.map(function (it) { return Object.assign({}, it, { photo: '' }); });
          localStorage.setItem(STORE_KEY, JSON.stringify(stripped));
          toast('存储满了！金额已存下，照片没存住');
          return false;
        } catch (e2) {
          toast('彻底存不下了，先导出备份');
          return false;
        }
      }
      toast('存不下了！去 统计→数据 压缩照片');
      return false;
    }
  }
  /* localStorage 占用估算（UTF-8 字节） */
  function usedBytes() {
    try { return new Blob([localStorage.getItem(STORE_KEY) || '']).size; }
    catch (e) { return 0; }
  }
  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  }
  function renderStorage() {
    var el = $('#storage-info');
    if (!el) return;
    var b = usedBytes();
    var pct = b / (5 * 1024 * 1024) * 100;
    var color = pct > 80 ? 'var(--danger)' : (pct > 50 ? '#C98A2E' : 'var(--muted)');
    el.innerHTML = '已占用 <b style="color:' + color + '">' + fmtSize(b) + '</b> <span style="color:var(--muted)">（浏览器上限约 5 MB）</span>';
  }
  /* 把已存的照片重压一遍，腾出空间 */
  function slimPhotos() {
    var list = state.items.filter(function (it) { return it.photo && it.photo.indexOf('data:image') === 0; });
    if (!list.length) { toast('还没有照片可以压缩'); return; }
    var i = 0;
    function next() {
      if (i >= list.length) {
        save(true); renderAll();
        toast('压缩了 ' + list.length + ' 张照片');
        return;
      }
      var it = list[i++];
      var img = new Image();
      img.onload = function () {
        var max = 420;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        it.photo = c.toDataURL('image/jpeg', 0.55);
        next();
      };
      img.onerror = next;
      img.src = it.photo;
    }
    next();
  }

  /* ---------------- 图片压缩 ---------------- */
  function compress(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 560;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.62));
      };
      img.onerror = function () { toast('这张图读不了'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------------- 视图切换 ---------------- */
  function switchView(name) {
    ['closet', 'stats', 'add'].forEach(function (v) {
      $('#view-' + v).classList.toggle('hidden', v !== name);
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
    window.scrollTo(0, 0);
    if (name === 'add') $('#f-name').focus();
  }

  /* ---------------- 衣柜页 ---------------- */
  function renderSummary() {
    var n = state.items.length;
    var skirtTotal = state.items.reduce(function (a, b) { return a + totalOf(b); }, 0);
    var skirtPaid = state.items.reduce(function (a, b) { return a + paidOf(b); }, 0);
    var skirtDue = skirtTotal - skirtPaid;
    var accTotal = state.items.reduce(function (a, b) { return a + accOf(b); }, 0);
    var accDue = state.items.reduce(function (a, b) { return a + accDueSum(b); }, 0);
    var totalDue = skirtDue + accDue;
    var avg = n ? skirtTotal / n : 0;
    var thisMonth = 0, now = new Date();
    state.items.forEach(function (it) {
      var d = new Date(it.date || it.createdAt);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) thisMonth += totalOf(it);
    });
    var foot =
      '<div>已付<b>¥' + money(Math.round(skirtPaid + (accTotal - accDue))) + '</b></div>' +
      '<div>待付尾款<b>¥' + money(Math.round(totalDue)) + '</b></div>' +
      '<div>平均单价<b>¥' + money(Math.round(avg)) + '</b></div>' +
      '<div>本月新增<b>¥' + money(Math.round(thisMonth)) + '</b></div>' +
      (accTotal > 0 ? '<div>配饰合计<b>¥' + money(Math.round(accTotal)) + '</b></div>' : '');
    $('#summary').innerHTML =
      '<div class="big">' +
      '<div><div class="num">' + n + '<span class="unit">条</span></div><div class="label">我的裙子</div></div>' +
      '<div class="divider"></div>' +
      '<div><div class="num">¥' + money(Math.round(skirtTotal)) + '</div><div class="label">裙子总价</div></div>' +
      '</div>' +
      '<div class="foot">' + foot + '</div>';
  }

  function renderChips() {
    var counts = {};
    state.items.forEach(function (it) { var t = it.type || '其他'; counts[t] = (counts[t] || 0) + 1; });
    var html = '<button class="chip' + (state.filter === 'all' ? ' on' : '') + '" data-f="all" type="button">全部<span class="cnt">' + state.items.length + '</span></button>';
    TYPES.forEach(function (t) {
      if (!counts[t]) return;
      html += '<button class="chip' + (state.filter === t ? ' on' : '') + '" data-f="' + esc(t) + '" type="button">' + esc(t) + '<span class="cnt">' + counts[t] + '</span></button>';
    });
    $('#chips').innerHTML = html;
    $('#chips').querySelectorAll('.chip').forEach(function (c) {
      c.onclick = function () { state.filter = c.dataset.f; renderCloset(); };
    });
  }

  function visible() {
    var q = state.q.trim().toLowerCase();
    var list = state.items.filter(function (it) {
      if (state.filter !== 'all' && (it.type || '其他') !== state.filter) return false;
      if (q) {
        var hay = [displayName(it), it.brand, it.color, it.note].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var s = state.sort;
    list.sort(function (a, b) {
      if (s === 'ph') return totalOf(b) - totalOf(a);
      if (s === 'pl') return totalOf(a) - totalOf(b);
      if (s === 'due') return dueOf(b) - dueOf(a);
      return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
    });
    return list;
  }

  function renderCloset() {
    renderSummary();
    renderChips();
    var list = visible();
    var grid = $('#grid'), empty = $('#empty');
    if (!state.items.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      empty.innerHTML = '<span class="e">🎀</span><p>衣柜还是空的。<br>点下面的「记一条」，把第一条裙子收进来。</p>' +
        '<button class="pill primary" id="btn-demo" type="button">先放 5 条示例看看</button>' +
        '<button class="pill ghost" style="margin-top:10px" id="btn-goadd" type="button">我自己记</button>';
      $('#btn-demo').onclick = seed;
      $('#btn-goadd').onclick = function () { resetForm(); switchView('add'); };
      return;
    }
    empty.classList.add('hidden');
    if (!list.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      empty.innerHTML = '<span class="e">🔍</span><p>没有符合条件的裙子</p>';
      return;
    }
    grid.innerHTML = list.map(function (it) {
      var thumb = it.photo ? '<img src="' + it.photo + '" alt="">' : '<span>' + emojiOf(it) + '</span>';
      var style = it.photo ? '' : ' style="background:' + grad(it.id) + '"';
      var due = dueOf(it) + accDueSum(it);
      var acc = accOf(it);
      var right = due
        ? '<span class="card-due">待付 ¥' + money(Math.round(due)) + '</span>'
        : '<span class="card-wear">' + (Number(it.balance) > 0 ? '已付清' : '全款') + '</span>';
      var accTag = (it.acc && it.acc.length) ? '<span class="tag-right">🎀</span>' : '';
      var accLine = acc > 0 ? '<div class="card-acc">配饰 ¥' + money(acc) + '</div>' : '';
      return '<div class="card-skirt" data-id="' + it.id + '">' +
        '<div class="thumb"' + style + '>' + thumb + '<span class="tag">' + esc(it.type || '其他') + '</span>' + accTag + '</div>' +
        '<div class="card-body">' +
        '<div class="card-name">' + esc(displayName(it)) + '</div>' +
        '<div class="card-meta"><span class="card-price">¥' + money(totalOf(it)) + '</span>' + right + '</div>' +
        accLine +
        '</div></div>';
    }).join('');
    grid.querySelectorAll('.card-skirt').forEach(function (el) {
      el.onclick = function () { openDetail(el.dataset.id); };
    });
  }

  /* ---------------- 详情 ---------------- */
  function openDetail(id) {
    var it = state.items.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var photo = it.photo ? '<img src="' + it.photo + '" alt="">' : '<span>' + emojiOf(it) + '</span>';
    var photoStyle = it.photo ? '' : ' style="background:' + grad(it.id) + '"';
    var due = dueOf(it);
    var acc = it.acc || [];

    var rows = '';
    rows += row('定金', '¥' + money(it.deposit));
    rows += row('尾款', '¥' + money(it.balance));
    rows += row('总价', '¥' + money(totalOf(it)));
    rows += row('状态', due ? '<span class="due-badge">待付 ¥' + money(Math.round(due)) + '</span>' : '已付清');
    if (it.type) rows += row('类型', esc(it.type));
    if (it.style) rows += row('款式', esc(it.style));
    if (it.color) rows += row('颜色', esc(it.color));
    if (it.brand) rows += row('品牌 / 店家', esc(it.brand));
    if (it.date) rows += row('购买日期', esc(it.date));

    var accHTML = '';
    if (acc.length) {
      var accRows = acc.map(function (a) {
        var txt;
        if (a.mode === 'full') txt = '全款 ¥' + money(a.full);
        else {
          txt = '定金 ¥' + money(a.deposit) + ' + 尾款 ¥' + money(a.balance);
          if (a.paid === false) txt += ' · <span class="due-badge">待付 ¥' + money(a.balance) + '</span>';
        }
        var label = esc(a.name || '配饰');
        return row(label, txt);
      }).join('');
      accHTML = '<div class="s-rows" style="margin-top:12px">' +
        accRows +
        row('<b>配饰合计</b>', '<b>¥' + money(accOf(it)) + '</b>') +
        '</div>';
    }

    $('#sheet').innerHTML =
      '<div class="sheet-grab"></div>' +
      '<div class="sheet-photo"' + photoStyle + '>' + photo + '</div>' +
      '<h3>' + esc(displayName(it)) + '</h3>' +
      '<div class="s-price">¥' + money(totalOf(it)) + '</div>' +
      '<div class="s-tags">' +
      (it.type ? '<span class="s-tag">' + esc(it.type) + '</span>' : '') +
      (it.style ? '<span class="s-tag">' + esc(it.style) + '</span>' : '') +
      (it.color ? '<span class="s-tag">' + esc(it.color) + '</span>' : '') +
      (it.brand ? '<span class="s-tag">' + esc(it.brand) + '</span>' : '') +
      (acc.length ? '<span class="s-tag">🎀 配饰 ' + acc.length + ' 件</span>' : '') +
      (due ? '<span class="s-tag" style="color:#D9534F">待付 ¥' + money(Math.round(due)) + '</span>' : '') +
      '</div>' +
      '<div class="s-rows">' + rows + '</div>' +
      accHTML +
      (it.note ? '<p class="s-note">' + esc(it.note) + '</p>' : '') +
      '<div class="sheet-actions">' +
      '<button class="pill ghost" id="d-edit" type="button">编辑</button>' +
      '<button class="pill warn" id="d-del" type="button">删除</button>' +
      '</div>';

    $('#sheet-mask').classList.remove('hidden');
    $('#sheet').classList.remove('hidden');
    $('#sheet').scrollTop = 0;

    $('#d-edit').onclick = function () { closeSheet(); fillForm(it); switchView('add'); };
    $('#d-del').onclick = function () {
      if (!confirm('确定删掉「' + it.name + '」？删了就找不回来了。')) return;
      state.items = state.items.filter(function (x) { return x.id !== id; });
      save(true); closeSheet(); renderAll(); toast('已删除');
    };
  }
  function row(k, v) { return '<div class="s-row"><span>' + k + '</span><span>' + v + '</span></div>'; }

  function closeSheet() {
    $('#sheet').classList.add('hidden');
    $('#sheet-mask').classList.add('hidden');
  }

  /* ---------------- 统计页 ---------------- */
  function renderStats() {
    var items = state.items;
    var n = items.length;
    var skirtTotal = items.reduce(function (a, b) { return a + totalOf(b); }, 0);
    var skirtPaid = items.reduce(function (a, b) { return a + paidOf(b); }, 0);
    var skirtDue = skirtTotal - skirtPaid;
    var accSum = items.reduce(function (a, b) { return a + accOf(b); }, 0);
    var accDue = items.reduce(function (a, b) { return a + accDueSum(b); }, 0);
    var totalDue = skirtDue + accDue;
    var totalPaid = skirtPaid + (accSum - accDue);
    var priciest = items.slice().sort(function (a, b) { return totalOf(b) - totalOf(a); })[0];
    var unpaidCount = items.filter(function (i) { return (dueOf(i) + accDueSum(i)) > 0; }).length;

    $('#stat-hero').innerHTML =
      cell('裙子总数', n + ' 条', true) +
      cell('裙子总价', '¥' + money(Math.round(skirtTotal)), true) +
      cell('已付金额', '¥' + money(Math.round(totalPaid))) +
      cell('待付尾款', '¥' + money(Math.round(totalDue))) +
      cell('平均单价', '¥' + money(n ? Math.round(skirtTotal / n) : 0)) +
      cell('最贵的一条', priciest ? '¥' + money(totalOf(priciest)) : '—') +
      cell('定金合计', '¥' + money(Math.round(items.reduce(function (a, b) { return a + (Number(b.deposit) || 0); }, 0)))) +
      cell('尾款合计', '¥' + money(Math.round(items.reduce(function (a, b) { return a + (Number(b.balance) || 0); }, 0)))) +
      cell('配饰合计', '¥' + money(Math.round(accSum))) +
      cell('总支出', '¥' + money(Math.round(skirtTotal + accSum))) +
      (unpaidCount ? cell('还没付清', unpaidCount + ' 条') : '');

    // 按类型
    var byType = {};
    items.forEach(function (i) { var t = i.type || '其他'; byType[t] = byType[t] || { n: 0, s: 0 }; byType[t].n++; byType[t].s += totalOf(i); });
    var tArr = Object.keys(byType).map(function (k) { return { k: k, n: byType[k].n, s: byType[k].s }; })
      .sort(function (a, b) { return b.s - a.s; });
    var tMax = tArr.length ? tArr[0].s : 1;
    $('#chart-type').innerHTML = tArr.length ? tArr.map(function (t) {
      return bar(t.k, '¥' + money(Math.round(t.s)), t.s / tMax, '');
    }).join('') : '<p class="card-sub">还没有数据</p>';

    // 近 6 个月
    var months = [], now = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.getFullYear() + '-' + d.getMonth(), label: (d.getMonth() + 1) + '月', s: 0 });
    }
    items.forEach(function (it) {
      var d = new Date(it.date || it.createdAt);
      months.forEach(function (m) { if (d.getFullYear() + '-' + d.getMonth() === m.key) m.s += totalOf(it); });
    });
    var mMax = Math.max.apply(null, months.map(function (m) { return m.s; }).concat([1]));
    $('#chart-month').innerHTML = '<div class="columns">' + months.map(function (m) {
      return '<div class="col"><div class="col-val">' + (m.s ? '¥' + money(Math.round(m.s)) : '') + '</div>' +
        '<div class="col-bar" style="height:' + (m.s ? Math.max(6, m.s / mMax * 78) : 3) + 'px"></div>' +
        '<div class="col-label">' + m.label + '</div></div>';
    }).join('') + '</div>';

    // 待付尾款（含配饰未付尾款）
    var dues = [];
    items.forEach(function (i) {
      if (dueOf(i) > 0) dues.push({ name: i.name, v: dueOf(i) });
      (i.acc || []).forEach(function (a) { if (accDueOf(a) > 0) dues.push({ name: (a.name || '配饰') + '·配饰', v: accDueOf(a) }); });
    });
    dues.sort(function (a, b) { return b.v - a.v; });
    var dMax = dues.length ? dues[0].v : 1;
    $('#chart-due').innerHTML = dues.length
      ? dues.map(function (d) { return bar(d.name, '¥' + money(Math.round(d.v)), d.v / dMax, ' due'); }).join('')
      : '<p class="card-sub">都付清了，一分不欠 🎉</p>';

    // 配饰明细
    var accList = [];
    items.forEach(function (it) {
      (it.acc || []).forEach(function (a) { accList.push({ name: (a.name || '配饰'), v: accTotalOf(a) }); });
    });
    accList.sort(function (a, b) { return b.v - a.v; });
    var aMax = accList.length ? accList[0].v : 1;
    $('#chart-acc').innerHTML = accList.length
      ? accList.slice(0, 10).map(function (a) { return bar(a.name, '¥' + money(a.v), a.v / aMax, ''); }).join('')
      : '<p class="card-sub">还没有登记配饰</p>';

    // 颜色
    var byColor = {};
    items.forEach(function (i) { var c = i.color || '未填'; byColor[c] = (byColor[c] || 0) + 1; });
    var cArr = Object.keys(byColor).sort(function (a, b) { return byColor[b] - byColor[a]; });
    $('#chart-color').innerHTML = cArr.length ? cArr.map(function (c) {
      return '<span class="swatch"><i style="background:' + colorHex(c) + '"></i>' + esc(c) + ' · ' + byColor[c] + '</span>';
    }).join('') : '<p class="card-sub">还没有数据</p>';
  }
  function bar(name, val, ratio, cls) {
    return '<div class="bar-row' + cls + '"><div class="bar-name">' + esc(name) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(6, ratio * 100) + '%"></div></div>' +
      '<div class="bar-val">' + val + '</div></div>';
  }
  function cell(label, val, rose) {
    return '<div><div class="s-label">' + label + '</div><div class="s-val' + (rose ? ' rose' : '') + '">' + val + '</div></div>';
  }

  /* ---------------- 表单 ---------------- */
  function buildPickers() {
    $('#pick-type').innerHTML = TYPES.map(function (t) {
      return '<button type="button" class="chip" data-v="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    $('#pick-color').innerHTML = COLORS.map(function (c) {
      return '<button type="button" class="chip" data-v="' + esc(c.n) + '"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + c.c + ';margin-right:5px"></i>' + esc(c.n) + '</button>';
    }).join('');
    // 类型：单选
    $('#pick-type').querySelectorAll('.chip').forEach(function (b) {
      b.onclick = function () {
        var on = b.classList.contains('on');
        $('#pick-type').querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
        if (!on) { b.classList.add('on'); state.type = b.dataset.v; } else { state.type = ''; }
      };
    });
    // 颜色：多选（同一款买了不同颜色可一次录多条）
    $('#pick-color').querySelectorAll('.chip').forEach(function (b) {
      b.onclick = function () {
        b.classList.toggle('on');
        state.colors = Array.prototype.map.call($('#pick-color').querySelectorAll('.chip.on'), function (x) { return x.dataset.v; });
        updateStlTotal();
      };
    });
  }
  function pickTypeOn(v) {
    $('#pick-type').querySelectorAll('.chip').forEach(function (b) {
      b.classList.toggle('on', b.dataset.v === v);
    });
  }
  function pickColorsOn(arr) {
    $('#pick-color').querySelectorAll('.chip').forEach(function (b) {
      b.classList.toggle('on', arr.indexOf(b.dataset.v) >= 0);
    });
  }

  /* 配饰：支持「定金+尾款」或「全款」，每条可带「款式」 */
  function accRowHTML(acc) {
    acc = acc || { name: '', style: '', mode: 'full', deposit: 0, balance: 0, paid: true, full: 0 };
    var mode = acc.mode || 'full';
    var splitOn = mode === 'split' ? ' on' : '';
    var fullOn = mode === 'full' ? ' on' : '';
    var splitHidden = mode === 'full' ? ' hidden' : '';
    var fullHidden = mode === 'split' ? ' hidden' : '';
    return '<div class="acc-row" data-mode="' + mode + '">' +
      '<div class="acc-head">' +
        '<input type="text" class="acc-name" placeholder="配饰名称，如 蝴蝶结KC" maxlength="20" value="' + esc(acc.name || '') + '">' +
      '</div>' +
      '<div class="acc-money">' +
        '<div class="acc-seg">' +
          '<button type="button" class="acc-seg-btn' + splitOn + '" data-v="split">定金+尾款</button>' +
          '<button type="button" class="acc-seg-btn' + fullOn + '" data-v="full">全款</button>' +
        '</div>' +
        '<div class="acc-split' + splitHidden + '">' +
          '<span class="acc-dep"><i>¥</i><input type="number" class="acc-deposit" placeholder="定金" min="0" step="0.01" inputmode="decimal" value="' + (mode === 'split' ? esc(acc.deposit || '') : '') + '"></span>' +
          '<span class="acc-bal"><i>¥</i><input type="number" class="acc-balance" placeholder="尾款" min="0" step="0.01" inputmode="decimal" value="' + (mode === 'split' ? esc(acc.balance || '') : '') + '"></span>' +
          '<label class="acc-paid"><input type="checkbox" class="acc-paid-cb"' + (acc.paid !== false ? ' checked' : '') + '>已付清</label>' +
        '</div>' +
        '<div class="acc-full' + fullHidden + '">' +
          '<span class="acc-f"><i>¥</i><input type="number" class="acc-full-in" placeholder="全款" min="0" step="0.01" inputmode="decimal" value="' + (mode === 'full' ? esc(acc.full || '') : '') + '"></span>' +
        '</div>' +
      '</div>' +
      '<div class="acc-foot">' +
        '<button type="button" class="acc-dup">复制一行</button>' +
        '<button type="button" class="acc-del">删除</button>' +
      '</div>' +
      '</div>';
  }
  function renderAcc(rows) {
    var list = (rows && rows.length) ? rows : [{ name: '', style: '', mode: 'full', deposit: 0, balance: 0, paid: true, full: 0 }];
    $('#acc-list').innerHTML = list.map(function (r) { return accRowHTML(r); }).join('');
    bindAcc();
  }
  function bindAcc() {
    $('#acc-list').querySelectorAll('.acc-del').forEach(function (b) {
      b.onclick = function () {
        b.closest('.acc-row').remove();
        if (!$('#acc-list').children.length) renderAcc([]);
        else updateAccTotal();
      };
    });
    $('#acc-list').querySelectorAll('.acc-dup').forEach(function (b) {
      b.onclick = function () {
        var row = b.closest('.acc-row');
        var clone = row.cloneNode(true);
        var nm = clone.querySelector('.acc-name');
        if (nm) nm.value = '';
        row.after(clone);
        bindAcc();
        if (nm) nm.focus();
      };
    });
    $('#acc-list').querySelectorAll('.acc-seg-btn').forEach(function (b) {
      b.onclick = function () {
        var row = b.closest('.acc-row');
        var v = b.dataset.v;
        row.dataset.mode = v;
        row.querySelectorAll('.acc-seg-btn').forEach(function (x) { x.classList.toggle('on', x === b); });
        row.querySelector('.acc-split').classList.toggle('hidden', v !== 'split');
        row.querySelector('.acc-full').classList.toggle('hidden', v !== 'full');
      };
    });
    $('#acc-list').querySelectorAll('input').forEach(function (i) { i.oninput = updateAccTotal; });
    updateAccTotal();
  }
  function accData() {
    return Array.prototype.map.call($('#acc-list').querySelectorAll('.acc-row'), function (r) {
      var name = r.querySelector('.acc-name').value.trim();
      if (r.dataset.mode === 'full') {
        var full = Number(r.querySelector('.acc-full-in').value) || 0;
        return { name: name, mode: 'full', deposit: 0, balance: 0, paid: true, full: full };
      }
      var dep = Number(r.querySelector('.acc-deposit').value) || 0;
      var bal = Number(r.querySelector('.acc-balance').value) || 0;
      var paid = r.querySelector('.acc-paid-cb').checked;
      return { name: name, mode: 'split', deposit: dep, balance: bal, paid: paid, full: 0 };
    }).filter(function (a) { return a.name || (a.mode === 'full' ? a.full : (a.deposit || a.balance)); });
  }
  function updateAccTotal() {
    var s = accData().reduce(function (a, b) { return a + accTotalOf(b); }, 0);
    $('#acc-total').textContent = '¥' + money(s);
  }
  function setSeg(v) {
    state.hasAcc = v;
    $('#seg-acc').querySelectorAll('.seg-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.v === v);
    });
    $('#acc-box').classList.toggle('hidden', v !== 'yes');
  }
  function setAcc(list) {
    if (list && list.length) { setSeg('yes'); renderAcc(list); }
    else { setSeg('no'); $('#acc-list').innerHTML = ''; updateAccTotal(); }
  }

  /* 款式子表：同一系列下逐条登记款式，每行一条裙子（可叠加上方颜色多选） */
  function stlRowHTML(stl) {
    stl = stl || { style: '', mode: 'split', deposit: 0, balance: 0, paid: true, full: 0 };
    var mode = stl.mode || 'split';
    var splitOn = mode === 'split' ? ' on' : '';
    var fullOn = mode === 'full' ? ' on' : '';
    var splitHidden = mode === 'full' ? ' hidden' : '';
    var fullHidden = mode === 'split' ? ' hidden' : '';
    return '<div class="acc-row stl-row" data-mode="' + mode + '">' +
      '<div class="acc-head">' +
        '<input type="text" class="stl-name acc-name" placeholder="款式，如 方领 / 方 / 立" maxlength="20" value="' + esc(stl.style || '') + '">' +
      '</div>' +
      '<div class="acc-money">' +
        '<div class="acc-seg">' +
          '<button type="button" class="acc-seg-btn' + splitOn + '" data-v="split">定金+尾款</button>' +
          '<button type="button" class="acc-seg-btn' + fullOn + '" data-v="full">全款</button>' +
        '</div>' +
        '<div class="acc-split' + splitHidden + '">' +
          '<span class="acc-dep"><i>¥</i><input type="number" class="stl-deposit" placeholder="定金" min="0" step="0.01" inputmode="decimal" value="' + (mode === 'split' ? esc(stl.deposit || '') : '') + '"></span>' +
          '<span class="acc-bal"><i>¥</i><input type="number" class="stl-balance" placeholder="尾款" min="0" step="0.01" inputmode="decimal" value="' + (mode === 'split' ? esc(stl.balance || '') : '') + '"></span>' +
          '<label class="acc-paid"><input type="checkbox" class="stl-paid-cb"' + (stl.paid !== false ? ' checked' : '') + '>已付清</label>' +
        '</div>' +
        '<div class="acc-full' + fullHidden + '">' +
          '<span class="acc-f"><i>¥</i><input type="number" class="stl-full-in" placeholder="全款" min="0" step="0.01" inputmode="decimal" value="' + (mode === 'full' ? esc(stl.full || '') : '') + '"></span>' +
        '</div>' +
      '</div>' +
      '<div class="acc-foot">' +
        '<button type="button" class="stl-dup acc-dup">复制一行</button>' +
        '<button type="button" class="stl-del acc-del">删除</button>' +
      '</div>' +
      '</div>';
  }
  function renderStl(rows) {
    var list = (rows && rows.length) ? rows : [{ style: '', mode: 'split', deposit: 0, balance: 0, paid: true, full: 0 }];
    $('#stl-list').innerHTML = list.map(function (r) { return stlRowHTML(r); }).join('');
    bindStl();
  }
  function bindStl() {
    $('#stl-list').querySelectorAll('.acc-del').forEach(function (b) {
      b.onclick = function () {
        b.closest('.acc-row').remove();
        if (!$('#stl-list').children.length) renderStl([]);
        else updateStlTotal();
      };
    });
    $('#stl-list').querySelectorAll('.acc-dup').forEach(function (b) {
      b.onclick = function () {
        var row = b.closest('.acc-row');
        var clone = row.cloneNode(true);
        var nm = clone.querySelector('.stl-name');
        if (nm) nm.value = '';
        row.after(clone);
        bindStl();
        if (nm) nm.focus();
      };
    });
    $('#stl-list').querySelectorAll('.acc-seg-btn').forEach(function (b) {
      b.onclick = function () {
        var row = b.closest('.acc-row');
        var v = b.dataset.v;
        row.dataset.mode = v;
        row.querySelectorAll('.acc-seg-btn').forEach(function (x) { x.classList.toggle('on', x === b); });
        row.querySelector('.acc-split').classList.toggle('hidden', v !== 'split');
        row.querySelector('.acc-full').classList.toggle('hidden', v !== 'full');
        updateStlTotal();
      };
    });
    $('#stl-list').querySelectorAll('input').forEach(function (i) {
      i.oninput = updateStlTotal;
      i.onchange = updateStlTotal;
    });
    updateStlTotal();
  }
  function stlData() {
    return Array.prototype.map.call($('#stl-list').querySelectorAll('.acc-row'), function (r) {
      var style = r.querySelector('.stl-name').value.trim();
      var m;
      if (r.dataset.mode === 'full') {
        // 全款直接折算成「定金=全款、尾款=0、已付清」，保证裙子字段口径统一
        var full = Number(r.querySelector('.stl-full-in').value) || 0;
        m = { style: style, mode: 'full', deposit: full, balance: 0, paid: true, full: full };
      } else {
        var dep = Number(r.querySelector('.stl-deposit').value) || 0;
        var bal = Number(r.querySelector('.stl-balance').value) || 0;
        var paid = r.querySelector('.stl-paid-cb').checked;
        m = { style: style, mode: 'split', deposit: dep, balance: bal, paid: paid, full: 0 };
      }
      m.money = (m.mode === 'full') ? m.full : (m.deposit + m.balance);
      return m;
    });
  }
  function stlValid(list) {
    return list.filter(function (m) { return m.money > 0 || m.style; });
  }
  function updateStlTotal() {
    var list = stlData();
    var valid = stlValid(list);
    var total = valid.reduce(function (a, b) { return a + (b.money || 0); }, 0);
    $('#stl-total').textContent = '¥' + money(total);
    var colorsN = state.colors.length || 1;
    $('#stl-count').textContent = valid.length ? ('将登记 ' + (valid.length * colorsN) + ' 条裙子') : '';
  }

  function showPhoto(url) {
    $('#photo-preview').src = url;
    $('#photo-preview').classList.remove('hidden');
    $('#photo-hint').classList.add('hidden');
    $('#btn-photo-remove').classList.remove('hidden');
  }
  function clearPhoto() {
    $('#photo-preview').removeAttribute('src');
    $('#photo-preview').classList.add('hidden');
    $('#photo-hint').classList.remove('hidden');
    $('#btn-photo-remove').classList.add('hidden');
    $('#f-photo-cam').value = '';
    $('#f-photo-lib').value = '';
  }

  function resetForm() {
    $('#f-id').value = '';
    $('#form').reset();
    state.type = ''; state.colors = [];
    pickTypeOn(''); pickColorsOn([]);
    clearPhoto();
    $('#f-date').value = todayStr();
    setAcc([]);
    renderStl([]);
    $('#btn-save').textContent = '保存';
  }
  function fillForm(it) {
    $('#f-id').value = it.id;
    $('#f-name').value = it.name || '';
    $('#f-date').value = it.date || '';
    $('#f-brand').value = it.brand || '';
    $('#f-note').value = it.note || '';
    state.type = it.type || ''; state.colors = it.color ? [it.color] : [];
    pickTypeOn(state.type); pickColorsOn(state.colors);
    if (it.photo) showPhoto(it.photo); else clearPhoto();
    setAcc(it.acc || []);
    var stl;
    if ((Number(it.balance) || 0) > 0) {
      stl = { style: it.style || '', mode: 'split', deposit: Number(it.deposit) || 0, balance: Number(it.balance) || 0, paid: it.paid !== false, full: 0 };
    } else {
      stl = { style: it.style || '', mode: 'full', deposit: 0, balance: 0, paid: true, full: Number(it.deposit) || 0 };
    }
    renderStl([stl]);
    $('#btn-save').textContent = '保存修改';
  }

  /* ---------------- 示例数据 ---------------- */
  function seed() {
    var now = new Date();
    function d(mAgo, day) { var d = new Date(now.getFullYear(), now.getMonth() - mAgo, day); return d.toISOString().slice(0, 10); }
    state.items = [
      { id: uid(), name: '草莓园', style: '方领', deposit: 200, balance: 399, paid: true, type: 'JSK', color: '红', brand: 'BABY', date: d(0, 4), note: '预售，尾款发货前补', acc: [{ name: '蝴蝶结 KC', mode: 'split', deposit: 40, balance: 48, paid: true, full: 0 }, { name: '裙撑', mode: 'full', deposit: 0, balance: 0, paid: true, full: 65 }], photo: '', createdAt: Date.now() },
      { id: uid(), name: '草莓园', style: '圆领', deposit: 200, balance: 420, paid: true, type: 'JSK', color: '红', brand: 'BABY', date: d(0, 4), note: '圆领版，同系列', acc: [{ name: '蝴蝶结 KC', mode: 'split', deposit: 40, balance: 48, paid: true, full: 0 }, { name: '裙撑', mode: 'full', deposit: 0, balance: 0, paid: true, full: 65 }], photo: '', createdAt: Date.now() },
      { id: uid(), name: '奶油杏', style: '', deposit: 268, balance: 0, paid: true, type: 'OP', color: '米杏', brand: 'Angelic Pretty', date: d(1, 12), note: '', acc: [], photo: '', createdAt: Date.now() },
      { id: uid(), name: '格纹', style: '', deposit: 120, balance: 180, paid: false, type: 'SK', color: '棕', brand: 'Innocent World', date: d(2, 20), note: '还没到补款期', acc: [{ name: '过膝袜', mode: 'full', deposit: 0, balance: 0, paid: true, full: 45 }], photo: '', createdAt: Date.now() },
      { id: uid(), name: '白色开衫', style: '', deposit: 99, balance: 0, paid: true, type: '开衫', color: '白', brand: '淘宝小店', date: d(3, 8), note: '夏天空调房穿', acc: [], photo: '', createdAt: Date.now() },
      { id: uid(), name: '彼得潘领衬衫', style: '', deposit: 158, balance: 0, paid: true, type: '衬衫', color: '白', brand: '表面美术馆', date: d(5, 15), note: '百搭内搭', acc: [], photo: '', createdAt: Date.now() }
    ];
    save(true); renderAll(); toast('放好啦，不喜欢可以清空');
  }

  /* ---------------- 备份 ---------------- */
  function exportData() {
    if (!state.items.length) { toast('还没有数据'); return; }
    var blob = new Blob([JSON.stringify({ app: 'skirt-ledger', version: 7, items: state.items }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '裙子账本备份-' + todayStr() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('已导出');
  }
  function importData(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        var arr = data.items || data;
        if (!Array.isArray(arr)) throw 0;
        if (!confirm('导入 ' + arr.length + ' 条记录，会覆盖现在的数据，继续？')) return;
        state.items = arr.map(function (it) {
          return {
            id: it.id || uid(), name: it.name || '未命名',
            style: it.style || '',
            deposit: Number(it.deposit) || (Number(it.price) || 0), balance: Number(it.balance) || 0,
            paid: it.paid !== false, type: it.type || '', color: it.color || '',
            brand: it.brand || '', date: it.date || '', note: it.note || '',
            acc: Array.isArray(it.acc) ? it.acc.map(function (a) {
              return {
                name: a.name || '',
                style: a.style || '',
                mode: a.mode === 'split' ? 'split' : 'full',
                deposit: Number(a.deposit) || 0,
                balance: Number(a.balance) || 0,
                paid: a.paid !== false,
                full: Number(a.full) || Number(a.price) || 0
              };
            }) : [],
            photo: it.photo || '', createdAt: it.createdAt || Date.now()
          };
        });
        migrate();
        save(true); renderAll(); toast('导入成功');
      } catch (e) { toast('文件格式不对'); }
    };
    r.readAsText(file);
  }

  /* ---------------- 初始化 ---------------- */
  function renderAll() { renderCloset(); renderStats(); renderStorage(); }

  function bind() {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.view;
        if (v === 'add') resetForm();
        switchView(v);
      };
    });

    $('#search').oninput = function () { state.q = this.value; renderCloset(); };

    $('#btn-sort').onclick = function () {
      var i = SORTS.map(function (s) { return s.k; }).indexOf(state.sort);
      state.sort = SORTS[(i + 1) % SORTS.length].k;
      this.textContent = SORTS.filter(function (s) { return s.k === state.sort; })[0].t;
      renderCloset();
    };

    // 图片：拍照 / 图库
    $('#btn-cam').onclick = function () { $('#f-photo-cam').click(); };
    $('#btn-lib').onclick = function () { $('#f-photo-lib').click(); };
    [['#f-photo-cam'], ['#f-photo-lib']].forEach(function (p) {
      $(p[0]).onchange = function () {
        var f = this.files && this.files[0];
        if (!f) return;
        compress(f, showPhoto);
        this.value = '';
      };
    });
    $('#btn-photo-remove').onclick = clearPhoto;

    // 配饰
    $('#seg-acc').querySelectorAll('.seg-btn').forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.v;
        setSeg(v);
        if (v === 'yes' && !$('#acc-list').children.length) renderAcc([]);
      };
    });
    $('#btn-add-acc').onclick = function () {
      $('#acc-list').insertAdjacentHTML('beforeend', accRowHTML('', ''));
      bindAcc();
      var rows = $('#acc-list').querySelectorAll('.acc-row');
      if (rows.length) rows[rows.length - 1].querySelector('input').focus();
    };

    $('#btn-add-stl').onclick = function () {
      $('#stl-list').insertAdjacentHTML('beforeend', stlRowHTML());
      bindStl();
      var rows = $('#stl-list').querySelectorAll('.acc-row');
      if (rows.length) rows[rows.length - 1].querySelector('.stl-name').focus();
    };

    $('#form').onsubmit = function (e) {
      e.preventDefault();
      var name = $('#f-name').value.trim();
      if (!name) { toast('给这个系列起个名字吧'); return; }
      var styles = stlValid(stlData());
      if (!styles.length) { toast('至少要填一个款式'); return; }
      if (!styles.some(function (s) { return s.money > 0; })) { toast('至少要给一个款式填金额'); return; }
      var acc = state.hasAcc === 'yes' ? accData() : [];
      if (state.hasAcc === 'yes' && acc.length && acc.some(function (a) { return !a.name; })) {
        toast('配饰还没写名字');
        return;
      }
      var colorsSel = state.colors.slice();
      if (!colorsSel.length) colorsSel = [''];
      var brand = $('#f-brand').value.trim();
      var date = $('#f-date').value;
      var note = $('#f-note').value.trim();
      var photo = $('#photo-preview').getAttribute('src') || '';
      var id = $('#f-id').value;
      if (id) {
        var s = styles[0];
        var col = colorsSel[0] || '';
        state.items = state.items.map(function (x) {
          return x.id === id ? Object.assign({}, x, {
            name: name, style: s.style, deposit: s.deposit, balance: s.balance, paid: s.paid,
            type: state.type, color: col, brand: brand, date: date,
            note: note, acc: acc, photo: photo
          }) : x;
        });
        toast('改好了');
      } else {
        var created = [];
        styles.forEach(function (s) {
          colorsSel.forEach(function (col) {
            created.push({
              id: uid(), createdAt: Date.now(),
              name: name, style: s.style, deposit: s.deposit, balance: s.balance, paid: s.paid,
              type: state.type, color: col, brand: brand, date: date,
              note: note, acc: acc, photo: photo
            });
          });
        });
        state.items = created.concat(state.items);
        toast('收进衣柜了 ' + created.length + ' 条 🎀');
      }
      save(true); renderAll(); resetForm(); switchView('closet');
    };
    $('#btn-cancel').onclick = function () { resetForm(); switchView('closet'); };

    $('#sheet-mask').onclick = closeSheet;

    $('#btn-export').onclick = exportData;
    $('#btn-import').onclick = function () { $('#import-file').click(); };
    $('#import-file').onchange = function () {
      if (this.files && this.files[0]) importData(this.files[0]);
      this.value = '';
    };
    $('#btn-slim').onclick = function () {
      var n = state.items.filter(function (it) { return it.photo; }).length;
      if (!n) { toast('还没有照片'); return; }
      if (!confirm('把 ' + n + ' 张照片压得更小（约原始体积的三分之一），腾出存储空间。画质会降一点，继续？')) return;
      slimPhotos();
    };

    $('#btn-clear').onclick = function () {
      if (!confirm('清空全部 ' + state.items.length + ' 条记录？建议先导出备份。')) return;
      state.items = []; save(); renderAll(); toast('已清空');
    };

    $('#btn-backup').onclick = function () {
      $('#sheet').innerHTML =
        '<div class="sheet-grab"></div><h3 style="margin-bottom:4px">数据备份</h3>' +
        '<p class="tiny" style="margin:0 0 12px">当前版本 ' + VERSION + '（看到 v8 就是最新的）</p>' +
        '<p class="s-note" style="margin-top:0">数据只存在这台手机的浏览器里。换手机、清缓存、卸载前，先导出一份 JSON 存到微信收藏或网盘。</p>' +
        '<div class="sheet-actions"><button class="pill primary small" id="bk-export" type="button">导出备份</button>' +
        '<button class="pill ghost small" id="bk-import" type="button">导入备份</button></div>' +
        '<div class="sheet-actions"><button class="pill warn" id="bk-clear" type="button">清空全部</button></div>';
      $('#sheet-mask').classList.remove('hidden');
      $('#sheet').classList.remove('hidden');
      $('#bk-export').onclick = function () { exportData(); closeSheet(); };
      $('#bk-import').onclick = function () { closeSheet(); $('#import-file').click(); };
      $('#bk-clear').onclick = function () {
        if (!confirm('清空全部 ' + state.items.length + ' 条记录？建议先导出备份。')) return;
        state.items = []; save(); renderAll(); closeSheet(); toast('已清空');
      };
    };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
    });
  }

  function init() {
    load();
    buildPickers();
    var ver = document.getElementById('app-ver');
    if (ver) ver.textContent = VERSION;
    bind();
    resetForm();
    renderAll();
    switchView('closet');

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
