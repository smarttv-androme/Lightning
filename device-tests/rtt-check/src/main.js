// Starts the test: WebGL context, Lightning app with the chosen scene + renderer, animation, side panel, remote keys,
// auto cycle and reporting (console + POST to serve.mjs).
(function (T) {
    var cfg = T.config, L = T.layout, scenes = T.scenes, renderers = T.renderers;
    function wrap(i, n) { return ((i % n) + n) % n; }
    var si = wrap(cfg.scene - 1, scenes.length), ri = wrap(cfg.renderer - 1, renderers.length);
    var scene = scenes[si], renderer = renderers[ri];
    var name = 'scene ' + (si + 1) + ' (' + scene.name + ') + renderer ' + (ri + 1) + ' (' + renderer.name + ')';

    function log(s) { console.log('[lightning-rtt] ' + s); }
    var error = '', lost = false;
    window.onerror = function (msg, src, line) { error = msg + ' @' + line; log('ERROR ' + name + ': ' + error); };

    // ---- WebGL context: the same options as Lightning's WebPlatform.createWebGLContext, except preserveDrawingBuffer
    var panelEl = document.getElementById('panel');
    var canvas = document.createElement('canvas');
    canvas.width = L.stageW; canvas.height = L.stageH;
    document.body.insertBefore(canvas, panelEl);
    var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, stencil: true, preserveDrawingBuffer: !!renderer.preserveDrawingBuffer });
    canvas.addEventListener('webglcontextlost', function (e) { lost = true; e.preventDefault(); log('CONTEXT LOST ' + name); }, false);

    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    var gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    var tizenVersion = /Tizen [\d.]+/.exec(navigator.userAgent), chrome = /Chrome\/(\d+)/.exec(navigator.userAgent);
    var device = (tizenVersion ? tizenVersion[0] : 'not Tizen') + ' · ' + (chrome ? 'Chrome ' + chrome[1] : '') + ' · ' + gpu;

    // ---- Lightning app
    var stageOptions = { w: L.stageW, h: L.stageH, canvas: canvas, context: gl, clearColor: 0xff000000, useImageWorker: cfg.imageWorker };
    for (var k in renderer.stage || {}) stageOptions[k] = renderer.stage[k];
    var app = new lng.Application({ stage: stageOptions });
    app.stage.fontMetrics['sans-serif'] = { baseline_ratio: 0.93, descent_ratio: 0.22, cap_ratio: 0.72 }; // this fork needs metrics per font
    app.patch(T.buildScene(scene));
    if (renderer.patch) renderer.patch(app, gl);
    T.startAnimation(app, scene);
    window.rttApp = app; // for debugging from the TV's devtools

    // ---- Side panel + frame loop
    var panel = T.createPanel(panelEl, {
        scenes: scenes, renderers: renderers, si: si, ri: ri, device: device, secs: cfg.secs,
        auto: function () { return cfg.auto; },
        storageKey: 'lightningRtt:' + scenes.length + 'x' + renderers.length + ':' + [cfg.churn, cfg.imageWorker ? 1 : 0, cfg.animate ? 1 : 0, cfg.localImages ? 1 : 0].join(','),
        status: function () { return (lost ? ', CONTEXT LOST' : '') + (error ? ', ERROR' : ''); }
    });
    var finished = false;
    app.stage.on('frameEnd', function () {
        panel.frame();
        if (cfg.auto && !finished && panel.elapsed() > cfg.secs) finish();
    });

    // ---- Navigation: every combination runs in a fresh page (fresh GL context). s and r are 0-based.
    function goto(s, r, auto) {
        var q = location.search.replace(/[?&](scene|renderer|auto)=\d+/g, '').replace(/^[?&]/, '');
        location.replace(location.pathname + '?scene=' + (s + 1) + '&renderer=' + (r + 1) + (auto ? '&auto=1' : '') + (q ? '&' + q : ''));
    }

    // End of a renderer in the auto cycle: store + report the result, then go to the next renderer of the same scene.
    function finish() {
        finished = true;
        panel.record();
        var text = name + ': ' + panel.result() + ' (worst frame ' + panel.worst() + 'ms) | ' + T.describeContent(scene).replace(/\n/g, '; ') + ' | ' + device;
        log('result ' + text);
        try {
            var x = new XMLHttpRequest();
            x.open('POST', 'report');
            x.setRequestHeader('Content-Type', 'application/json');
            x.send(JSON.stringify({ test: 'lightning-rtt', scene: si + 1, renderer: ri + 1, name: name, frameMs: panel.frameMs(), fps: panel.fps(), worstMs: panel.worst(), lost: lost, error: error, device: device, params: location.search, text: text }));
        } catch (e) {}

        if (ri + 1 < renderers.length) {
            setTimeout(function () { goto(si, ri + 1, true); }, 300);
        } else {
            cfg.auto = false;
            panel.render();
            var res = panel.results(), lines = [];
            for (var r = 0; r < renderers.length; r++) lines.push('  renderer ' + (r + 1) + ' (' + renderers[r].name + '): ' + (res[si + ',' + r] || '-'));
            log('SUMMARY scene ' + (si + 1) + ' (' + scene.name + ') | ' + device + '\n' + lines.join('\n'));
        }
    }

    // ---- Remote control
    document.addEventListener('keydown', function (e) {
        var key = e.keyCode;
        if (key === 38 || key === 40) goto(wrap(si + (key === 40 ? 1 : -1), scenes.length), ri, false);         // UP / DOWN: scene
        else if (key === 37 || key === 39) goto(si, wrap(ri + (key === 39 ? 1 : -1), renderers.length), false); // LEFT / RIGHT: renderer
        else if (key >= 49 && key < 49 + renderers.length) goto(si, key - 49, false);                            // 1..4: renderer
        else if (key === 13) { panel.clearScene(); goto(si, 0, true); }                                          // ENTER: auto cycle this scene
    }, false);
    try { for (var n = 1; n <= renderers.length; n++) window.tizen.tvinputdevice.registerKey('' + n); } catch (e) {} // Tizen: number keys

    log('start ' + name + ' | ' + device);
    panel.render();
})(window.RttTest);
