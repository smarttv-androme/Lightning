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

import Component from "./Component.mjs";
import Utils from "../tree/Utils.mjs";

export default class Application extends Component {

    constructor(options = {}, properties) {
        // Save options temporarily to avoid having to pass it through the constructor.
        Application._temp_options = options;

        // Booting flag is used to postpone updateFocusSettings;
        Application.booting = true;
        const stage = new Stage(options.stage);
        super(stage, properties);
        Application.booting = false;

        this.__updateFocusCounter = 0;
        this.__hoveredChild = null;

        // We must construct while the application is not yet attached.
        // That's why we 'init' the stage later (which actually emits the attach event).
        this.stage.init();

        // Initially, the focus settings are updated after both the stage and application are constructed.
        this.updateFocusSettings();

        this.__keymap = this.getOption('keys');

        if (this.__keymap) {
            this.stage.platform.registerKeydownHandler((e) => {
                this._receiveKeydown(e);
            });

            this.stage.platform.registerKeyupHandler((e) => {
                this._receiveKeyup(e);
            });
        }

        if (this.getOption("enablePointer")) {
            this.stage.platform.registerClickHandler((e) => {
                this._receiveClick(e);
            });

            this.stage.platform.registerHoverHandler((e) => {
                this._receiveHover(e);
            });

            this.stage.platform.registerScrollWheelHandler((e) => {
                this._recieveScrollWheel(e);
            });

            this.cursor = 'default';
        }
    }

    getOption(name) {
        return this.__options[name];
    }

    _setOptions(o) {
        this.__options = {};

        let opt = (name, def) => {
            let value = o[name];

            if (value === undefined) {
                this.__options[name] = def;
            } else {
                this.__options[name] = value;
            }
        }

        opt('debug', false);
        opt('keys', {
            38: "Up",
            40: "Down",
            37: "Left",
            39: "Right",
            13: "Enter",
            8: "Back",
            27: "Exit"
        });
        opt('enablePointer', false);
    }

    __construct() {
        this.stage.setApplication(this);

        this._setOptions(Application._temp_options);
        delete Application._temp_options;

        /**
         * Tracks keys which are currently down.
         * Needs to be initialized in __construct, as focus changes can occur during a component's constructor
         *
         * @type {Map<string | number, Press>}
         */
        this.__presses = new Map();

        super.__construct();
    }

    __init() {
        super.__init();
        this.__updateFocus();
    }

    updateFocusPath() {
        this.__updateFocus();
    }

    __updateFocus() {
        const notOverridden = this.__updateFocusRec();

        if (!Application.booting && notOverridden) {
            this.updateFocusSettings();
        }
    }

    __updateFocusRec() {
        const updateFocusId = ++this.__updateFocusCounter;
        this.__updateFocusId = updateFocusId;

        const newFocusPath = this.__getFocusPath();
        const newFocusedComponent = newFocusPath[newFocusPath.length - 1];
        const prevFocusedComponent = this._focusPath ? this._focusPath[this._focusPath.length - 1] : undefined;

        if (!prevFocusedComponent) {
            // Focus events.
            this._focusPath = [];
            for (let i = 0, n = newFocusPath.length; i < n; i++) {
                this._focusPath.push(newFocusPath[i]);
                this._focusPath[i]._focus(newFocusedComponent, undefined);
                const focusOverridden = (this.__updateFocusId !== updateFocusId);
                if (focusOverridden) {
                    return false;
                }
            }
            return true;
        } else {
            let m = Math.min(this._focusPath.length, newFocusPath.length);
            let index;
            for (index = 0; index < m; index++) {
                if (this._focusPath[index] !== newFocusPath[index]) {
                    break;
                }
            }

            if (this._focusPath.length !== newFocusPath.length || index !== newFocusPath.length) {

                if (this.getOption('debug')) {
                    console.log('[Lightning] Focus changed: ' + newFocusedComponent.getLocationString());
                }

                // `index` is the common length of the old and new focus path.
                // If it is smaller than the depth of the key press, the focus path changed.
                // By clamping the depth here, key releases / long presses can still be routed
                // to ancestors in the focus path which were focused on key down, while
                // skipping the components which lost focus between key down and key up.
                // For example:
                //  [Application, ButtonRow, ButtonA] depth = 3
                //  [Application, ButtonRow, ButtonB] index = 2 => depth = 2
                for (const press of this.__presses.values()) {
                    if (index < press.depth) {
                        press.depth = index;
                    }
                }

                // Unfocus events.
                for (let i = this._focusPath.length - 1; i >= index; i--) {
                    const unfocusedElement = this._focusPath.pop();
                    unfocusedElement._unfocus(newFocusedComponent, prevFocusedComponent);
                    const focusOverridden = (this.__updateFocusId !== updateFocusId);
                    if (focusOverridden) {
                        return false;
                    }
                }

                // Focus events.
                for (let i = index, n = newFocusPath.length; i < n; i++) {
                    this._focusPath.push(newFocusPath[i]);
                    this._focusPath[i]._focus(newFocusedComponent, prevFocusedComponent);
                    const focusOverridden = (this.__updateFocusId !== updateFocusId);
                    if (focusOverridden) {
                        return false;
                    }
                }

                // Focus changed events.
                for (let i = 0; i < index; i++) {
                    this._focusPath[i]._focusChange(newFocusedComponent, prevFocusedComponent);
                }
            }
        }

        return true;
    }

