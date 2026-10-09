// Detects broken direct canvas -> WebGL texture upload (Tizen/old Chromium). ES5 only.
// Returns true if device looks affected (or on any error): use getImageData path then.
export function isCanvasUploadBroken(gl, iterations) {
    var n = iterations || 12;
    var sizes = [[512, 256], [300, 300], [640, 128], [256, 512]]; // all area > 256*256 (GPU canvas threshold)
    var P = [gl.UNPACK_ALIGNMENT, gl.UNPACK_FLIP_Y_WEBGL, gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, gl.UNPACK_COLORSPACE_CONVERSION_WEBGL];
    var saved = [], prevTex, prevFb, prevUnit, fb, texs = [], broken = false, i, j;
    var prevUnitCleanup = null;
    try {
        for (i = 0; i < P.length; i++) saved.push(gl.getParameter(P[i]));
        prevUnit = gl.getParameter(gl.ACTIVE_TEXTURE);
        gl.activeTexture(gl.TEXTURE0);
        prevTex = gl.getParameter(gl.TEXTURE_BINDING_2D);
        prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        // Same settings Lightning uses for canvas uploads.
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        fb = gl.createFramebuffer();
        var px = new Uint8Array(4);

        for (i = 0; i < n && !broken; i++) {
            var jobs = [];
            // Upload everything first, verify after: later uploads/canvas recycling may corrupt earlier textures.
            for (j = 0; j < sizes.length; j++) {
                var w = sizes[j][0], h = sizes[j][1];
                var c = document.createElement('canvas');
                c.width = w; c.height = h;
                var ctx = c.getContext('2d');
                // 4 solid rects (distinct per iteration/canvas), top-left quadrant, top-right, bottom-left, bottom-right=transparent
                var s = (i * 37 + j * 71) % 128;
                var cols = [[255 - s, s, 40], [20, 120 + s, 255 - s], [200, 200 - s, s * 2]];
                var pts = [[w / 4, h / 4], [w * 3 / 4, h / 4], [w / 4, h * 3 / 4], [w * 3 / 4, h * 3 / 4]];
                for (var k = 0; k < 3; k++) {
                    ctx.fillStyle = 'rgb(' + cols[k][0] + ',' + cols[k][1] + ',' + cols[k][2] + ')';
                    ctx.fillRect(pts[k][0] - w / 8, pts[k][1] - h / 8, w / 4, h / 4);
                }
                // text-like drawing in the transparent quadrant's corner (exercises text path; not verified)
                ctx.fillStyle = '#fff';
                ctx.font = '20px sans-serif';
                ctx.fillText('Lightning ' + i, w / 2 + 4, h - 8);
                var t = gl.createTexture();
                texs.push(t);
                gl.bindTexture(gl.TEXTURE_2D, t);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                jobs.push({ t: t, pts: pts, cols: cols });
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            for (j = 0; j < jobs.length && !broken; j++) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, jobs[j].t, 0);
                if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { broken = true; break; }
                for (k = 0; k < 4; k++) {
                    var p = jobs[j].pts[k], e = jobs[j].cols[k] || [0, 0, 0], a = jobs[j].cols[k] ? 255 : 0;
                    gl.readPixels(Math.floor(p[0]), Math.floor(p[1]), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                    if (Math.abs(px[0] - e[0]) > 6 || Math.abs(px[1] - e[1]) > 6 || Math.abs(px[2] - e[2]) > 6 || Math.abs(px[3] - a) > 6) { broken = true; break; }
                }
            }
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
            for (j = 0; j < texs.length; j++) gl.deleteTexture(texs[j]);
            texs = [];
        }
        if (gl.getError() !== gl.NO_ERROR) broken = true;
    } catch (e) {
        broken = true;
    }
    // Restore state (best effort; never throw).
    try {
        for (j = 0; j < texs.length; j++) gl.deleteTexture(texs[j]);
        if (fb) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); }
        gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb || null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, prevTex || null);
        if (prevUnit) gl.activeTexture(prevUnit);
        for (i = 0; i < saved.length; i++) if (saved[i] !== undefined && saved[i] !== null) gl.pixelStorei(P[i], saved[i]);
    } catch (e2) {}
    return broken;
}
