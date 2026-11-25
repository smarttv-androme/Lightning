// Animation, run every frame: the rails scroll left and right. Unless anim=0 also: progress bars, image swaps and
// focus scaling. Uses the refs Img and Bar of the card template when they exist.
(function (T) {
    var cfg = T.config, L = T.layout;

    T.startAnimation = function (app, scene) {
        var stage = app.stage, rails = [], cards = [], focus = 0, r, c, R = T.railLayout(scene);
        for (r = 0; r < R.rails; r++) {
            rails.push(app.tag('Scene.Rail' + r + '.Items'));
            for (c = 0; c < R.cardsPerRail; c++) cards.push({ id: r * R.cardsPerRail + c, el: app.tag('Scene.Rail' + r + '.Items.C' + c) });
        }
        var scrollDistance = Math.max(0, R.cardsPerRail * (T.card.w + L.gap) * R.scale - L.viewW + 140);
        var lines = scene.syncRails ? app.tag('Scene.Markers.Lines') : null;

        stage.on('frameStart', function () {
            var f = stage.frameCounter, i;

            if (scene.syncRails) {
                // Back and forth at a constant speed, every rail and the lines at the same x.
                var p = (f * cfg.speed) % (2 * scrollDistance), x = 20 - (p < scrollDistance ? p : 2 * scrollDistance - p);
                for (i = 0; i < rails.length; i++) rails[i].x = x;
                lines.x = x;
            } else {
                for (i = 0; i < rails.length; i++) rails[i].x = 20 - (Math.sin(f / 90 + i) * 0.5 + 0.5) * scrollDistance;
            }
            if (!cfg.animate) return;

            for (i = 0; i < cards.length && !scene.cardsStatic; i++) {
                var card = cards[i], bar = card.el.tag('Bar'), img = card.el.tag('Img');
                if (bar && card.id % 3 !== 2) bar.w = 10 + (f * 2 + card.id * 30) % (T.card.w - 10);
                if (img && cfg.churn && !scene.sharedImages && (f + i * 37) % cfg.churn === 0) {
                    card.imageN = (card.imageN || card.id) + 1;
                    img.src = T.imageSrc(card.imageN);
                }
            }

            if (f % 45 === 0 && !scene.syncRails) { // 1 frame late check: no focus, it would cover the lines
                cards[focus].el.setSmooth('scale', 1);
                focus = (focus + 1) % cards.length;
                cards[focus].el.setSmooth('scale', 1.1);
            }
        });
    };
})(window.RttTest);
