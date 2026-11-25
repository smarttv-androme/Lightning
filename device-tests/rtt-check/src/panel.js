// Side panel: the scene and renderer being tested, the measured average frame time, the content, the device and a results grid
// (scenes x renderers). Results are kept in sessionStorage, so they survive the page reload between combinations.
(function (T) {
    var WARMUP_FRAMES = 30;

    // options: scenes, renderers, si, ri (0-based), device, storageKey, secs, auto() -> bool,
    //          status() -> extra text such as ', CONTEXT LOST'
    T.createPanel = function (el, o) {
        var frames = 0, ms = 0, worst = 0, startTime = 0, lastTime = 0, count = 0, key = o.si + ',' + o.ri;

        function fps() { return ms ? Math.round(frames * 1000 / ms) : 0; }
        function frameMs() { return frames ? Math.round(ms / frames * 10) / 10 : 0; } // average time per frame
        function result() { return frameMs().toFixed(1) + ' ms' + o.status(); }
        function load() { try { return JSON.parse(sessionStorage.getItem(o.storageKey)) || {}; } catch (e) { return {}; } }
        function save(res) { try { sessionStorage.setItem(o.storageKey, JSON.stringify(res)); } catch (e) {} }
        function record() { var res = load(); res[key] = result(); save(res); }
        function elapsed() { return startTime ? (lastTime - startTime) / 1000 : 0; }
        function esc(s) { return ('' + s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'); }

        function render() {
            var res = load(), measured = frames > 0, s, r, scene = o.scenes[o.si], renderer = o.renderers[o.ri];

            var grid = '<tr><td></td>';
            for (r = 0; r < o.renderers.length; r++) grid += '<td class="h r' + (r === o.ri ? ' cur' : '') + '">R' + (r + 1) + '</td>';
            grid += '</tr>';
            for (s = 0; s < o.scenes.length; s++) {
                grid += '<tr><td class="h' + (s === o.si ? ' cur' : '') + '">S' + (s + 1) + '</td>';
                for (r = 0; r < o.renderers.length; r++) {
                    var here = s === o.si && r === o.ri, v = here && measured ? result() : res[s + ',' + r];
                    grid += '<td class="r' + (here ? ' cur' : '') + '">' + (v ? esc(v.replace(' ms', '').replace(' fps', 'fps')) : '–') + '</td>';
                }
                grid += '</tr>';
            }
            var legendS = '', legendR = ''; // two columns: scenes, renderers
            for (s = 0; s < o.scenes.length; s++) legendS += 'S' + (s + 1) + ' ' + esc(o.scenes[s].name) + '<br>';
            for (r = 0; r < o.renderers.length; r++) legendR += 'R' + (r + 1) + ' ' + esc(o.renderers[r].name) + '<br>';

            el.innerHTML =
                (o.auto() ? '<div class="label">AUTO ' + (o.ri + 1) + '/' + o.renderers.length + ' · ' + Math.floor(elapsed()) + '/' + o.secs + 's</div>' : '') +
                '<div class="label">SCENE ' + (o.si + 1) + '/' + o.scenes.length + '</div>' +
                '<div class="now">' + esc(scene.name) + '</div>' +
                '<div class="desc">' + esc(scene.desc) + '</div>' +
                '<div class="label">RENDERER ' + (o.ri + 1) + '/' + o.renderers.length + '</div>' +
                '<div class="now renderer">' + esc(renderer.name) + '</div>' +
                '<div class="desc">' + esc(renderer.desc) + '</div>' +
                '<div class="fps">' + (measured ? result() : 'measuring…') + '</div>' +
                '<div class="label">CONTENT</div><div class="block">' + esc(T.describeContent(o.scenes[o.si])) + '</div>' +
                '<div class="label">DEVICE</div><div class="block">' + esc(o.device) + '</div>' +
                '<div class="label">RESULTS (ms per frame, lower is faster)</div><table>' + grid + '</table><div class="legend"><div>' + legendS + '</div><div>' + legendR + '</div></div>' +
                '<div class="keys">UP / DOWN scene · LEFT / RIGHT or 1–' + o.renderers.length + ' renderer · ENTER auto cycle (all renderers of this scene)</div>';
        }

        return {
            // Call once per drawn frame.
            frame: function () {
                var now = window.performance ? performance.now() : Date.now();
                count++;
                if (!startTime) startTime = now;
                if (lastTime && count > WARMUP_FRAMES) { var d = now - lastTime; frames++; ms += d; if (d > worst) worst = d; }
                lastTime = now;
                if (count % 20 === 0) render();
                if (count % 120 === 0 && frames) record();
            },
            elapsed: elapsed,
            fps: fps,
            frameMs: frameMs,
            worst: function () { return Math.round(worst); },
            result: result,
            record: record,
            results: load,
            clearScene: function () { var res = load(); for (var r = 0; r < o.renderers.length; r++) delete res[o.si + ',' + r]; save(res); },
            render: render
        };
    };
})(window.RttTest);
