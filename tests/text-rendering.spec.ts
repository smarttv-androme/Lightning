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

import { test, expect, type Page } from "@playwright/test";
import looksSame from "looks-same";

const FIRST_TEST = 1;
const BASIC_COUNT = 2;
const STYLED_TESTS = FIRST_TEST + BASIC_COUNT;
const STYLED_COUNT = 1;
const BIDI_TESTS = STYLED_TESTS + STYLED_COUNT;
const BIDI_COUNT = 4;
const DETECTION_TESTS = BIDI_TESTS + BIDI_COUNT;
const DETECTION_COUNT = 3;
const COMPLEX_HEBREW = BIDI_TESTS + BIDI_COUNT + DETECTION_COUNT;
const COMPLEX_HEBREW_COUNT = 2;
const COMPLEX_ARABIC = COMPLEX_HEBREW + COMPLEX_HEBREW_COUNT;
const COMPLEX_ARABIC_COUNT = 1;

const BASIC_MAX_DIFF = 50;
const LOOSE_MAX_DIFF = 100;

const OUTPUT_DIR = "temp/playwright";

const LS_OPTIONS = {
  createDiffImage: true,
  ignoreAntialiasing: true,
  tolerance: 10,
  antialiasingTolerance: 50,
} as const;

async function compareWrapping(page: Page, width: number) {
  page.setDefaultTimeout(2000);
  await page.setViewportSize({ width, height: 4000 });
  await page.goto("/tests/text-rendering.html?playwright");

  for (let i = FIRST_TEST; i < COMPLEX_HEBREW; i++) {
    await page
      .locator(`#preview${i}`)
      .screenshot({ path: `${OUTPUT_DIR}/wrap-${width}-test${i}-html.png` });
    await page
      .locator(`#canvas${i}`)
      .screenshot({ path: `${OUTPUT_DIR}/wrap-${width}-test${i}-canvas.png` });

    const { equal, diffImage, differentPixels } = await looksSame(
      `${OUTPUT_DIR}/wrap-${width}-test${i}-html.png`,
      `${OUTPUT_DIR}/wrap-${width}-test${i}-canvas.png`,
      LS_OPTIONS
    );
    diffImage?.save(`${OUTPUT_DIR}/wrap-${width}-test${i}-diff.png`);

    if (differentPixels) {
      console.log(
        `Test ${i} - ${width}px - different pixels: ${differentPixels}`
      );
    }
    expect(
      equal || differentPixels < BASIC_MAX_DIFF,
      `[Test ${i}] HTML and canvas rendering do not match (${differentPixels} pixels differ)`
    ).toBe(true);
  }
}

async function compareLetterSpacing(page: Page, width: number) {
  page.setDefaultTimeout(2000);
  await page.setViewportSize({ width, height: 4000 });
  await page.goto("/tests/text-rendering.html?playwright&letterSpacing=5");

  for (let i = FIRST_TEST; i < STYLED_TESTS + STYLED_COUNT; i++) {
    await page
      .locator(`#preview${i}`)
      .screenshot({ path: `${OUTPUT_DIR}/spacing-${width}-test${i}-html.png` });
    await page
      .locator(`#canvas${i}`)
      .screenshot({ path: `${OUTPUT_DIR}/spacing-${width}-test${i}-canvas.png` });

    const { equal, diffImage, differentPixels } = await looksSame(
      `${OUTPUT_DIR}/spacing-${width}-test${i}-html.png`,
      `${OUTPUT_DIR}/spacing-${width}-test${i}-canvas.png`,
      LS_OPTIONS
    );
    diffImage?.save(`${OUTPUT_DIR}/spacing-${width}-test${i}-diff.png`);

    if (differentPixels) {
      console.log(
        `Test ${i} - ${width}px - different pixels: ${differentPixels}`
      );
    }
    expect(
      equal || differentPixels < LOOSE_MAX_DIFF,
      `[Test ${i}] HTML and canvas rendering do not match (${differentPixels} pixels differ)`
    ).toBe(true);
  }
}

