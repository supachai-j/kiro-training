/* Kiro Training Portal — shared behaviour:
   theme toggle · language toggle · TOC scroll-spy · progress tracking */
(function () {
  var root = document.documentElement;
  var PATH = location.pathname;
  var IS_TH = /(?:course|labs)-th\.html/.test(PATH);
  var L = IS_TH ? 'th' : 'en';

  /* ============ tiny localStorage JSON store ============ */
  function loadStore(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveStore(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
  }
  window.kiroProgress = {
    get: function (key, id) { return !!loadStore(key)[id]; },
    set: function (key, id, val) {
      var s = loadStore(key);
      if (val) s[id] = 1; else delete s[id];
      saveStore(key, s);
      try { window.dispatchEvent(new CustomEvent('kiro-progress', { detail: { key: key } })); } catch (e) {}
    },
    ids: function (key) { return Object.keys(loadStore(key)); },
    count: function (key) { return Object.keys(loadStore(key)).length; },
    clear: function (key) {
      saveStore(key, {});
      try { window.dispatchEvent(new CustomEvent('kiro-progress', { detail: { key: key } })); } catch (e) {}
    }
  };

  var MODULES_KEY = 'kiro-modules';   // ids: m0..m8
  var LABS_KEY = 'kiro-labs';         // ids: lab0..lab8
  var TOTAL_MODULES = 9;
  var TOTAL_LABS = 9;

  var T = {
    en: {
      moduleDone: function (n) { return 'Mark Module ' + n + ' as complete'; },
      labGuide: 'Open the full lab guide →',
      modProgress: function (d, t) { return 'Modules — ' + d + ' / ' + t + ' complete'; },
      labProgress: function (d, t) { return 'Labs — ' + d + ' / ' + t + ' done'; },
      reset: 'Reset progress',
      resetConfirm: 'Clear all saved progress on this browser?',
      startHere: 'Not started yet.',
      allDone: 'All done — nice work.'
    },
    th: {
      moduleDone: function (n) { return 'ทำบทที่ ' + n + ' เสร็จแล้ว'; },
      labGuide: 'เปิดคู่มือแล็บฉบับเต็ม →',
      modProgress: function (d, t) { return 'บทเรียน — เสร็จ ' + d + ' / ' + t; },
      labProgress: function (d, t) { return 'แล็บ — เสร็จ ' + d + ' / ' + t; },
      reset: 'ล้างความคืบหน้า',
      resetConfirm: 'ล้างความคืบหน้าที่บันทึกไว้บนเบราว์เซอร์นี้ทั้งหมด?',
      startHere: 'ยังไม่เริ่ม',
      allDone: 'เสร็จครบแล้ว — เยี่ยมมาก'
    }
  }[L];

  /* ---------- theme ---------- */
  try {
    var savedTheme = localStorage.getItem('kiro-theme');
    if (savedTheme) root.setAttribute('data-theme', savedTheme);
  } catch (e) {}

  function currentTheme() {
    return root.getAttribute('data-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  window.toggleTheme = function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('kiro-theme', next); } catch (e) {}
    updateThemeLabel();
    try { window.dispatchEvent(new CustomEvent('kiro-theme', { detail: next })); } catch (e) {}
  };
  window.kiroCurrentTheme = currentTheme;

  function updateThemeLabel() {
    var el = document.getElementById('theme-label');
    if (el) el.textContent = currentTheme() === 'dark' ? '☀︎' : '☾';
  }

  /* ---------- language ---------- */
  function applyLang(lang) {
    document.body.classList.remove('lang-en', 'lang-th');
    document.body.classList.add('lang-' + lang);
    root.setAttribute('lang', lang);
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang-btn') === lang);
    });
    try { localStorage.setItem('kiro-lang', lang); } catch (e) {}
  }
  window.setLang = applyLang;

  var startLang = 'en';
  try { startLang = localStorage.getItem('kiro-lang') || 'en'; } catch (e) {}

  /* ============ progress: shared bar element ============ */
  function bar(pct) {
    return '<div class="pbar"><span style="width:' + pct + '%"></span></div>';
  }

  /* ---- course pages: per-module done toggles + progress ---- */
  function initCourseProgress() {
    var content = document.querySelector('.course-shell .content');
    if (!content) return;
    var articles = [].slice.call(content.querySelectorAll('article[id]'))
      .filter(function (a) { return /^m\d+$/.test(a.id); });
    if (!articles.length) return;

    /* progress panel at the top of the content column */
    var panel = document.createElement('div');
    panel.className = 'progress-panel';
    panel.innerHTML =
      '<div class="progress-head"><strong data-modtext></strong>' +
      '<button type="button" class="btn btn-sm" data-reset>' + T.reset + '</button></div>' +
      '<div data-modbar></div>';
    content.insertBefore(panel, content.firstChild);

    /* a done-toggle at the end of each module article */
    articles.forEach(function (art) {
      var n = art.id.slice(1);
      var box = document.createElement('div');
      box.className = 'module-done';
      box.innerHTML = '<label><input type="checkbox" data-done="m' + n + '"> <span>' +
        T.moduleDone(n) + '</span></label>';
      art.appendChild(box);
    });

    content.querySelectorAll('input[data-done]').forEach(function (cb) {
      var id = cb.getAttribute('data-done');
      cb.checked = window.kiroProgress.get(MODULES_KEY, id);
      cb.addEventListener('change', function () {
        window.kiroProgress.set(MODULES_KEY, id, cb.checked);
      });
    });

    panel.querySelector('[data-reset]').addEventListener('click', function () {
      if (window.confirm(T.resetConfirm)) {
        window.kiroProgress.clear(MODULES_KEY);
        window.kiroProgress.clear(LABS_KEY);
        content.querySelectorAll('input[data-done]').forEach(function (cb) { cb.checked = false; });
      }
    });

    /* TOC check-marks */
    var tocLinks = {};
    document.querySelectorAll('.toc a[href^="#m"]').forEach(function (a) {
      var m = a.getAttribute('href').match(/^#(m\d+)$/);
      if (m) tocLinks[m[1]] = a;
    });

    function refresh() {
      var done = window.kiroProgress.count(MODULES_KEY);
      var pct = Math.round(done / TOTAL_MODULES * 100);
      panel.querySelector('[data-modtext]').textContent = T.modProgress(done, TOTAL_MODULES);
      panel.querySelector('[data-modbar]').innerHTML = bar(pct);
      Object.keys(tocLinks).forEach(function (id) {
        tocLinks[id].classList.toggle('done', window.kiroProgress.get(MODULES_KEY, id));
      });
    }
    window.addEventListener('kiro-progress', refresh);
    refresh();

    /* link each inline lab to its full guide */
    document.querySelectorAll('.lab').forEach(function (lab) {
      var label = lab.querySelector('.label');
      var m = label && label.textContent.match(/Lab\s+(\d+)/i);
      if (!m) return;
      var link = document.createElement('a');
      link.className = 'lab-guide-link';
      link.href = 'labs-' + L + '.html#lab' + m[1];
      link.textContent = T.labGuide;
      lab.appendChild(link);
    });
  }

  /* ---- labs page: per-lab done checkboxes + progress ---- */
  function initLabsProgress() {
    if (!document.body.classList.contains('page-labs')) return;
    var host = document.querySelector('[data-labs-progress]');

    document.querySelectorAll('input[data-lab-check]').forEach(function (cb) {
      var id = cb.getAttribute('data-lab-check');
      cb.checked = window.kiroProgress.get(LABS_KEY, id);
      cb.addEventListener('change', function () {
        window.kiroProgress.set(LABS_KEY, id, cb.checked);
      });
    });

    function refresh() {
      var done = window.kiroProgress.count(LABS_KEY);
      var pct = Math.round(done / TOTAL_LABS * 100);
      if (host) {
        host.innerHTML = '<strong>' + T.labProgress(done, TOTAL_LABS) + '</strong>' + bar(pct);
      }
      document.querySelectorAll('article[id^="lab"]').forEach(function (a) {
        a.classList.toggle('done', window.kiroProgress.get(LABS_KEY, a.id));
      });
    }
    window.addEventListener('kiro-progress', refresh);
    refresh();

    var rb = document.querySelector('[data-labs-reset]');
    if (rb) rb.addEventListener('click', function () {
      if (window.confirm(T.resetConfirm)) {
        window.kiroProgress.clear(LABS_KEY);
        document.querySelectorAll('input[data-lab-check]').forEach(function (cb) { cb.checked = false; });
      }
    });
  }

  /* ---- landing page: progress summary widgets ---- */
  function initLandingProgress() {
    var mHost = document.querySelector('[data-progress-modules]');
    var lHost = document.querySelector('[data-progress-labs]');
    if (!mHost && !lHost) return;
    function pct(done, total) {
      var p = Math.round(done / total * 100);
      var cls = done === total && total > 0 ? ' class="pnum ok"' : ' class="pnum"';
      return '<div' + cls + '>' + done + '<span>/ ' + total + '</span></div>' + bar(p);
    }
    function refresh() {
      if (mHost) mHost.innerHTML = pct(window.kiroProgress.count(MODULES_KEY), TOTAL_MODULES);
      if (lHost) lHost.innerHTML = pct(window.kiroProgress.count(LABS_KEY), TOTAL_LABS);
    }
    window.addEventListener('kiro-progress', refresh);
    window.addEventListener('storage', refresh);   // reflect changes made in another tab
    refresh();

    document.querySelectorAll('[data-progress-reset]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (window.confirm(T.resetConfirm)) {
          window.kiroProgress.clear(MODULES_KEY);
          window.kiroProgress.clear(LABS_KEY);
        }
      });
    });
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    applyLang(startLang);
    updateThemeLabel();

    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang-btn')); });
    });

    /* TOC scroll-spy */
    var links = [].slice.call(document.querySelectorAll('.toc a[href^="#"]'));
    if (links.length) {
      var map = {};
      links.forEach(function (l) {
        var id = l.getAttribute('href').slice(1);
        var t = document.getElementById(id);
        if (t) map[id] = l;
      });
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (l) { l.classList.remove('active'); });
            if (map[en.target.id]) map[en.target.id].classList.add('active');
          }
        });
      }, { rootMargin: '-10% 0px -75% 0px' });
      Object.keys(map).forEach(function (id) { obs.observe(document.getElementById(id)); });
    }

    initCourseProgress();
    initLabsProgress();
    initLandingProgress();
  });
})();
