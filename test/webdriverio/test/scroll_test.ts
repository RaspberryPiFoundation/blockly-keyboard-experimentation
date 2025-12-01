/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
import * as chai from 'chai';
import {Key} from 'webdriverio';
import {
  sendKeyAndWait,
  keyUp,
  keyDown,
  keyRight,
  PAUSE_TIME,
  tabNavigateToWorkspace,
  testFileLocations,
  testSetup,
  checkForFailures,
} from './test_setup.js';

suite('Scrolling into view', function () {
  // Disable timeouts when non-zero PAUSE_TIME is used to watch tests run.
  if (PAUSE_TIME) this.timeout(0);

  // Resize browser to provide predictable small viewport size for scrolling.
  //
  // N.B. that this is called only one per suite, not once per test.
  suiteSetup(async function () {
    this.browser = await testSetup(testFileLocations.BASE, this.timeout());
    // Note that a viewport is used here over adjusting window size to ensure
    // consistency across platforms and environments.
    // await this.browser.setViewport({
      // width: 800, height: 600, devicePixelRatio: 1
    // });
    this.windowSize = await this.browser.getWindowSize();
    await this.browser.setWindowSize(800, 600);
    await this.browser.pause(PAUSE_TIME);
  });

  // Restore original browser window size.
  suiteTeardown(async function () {
    await this.browser.setWindowSize(
      this.windowSize.width,
      this.windowSize.height,
    );
  });

  // Clear the workspace and load start blocks.
  setup(async function () {
    await testSetup(testFileLocations.BASE, this.timeout());
  });

  teardown(async function() {
    await checkForFailures(this.browser, this.currentTest!.title, this.currentTest?.state);
  });

  test('Insert scrolls new block into view', async function () {
    // Increase timeout to 10s for this longer test.
    this.timeout(PAUSE_TIME ? 0 : 10000);

    await tabNavigateToWorkspace(this.browser);

    // Separate the two top-level blocks by moving p5_draw_1 further down.
    await keyDown(this.browser, 3);
    await sendKeyAndWait(this.browser, 'm');
    await sendKeyAndWait(this.browser, [Key.Alt, Key.ArrowDown], 25);
    await sendKeyAndWait(this.browser, Key.Enter);
    const movedBlockBounds = await this.browser.execute(() => {
      const block = Blockly.getFocusManager().getFocusedNode() as Blockly.BlockSvg;
      const blockBounds = block.getBoundingRectangleWithoutChildren();
      return blockBounds;
    });
    console.log("just moved block bounds:", movedBlockBounds);
    // Scroll back up, leaving cursor on the draw block out of the viewport.
    const scrollPosition1 = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      return [workspace.scrollX, workspace.scrollY];
    });
    console.log("workspace scroll position before scroll:", scrollPosition1);
    await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      workspace.scrollBoundsIntoView(
        (
          workspace.getTopBlocks(true)[0] as Blockly.BlockSvg
        ).getBoundingRectangleWithoutChildren(),
      );
    });
    // Pause to allow scrolling to stabilize before proceeding.
    await this.browser.pause(PAUSE_TIME);
    const scrollPosition2 = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      return [workspace.scrollX, workspace.scrollY];
    });
    console.log("workspace scroll position after scroll:", scrollPosition2);
    const focusedNodeId1 = await this.browser.execute(() => {
      return Blockly.getFocusManager().getFocusedNode()?.getFocusableElement()?.id;
    });
    console.log("current focused node before insert:", focusedNodeId1);

    // Insert and confirm the test block which should be scrolled into view.
    await sendKeyAndWait(this.browser, 't');
    await keyRight(this.browser);
    await sendKeyAndWait(this.browser, Key.Enter);
    await keyDown(this.browser);
    await keyUp(this.browser);
    await sendKeyAndWait(this.browser, Key.Enter);
    const focusedNodeId2 = await this.browser.execute(() => {
      return Blockly.getFocusManager().getFocusedNode()?.getFocusableElement()?.id;
    });
    console.log("current focused node after insert:", focusedNodeId2);
    const scrollPosition3 = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      return [workspace.scrollX, workspace.scrollY];
    });
    console.log("workspace scroll position after insert:", scrollPosition3);

    // Assert new block has been scrolled into the viewport.
    await this.browser.pause(5000);
    await this.browser.saveScreenshot(`failures/extra_snapshot_for_verification.png`);
    const blockBounds = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      const block = workspace.getBlocksByType(
        'controls_if',
      )[0] as Blockly.BlockSvg;
      const blockBounds = block.getBoundingRectangleWithoutChildren();
      return blockBounds;
    });
    console.log("block bounds:", blockBounds);
    const [blockPosition, blockRelative, x, y, transform, style] = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      const block = workspace.getBlocksByType(
        'controls_if',
      )[0] as Blockly.BlockSvg;

      const XY_REGEX = /translate\(\s*([-+\d.e]+)([ ,]\s*([-+\d.e]+)\s*)?/;
      const XY_STYLE_REGEX =
        /transform:\s*translate(?:3d)?\(\s*([-+\d.e]+)\s*px([ ,]\s*([-+\d.e]+)\s*px)?/;
      const element = block.getSvgRoot();
      class Coordinate {
        constructor(public x: number, public y: number){}
      };
      const xy = new Coordinate(0, 0);
      // First, check for x and y attributes.
      // Checking for the existence of x/y properties is faster than getAttribute.
      // However, x/y contains an SVGAnimatedLength object, so rely on getAttribute
      // to get the number.
      const x = (element as any).x && element.getAttribute('x');
      const y = (element as any).y && element.getAttribute('y');
      if (x) {
        xy.x = parseInt(x);
      }
      if (y) {
        xy.y = parseInt(y);
      }
      // Second, check for transform="translate(...)" attribute.
      const transform = element.getAttribute('transform');
      const r = transform && transform.match(XY_REGEX);
      if (r) {
        xy.x += Number(r[1]);
        if (r[3]) {
          xy.y += Number(r[3]);
        }
      }

      // Then check for style = transform: translate(...) or translate3d(...)
      const style = element.getAttribute('style');
      if (style && style.includes('translate')) {
        const styleComponents = style.match(XY_STYLE_REGEX);
        if (styleComponents) {
          xy.x += Number(styleComponents[1]);
          if (styleComponents[3]) {
            xy.y += Number(styleComponents[3]);
          }
        }
      }
      return [block.getRelativeToSurfaceXY(), xy, x, y, transform, style];
    });
    console.log("block position:", blockPosition, "relative:", blockRelative, x, y, transform, style);
    const [blockParentBounds, blockParentId] = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      const block = workspace.getBlocksByType(
        'controls_if',
      )[0] as Blockly.BlockSvg;
      const blockBounds = block.getSurroundParent()?.getBoundingRectangleWithoutChildren();
      return [blockBounds, block.getSurroundParent()?.getFocusableElement()?.id];
    });
    console.log("block's parent bounds:", blockParentBounds, "id:", blockParentId);
    const viewport = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      const rawViewport = workspace.getMetricsManager().getViewMetrics(true);
      const viewport = new Blockly.utils.Rect(
        rawViewport.top,
        rawViewport.top + rawViewport.height,
        rawViewport.left,
        rawViewport.left + rawViewport.width,
      );
      return viewport;
    });
    console.log("viewport:", viewport);
    const matchedBlocks = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      return workspace.getBlocksByType(
        'controls_if',
      ).map((block) => { return (block as Blockly.BlockSvg).getFocusableElement().id });
    });
    console.log('matched blocks to controls_if:', matchedBlocks);
    const inViewport = await this.browser.execute(() => {
      const workspace = Blockly.getMainWorkspace() as Blockly.WorkspaceSvg;
      const block = workspace.getBlocksByType(
        'controls_if',
      )[0] as Blockly.BlockSvg;
      const blockBounds = block.getBoundingRectangleWithoutChildren();
      const rawViewport = workspace.getMetricsManager().getViewMetrics(true);
      const viewport = new Blockly.utils.Rect(
        rawViewport.top,
        rawViewport.top + rawViewport.height,
        rawViewport.left,
        rawViewport.left + rawViewport.width,
      );
      return viewport.contains(blockBounds.left, blockBounds.top);
    });
    chai.assert.isTrue(inViewport);
  });
});