async function compareDetection(page: Page, width: number, start: number, count: number) {
  await page.setViewportSize({ width, height: 4000 });
  await page.goto("/tests/text-rendering.html?playwright");

  for (let i = start; i < start + count; i++) {
    await page
      .locator(`#preview${i}`)
      .screenshot({ path: `${OUTPUT_DIR}/detection-${width}-test${i}-html.png` });
    await page
      .locator(`#canvas${i}`)
      .screenshot({ path: `${OUTPUT_DIR}/detection-${width}-test${i}-canvas.png` });

    const { equal, diffImage, differentPixels } = await looksSame(
      `${OUTPUT_DIR}/detection-${width}-test${i}-html.png`,
      `${OUTPUT_DIR}/detection-${width}-test${i}-canvas.png`,
      LS_OPTIONS
    );
    diffImage?.save(`${OUTPUT_DIR}/detection-${width}-test${i}-diff.png`);

    if (differentPixels) {
      console.log(
        `Test ${i} - ${width}px - different pixels: ${differentPixels}`
      );
    }
    expect(
      equal || differentPixels < BASIC_MAX_DIFF,
      `[Test ${i}] HTML and canvas rendering do not match (${differentPixels} pixels differ)`
    ).toBe(true);
  }
}

async function compareComplex(page: Page, width: number, start: number, count: number) {
  await page.setViewportSize({ width, height: 4000 });
  await page.goto("/tests/text-rendering.html?playwright");

  for (let i = start; i < start + count; i++) {
    await page
      .locator(`#preview${i}`)
      .screenshot({ path: `${OUTPUT_DIR}/complex-${width}-test${i}-html.png` });
    await page
      .locator(`#canvas${i}`)
      .screenshot({ path: `${OUTPUT_DIR}/complex-${width}-test${i}-canvas.png` });

    const { equal, diffImage, differentPixels } = await looksSame(
      `${OUTPUT_DIR}/complex-${width}-test${i}-html.png`,
      `${OUTPUT_DIR}/complex-${width}-test${i}-canvas.png`,
      LS_OPTIONS
    );
    diffImage?.save(`${OUTPUT_DIR}/complex-${width}-test${i}-diff.png`);

    if (differentPixels) {
      console.log(
        `Test ${i} - ${width}px - different pixels: ${differentPixels}`
      );
    }
    expect(
      equal || differentPixels < BASIC_MAX_DIFF,
      `[Test ${i}] HTML and canvas rendering do not match (${differentPixels} pixels differ)`
    ).toBe(true);
  }
}

/*
* The following tests compare HTML and LightningJS canvas rendering of text.
* 
* The tests compare the two renderings and check if they match within a certain tolerance.
* More tolerance is given to Arabic due to the amount of details in the script.
* 
* The tests are run at different viewport widths and letter spacings.
* 
* Note: we don't expect that HTML and canvas rendering will always match exactly, especially
* when it comes to wrapping and ellipsis logic. The viewport widths have been chosen where 
* wrapping and ellipsis matched the best.
*/

test("no wrap", async ({ page }) => {
  await compareWrapping(page, 1900);
});

test("wrap 840", async ({ page }) => {
  await compareWrapping(page, 840);
});

test("wrap 620", async ({ page }) => {
  await compareWrapping(page, 620);
});

// TODO: fix embedded RTL in LTR
// test("wrap 510", async ({ page }) => {
//   await compareWrapping(page, 510);
// });

test("letter spacing wrap 1000", async ({ page }) => {
  await compareLetterSpacing(page, 1000);
});

test("letter spacing wrap 600", async ({ page }) => {
  await compareLetterSpacing(page, 600);
});

test("direction detection", async ({ page }) => {
  await compareDetection(page, 1000, DETECTION_TESTS, DETECTION_COUNT);
});

test("complex Hebrew 660", async ({ page }) => {
  await compareComplex(page, 660, COMPLEX_HEBREW, COMPLEX_HEBREW_COUNT);
});

test("complex Hebrew 880", async ({ page }) => {
  await compareComplex(page, 880, COMPLEX_HEBREW, COMPLEX_HEBREW_COUNT);
});

test("complex Arabic 900", async ({ page }) => {
  await compareComplex(page, 900, COMPLEX_ARABIC, COMPLEX_ARABIC_COUNT);
});