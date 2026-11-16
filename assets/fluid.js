/* Calm flowing smoke. Own code, no libraries.
   Cheap by design: 1/4 resolution, ~20 fps, paused in hidden tabs,
   one still frame under prefers-reduced-motion, and it freezes itself for good
   if the machine cannot keep the page smooth (e.g. software compositing).
   Without WebGL the CSS orbs stay. */
(function () {
  var cv = document.querySelector('.fluid');
  if (!cv) return;
  var gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 r;uniform float t;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/r.y*1.3;float s=t*.035;',
    ' vec2 q=vec2(fbm(uv+s),fbm(uv+vec2(5.2,1.3)-s));',
    ' vec2 w=vec2(fbm(uv+2.*q+vec2(1.7,9.2)+s*.7),fbm(uv+2.*q+vec2(8.3,2.8)-s*.5));',
    ' float f=fbm(uv+2.*w);',
    ' vec3 bg=vec3(.051,.075,.188),v2=vec3(.357,.184,.761),v1=vec3(.639,.439,1.);',
    /* caps keep --muted text at >= 4.5:1 contrast on the brightest spot */
    ' vec3 c=mix(bg,v2,smoothstep(.42,.85,f)*.42);',
    ' c=mix(c,v1,smoothstep(.6,.95,f)*.2);',
    ' gl_FragColor=vec4(c,1.);}'
  ].join('\n');

  var uR, uT;
  function build() {
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    uR = gl.getUniformLocation(pr, 'r'); uT = gl.getUniformLocation(pr, 't');
    cv.width = cv.height = 0; /* force size() to set viewport and uniform again */
    return true;
  }
  if (!build()) return;

  var SCALE = 0.25, STEP = 50;          /* 1/4 resolution, ~20 fps */
  var clock = 20;                       /* seconds of animation actually shown */
  var prev = 0, acc = 0, raf = 0;
  var lost = false, frozen = false, scrolling = false, scrollTimer = 0;
  var deltas = [], lastTick = 0;        /* frame-rate guard */
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  function size() {
    var w = Math.max(1, Math.round(innerWidth * SCALE)), h = Math.max(1, Math.round(innerHeight * SCALE));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(uR, w, h); }
  }
  function draw() { size(); gl.uniform1f(uT, clock); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  function guard(now) {
    if (lastTick) {
      deltas.push(now - lastTick);
      if (deltas.length === 90) {
        var d = deltas.slice().sort(function (a, b) { return a - b; })[45];
        if (d > 24) frozen = true;          /* page below ~40 fps: keep a still frame */
        deltas = [];
      }
    }
    lastTick = now;
  }
  function loop(now) {
    if (lost || frozen || document.hidden) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    if (!scrolling) guard(now); else lastTick = 0;
    var dt = prev ? Math.min(now - prev, 100) : 0;  /* paused time is never counted */
    prev = now; acc += dt;
    if (acc < STEP) return;
    clock += acc / 1000; acc = 0;
    draw();
  }
  function start() {
    cancelAnimationFrame(raf); raf = 0; prev = 0; lastTick = 0; deltas = [];
    if (lost) return;
    if (still.matches || frozen) { draw(); return; }
    if (!document.hidden) raf = requestAnimationFrame(loop);
  }

  document.documentElement.classList.add('has-fluid');
  draw();
  start();

  addEventListener('resize', function () { if (!lost) draw(); }, { passive: true });
  addEventListener('scroll', function () {
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { scrolling = false; }, 300);
  }, { passive: true });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else start(); });
  if (still.addEventListener) still.addEventListener('change', start);
  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; cancelAnimationFrame(raf); raf = 0; });
  cv.addEventListener('webglcontextrestored', function () {
    lost = false;
    if (build()) start(); else document.documentElement.classList.remove('has-fluid');
  });
})();
