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

import FlexTestUtils from "./src/FlexTestUtils.mjs";

const flexTestUtils = new FlexTestUtils();

/**
 * Gap semantics follow CSS:
 * - `columnGap` is the horizontal space between items or lines.
 * - `rowGap` is the vertical space between items or lines.
 * - `gap` sets both.
 * Gaps are only placed between items and between lines, never at the edges.
 */
describe('layout', () => {
    describe('gap', () => {

        describe('settings', () => {
            it('defaults to 0', () => {
                const root = flexTestUtils.buildFlexFromStructure({flex: {}});
                chai.assert.equal(root.flex.rowGap, 0);
                chai.assert.equal(root.flex.columnGap, 0);
            });

            it('gap sets rowGap and columnGap', () => {
                const root = flexTestUtils.buildFlexFromStructure({flex: {gap: 15}});
                chai.assert.equal(root.flex.rowGap, 15);
                chai.assert.equal(root.flex.columnGap, 15);
            });

            it('rowGap and columnGap can be set separately', () => {
                const root = flexTestUtils.buildFlexFromStructure({flex: {rowGap: 5, columnGap: 25}});
                chai.assert.equal(root.flex.rowGap, 5);
                chai.assert.equal(root.flex.columnGap, 25);
            });
        });

        describe('annotated', () => {

            flexTestUtils.addMochaTestForAnnotatedStructure('row, fit to contents', {
                flex: {columnGap: 20},
                r: [0, 0, 490, 300],
                children: [
                    {w: 200, h: 300, r: [0, 0, 200, 300]},
                    {w: 100, h: 100, r: [220, 0, 100, 100]},
                    {w: 150, h: 150, r: [340, 0, 150, 150]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('gap shorthand on a single line', {
                flex: {gap: 20},
                r: [0, 0, 490, 300],
                children: [
                    {w: 200, h: 300, r: [0, 0, 200, 300]},
                    {w: 100, h: 100, r: [220, 0, 100, 100]},
                    {w: 150, h: 150, r: [340, 0, 150, 150]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('row ignores rowGap on a single line', {
                flex: {rowGap: 50},
                r: [0, 0, 450, 300],
                children: [
                    {w: 200, h: 300, r: [0, 0, 200, 300]},
                    {w: 100, h: 100, r: [200, 0, 100, 100]},
                    {w: 150, h: 150, r: [300, 0, 150, 150]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('column uses rowGap on the main axis', {
                flex: {direction: 'column', rowGap: 10, columnGap: 50},
                r: [0, 0, 200, 570],
                children: [
                    {w: 200, h: 300, r: [0, 0, 200, 300]},
                    {w: 100, h: 100, r: [0, 310, 100, 100]},
                    {w: 150, h: 150, r: [0, 420, 150, 150]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('wrap', {
                flex: {wrap: true, columnGap: 20, rowGap: 10},
                w: 350,
                r: [0, 0, 350, 460],
                children: [
                    {w: 200, h: 300, r: [0, 0, 200, 300]},
                    {w: 100, h: 100, r: [220, 0, 100, 100]},
                    {w: 150, h: 150, r: [0, 310, 150, 150]}
                ]
            });

            // Without the gap, the first two items (200 + 100) would fit in 310.
            flexTestUtils.addMochaTestForAnnotatedStructure('wrap point includes gap', {
                flex: {wrap: true, columnGap: 20, rowGap: 10},
                w: 310,
                r: [0, 0, 310, 460],
                children: [
                    {w: 200, h: 300, r: [0, 0, 200, 300]},
                    {w: 100, h: 100, r: [0, 310, 100, 100]},
                    {w: 150, h: 150, r: [120, 310, 150, 150]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('column wrap', {
                flex: {direction: 'column', wrap: true, rowGap: 20, columnGap: 10},
                h: 350,
                r: [0, 0, 460, 350],
                children: [
                    {w: 300, h: 200, r: [0, 0, 300, 200]},
                    {w: 100, h: 100, r: [0, 220, 100, 100]},
                    {w: 150, h: 150, r: [310, 0, 150, 150]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('grow', {
                flex: {columnGap: 20},
                w: 500,
                r: [0, 0, 500, 100],
                children: [
                    {w: 100, h: 100, flexItem: {grow: 1}, r: [0, 0, 380, 100]},
                    {w: 100, h: 100, r: [400, 0, 100, 100]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('shrink', {
                flex: {columnGap: 20},
                w: 300,
                r: [0, 0, 300, 100],
                children: [
                    {w: 200, h: 100, flexItem: {shrink: 1}, r: [0, 0, 140, 100]},
                    {w: 200, h: 100, flexItem: {shrink: 1}, r: [160, 0, 140, 100]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('justifyContent: space-between', {
                flex: {columnGap: 20, justifyContent: 'space-between'},
                w: 500,
                r: [0, 0, 500, 100],
                children: [
                    {w: 100, h: 100, r: [0, 0, 100, 100]},
                    {w: 100, h: 100, r: [200, 0, 100, 100]},
                    {w: 100, h: 100, r: [400, 0, 100, 100]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('justifyContent: center', {
                flex: {columnGap: 20, justifyContent: 'center'},
                w: 500,
                r: [0, 0, 500, 100],
                children: [
                    {w: 100, h: 100, r: [80, 0, 100, 100]},
                    {w: 100, h: 100, r: [200, 0, 100, 100]},
                    {w: 100, h: 100, r: [320, 0, 100, 100]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('row-reverse', {
                flex: {direction: 'row-reverse', columnGap: 20},
                w: 500,
                r: [0, 0, 500, 300],
                children: [
                    {w: 200, h: 300, r: [300, 0, 200, 300]},
                    {w: 100, h: 100, r: [180, 0, 100, 100]},
                    {w: 150, h: 150, r: [10, 0, 150, 150]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('column-reverse', {
                flex: {direction: 'column-reverse', rowGap: 10},
                h: 600,
                r: [0, 0, 100, 600],
                children: [
                    {w: 100, h: 100, r: [0, 500, 100, 100]},
                    {w: 100, h: 100, r: [0, 390, 100, 100]},
                    {w: 100, h: 100, r: [0, 280, 100, 100]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('alignContent: space-between', {
                flex: {wrap: true, rowGap: 20, alignContent: 'space-between'},
                w: 250,
                h: 500,
                r: [0, 0, 250, 500],
                children: [
                    {w: 200, h: 100, r: [0, 0, 200, 100]},
                    {w: 200, h: 100, r: [0, 200, 200, 100]},
                    {w: 200, h: 100, r: [0, 400, 200, 100]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('padding and gap', {
                flex: {padding: 10, columnGap: 20},
                r: [0, 0, 360, 120],
                children: [
                    {w: 100, h: 100, r: [10, 10, 100, 100]},
                    {w: 100, h: 100, r: [130, 10, 100, 100]},
                    {w: 100, h: 100, r: [250, 10, 100, 100]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('margin and gap', {
                flex: {columnGap: 20},
                r: [0, 0, 350, 100],
                children: [
                    {w: 100, h: 100, flexItem: {marginRight: 10}, r: [0, 0, 100, 100]},
                    {w: 100, h: 100, r: [130, 0, 100, 100]},
                    {w: 100, h: 100, r: [250, 0, 100, 100]}
                ]
            });

            flexTestUtils.addMochaTestForAnnotatedStructure('single item has no gap', {
                flex: {gap: 20},
                r: [0, 0, 100, 100],
                children: [
                    {w: 100, h: 100, r: [0, 0, 100, 100]}
                ]
            });

            // The nested container may not shrink below its contents including gaps (3 * 100 + 2 * 20).
            flexTestUtils.addMochaTestForAnnotatedStructure('nested container min size includes gap', {
                flex: {},
                w: 300,
                r: [0, 0, 300, 100],
                children: [
                    {
                        flex: {columnGap: 20}, r: [0, 0, 340, 100],
                        children: [
                            {w: 100, h: 100, r: [0, 0, 100, 100]},
                            {w: 100, h: 100, r: [120, 0, 100, 100]},
                            {w: 100, h: 100, r: [240, 0, 100, 100]}
                        ]
                    }
                ]
            });

        });

        describe('compared to html', () => {
            const structures = {
                'row, wrap, justifyContent: space-around': {
                    flex: {wrap: true, columnGap: 15, rowGap: 25, justifyContent: 'space-around'},
                    w: 400,
                    children: [
                        {w: 120, h: 80},
                        {w: 90, h: 120},
                        {w: 140, h: 60},
                        {w: 70, h: 100},
                        {w: 200, h: 50}
                    ]
                },
                'column, wrap, alignContent: center': {
                    flex: {direction: 'column', wrap: true, rowGap: 12, columnGap: 30, alignContent: 'center'},
                    w: 600,
                    h: 300,
                    children: [
                        {w: 100, h: 120},
                        {w: 80, h: 90},
                        {w: 120, h: 140},
                        {w: 60, h: 70}
                    ]
                },
                'row, grow and shrink mixed': {
                    flex: {columnGap: 25},
                    w: 450,
                    h: 100,
                    children: [
                        {w: 200, h: 100, flexItem: {shrink: 1}},
                        {w: 100, h: 100, flexItem: {grow: 1}},
                        {w: 200, h: 100, flexItem: {shrink: 2}}
                    ]
                },
                'nested containers with different gaps': {
                    flex: {direction: 'column', rowGap: 20},
                    w: 500,
                    children: [
                        {
                            flex: {columnGap: 10},
                            children: [
                                {w: 100, h: 50},
                                {w: 100, h: 50, flexItem: {grow: 1}}
                            ]
                        },
                        {
                            // Fixed width: a stretched, wrapping child in an auto-sized column is
                            // measured before it is stretched, which mismatches HTML even without gaps.
                            flex: {wrap: true, gap: 30}, w: 500,
                            children: [
                                {w: 200, h: 40},
                                {w: 200, h: 40},
                                {w: 200, h: 40}
                            ]
                        }
                    ]
                }
            };

            Object.keys(structures).forEach(name => {
                describe(name, () => {
                    it('layouts', () => {
                        return flexTestUtils.layoutFlexAndValidate(structures[name]);
                    });
                });
            });
        });

        describe('update', function() {
            this.timeout(0);

            let root;

            const addUpdateTest = (name, setup, show = false) => {
                flexTestUtils.addUpdateTest(() => root, name, setup, show);
            };

            before(() => {
                root = flexTestUtils.buildFlexFromStructure({
                    w: 400, flex: {wrap: true},
                    children: [
                        {w: 150, h: 100},
                        {w: 150, h: 100},
                        {w: 150, h: 100}
                    ]
                });
                root.update();
            });

            addUpdateTest('set columnGap', () => {
                root.flex.columnGap = 20;
            });

            addUpdateTest('set rowGap', () => {
                root.flex.rowGap = 30;
            });

            addUpdateTest('set gap', () => {
                root.flex.gap = 60;
            });

            addUpdateTest('reset gap', () => {
                root.flex.gap = 0;
            });
        });

    });
});
