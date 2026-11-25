// The renderers: how Lightning draws the frame. Each renderer can have:
//   stage                    extra Lightning stage options
//   preserveDrawingBuffer    WebGL context option
//   patch(app, gl)           code applied to the running Lightning app
(function (T) {
    T.renderers = [
        {
            name: 'Lightning as-is',
            desc: 'Baseline renderer, no workaround.'
        },
        {
            name: 'readPixelsAfterDraw',
            desc: 'Existing stage option: waits for the GPU after every frame with rtt work.',
            stage: { readPixelsAfterDraw: true, readPixelsAfterDrawThreshold: 1 }
        },
        {
            name: 'RTT first + 1 readPixels',
            desc: 'Core stage option flushRenderToTexture: renders all textures first, waits for the GPU once, then draws the screen.',
            stage: { flushRenderToTexture: true }
        },
        {
            name: 'preserveDrawingBuffer',
            desc: 'WebGL context option: the browser copies the canvas instead of swapping buffers.',
            preserveDrawingBuffer: true
        },
        {
            name: 'RTT first',
            desc: 'Renders all textures first, then the screen, without waiting for the GPU (renderer 3 without the readPixels).',
            patch: function (app, gl) { rttFirst(app, gl, false); }
        },
        {
            name: '1 readPixels',
            desc: 'Lightning order unchanged, one readPixels per frame when switching from the last texture to the screen (renderer 3 without the reordering).',
            patch: lastRttThenSync
        },
        {
            name: 'Textures one frame late',
            desc: 'Draws the screen first with the textures of the previous frame, then renders the textures for the next frame. No GPU wait; rtt content is 1 frame behind.',
            patch: texturesOneFrameLate
        },
        {
            name: 'Padding passes',
            desc: 'Lightning as-is, then a few dummy render passes at the end of the frame (pad=N passes of padSize px), then one transparent pixel on the screen that reads the last of them (padScreen=0 to skip). Pushes the real passes through the GPU pipeline. No GPU wait.',
            patch: paddingPasses
        },
        {
            name: 'Screen pixel only',
            desc: 'Lightning as-is, then one transparent pixel on the screen that reads the last texture rendered in the frame (renderer 8 without the dummy passes). No GPU wait.',
            patch: screenPixelOnly
        }
    ];

    // Renderer 8 without the padding passes: after Lightning's frame, one transparent pixel on the screen (bottom
    // left) that samples the last render texture of the frame, multiplied by a uniform 0 so the read cannot be
    // optimized away. The screen's last work then depends on that texture. Frames without rtt work draw nothing extra.
    function screenPixelOnly(app, gl) {
        var exec = app.stage.ctx.renderExec, origExecute = exec.execute;

        function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
        var prog = gl.createProgram();
        gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }'));
        gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D t; uniform float k; void main() { gl_FragColor = texture2D(t, vec2(0.5)) * k; }'));
        gl.bindAttribLocation(prog, 0, 'p');
        gl.linkProgram(prog);
        gl.useProgram(prog);
        gl.uniform1i(gl.getUniformLocation(prog, 't'), 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'k'), 0);
        gl.useProgram(null);
        var full = gl.createBuffer();               // one triangle covering the whole viewport; the scissor keeps 1 pixel
        gl.bindBuffer(gl.ARRAY_BUFFER, full);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

        exec.execute = function () {
            var ops = this.renderState.quadOperations, last = null, i, ri;
            for (i = 0; i < ops.length; i++) { ri = ops[i].renderTextureInfo; if (ri && !ri.ignore) last = ri.nativeTexture; }
            var result = origExecute.apply(this, arguments);
            if (!last) return result;
            this._stopShaderProgram();              // disables Lightning's attribs; the next frame re-enables them
            this._bindRenderTexture(null);
            gl.useProgram(prog);
            gl.bindBuffer(gl.ARRAY_BUFFER, full);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, last);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.SCISSOR_TEST); this._scissor = null;
            gl.scissor(0, 0, 1, 1);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.disable(gl.SCISSOR_TEST);
            gl.disableVertexAttribArray(0);
            gl.useProgram(null);
            return result;
        };
    }

    // After Lightning's frame: cfg.pad render passes, each into its own cfg.padSize x cfg.padSize framebuffer (a clear + one drawn
    // triangle, so the driver cannot skip the pass). Separate framebuffers, so every one is a new render pass.
    // With cfg.padScreen: then one pixel on the screen that samples the last padding texture (multiplied by a uniform
    // 0, so it is transparent and the compiler cannot drop the read): the screen's last work depends on the padding,
    // so the frame cannot be finished before it. The GL state is left so that Lightning's _reset() at the start of the
    // next frame sets up its own again.
    function paddingPasses(app, gl) {
        var exec = app.stage.ctx.renderExec, origExecute = exec.execute, S = T.config.padSize, fbs = [], i;
        for (i = 0; i < T.config.pad; i++) {
            var tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // any padSize, also not a power of 2
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            var fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            fbs.push(fb);
            var lastTex = tex;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
        var prog = gl.createProgram();
        gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }'));
        gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }'));
        gl.bindAttribLocation(prog, 0, 'p');
        gl.linkProgram(prog);
        var screenProg = gl.createProgram();
        gl.attachShader(screenProg, shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }'));
        gl.attachShader(screenProg, shader(gl.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D t; uniform float k; void main() { gl_FragColor = texture2D(t, vec2(0.25)) * k; }'));
        gl.bindAttribLocation(screenProg, 0, 'p');
        gl.linkProgram(screenProg);
        gl.useProgram(screenProg);
        gl.uniform1i(gl.getUniformLocation(screenProg, 't'), 0);
        gl.uniform1f(gl.getUniformLocation(screenProg, 'k'), 0);
        gl.useProgram(null);
        var tri = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tri);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 0, 1]), gl.STATIC_DRAW);
        var full = gl.createBuffer();               // one triangle covering the whole viewport
        gl.bindBuffer(gl.ARRAY_BUFFER, full);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

        exec.execute = function () {
            var result = origExecute.apply(this, arguments);
            this._stopShaderProgram();              // disables Lightning's attribs; the next frame re-enables them
            gl.disable(gl.SCISSOR_TEST); this._scissor = null;
            gl.useProgram(prog);
            gl.bindBuffer(gl.ARRAY_BUFFER, tri);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(0);
            gl.viewport(0, 0, S, S);
            gl.clearColor(0, 0, 0, 0);
            for (var i = 0; i < fbs.length; i++) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbs[i]);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            }
            this._bindRenderTexture(null);          // back to the screen (also sets the viewport)
            if (T.config.padScreen && lastTex) {
                // One transparent pixel at the bottom left, blended (Lightning's blend mode), reading the padding.
                gl.useProgram(screenProg);
                gl.bindBuffer(gl.ARRAY_BUFFER, full);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, lastTex);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                gl.enable(gl.SCISSOR_TEST);
                gl.scissor(0, 0, 1, 1);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
                gl.disable(gl.SCISSOR_TEST);
            }
            gl.disableVertexAttribArray(0);
            gl.useProgram(null);
            return result;
        };
    }

    // Screen first (sampling the textures as they were rendered last frame), then the render-to-texture work, which is
    // shown in the next frame. The screen pass is short and is not queued behind the texture work.
    // - A texture that was not rendered in the previous frame (new, resized, or static until now) has no up-to-date
    //   content yet: that frame is drawn in Lightning's normal order.
    // - After a frame with texture work, the next frame is always drawn, so the new textures reach the screen even
    //   when nothing else changes.
    // - Every rtt element must get its own texture back each frame. Lightning releases an element's texture to the pool
    //   before re-rendering it and then allocates one again, but skips a texture stamped in the same frame, so
    //   same-size elements (the rails) swap textures every frame. Here an element takes its previous texture back.
    function texturesOneFrameLate(app, gl) {
        var stage = app.stage, exec = stage.ctx.renderExec, origExecute = exec.execute, lastFrame = [];

        var proto = Object.getPrototypeOf(app.core.texturizer), origRelease = proto.releaseRenderTexture, origGet = proto.getRenderTexture;
        proto.releaseRenderTexture = function () {
            if (this._renderTexture && !this._renderTextureReused) this._ownTexture = this._renderTexture;
            return origRelease.apply(this, arguments);
        };
        proto.getRenderTexture = function () {
            var t = this._ownTexture, pool = this.ctx._renderTexturePool, i;
            this._ownTexture = null;
            if (!this._renderTexture && t && (i = pool.indexOf(t)) >= 0 && t.ow === this._core._w && t.oh === this._core._h) {
                pool.splice(i, 1);
                t.f = stage.frameCounter;
                this._renderTexture = t;
                this._renderTextureReused = false;
                return t;
            }
            return origGet.apply(this, arguments);
        };

        exec.execute = function () {
            var ops = this.renderState.quadOperations, rtt = [], screen = [], targets = [], fresh = false, i, ri, t;
            for (i = 0; i < ops.length; i++) {
                ri = ops[i].renderTextureInfo;
                if (!ri) { screen.push(ops[i]); continue; }
                if (ri.ignore) continue;
                rtt.push(ops[i]);
                t = ri.nativeTexture;
                if (targets.indexOf(t) < 0) { targets.push(t); if (lastFrame.indexOf(t) < 0) fresh = true; }
            }
            if (rtt.length && !fresh) {
                ops.length = 0;
                for (i = 0; i < screen.length; i++) ops.push(screen[i]);
                for (i = 0; i < rtt.length; i++) ops.push(rtt[i]);
            }
            lastFrame = targets;
            var result = origExecute.apply(this, arguments);
            if (rtt.length) stage.forceRenderUpdate(); // draw the next frame too, to show what was just rendered
            return result;
        };
    }

    // One readPixels per frame, at the last switch from a render texture to the screen, without reordering.
    function lastRttThenSync(app, gl) {
        var exec = app.stage.ctx.renderExec, origExecute = exec.execute, origBind = exec._bindRenderTexture, px = new Uint8Array(4), left = 0;

        // Count the switches from a texture to the screen in this frame (ops with ignore are skipped by Lightning).
        exec.execute = function () {
            var ops = this.renderState.quadOperations, inTexture = false, i, ri;
            left = 0;
            for (i = 0; i < ops.length; i++) {
                ri = ops[i].renderTextureInfo;
                if (ri && ri.ignore) continue;
                if (inTexture && !ri) left++;
                inTexture = !!ri;
            }
            return origExecute.apply(this, arguments);
        };

        exec._bindRenderTexture = function (target) {
            if (this._renderTexture && !target && left > 0 && --left === 0) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            return origBind.apply(this, arguments);
        };
    }

    // Stable partition of the quad operations: all render-to-texture work first, then the screen. With sync: one
    // readPixels when switching from the last texture to the screen (renderer 3 is the same, built into Lightning
    // core as the stage option flushRenderToTexture).
    function rttFirst(app, gl, sync) {
        var exec = app.stage.ctx.renderExec, origExecute = exec.execute, origBind = exec._bindRenderTexture, px = new Uint8Array(4);

        // 1. Stable partition of the frame's quad operations: all render-to-texture work first, then the screen.
        exec.execute = function () {
            var ops = this.renderState.quadOperations, rtt = [], screen = [], i;
            for (i = 0; i < ops.length; i++) (ops[i].renderTextureInfo ? rtt : screen).push(ops[i]);
            ops.length = 0;
            for (i = 0; i < rtt.length; i++) ops.push(rtt[i]);
            for (i = 0; i < screen.length; i++) ops.push(screen[i]);
            return origExecute.apply(this, arguments);
        };

        // 2. When switching from the texture passes to the screen: wait for the GPU once (readPixels blocks until done).
        // The ordering alone, a 1px copyTexSubImage2D or clearing a 1x1 framebuffer instead (no CPU wait) flicker full-screen.
        exec._bindRenderTexture = function (target) {
            if (sync && this._renderTexture && !target) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
            return origBind.apply(this, arguments);
        };
    }
})(window.RttTest);
