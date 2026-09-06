/* Kiro Training Portal — shared behaviour: theme toggle, language toggle, TOC scroll-spy */
(function () {
  var root = document.documentElement;

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
  });
})();
