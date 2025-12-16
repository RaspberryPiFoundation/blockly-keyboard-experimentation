/**
 * @license
 * Copyright 2025 Raspberry Pi Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import * as chai from 'chai';
import * as Blockly from 'blockly/core';
import {
  PAUSE_TIME,
  testFileLocations,
  testSetup,
  focusWorkspace,
} from '../test_setup.js';
import {voiceOver} from '@guidepup/guidepup';

suite('Screenreader', function () {
  // Disable timeouts when non-zero PAUSE_TIME is used to watch tests run.
  if (PAUSE_TIME) this.timeout(0);

  // Clear the workspace and load start blocks.
  setup(async function () {
    this.browser = await testSetup(testFileLocations.BASE, this.timeout());
    await this.browser.pause(PAUSE_TIME);
    chai.config.truncateThreshold = 0;
    await focusWorkspace(this.browser);
  });

  test('Denotes blocks that begin a stack', async function () {
    await voiceOver.press('ArrowRight');
    const log = await voiceOver.lastSpokenPhrase();
    chai.assert.include(log, 'Begin stack, setup container block');
  });

  test('Narrates block field values', async function () {
    await voiceOver.press('ArrowRight');
    await voiceOver.press('ArrowRight');
    const log = await voiceOver.lastSpokenPhrase();
    chai.assert.include(
      log,
      'create canvas with width, 400, height, 400, has inputs statement block',
    );
  });

  test('Narrates toolbox categories', async function () {
    await voiceOver.press('t');
    const log = await voiceOver.lastSpokenPhrase();
    chai.assert.include(
      log,
      'Logic blocks group selected outline row (1 of 9)',
    );
  });
});