    updateFocusSettings() {
        const focusedComponent = this._focusPath[this._focusPath.length - 1];

        // Get focus settings. These can be used for dynamic application-wide settings that depend on the
        // focus directly (such as the application background).
        const focusSettings = {};
        const defaultSetFocusSettings = Component.prototype._setFocusSettings;
        for (let i = 0, n = this._focusPath.length; i < n; i++) {
            if (this._focusPath[i]._setFocusSettings !== defaultSetFocusSettings) {
                this._focusPath[i]._setFocusSettings(focusSettings);
            }
        }

        const defaultHandleFocusSettings = Component.prototype._handleFocusSettings;
        for (let i = 0, n = this._focusPath.length; i < n; i++) {
            if (this._focusPath[i]._handleFocusSettings !== defaultHandleFocusSettings) {
                this._focusPath[i]._handleFocusSettings(focusSettings, this.__prevFocusSettings, focusedComponent);
            }
        }

        this.__prevFocusSettings = focusSettings;
    }

    _handleFocusSettings(settings, prevSettings, focused, prevFocused) {
        // Override to handle focus-based settings.
    }

    __getFocusPath() {
        const path = [this];
        let current = this;
        do {
            const nextFocus = current._getFocused();
            if (!nextFocus || (nextFocus === current)) {
                // Found!;
                break;
            }


            let ptr = nextFocus.cparent;
            if (ptr === current) {
                path.push(nextFocus);
            } else {
                // Not an immediate child: include full path to descendant.
                const newParts = [nextFocus];
                do {
                    if (!ptr) {
                        current._throwError("Return value for _getFocused must be an attached descendant component but its '" + nextFocus.getLocationString() + "'");
                    }
                    newParts.push(ptr);
                    ptr = ptr.cparent;
                } while (ptr !== current);

                // Add them reversed.
                for (let i = 0, n = newParts.length; i < n; i++) {
                    path.push(newParts[n - i - 1]);
                }
            }

            current = nextFocus;
        } while (true);

        return path;
    }

    get focusPath() {
        return this._focusPath;
    }

