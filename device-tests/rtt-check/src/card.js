// =====================================================================================================================
//  CARD TEMPLATE  -  edit this file to change what every card looks like.
//
//  T.Card(card) returns a plain Lightning template: the same format as a Component's static _template().
//  `card` tells you how this card is being used:
//    card.id        0..23 (rail * 6 + column)
//    card.title     'Card <rail>-<column>'
//    card.src       image URL (animation.js sets a new URL on Img every few seconds)
//    card.rtt       true when the scene puts rtt on every card: the card then has rounded corners (a rounded
//                   corner needs rtt on the card; without it the card is square)
//    card.split     rtt only on the static part (image + gradient + title, ref Content); everything that animates
//                   (the progress bar) is a sibling outside it, so the card texture is not redrawn every frame
//
//  animation.js looks for these refs (remove them and that animation is simply skipped):
//    Img  its src is swapped            Bar  its width animates (on 2 of every 3 cards)
//
//  Note: the card structure influences the flicker. With rtt on each card it was much weaker than with rtt on a
//  rail; if a change makes the flicker disappear, compare with the original template below.
// =====================================================================================================================
(function (T) {
    var W = 240, H = 135, RADIUS = 16;
    T.card = { w: W, h: H }; // used by scene.js (layout) and animation.js (bar width, scroll distance)

    T.Card = function (card) {
        if (card.split) {
            return {
                w: W, h: H,
                Content: {
                    w: W, h: H, rtt: true, shader: T.rounded(RADIUS),
                    Img: { w: W, h: H, src: card.src },
                    Overlay: { y: 40, w: W, h: H - 40, rect: true, colorTop: 0x00000000, colorBottom: 0xf0000000 },
                    Title: { x: 12, y: 10, text: { text: card.title, fontSize: 24, textColor: 0xffffffff } }
                },
                // Outside the rtt, just below the card: drawn straight to the screen.
                Bar: { x: 0, y: H + 4, w: 10, h: 6, rect: true, colorLeft: 0xffff3060, colorRight: 0xffffd040 }
            };
        }

        var t = {
            w: W, h: H,
            rtt: card.rtt,
            shader: card.rtt ? T.rounded(RADIUS) : undefined,

            Img: { w: W, h: H, src: card.src },
            Overlay: { y: 40, w: W, h: H - 40, rect: true, colorTop: 0x00000000, colorBottom: 0xf0000000 },
            Title: { x: 12, y: 10, text: { text: card.title, fontSize: 24, textColor: 0xffffffff } },
            Bar: { x: 0, y: H - 6, w: 10, h: 6, rect: true, colorLeft: 0xffff3060, colorRight: 0xffffd040 }
        };

        if (card.id % 4 === 1) { // every 4th card: a nested element with its own shaders (and its own rtt when the card has rtt)
            t.Inner = {
                x: 140, y: 64, w: 88, h: 58, rtt: card.rtt, shader: T.rounded(10),
                Glow: {
                    w: 88, h: 58, rect: true, color: 0xff2040a0,
                    shader: { type: lng.shaders.RadialGradient, innerColor: 0xff40c0ff, outerColor: 0x002040a0, radiusX: 44, radiusY: 29 }
                }
            };
        }
        return t;
    };

    // RoundedRectangle shader; r is a number or [topLeft, topRight, bottomRight, bottomLeft].
    T.rounded = function (r) { return { type: lng.shaders.RoundedRectangle, radius: r }; };
})(window.RttTest);
