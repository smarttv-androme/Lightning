/*
 * If not stated otherwise in this file or this component's LICENSE file the
 * following copyright and licenses apply:
 *
 * Copyright 2020 Metrological
 *
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import StageUtils from "../tree/StageUtils.mjs";
import Utils from "../tree/Utils.mjs";
import { getFontSetting, measureText, wrapText } from "./TextTextureRendererUtils.mjs";

export default class TextTextureRenderer {

    constructor(stage, canvas, settings) {
        this._stage = stage;
        this._canvas = canvas;
        this._context = this._canvas.getContext('2d');
        this._settings = settings;
    }

    getPrecision() {
        return this._settings.precision;
    };

    setFontProperties() {
        this._context.font = getFontSetting(
            this._settings.fontFace,
            this._settings.fontStyle,
            this._settings.fontSize,
            this.getPrecision(),
            this._stage.getOption('defaultFontFace'),
        );
        this._context.textBaseline = 'alphabetic';
    };

    draw() {
        return Utils.isSpark ? this._stage.platform.drawText(this) : this._draw();
    }

    _calculateRenderInfo() {
        let renderInfo = {};

        const precision = this.getPrecision();

        const paddingLeft = this._settings.paddingLeft * precision;
        const paddingRight = this._settings.paddingRight * precision;
        const fontSize = this._settings.fontSize * precision;
        let lineHeight = this._settings.lineHeight * precision;
        const w = this._settings.w * precision;
        const h = this._settings.h * precision;
        let wordWrapWidth = this._settings.wordWrapWidth * precision;
        const cutSx = this._settings.cutSx * precision;
        const cutEx = this._settings.cutEx * precision;
        const cutSy = this._settings.cutSy * precision;
        const cutEy = this._settings.cutEy * precision;
        const letterSpacing = (this._settings.letterSpacing || 0) * precision;
        const textIndent = this._settings.textIndent * precision;

        // Set font properties.
        this.setFontProperties();

        // Total width.
        let width = w || this._stage.getOption('w');

        // Inner width.
        let innerWidth = width - (paddingLeft);
        if (innerWidth < 10) {
            width += (10 - innerWidth);
            innerWidth = 10;
        }

        if (!wordWrapWidth) {
            wordWrapWidth = innerWidth
        }

        // Text overflow
        if (this._settings.textOverflow && !this._settings.wordWrap) {
            let suffix;
            switch (this._settings.textOverflow) {
                case 'clip':
                    suffix = '';
                    break;
                case 'ellipsis':
                    suffix = this._settings.maxLinesSuffix;
                    break;
                default:
                    suffix = this._settings.textOverflow;
            }
            this._settings.text = this.wrapWord(this._settings.text, wordWrapWidth - textIndent, suffix)
        }

        // word wrap
        // preserve original text
        let linesInfo;
        if (this._settings.wordWrap) {
            linesInfo = this.wrapText(this._settings.text, wordWrapWidth, letterSpacing, textIndent);
        } else {
            linesInfo = {l: this._settings.text.split(/(?:\r\n|\r|\n)/), n: []};
            let i, n = linesInfo.l.length;
            for (let i = 0; i < n - 1; i++) {
                linesInfo.n.push(i);
            }
        }
        let lines = linesInfo.l;

        if (this._settings.maxLines && lines.length > this._settings.maxLines) {
            let usedLines = lines.slice(0, this._settings.maxLines);

            let otherLines = null;
            if (this._settings.maxLinesSuffix) {
                // Wrap again with max lines suffix enabled.
                let w = this._settings.maxLinesSuffix ? this.measureText(this._settings.maxLinesSuffix) : 0;
                let al = this.wrapText(usedLines[usedLines.length - 1], wordWrapWidth - w, letterSpacing, textIndent);
                usedLines[usedLines.length - 1] = al.l[0] + this._settings.maxLinesSuffix;
                otherLines = [al.l.length > 1 ? al.l[1] : ''];
            } else {
                otherLines = [''];
            }

            // Re-assemble the remaining text.
            let i, n = lines.length;
            let j = 0;
            let m = linesInfo.n.length;
            for (i = this._settings.maxLines; i < n; i++) {
                otherLines[j] += (otherLines[j] ? " " : "") + lines[i];
                if (i + 1 < m && linesInfo.n[i + 1]) {
                    j++;
                }
            }

            renderInfo.remainingText = otherLines.join("\n");

            renderInfo.moreTextLines = true;

            lines = usedLines;
        } else {
            renderInfo.moreTextLines = false;
            renderInfo.remainingText = "";
        }

        // calculate text width
        let maxLineWidth = 0;
        let lineWidths = [];
        for (let i = 0; i < lines.length; i++) {
            let lineWidth = this.measureText(lines[i], letterSpacing) + (i === 0 ? textIndent : 0);
            lineWidths.push(lineWidth);
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
        }

        renderInfo.lineWidths = lineWidths;

        if (!w) {
            // Auto-set width to max text length.
            width = maxLineWidth + paddingLeft + paddingRight;
            innerWidth = maxLineWidth;
        }

        const fontMetrics = this._getFontMetrics();
        if (fontMetrics) {
            const baseline_ratio = fontMetrics.baseline_ratio;
            const cap_height_ratio = fontMetrics.cap_ratio;
            const descent_ratio = fontMetrics.descent_ratio;

            const alphabetic_pos_from_top = fontSize * baseline_ratio;
            const height_based_on_font_metrics = fontSize * (baseline_ratio + descent_ratio);

            let centerOnCapsPadding = 0;
            if (this._settings.centerOnCaps) {
                const capitalHeight = fontSize * cap_height_ratio;
                const space_above_capital = alphabetic_pos_from_top - capitalHeight;
                const descent = fontSize * descent_ratio
                centerOnCapsPadding = descent - space_above_capital
            }

            const fullFontHeight = height_based_on_font_metrics + centerOnCapsPadding;
            const fontDrawPositionBasedOnFullHeight = alphabetic_pos_from_top + centerOnCapsPadding;
            renderInfo.fullFontHeight = fullFontHeight;
            renderInfo.fontDrawPositionBasedOnFullHeight = fontDrawPositionBasedOnFullHeight;
        }

        // calculate text height
        lineHeight = lineHeight || renderInfo.fullFontHeight;

        let height;
        if (h) {
            height = h;
        } else {
            height = lineHeight * (lines.length - 1) + Math.max(lineHeight, renderInfo.fullFontHeight);
        }

        renderInfo.w = width;
        renderInfo.h = height;
        renderInfo.lines = lines;
        renderInfo.precision = precision;

        if (!width) {
            // To prevent canvas errors.
            width = 1;
        }

        if (!height) {
            // To prevent canvas errors.
            height = 1;
        }

        if (cutSx || cutEx) {
            if (cutSx && cutEx) {
                width = Math.min(width, cutEx - cutSx);
            } else {
                width = Math.min(width, width - cutSx);
            }
        }

        if (cutSy || cutEy) {
            if (cutSy && cutEy) {
                height = Math.min(height, cutEy - cutSy);
            } else {
                height = Math.min(height, height - cutSy);
            }
        }

        renderInfo.width = width;
        renderInfo.innerWidth = innerWidth;
        renderInfo.height = height;
        renderInfo.fontSize = fontSize;
        renderInfo.cutSx = cutSx;
        renderInfo.cutSy = cutSy;
        renderInfo.cutEx = cutEx;
        renderInfo.cutEy = cutEy;
        renderInfo.lineHeight = lineHeight;
        renderInfo.lineWidths = lineWidths;
        renderInfo.paddingLeft = paddingLeft;
        renderInfo.paddingRight = paddingRight;
        renderInfo.letterSpacing = letterSpacing;
        renderInfo.textIndent = textIndent;

        return renderInfo;
    }

    _draw() {
        const renderInfo = this._calculateRenderInfo();
        const precision = this.getPrecision();

        // Add extra margin to prevent issue with clipped text when scaling.
        this._canvas.width = Math.ceil(renderInfo.width + this._stage.getOption('textRenderIssueMargin'));
        this._canvas.height = Math.ceil(renderInfo.height);

        // Canvas context has been reset.
        this.setFontProperties();

        if (renderInfo.fontSize >= 128) {
            // WpeWebKit bug: must force compositing because cairo-traps-compositor will not work with text first.
            this._context.globalAlpha = 0.01;
            this._context.fillRect(0, 0, 0.01, 0.01);
            this._context.globalAlpha = 1.0;
        }

        if (renderInfo.cutSx || renderInfo.cutSy) {
            this._context.translate(-renderInfo.cutSx, -renderInfo.cutSy);
        }

        let linePositionX;
        let linePositionY;

        let drawLines = [];

        // Draw lines line by line.
        for (let i = 0, n = renderInfo.lines.length; i < n; i++) {
            linePositionX = i === 0 ? renderInfo.textIndent : 0;

            linePositionY = (i * renderInfo.lineHeight) + renderInfo.fontDrawPositionBasedOnFullHeight;
             if (this._settings.verticalAlign === 'top') {
                // already ok
            } else if (this._settings.verticalAlign === 'bottom') {
                linePositionY += renderInfo.lineHeight - renderInfo.fullFontHeight;
            } else {
                linePositionY += (renderInfo.lineHeight - renderInfo.fullFontHeight) / 2;
            }

            if (this._settings.textAlign === 'right') {
                linePositionX += (renderInfo.innerWidth - renderInfo.lineWidths[i]);
            } else if (this._settings.textAlign === 'center') {
                linePositionX += ((renderInfo.innerWidth - renderInfo.lineWidths[i]) / 2);
            }
            linePositionX += renderInfo.paddingLeft;

            drawLines.push({text: renderInfo.lines[i], x: linePositionX, y: linePositionY, w: renderInfo.lineWidths[i]});
        }

        // Highlight.
        if (this._settings.highlight) {
            let color = this._settings.highlightColor || 0x00000000;

            let hlHeight = (this._settings.highlightHeight * precision || renderInfo.fullFontHeight);
            const offset = this._settings.highlightOffset * precision;
            const hlPaddingLeft = (this._settings.highlightPaddingLeft !== null ? this._settings.highlightPaddingLeft * precision : renderInfo.paddingLeft);
            const hlPaddingRight = (this._settings.highlightPaddingRight !== null ? this._settings.highlightPaddingRight * precision : renderInfo.paddingRight);

            this._context.fillStyle = StageUtils.getRgbaString(color);
            for (let i = 0; i < drawLines.length; i++) {
                let drawLine = drawLines[i];
                this._context.fillRect((drawLine.x - hlPaddingLeft), (drawLine.y - renderInfo.fontDrawPositionBasedOnFullHeight + offset), (drawLine.w + hlPaddingRight + hlPaddingLeft), hlHeight);
            }
        }

        // Text shadow.
        let prevShadowSettings = null;
        if (this._settings.shadow) {
            prevShadowSettings = [this._context.shadowColor, this._context.shadowOffsetX, this._context.shadowOffsetY, this._context.shadowBlur];

            this._context.shadowColor = StageUtils.getRgbaString(this._settings.shadowColor);
            this._context.shadowOffsetX = this._settings.shadowOffsetX * precision;
            this._context.shadowOffsetY = this._settings.shadowOffsetY * precision;
            this._context.shadowBlur = this._settings.shadowBlur * precision;
        }

        this._context.fillStyle = StageUtils.getRgbaString(this._settings.textColor);
        for (let i = 0, n = drawLines.length; i < n; i++) {
            let drawLine = drawLines[i];

            if (renderInfo.letterSpacing === 0) {
                this._context.fillText(drawLine.text, drawLine.x, drawLine.y);
            } else {
                const textSplit = drawLine.text.split('');
                let x = drawLine.x;
                for (let i = 0, j = textSplit.length; i < j; i++) {
                    this._context.fillText(textSplit[i], x, drawLine.y);
                    x += this.measureText(textSplit[i], renderInfo.letterSpacing);
                }
            }
        }

        if (prevShadowSettings) {
            this._context.shadowColor = prevShadowSettings[0];
            this._context.shadowOffsetX = prevShadowSettings[1];
            this._context.shadowOffsetY = prevShadowSettings[2];
            this._context.shadowBlur = prevShadowSettings[3];
        }

        if (renderInfo.cutSx || renderInfo.cutSy) {
            this._context.translate(renderInfo.cutSx, renderInfo.cutSy);
        }

        this.renderInfo = renderInfo;
    };

    wrapWord(word, wordWrapWidth, suffix) {
        const suffixWidth = this.measureText(suffix);
        const wordLen = word.length
        const wordWidth = this.measureText(word);

        /* If word fits wrapWidth, do nothing */
        if (wordWidth <= wordWrapWidth) {
            return word;
        }

        /* Make initial guess for text cuttoff */
        let cutoffIndex = Math.floor((wordWrapWidth * wordLen) / wordWidth);
        let truncWordWidth = this.measureText(word.substring(0, cutoffIndex)) + suffixWidth;

        /* In case guess was overestimated, shrink it letter by letter. */
        if (truncWordWidth > wordWrapWidth) {
            while (cutoffIndex > 0) {
                truncWordWidth = this.measureText(word.substring(0, cutoffIndex)) + suffixWidth;
                if (truncWordWidth > wordWrapWidth) {
                    cutoffIndex -= 1;
                } else {
                    break;
                }
            }

        /* In case guess was underestimated, extend it letter by letter. */
        } else {
            while (cutoffIndex < wordLen) {
                truncWordWidth = this.measureText(word.substring(0, cutoffIndex)) + suffixWidth;
                if (truncWordWidth < wordWrapWidth) {
                    cutoffIndex += 1;
                } else {
                    // Finally, when bound is crossed, retract last letter.
                    cutoffIndex -=1;
                    break;
                }
            }
        }

        /* If wrapWidth is too short to even contain suffix alone, return empty string */
        return word.substring(0, cutoffIndex) + (wordWrapWidth >= suffixWidth ? suffix : '');
    }

    /**
     * See {@link wrapText}
     *
     * @param {string} text
     * @param {number} wordWrapWidth
     * @param {number} letterSpacing
     * @param {number} indent
     * @returns
     */
    wrapText(text, wordWrapWidth, letterSpacing, indent = 0) {
        return wrapText(this._context, text, wordWrapWidth, letterSpacing, indent);
    };

    /**
     * See {@link measureText}
     *
     * @param {string} word
     * @param {number} space
     * @returns {number}
     */
    measureText(word, space = 0) {
        return measureText(this._context, word, space);
    }

    /**
     * @return {Stage.FontMetrics | undefined}
     */
    _getFontMetrics() {
        const fontMetrics = this._stage.fontMetrics[this._settings.fontFace] ?? this._stage.fontMetrics[this._stage.getOption('defaultFontFace')];

        if (!fontMetrics) {
            console.warn(`[Lightning] No font metrics found for font '${this._settings.fontFace}'!`);
            return undefined;
        }

        return fontMetrics
    }
}