    /**
     * Injects an event in the state machines, top-down from application to focused component.
     */
    focusTopDownEvent(events, ...args) {
        const path = this.focusPath;
        const n = path.length;

        // Multiple events.
        for (let i = 0; i < n; i++) {
            const event = path[i]._getMostSpecificHandledMember(events);
            if (event !== undefined) {
                const returnValue = path[i][event](...args);
                if (returnValue !== false) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Injects an event in the state machines, bottom-up from focused component to application.
     */
    focusBottomUpEvent(events, ...args) {
        const path = this.focusPath;
        const n = path.length;

        // Multiple events.
        for (let i = n - 1; i >= 0; i--) {
            const event = path[i]._getMostSpecificHandledMember(events);
            if (event !== undefined) {
                const returnValue = path[i][event](...args);
                if (returnValue !== false) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Keydown listener
     *
     * Tracks keys which have been pressed so that we can make sure that key releases / long presses are only
     * routed to components which were on the focus path when the key is released.
     *
     * @param {KeyboardEvent} e
     * @private
     */
    _receiveKeydown(e) {
        const keys = this.__getKeys(e);

        if (keys) {
            for (let i = 0, n = keys.length; i < n; i++) {
                const key = keys[i];
                this.__keydown(key, [`_capture${key}`, "_captureKey"], [`_handle${key}`, "_handleKey"], e, key);
            }
        } else {
            this.__keydown(e.keyCode, ["_captureKey"], ["_handleKey"], e);
        }

        this.updateFocusPath();
    }

    /**
     * Keyup listener
     * To take away some confusion we add `Release` to the event to prevent ending up with method names like:
     *  _handleLeftUp / _handleUpUp / _handleEnterUp etc
     *
     * @param e
     * @private
     */
    _receiveKeyup(e) {
        const keys = this.__getKeys(e);

        if (keys) {
            for (let i = 0, n = keys.length; i < n; i++) {
                const key = keys[i];
                this.__keyup(key, [`_capture${key}Release`, "_captureKeyRelease"], [`_handle${key}Release`, "_handleKeyRelease"], e);
            }
        } else {
            this.__keyup(e.keyCode, ["_captureKeyRelease"], ["_handleKeyRelease"], e);
        }

        this.updateFocusPath();
    }

    /**
     * Returns the mapped names of the key, or undefined if the key is not mapped.
     *
     * @return {Array<string> | undefined}
     */
    __getKeys(e) {
        const key = this.__keymap[e.keyCode];
        if (!key) return undefined;

        return Array.isArray(key) ? key : [key];
    }

    /**
     * @param {string | number} id
     *   Either the key name for a mapped key, or key code for an unmapped key.
     * @param {Array<string>} captureEvents
     * @param {Array<string>} handleEvents
     * @param {KeyboardEvent} e
     * @param longpressKey
     *   The key name to use for the long press. Unmapped keys have no long press.
     */
    __keydown(id, captureEvents, handleEvents, e, longpressKey) {
        let press = this.__presses.get(id);

        // If the key was already down, treat it as a repeat. If the platform says that this is not a repeat,
        // then the key up of the previous press was probably missed.
        if (press && e.repeat !== false) {
            // Avoid repeating key inputs when there is a long press timer
            if (press.timer === undefined && !this.focusTopDownEvent(captureEvents, e)) {
                this.focusBottomUpEvent(handleEvents, e);
            }
            return;
        }

        if (press) {
            clearTimeout(press.timer);
        }

        const depth = this._focusPath.length;
        const focused = this._focusPath[depth - 1];
        press = {
            depth: depth,
            // The capture phase visits the focus path from index 0 up to, but not including, captureEnd.
            captureEnd: depth,
            // The handle phase visits the focus path from index depth - 1 down to, and including, handleEnd.
            handleEnd: 0,
            timer: undefined,
            long: false
        };
        this.__presses.set(id, press);

        const captured = this.__capturePressEvent(press, captureEvents, e);
        if (captured !== -1) {
            press.captureEnd = captured + 1;
            press.handleEnd = depth;
        } else {
            const handled = this.__handlePressEvent(press, handleEvents, e);
            if (handled !== -1) {
                press.handleEnd = handled;
            }
        }

        if (longpressKey) {
            this._startLongpressTimer(longpressKey, focused, press);
        }
    }

    /**
     * @param {string | number} id
     *   Either the key name for a mapped key, or key code for an unmapped key.
     * @param {Array<string>} captureEvents
     * @param {Array<string>} handleEvents
     * @param {KeyboardEvent} e
     */
    __keyup(id, captureEvents, handleEvents, e) {
        const press = this.__presses.get(id);

        // A key up without a key down has no route, so there is no component that may handle it
        if (!press) return;

        this.__presses.delete(id);
        clearTimeout(press.timer);

        // If a long press has been dispatched already, we want to avoid dispatching the release event as well
        if (!press.long) {
            this.__dispatchPressEvent(press, captureEvents, handleEvents, e);
        }
    }

    /**
     * Sends a release or long press along the route of the key down that started the press.
     *
     * The event is offered to the same components as the key down, in the same order. This means that it stops
     * at the component that consumed the key down. Components that lost focus since the key down are skipped.
     * As a result, a component never gets a long press or release for a key down that it could not handle.
     *
     * @param {Press} press
     * @param {Array<string>} captureEvents
     * @param {Array<string>} handleEvents
     * @param {KeyboardEvent} e
     */
    __dispatchPressEvent(press, captureEvents, handleEvents, e) {
        if (this.__capturePressEvent(press, captureEvents, e) === -1) {
            this.__handlePressEvent(press, handleEvents, e);
        }
    }

    /**
     * Top-down phase of a press event.
     * @param {Press} press
     * @param {Array<string>} events
     * @param {KeyboardEvent} e
     * @return the index in the focus path of the component that consumed the event, or -1.
     */
    __capturePressEvent(press, events, e) {
        const path = this._focusPath;

        // The depth decreases when a handler changes focus
        for (let i = 0; i < press.captureEnd && i < press.depth; i++) {
            const component = path[i];
            const event = component._getMostSpecificHandledMember(events);
            if (event !== undefined && component[event](e) !== false) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Bottom-up phase of a press event.
     * @param {Press} press
     * @param {Array<string>} events
     * @param {KeyboardEvent} e
     * @return the index in the focus path of the component that consumed the event, or -1.
     */
    __handlePressEvent(press, events, e) {
        const path = this._focusPath;

        for (let i = press.depth - 1; i >= press.handleEnd; i--) {
            // The depth gets smaller when a handler changes the focus.
            if (i < press.depth) {
                const component = path[i];
                const event = component._getMostSpecificHandledMember(events);
                if (event !== undefined && component[event](e) !== false) {
                    return i;
                }
            }
        }

        return -1;
    }

    /**
     * Registers and starts a timer for the pressed key. Timer will be cleared when the key is released
     * before the timer goes off.
     *
     * If key is not release (keyup) the longpress handler will be fired.
     * Configuration can be via the Components template:
     *
     * static _template() {
     *     return {
     *         w:100, h:100,
     *         longpress:{up:700, down:500}
     *     }
     * }     *
     * // this will get called when up has been pressed for 700ms
     * _handleUpLong() {
     *
     * }
     *
     * @param key
     * @param element
     *   The component that had focus at key down.
     * @param {Press} press
     * @private
     */
    _startLongpressTimer(key, element, press) {
        const config = element.longpress;
        const timeout = config && config[key.toLowerCase()];

        if (timeout) {
            if (!Utils.isNumber(timeout)) {
                element._throwError("config value for longpress must be a number");
            } else {
                press.timer = setTimeout(() => {
                    press.long = true;
                    this.__dispatchPressEvent(press, [`_capture${key}Long`, "_captureKey"], [`_handle${key}Long`, "_handleKey"], {});
                }, timeout);
            }
        }
    }

    _recieveScrollWheel(e) {
        const obj = e;
        const {clientX, clientY} = obj;

        if (clientX <= this.stage.w && clientY <= this.stage.h) {
            if (!this.fireTopDownScrollWheelHandler("_captureScroll", obj)) {
                this.fireBottomUpScrollWheelHandler("_handleScroll", obj);
            }
        }
    }

    fireTopDownScrollWheelHandler(event, obj) {
        let children = this.stage.application.children;
        let affected = this._findChildren([], children).reverse();
        let n = affected.length;

        while (n--) {
            const child = affected[n];
            if (child && child[event]) {
                child._captureScroll(obj);
                return true;
            }
        }
        return false;
    }

    fireBottomUpScrollWheelHandler(event, obj) {
        const {clientX, clientY} = obj;
        const target = this._getTargetChild(clientX, clientY);
        let child = target;

        // Search tree bottom up for a handler
        while (child !== null) {
            if (child && child[event]) {
                child._handleScroll(obj);
                return true;
            }
            child = child.parent;
        }
        return false;
    }

    _receiveClick(e) {
        const obj = e;
        const {clientX, clientY} = obj;

        if (clientX <= this.stage.w && clientY <= this.stage.h) {
            this.stage.application.fireBottomUpClickHandler(obj);
        }
    }

    fireBottomUpClickHandler(obj) {
        const {clientX, clientY} = obj;
        const target = this._getTargetChild(clientX, clientY);
        const precision = this.stage.getRenderPrecision() / this.stage.getOption('devicePixelRatio');
        let child = target;

        // Search tree bottom up for a handler
        while (child !== null) {
            if (child && child["_handleClick"]) {
                const {px, py} = child.core._worldContext;
                const cx = px * precision;
                const cy = py * precision;

                const localCoords = {
                    x: clientX - cx,
                    y: clientY - cy
                }

                const returnValue = child._handleClick(target, localCoords);
                if (returnValue !== false) {
                    break;
                }
            }
            child = child.parent;
        }
    }

    _receiveHover(e) {
        const obj = e;
        const {clientX, clientY} = obj;

        if (clientX <= this.stage.w && clientY <= this.stage.h) {
            this.stage.application.fireBottomUpHoverHandler(obj);
        }
    }

    fireBottomUpHoverHandler(obj) {
        const {clientX, clientY} = obj;
        const target = this._getTargetChild(clientX, clientY);

        // Only fire handlers when pointer target changes
        if (target !== this.__hoveredChild) {

            let hoveredBranch = new Set();
            let newHoveredBranch = new Set();

            if (target) {
                newHoveredBranch = new Set(target.getAncestors());
            }

            if (this.__hoveredChild) {
                hoveredBranch = new Set(this.__hoveredChild.getAncestors());
                for (const elem of [...hoveredBranch].filter((e) => !newHoveredBranch.has(e))) {
                    const c = Component.getComponent(elem);
                    if (c["_handleUnhover"]) {
                        try {
                            c._handleUnhover(elem);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    if (elem.parent && elem.parent.cursor) {
                        this.stage.getCanvas().style.cursor = elem.parent.cursor;
                    }
                }
            }

            this.__hoveredChild = target;

            const diffBranch = [...newHoveredBranch].filter((e) => !hoveredBranch.has(e))
            for (const elem of diffBranch) {
                const c = Component.getComponent(elem);
                if (c["_handleHover"]) {
                    c._handleHover(elem);
                }
            }

            // New element hover cursor
            const lastElement = diffBranch[0];
            if (lastElement && lastElement.cursor) {
                this.stage.getCanvas().style.cursor = lastElement.cursor;
            }

            // Rerun _handleHover for target element in case it's been hovered
            // back from its child
            if (diffBranch.length === 0 && target) {
                const c = Component.getComponent(target);
                if (c["_handleHover"]) {
                    c._handleHover(target);
                }
            }
        }
    }

    _getTargetChild(clientX, clientY) {
        let children = this.stage.application.children;
        let affected = this._findChildren([], children);
        let hoverableChildren = this._withinClickableRange(affected, clientX, clientY);

        hoverableChildren.sort((a, b) => {
            // Sort by zIndex and then id
            if (a.zIndex > b.zIndex) {
                return 1;
            } else if (a.zIndex < b.zIndex) {
                return -1;
            } else {
                return a.id > b.id ? 1 : -1;
            }
        });

        if (hoverableChildren.length) {
            // Assume target has highest zIndex (id when zIndex equal)
            return hoverableChildren.slice(-1)[0];
        } else {
            return null;
        }
    }

    _findChildren(bucket, children) {
        let n = children.length;
        while (n--) {
            const child = children[n];
            // only add active children
            if (child.__active && child.collision) {
                if (child.collision === true) {
                    bucket.push(child);
                }
                if (child.hasChildren()) {
                    this._findChildren(bucket, child.children);
                }
            }
        }
        return bucket;
    }

    _withinClickableRange(affectedChildren, cursorX, cursorY) {
        let n = affectedChildren.length;
        const candidates = [];

        // loop through affected children
        // and perform collision detection
        while (n--) {
            const child = affectedChildren[n];
            const precision = this.stage.getRenderPrecision() / this.stage.getOption('devicePixelRatio');
            const ctx = child.core._worldContext;

            const cx = ctx.px * precision;
            const cy = ctx.py * precision;
            const cw = child.finalW * ctx.ta * precision;
            const ch = child.finalH * ctx.td * precision;

            if (cx > this.stage.w || cy > this.stage.h) {
                continue;
            }

            if (child.parent.core._scissor) {
                const scissor = child.parent.core._scissor.map((v) => v * precision);
                if (!this._testCollision(cursorX, cursorY, ...scissor))
                    continue
            }

            if (this._testCollision(cursorX, cursorY, cx, cy, cw, ch)) {
                candidates.push(child);
            }
        }
        return candidates;
    }

    _testCollision(px, py, cx, cy, cw, ch) {
        if (px >= cx &&
            px <= cx + cw &&
            py >= cy &&
            py <= cy + ch) {
            return true;
        }
        return false;
    }

    destroy() {
        if (!this._destroyed) {
            this._destroy();
            this.stage.destroy();
            this._destroyed = true;
        }
    }

    _destroy() {
        // This forces the _detach, _disabled and _active events to be called.
        this.stage.setApplication(undefined);
        this._updateAttachedFlag();
        this._updateEnabledFlag();

        for (const press of this.__presses.values()) {
            clearTimeout(press.timer);
        }

        this.__presses.clear();
    }

    getCanvas() {
        return this.stage.getCanvas();
    }

}

import Stage from "../tree/Stage.mjs";
