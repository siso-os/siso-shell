/* v2/page.js — inlined into every v2 page. no-js → js; the contents capsule follows the reader; faces mount when the
   Halo Face engine is inlined (HaloFace.agent from packages/halo-face), otherwise the CSS face stays. */
(function () {
  var d = document; d.documentElement.classList.remove('no-js');
  var toc = d.querySelectorAll('.toc a[href^="#"]');
  if (toc.length && 'IntersectionObserver' in window) {
    var map = {}; toc.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && map[e.target.id]) { toc.forEach(function (a) { a.classList.remove('on'); }); map[e.target.id].classList.add('on'); } }); }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { var el = d.getElementById(id); if (el) io.observe(el); });
  }
  if (window.HaloFace && HaloFace.agent) d.querySelectorAll('.hfh[data-face]').forEach(function (el) {
    var p = el.getAttribute('data-face').split('|');
    try { el.innerHTML = ''; HaloFace.agent(el, { project: p[0], status: p[1], size: +p[2], name: p[3] }); } catch (e) { }
  });
})();
