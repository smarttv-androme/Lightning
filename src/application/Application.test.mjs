import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Application from './Application.mjs';

const ENTER = 13;
const UNMAPPED = 99;

let log;

/**
 * Stands in for a component in the focus path. Every handler logs "<name>.<event>" and returns the given value.
 */
function component(name, handlers = {}, longpress) {
    const c = {
        name,
        longpress,
        _focus() {},
        _unfocus() {},
        _focusChange() {},
        _getMostSpecificHandledMember(events) {
            return events.find((event) => this[event] !== undefined);
        }
    };

    for (const [event, returnValue] of Object.entries(handlers)) {
        c[event] = () => {
            log.push(`${name}.${event}`);
            return typeof returnValue === 'function' ? returnValue() : returnValue;
        };
    }

    return c;
}

/**
 * Creates an application without a stage. Only the focus path and the key dispatching work.
 */
function createApp(focusPath) {
    const app = Object.create(Application.prototype);
    app.__keymap = {[ENTER]: "Enter"};
    app.__presses = new Map();
    app.__updateFocusCounter = 0;
    app.__getFocusPath = () => app.__testFocusPath.slice();
    app.getOption = () => false;
    app.updateFocusSettings = () => {};
    focus(app, focusPath);
    return app;
}

function focus(app, focusPath) {
    app.__testFocusPath = focusPath;
    app.updateFocusPath();
}

describe('Application key dispatching', () => {
    beforeEach(() => {
        log = [];
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sends the release to a component that did not handle the key down', () => {
        const root = component('root');
        const tile = component('tile', {_handleEnterRelease: undefined});
        const app = createApp([root, tile]);

        app._receiveKeydown({keyCode: ENTER});
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual(['tile._handleEnterRelease']);
    });

    it('does not send the release or long press to a component that got focus during the press', () => {
        const root = component('root', {_captureEnterRelease: false});
        const tile = component('tile', {_handleEnterRelease: undefined, _handleEnterLong: undefined}, {enter: 500});
        const button = component('button', {_handleEnter: () => focus(app, [root, tile])});
        const app = createApp([root, button]);

        app._receiveKeydown({keyCode: ENTER});
        vi.advanceTimersByTime(1000);
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual(['button._handleEnter', 'root._captureEnterRelease']);
    });

    it('does not send the release to a component that got focus without a key down', () => {
        const root = component('root');
        const tile = component('tile', {_handleEnterRelease: undefined});
        const button = component('button', {_handleEnterRelease: undefined});
        const app = createApp([root, tile]);

        app._receiveKeydown({keyCode: ENTER});
        focus(app, [root, button]);
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual([]);
    });

    it('does not send the release to a component that lost and regained focus during the press', () => {
        const root = component('root');
        const tile = component('tile', {_handleEnterRelease: undefined});
        const dialog = component('dialog');
        const app = createApp([root, tile]);

        app._receiveKeydown({keyCode: ENTER});
        focus(app, [root, dialog]);
        focus(app, [root, tile]);
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual([]);
    });

    it('does not keep references to components', () => {
        const root = component('root');
        const tile = component('tile');
        const dialog = component('dialog');
        const app = createApp([root, tile]);

        app._receiveKeydown({keyCode: ENTER});
        focus(app, [root, dialog]);

        const press = app.__presses.get("Enter");
        expect(press.depth).toBe(1);
        expect(Object.values(press).filter((value) => typeof value === 'object')).toEqual([]);
    });

    it('does not send the release to an ancestor of the component that handled the key down', () => {
        const page = component('page', {_handleEnterRelease: undefined});
        const button = component('button', {_handleEnter: undefined});
        const app = createApp([page, button]);

        app._receiveKeydown({keyCode: ENTER});
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual(['button._handleEnter']);
    });

    it('sends the release to a descendant of the component that handled the key down', () => {
        const root = component('root', {_handleKey: undefined});
        const tile = component('tile', {_handleEnterRelease: undefined});
        const app = createApp([root, tile]);

        app._receiveKeydown({keyCode: ENTER});
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual(['root._handleKey', 'tile._handleEnterRelease']);
    });

    it('does not send the release to a descendant of the component that captured the key down', () => {
        const root = component('root', {_captureEnterRelease: false});
        const blocker = component('blocker', {_captureKey: undefined});
        const tile = component('tile', {_handleEnterRelease: undefined, _handleEnterLong: undefined}, {enter: 500});
        const app = createApp([root, blocker, tile]);

        app._receiveKeydown({keyCode: ENTER});
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual(['blocker._captureKey', 'root._captureEnterRelease']);
    });

    it('sends one long press instead of the release, and does not repeat the key down', () => {
        const tile = component('tile', {
            _handleEnter: undefined,
            _handleEnterRelease: undefined,
            _handleEnterLong: undefined
        }, {enter: 500});
        const app = createApp([tile]);

        app._receiveKeydown({keyCode: ENTER});
        for (let i = 0; i < 20; i++) {
            vi.advanceTimersByTime(100);
            app._receiveKeydown({keyCode: ENTER});
        }
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual(['tile._handleEnter', 'tile._handleEnterLong']);
    });

    it('sends the release when the key is released before the long press', () => {
        const tile = component('tile', {_handleEnterRelease: undefined, _handleEnterLong: undefined}, {enter: 500});
        const app = createApp([tile]);

        app._receiveKeydown({keyCode: ENTER});
        vi.advanceTimersByTime(400);
        app._receiveKeyup({keyCode: ENTER});
        vi.advanceTimersByTime(1000);

        expect(log).toEqual(['tile._handleEnterRelease']);
    });

    it('sends a repeat to the focused component without changing the route of the release', () => {
        const root = component('root');
        const tile = component('tile', {_handleEnter: undefined, _handleEnterRelease: undefined});
        const button = component('button', {_handleEnter: () => focus(app, [root, tile])});
        const app = createApp([root, button]);

        app._receiveKeydown({keyCode: ENTER});
        app._receiveKeydown({keyCode: ENTER});
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual(['button._handleEnter', 'tile._handleEnter']);
    });

    it('starts a new press when the platform reports that a key down is not a repeat', () => {
        const root = component('root');
        const tile = component('tile', {_handleEnterRelease: undefined});
        const button = component('button', {_handleEnterRelease: undefined});
        const app = createApp([root, button]);

        // The key up of this press is missed.
        app._receiveKeydown({keyCode: ENTER, repeat: false});
        focus(app, [root, tile]);

        app._receiveKeydown({keyCode: ENTER, repeat: false});
        app._receiveKeyup({keyCode: ENTER});

        expect(log).toEqual(['tile._handleEnterRelease']);
    });

    it('ignores a key up without a key down', () => {
        const tile = component('tile', {_handleEnterRelease: undefined, _handleKeyRelease: undefined});
        const app = createApp([tile]);

        app._receiveKeyup({keyCode: ENTER});
        app._receiveKeyup({keyCode: UNMAPPED});

        expect(log).toEqual([]);
    });

    it('sends an unmapped key to the generic handlers', () => {
        const tile = component('tile', {_handleKey: undefined, _handleKeyRelease: undefined});
        const app = createApp([tile]);

        app._receiveKeydown({keyCode: UNMAPPED});
        app._receiveKeyup({keyCode: UNMAPPED});

        expect(log).toEqual(['tile._handleKey', 'tile._handleKeyRelease']);
    });
});
