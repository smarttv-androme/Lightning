// URL options and layout constants, shared by all other files via window.RttTest.
(function (T) {
    var q = {};
    location.search.replace(/[?&](\w+)=(\d+)/g, function (m, k, v) { q[k] = +v; });
    function opt(name, def) { return q[name] === undefined ? def : q[name]; }

    T.config = {
        scene: opt('scene', 5),          // 1-8, see scene.js
        renderer: opt('renderer', 1),    // 1-9, see renderers.js
        auto: !!q.auto,                  // cycle through all renderers of the scene
        secs: opt('secs', 15),           // seconds per combination in the auto cycle
        churn: opt('churn', 180),        // frames between loading a new image per card (0 = off)
        imageWorker: !!opt('worker', 1), // Lightning's useImageWorker
        localImages: !!opt('local', 0),  // 1 = local PNG posters (img/) instead of Lorem Picsum photos
        animate: !!opt('anim', 1),       // 0 = cards never change after the first frame, only the rails scroll
        load: opt('load', 4),            // GPU stress scene: number of full-screen semi-transparent layers (GPU load)
        pad: opt('pad', 4),              // renderer 8: number of dummy render passes at the end of the frame
        padSize: opt('padSize', 512),    // renderer 8: width and height of each dummy pass in pixels
        padScreen: !!opt('padScreen', 1), // renderer 8: then 1 transparent pixel on the screen that reads the padding
        speed: opt('speed', 6)          // 1 frame late check scene: scroll speed of the rails in px per frame
    };

    T.layout = {
        stageW: 1920, stageH: 1080,
        viewW: 1360,                     // width of the scene; the side panel uses the rest
        rails: 4, cardsPerRail: 6,
        railH: 200, railSpacing: 50, gap: 24
    };
})(window.RttTest = window.RttTest || {});
