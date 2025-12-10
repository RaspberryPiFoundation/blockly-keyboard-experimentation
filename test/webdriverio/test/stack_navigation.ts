/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as chai from 'chai';
import {
  getCurrentFocusedBlockId,
  getCurrentFocusNodeId,
  focusOnWorkspaceComment,
  PAUSE_TIME,
  tabNavigateToWorkspace,
  testFileLocations,
  testSetup,
  sendKeyAndWait,
} from './test_setup.js';

suite('Stack navigation', function () {
  // Clear the workspace and load start blocks.
  setup(async function () {
    this.browser = await testSetup(testFileLocations.COMMENTS, this.timeout());
    await this.browser.pause(PAUSE_TIME);
  });

  test('Next', async function () {
    await tabNavigateToWorkspace(this.browser);
    chai.assert.equal(
      'p5_setup_1',
      await getCurrentFocusedBlockId(this.browser),
    );
    await sendKeyAndWait(this.browser, 'n');
    chai.assert.equal(
      'p5_draw_1',
      await getCurrentFocusedBlockId(this.browser),
    );
    await sendKeyAndWait(this.browser, 'n');
    chai.assert.equal(
      'workspace_comment_1',
      await getCurrentFocusNodeId(this.browser),
    );
    await sendKeyAndWait(this.browser, 'n');
    // Does not loop around.
    chai.assert.equal(
      'workspace_comment_1',
      await getCurrentFocusNodeId(this.browser),
    );
  });

  test('Previous', async function () {
    await tabNavigateToWorkspace(this.browser);
    chai.assert.equal(
      'p5_setup_1',
      await getCurrentFocusedBlockId(this.browser),
    );
    await sendKeyAndWait(this.browser, 'b');
    // Does not loop to bottom.
    chai.assert.equal(
      'p5_setup_1',
      await getCurrentFocusedBlockId(this.browser),
    );

    await focusOnWorkspaceComment(this.browser, 'workspace_comment_1');

    await sendKeyAndWait(this.browser, 'b');
    chai.assert.isTrue(
      (await getCurrentFocusNodeId(this.browser))?.startsWith(
        'draw_circle_2_connection',
      ),
    );
    await sendKeyAndWait(this.browser, 'b');
    chai.assert.isTrue(
      (await getCurrentFocusNodeId(this.browser))?.startsWith(
        'set_background_color_1_connection',
      ),
    );
  });
});
