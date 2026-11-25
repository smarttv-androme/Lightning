// The scenes: where the rtt is. Each scene is the same background with rails of cards (card.js):
//   cardRtt    rtt on every card (the card then has rounded corners; otherwise it is square)
//   railRtt    0-based indices of the rails that get rtt + rounded corners
//   cardsStatic  the card content never changes after creation (no progress bars, no image swaps); the rails still
//                scroll and the focus still moves
//   cardSplit    rtt only on the static part of each card; the progress bar is outside it (card.js)
//   screenLoad   extra GPU work on the screen itself, without rtt: cfg.load full-screen semi-transparent layers behind
//                the rails
//   rails        number of rails (default L.rails); more rails make them small (T.railLayout)
//   pageRtt      the whole page (all rails) is rendered to one texture, with cfg.load semi-transparent layers inside
//                it behind the rails: the last texture pass before the screen is big and slow (GPU stress test)
//   sharedImages the cards share 24 images and never load new ones (for scenes with many cards)
//   syncRails    all rails scroll together at cfg.speed px per frame (animation.js), with white lines outside the rtt
//                in the gaps between the cards: shows content that lags a frame behind (renderer 7)
(function (T) {
    var cfg = T.config, L = T.layout;

    T.scenes = [
        { name: 'No rtt', desc: 'Baseline: no rtt anywhere, square cards.', cardRtt: false, railRtt: [] },
        { name: 'rtt on every card', desc: 'Every card is rendered to a texture and has the rounded corners.', cardRtt: true, railRtt: [] },
        { name: 'rtt on every card, static cards', desc: 'As scene 2, but the card content never changes: only scrolling and focus scaling.', cardRtt: true, railRtt: [], cardsStatic: true },
        { name: 'rtt on every card + every rail', desc: 'As scene 2, and every rail is rendered to a texture too, with rounded corners (nested rtt).', cardRtt: true, railRtt: [0, 1, 2, 3] },
        { name: 'rtt on every rail', desc: 'Every rail is rendered to a texture with rounded corners, the cards have no rtt.', cardRtt: false, railRtt: [0, 1, 2, 3] },
        // Disabled for now (the scene numbers below shift down by 2):
        // { name: 'No rtt + heavy screen load', desc: 'As scene 1, plus full-screen semi-transparent layers: GPU load without rtt.', cardRtt: false, railRtt: [], screenLoad: true },
        // { name: 'rtt on static card content', desc: 'rtt on the image + gradient + title of every card; the progress bar is outside the rtt. No rtt on the rails.', cardRtt: true, railRtt: [], cardSplit: true },
        { name: '1 frame late check', desc: 'All rails scroll together. Rail 1 has no rtt, rails 2-4 do. The white lines (no rtt) sit in the gaps between the cards: content a frame behind runs into them.', cardRtt: false, railRtt: [1, 2, 3], cardsStatic: true, syncRails: true },
        { name: '20 rtt rails', desc: '20 rails of the size of scene 5, each offset a bit so they overlap, every rail rendered to a texture with rounded corners. No rtt on the cards; progress bars animate, no image swaps.', cardRtt: false, railRtt: range(20), rails: 20, sharedImages: true },
        { name: 'GPU stress: full-page rtt', desc: 'The whole page is rendered to one texture: the rails (each with rtt) plus full-screen layers inside it. The last texture pass covers the screen, so a late finish shows everywhere.', cardRtt: false, railRtt: [0, 1, 2, 3], pageRtt: true }
    ];

    function range(n) { for (var a = [], i = 0; i < n; i++) a.push(i); return a; }

    // Size and position of the rails for a scene. Rails are always the size of scene 5; with more rails than fit, every
    // rail is offset by the same amount so they overlap and all fit on the screen.
    T.railLayout = function (scene) {
        var rails = scene.rails || L.rails, pitch = L.railH + L.railSpacing;
        if (rails > L.rails) pitch = Math.floor((L.stageH - 40 - L.railH) / (rails - 1));
        return { rails: rails, cardsPerRail: L.cardsPerRail, top: rails > L.rails ? 20 : 40, railH: L.railH, railSpacing: pitch - L.railH, itemsY: 30, scale: 1, radius: 48 };
    };

    var imageCounter = 0;
    // A unique URL every time, so each swap is a real download + decode + upload. Picsum: a seed always gives the same
    // photo, so every run starts with the same images. Local: generated PNGs (make-images.mjs).
    T.imageSrc = function (n) {
        var u = imageCounter++;
        return cfg.localImages ? 'img/poster-' + (n % 8) + '.png?u=' + u : 'https://picsum.photos/seed/rtt' + u + '/480/270';
    };

    // Returns the template for the whole app.
    T.buildScene = function (scene) {
        var content = { w: L.viewW, h: L.stageH }, R = T.railLayout(scene), shared = [];
        if (scene.pageRtt) {
            // Inside the page texture, behind the rails: full-size blends make the last texture pass slow.
            content.rtt = true;
            content.PageLoad = {};
            for (var k = 0; k < cfg.load; k++) content.PageLoad['L' + k] = { w: L.viewW, h: L.stageH, rect: true, color: k % 2 ? 0x10000000 : 0x10ffffff };
        }

        for (var r = 0; r < R.rails; r++) {
            var items = { x: 20, y: R.itemsY, pivot: 0, scale: R.scale };
            for (var c = 0; c < R.cardsPerRail; c++) {
                var id = r * R.cardsPerRail + c;
                // Many cards (more rails): reuse 24 images, so they are loaded once.
                var src = scene.sharedImages ? shared[id % 24] || (shared[id % 24] = T.imageSrc(id)) : T.imageSrc(id);
                var card = T.Card({ id: id, title: 'Card ' + r + '-' + c, src: src, rtt: scene.cardRtt, split: scene.cardSplit });
                card.x = c * (T.card.w + L.gap);
                items['C' + c] = card;
            }
            var rail = { x: 30, y: R.top + r * (R.railH + R.railSpacing), w: L.viewW - 60, h: R.railH, clipping: true,
                RailBg: { w: L.viewW - 60, h: R.railH, rect: true, color: 0x24ffffff }, // slight background behind the cards
                Items: items };
            if (scene.railRtt.indexOf(r) >= 0) { rail.rtt = true; rail.shader = T.rounded(R.radius); }
            content['Rail' + r] = rail;
        }

        if (scene.syncRails) {
            // Lines in the middle of every gap between the cards, over all rails; moved with the rails (animation.js).
            var lines = {}, top = 40 - 10, bottom = 40 + L.rails * (L.railH + L.railSpacing) - L.railSpacing + 10;
            for (c = 1; c < L.cardsPerRail; c++) lines['L' + c] = { x: c * (T.card.w + L.gap) - L.gap / 2 - 2, w: 4, h: bottom - top, rect: true, color: 0xffffffff };
            content.Markers = { x: 30, y: top, w: L.viewW - 60, h: bottom - top, clipping: true, Lines: { x: 20, Items: lines } };
        }

        var load = {};
        // Alternating light/dark so the scene looks about the same; every layer is a full-screen blend (no rtt).
        for (var i = 0; scene.screenLoad && i < cfg.load; i++) load['L' + i] = { w: L.stageW, h: L.stageH, rect: true, color: i % 2 ? 0x10000000 : 0x10ffffff };

        return {
            Bg: { w: L.stageW, h: L.stageH, rect: true, colorTop: 0xff6a7690, colorBottom: 0xff3c4458 },
            Load: load,
            Scene: content
        };
    };

    // Human readable description of what moves, for the side panel and the reports (lines separated by '\n').
    T.describeContent = function (scene) {
        return [
            (cfg.localImages ? 'PNG posters' : 'Lorem Picsum photos (JPEG)') + ' + gradient overlay' + (cfg.churn && cfg.animate && !scene.cardsStatic && !scene.sharedImages ? ', new image every ' + (cfg.churn / 60) + 's' : '') +
                (cfg.imageWorker ? '' : ', no image worker'),
            scene.sharedImages ? scene.rails + ' rails scroll, progress bars, focus scaling, 24 images (no swaps)' : scene.syncRails ? 'STATIC CARDS: all rails scroll together at ' + cfg.speed + ' px per frame' : scene.cardsStatic && cfg.animate ? 'STATIC CARDS: only scrolling rails and focus scaling' : cfg.animate ? 'text, progress bars, focus scaling, scrolling rails' : 'ONLY THE RAILS SCROLL: cards never change after the first frame'
        ].concat(scene.screenLoad ? [cfg.load + ' full-screen layers behind the rails (load=' + cfg.load + ')'] : [])
         .concat(scene.pageRtt ? ['page rtt with ' + cfg.load + ' full-page layers inside (load=' + cfg.load + ')'] : []).join('\n');
    };
})(window.RttTest);
