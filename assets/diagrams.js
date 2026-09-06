/* Mermaid diagram bootstrap for the Kiro course pages.

   IMPORTANT: an inline <script> BEFORE mermaid.min.js has already copied each
   <pre class="mermaid"> block's raw source into el.dataset.src. That must
   happen before mermaid runs, because mermaid replaces the block with an SVG
   and the original (newline-containing) source is then unrecoverable.

   This file:
   - configures mermaid theme/labels BEFORE its own auto-run fires
   - re-renders every diagram from the stashed source when the theme toggles */
(function () {
  function themeName() {
    var t = (window.kiroCurrentTheme && window.kiroCurrentTheme()) ||
      document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    return t === 'dark' ? 'dark' : 'default';
  }

  function config(startOnLoad) {
    return {
      startOnLoad: !!startOnLoad,
      theme: themeName(),
      securityLevel: 'strict',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif',
      // htmlLabels:false → SVG <tspan> labels; a real newline in the source
      // becomes a line break, reliably, across mermaid versions.
      flowchart: { curve: 'basis', htmlLabels: false, useMaxWidth: true, nodeSpacing: 42, rankSpacing: 52, wrappingWidth: 260 },
      sequence: { useMaxWidth: true }
    };
  }

  // Runs synchronously, right after mermaid.min.js and before mermaid's own
  // DOMContentLoaded auto-run — so the very first render uses our theme.
  if (window.mermaid && window.mermaid.initialize) {
    try { window.mermaid.initialize(config(true)); } catch (e) {}
  }

  function rerender() {
    if (!window.mermaid) return;
    document.querySelectorAll('pre.mermaid').forEach(function (el) {
      if (!el.dataset.src) return;
      el.removeAttribute('data-processed');
      el.innerHTML = el.dataset.src;
    });
    try {
      window.mermaid.initialize(config(false));
      window.mermaid.run({ querySelector: 'pre.mermaid' });
    } catch (e) {}
  }

  window.addEventListener('kiro-theme', function () { setTimeout(rerender, 30); });
})();
