/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
import * as chai from 'chai';
import {Browser, Key} from 'webdriverio';
import {
  PAUSE_TIME,
  focusOnBlock,
  createTestUrl,
  testFileLocations,
  testSetup,
  sendKeyAndWait,
  keyDown,
  contextMenuItems,
} from './test_setup.js';

suite('Move start tests', function () {
  // Increase timeout to 10s for this longer test (but disable
  // timeouts if when non-zero PAUSE_TIME is used to watch tests) run.
  this.timeout(PAUSE_TIME ? 0 : 10000);

  // Clear the workspace and load start blocks.
  setup(async function () {
    this.browser = await testSetup(
      testFileLocations.MOVE_START_TEST_BLOCKS,
      this.timeout(),
    );
    await this.browser.pause(PAUSE_TIME);
  });

  // When a move of a statement block begins, it is expected that only
  // that block (and all blocks connected to its inputs) will be
  // moved, with subsequent statement blocks below it in the stack
  // reattached to where the moving block was - i.e., that a stack
  // heal will occur.
  //
  // Also tests initating a move using the shortcut key.
  test('Start moving statement blocks', async function () {
    for (let i = 1; i < 7; i++) {
      // Navigate to statement_<i>.
      await focusOnBlock(this.browser, `statement_${i}`);

      // Get information about parent connection of selected block,
      // and block connected to selected block's next connection.
      const info = await getFocusedNeighbourInfo(this.browser);

      chai.assert.exists(
        info.parentId,
        'selected block should have parent block',
      );
      chai.assert(
        typeof info.parentIndex === 'number',
        'parent connection index should exist and be a number',
      );
      chai.assert.exists(info.nextId, 'selected block should have next block');

      // Start move using keyboard shortcut.
      await sendKeyAndWait(this.browser, 'm');

      // Check that the moving block has nothing connected it its
      // next/previous connections, and same thing connected to value
      // input.
      const newInfo = await getFocusedNeighbourInfo(this.browser);
      chai.assert.isNull(
        newInfo.parentId,
        'moving block should have no parent block',
      );
      chai.assert.isNull(
        newInfo.nextId,
        'moving block should have no next block',
      );
      chai.assert.strictEqual(
        newInfo.valueId,
        info.valueId,
        'moving block should have same attached value block',
      );

      // Check that the block connected to the former parent
      // connection of the currently-moving block (if any) is the one
      // that was attached to the moving block's next connection.
      const parentInfo = await getConnectedBlockInfo(
        this.browser,
        info.parentId,
        info.parentIndex,
      );
      chai.assert.strictEqual(
        parentInfo.id,
        info.nextId,
        'former parent connection should be connected to former next block',
      );

      // Abort move.
      await sendKeyAndWait(this.browser, Key.Escape);
    }
  });

  // When a move of a value block begins, it is expected that block
  // and all blocks connected to its inputs will be moved - i.e., that
  // a stack heal (really: unary operator chain heal) will NOT occur.
  //
  // Also tests initiating a move via the context menu.
  test('Start moving value blocks', async function () {
    for (let i = 1; i < 7; i++) {
      // Navigate to statement_<i>.
      await focusOnBlock(this.browser, `value_${i}`);

      // Get information about parent connection of selected block,
      // and block connected to selected block's value input.
      const info = await getFocusedNeighbourInfo(this.browser);

      chai.assert.exists(
        info.parentId,
        'selected block should have parent block',
      );
      chai.assert(
        typeof info.parentIndex === 'number',
        'parent connection index should exist and be a number',
      );
      chai.assert.exists(
        info.valueId,
        'selected block should have child value block',
      );

      // Start move using context menu (using keyboard nav).
      await sendKeyAndWait(this.browser, [Key.Ctrl, Key.Return]);

      // Find how many times to press the down arrow
      const index = (await contextMenuItems(this.browser)).findIndex(({text}) =>
        text.includes('Move'),
      );
      chai.assert.isAbove(
        index,
        -1,
        'expected Move to appear in context menu items',
      );
      await keyDown(this.browser, index);
      await sendKeyAndWait(this.browser, Key.Return);

      // Wait for the move icon to appear so we know we're in move mode.
      await this.browser.$('.blocklyMoveIndicatorBubble').waitForExist();

      // Check that the moving block has nothing connected it its
      // next/previous connections, and same thing connected to value
      // input.
      const newInfo = await getFocusedNeighbourInfo(this.browser);
      chai.assert.isNull(
        newInfo.parentId,
        'moving block should have no parent block',
      );
      chai.assert.isNull(
        newInfo.nextId,
        'moving block should have no next block',
      );
      chai.assert.strictEqual(
        newInfo.valueId,
        info.valueId,
        'moving block should have same attached value block',
      );

      // Check that the former parent connection of the
      // currently-moving block is either unconnected or connected to
      // a shadow block.
      const parentInfo = await getConnectedBlockInfo(
        this.browser,
        info.parentId,
        info.parentIndex,
      );
      chai.assert(
        parentInfo.id === null || parentInfo.shadow,
        'former parent connection should be unconnected (or shadow)',
      );

      // Abort move.
      await sendKeyAndWait(this.browser, Key.Escape);
    }
  });
});

suite('Statement move tests', function () {
  // Increase timeout to 10s for this longer test (but disable
  // timeouts if when non-zero PAUSE_TIME is used to watch tests) run.
  this.timeout(PAUSE_TIME ? 0 : 10000);

  // Clear the workspace and load start blocks.
  setup(async function () {
    this.browser = await testSetup(
      testFileLocations.MOVE_STATEMENT_TEST_BLOCKS,
      this.timeout(),
    );
    await this.browser.pause(PAUSE_TIME);
  });

  /** Serialized simple statement block with no statement inputs. */
  const STATEMENT_SIMPLE = {
    type: 'draw_emoji',
    id: 'simple_mover',
    fields: {emoji: '✨'},
  };
  /**
   * Expected connection candidates when moving a block with no
   * inputs, after pressing right (or down) arrow n times.
   */
  const EXPECTED_SIMPLE_RIGHT = [
    {id: 'p5_canvas', index: 1, ownIndex: 0}, // Next; starting location.
    {id: 'text_print', index: 0, ownIndex: 1}, // Previous.
    {id: 'text_print', index: 1, ownIndex: 0}, // Next.
    {id: 'controls_if', index: 3, ownIndex: 0}, // "If" statement input.
    {id: 'controls_repeat_ext', index: 3, ownIndex: 0}, // Statement input.
    {id: 'controls_repeat_ext', index: 1, ownIndex: 0}, // Next.
    {id: 'controls_if', index: 5, ownIndex: 0}, // "Else if" statement input.
    {id: 'controls_if', index: 6, ownIndex: 0}, // "Else" statement input.
    {id: 'controls_if', index: 1, ownIndex: 0}, // Next.
    {id: 'p5_draw', index: 0, ownIndex: 0}, // Statement input.
  ];
  /**
   * Expected connection candidates when moving STATEMENT_SIMPLE after
   * pressing left (or up) arrow n times.
   */
  const EXPECTED_SIMPLE_LEFT = EXPECTED_SIMPLE_RIGHT.slice(0, 1).concat(
    EXPECTED_SIMPLE_RIGHT.slice(1).reverse(),
  );

  suite('Constrained moves of simple statement block', function () {
    setup(async function () {
      await appendBlock(this.browser, STATEMENT_SIMPLE, 'p5_canvas');
    });
    test(
      'moving right',
      moveTest(STATEMENT_SIMPLE.id, Key.ArrowRight, EXPECTED_SIMPLE_RIGHT),
    );
    test(
      'moving left',
      moveTest(STATEMENT_SIMPLE.id, Key.ArrowLeft, EXPECTED_SIMPLE_LEFT),
    );
    test(
      'moving down',
      moveTest(STATEMENT_SIMPLE.id, Key.ArrowDown, EXPECTED_SIMPLE_RIGHT),
    );
    test(
      'moving up',
      moveTest(STATEMENT_SIMPLE.id, Key.ArrowUp, EXPECTED_SIMPLE_LEFT),
    );
  });

  /** Serialized statement block with multiple statement inputs. */
  const STATEMENT_COMPLEX = {
    type: 'controls_if',
    id: 'complex_mover',
    extraState: {hasElse: true},
  };
  /**
   * Expected connection candidates when moving STATEMENT_COMPLEX, after
   * pressing right (or down) arrow n times.
   */
  const EXPECTED_COMPLEX_RIGHT = [
    // TODO(#702): Due to a bug in KeyboardDragStrategy, certain
    // connection candidates that can be found using the mouse are not
    // visited when doing a keyboard move.  They appear in the list
    // below, but commented out for now.  They should be uncommented
    // when bug is fixed.
    {id: 'p5_canvas', index: 1, ownIndex: 0}, // Next; starting location again.
    // {id: 'text_print', index: 0, ownIndex: 1}, // Previous to own next.
    {id: 'text_print', index: 0, ownIndex: 4}, // Previous to own else input.
    // {id: 'text_print', index: 0, ownIndex: 3}, // Previous to own if input.
    {id: 'text_print', index: 1, ownIndex: 0}, // Next.
    {id: 'controls_if', index: 3, ownIndex: 0}, // "If" statement input.
    {id: 'controls_repeat_ext', index: 3, ownIndex: 0}, // Statement input.
    {id: 'controls_repeat_ext', index: 1, ownIndex: 0}, // Next.
    {id: 'controls_if', index: 5, ownIndex: 0}, // "Else if" statement input.
    {id: 'controls_if', index: 6, ownIndex: 0}, // "Else" statement input.
    {id: 'controls_if', index: 1, ownIndex: 0}, // Next.
    {id: 'p5_draw', index: 0, ownIndex: 0}, // Statement input.
  ];
  /**
   * Expected connection candidates when moving STATEMENT_COMPLEX after
   * pressing left or up arrow n times.
   */
  const EXPECTED_COMPLEX_LEFT = EXPECTED_COMPLEX_RIGHT.slice(0, 1).concat(
    EXPECTED_COMPLEX_RIGHT.slice(1).reverse(),
  );

  suite('Constrained moves of stack block with statement inputs', function () {
    setup(async function () {
      await appendBlock(this.browser, STATEMENT_COMPLEX, 'p5_canvas');
    });
    test(
      'moving right',
      moveTest(STATEMENT_COMPLEX.id, Key.ArrowRight, EXPECTED_COMPLEX_RIGHT),
    );
    test(
      'moving left',
      moveTest(STATEMENT_COMPLEX.id, Key.ArrowLeft, EXPECTED_COMPLEX_LEFT),
    );
    test(
      'moving down',
      moveTest(STATEMENT_COMPLEX.id, Key.ArrowDown, EXPECTED_COMPLEX_RIGHT),
    );
    test(
      'moving up',
      moveTest(STATEMENT_COMPLEX.id, Key.ArrowUp, EXPECTED_COMPLEX_LEFT),
    );
  });

  // When a top-level block with no previous, next or output
  // connections is subject to a constrained move, it should not move.
  //
  // This includes a regression test for issue #446 (fixed in PR #599)
  // where, due to an implementation error in Mover, constrained
  // movement following unconstrained movement would result in the
  // block unexpectedly moving (unless workspace scale was === 1).
  test('Constrained move of unattachable top-level block', async function () {
    // Block ID of an unconnectable block.
    const BLOCK = 'p5_setup';

    // Scale workspace.
    await this.browser.execute(() => {
      (Blockly.getMainWorkspace() as Blockly.WorkspaceSvg).setScale(0.9);
    });

    // Navigate to unconnectable block, get initial coords and start move.
    await focusOnBlock(this.browser, BLOCK);
    const startCoordinate = await getCoordinate(this.browser, BLOCK);
    await sendKeyAndWait(this.browser, 'm');

    // Check constrained moves have no effect.
    await keyDown(this.browser, 5);
    const coordinate = await getCoordinate(this.browser, BLOCK);
    chai.assert.deepEqual(
      coordinate,
      startCoordinate,
      'constrained move should have no effect',
    );

    // Unconstrained moves.
    await sendKeyAndWait(this.browser, [Key.Alt, Key.ArrowDown]);
    await sendKeyAndWait(this.browser, [Key.Alt, Key.ArrowRight]);
    const newCoordinate = await getCoordinate(this.browser, BLOCK);
    chai.assert.notDeepEqual(
      newCoordinate,
      startCoordinate,
      'unconstrained move should have effect',
    );

    // Try multiple constrained moves, as first might (correctly) do nothing.
    for (let i = 0; i < 5; i++) {
      await keyDown(this.browser);
      const coordinate = await getCoordinate(this.browser, BLOCK);
      chai.assert.deepEqual(
        coordinate,
        newCoordinate,
        'constrained move after unconstrained move should have no effect',
      );
    }

    // Abort move.
    await sendKeyAndWait(this.browser, Key.Escape);
  });
});

suite(`Value expression move tests`, function () {
  // Increase timeout to 10s for this longer test (but disable
  // timeouts if when non-zero PAUSE_TIME is used to watch tests) run.
  this.timeout(PAUSE_TIME ? 0 : 10000);

  /** Serialized simple reporter value block with no inputs. */
  const VALUE_SIMPLE = {
    type: 'text',
    id: 'simple_mover',
    fields: {TEXT: 'simple mover'},
  };
  /**
   * Expected connection candidates when moving VALUE_SIMPLE, after
   * pressing ArrowRight n times.
   */
  const EXPECTED_SIMPLE_RIGHT = [
    {id: 'join0', index: 1, ownIndex: 0}, // Join block ADD0 input.
    {id: 'join0', index: 2, ownIndex: 0}, // Join block ADD1 input.
    {id: 'print1', index: 2, ownIndex: 0}, // Print block with no shadow.
    {id: 'print2', index: 2, ownIndex: 0}, // Print block with shadow.
    // Skip draw_emoji block as it has no value inputs.
    {id: 'print3', index: 2, ownIndex: 0}, // Replacing  join expression.
    {id: 'join1', index: 1, ownIndex: 0}, // Join block ADD0 input.
    {id: 'join1', index: 2, ownIndex: 0}, // Join block ADD1 input.
    // Skip controls_repeat_ext block's TIMES input as it is incompatible.
    {id: 'print4', index: 2, ownIndex: 0}, // Replacing join expression.
    {id: 'join2', index: 1, ownIndex: 0}, // Join block ADD0 input.
    {id: 'join2', index: 2, ownIndex: 0}, // Join block ADD1 input.
    // Skip input of unattached join block.
  ];
  /**
   * Expected connection candidates when moving BLOCK_SIMPLE, after
   * pressing ArrowLeft n times.
   */
  const EXPECTED_SIMPLE_LEFT = EXPECTED_SIMPLE_RIGHT.slice(0, 1).concat(
    EXPECTED_SIMPLE_RIGHT.slice(1).reverse(),
  );

  /**
   * Serialized row of value blocks with no free inputs; should behave
   * as VALUE_SIMPLE does.
   */
  const VALUE_ROW = {
    type: 'text_changeCase',
    id: 'row_mover',
    fields: {CASE: 'TITLECASE'},
    inputs: {
      TEXT: {block: VALUE_SIMPLE},
    },
  };
  // EXPECTED_ROW_RIGHT will be same as EXPECTED_SIMPLE_RIGHT (and
  // same for ..._LEFT).

  /** Serialized value block with a single free (external) input. */
  const VALUE_UNARY = {
    type: 'text_changeCase',
    id: 'unary_mover',
    fields: {CASE: 'TITLECASE'},
  };
  /**
   * Expected connection candidates when moving VALUE_UNARY after
   * pressing ArrowRight n times.
   */
  const EXPECTED_UNARY_RIGHT = EXPECTED_SIMPLE_RIGHT.concat([
    {id: 'join0', index: 0, ownIndex: 1}, // Unattached block to own input.
  ]);
  /**
   * Expected connection candidates when moving row consisting of
   * BLOCK_UNARY on its own after pressing ArrowLEFT n times.
   */
  const EXPECTED_UNARY_LEFT = EXPECTED_UNARY_RIGHT.slice(0, 1).concat(
    EXPECTED_UNARY_RIGHT.slice(1).reverse(),
  );

  /** Serialized value block with a single free (external) input. */
  const VALUE_COMPLEX = {
    type: 'text_join',
    id: 'complex_mover',
  };
  /**
   * Expected connection candidates when moving VALUE_COMPLEX after
   * pressing ArrowRight n times.
   */
  const EXPECTED_COMPLEX_RIGHT = EXPECTED_SIMPLE_RIGHT.concat([
    // TODO(#702): Due to a bug in KeyboardDragStrategy, certain
    // connection candidates that can be found using the mouse are not
    // visited when doing a keyboard move.  They appear in the list
    // below, but commented out for now.  They should be uncommented
    // when bug is fixed.
    {id: 'join0', index: 0, ownIndex: 2}, // Unattached block to own input.
    // {id: 'join0', index: 0, ownIndex: 1}, // Unattached block to own input.
  ]);
  /**
   * Expected connection candidates when moving row consisting of
   * BLOCK_COMPLEX on its own after pressing ArrowLEFT n times.
   */
  const EXPECTED_COMPLEX_LEFT = EXPECTED_COMPLEX_RIGHT.slice(0, 1).concat(
    EXPECTED_COMPLEX_RIGHT.slice(1).reverse(),
  );

  for (const renderer of ['geras', 'thrasos', 'zelos']) {
    // TODO(#707): These tests fail when run using zelos, so for now
    // we skip entire suite.  Stop skipping suite when bug is fixed.
    const suiteOrSkip = renderer === 'zelos' ? suite.skip : suite;
    suiteOrSkip(`using ${renderer}`, function () {
      // Clear the workspace and load start blocks.
      setup(async function () {
        this.browser = await testSetup(
          createTestUrl(
            new URLSearchParams({renderer, scenario: 'moveValueTestBlocks'}),
          ),
          this.timeout(),
        );
        await this.browser.pause(PAUSE_TIME);
      });

      suite('Constrained moves of a simple reporter block', function () {
        setup(async function () {
          await appendBlock(this.browser, VALUE_SIMPLE, 'join0', 'ADD0');
        });
        test(
          'moving right',
          moveTest(VALUE_SIMPLE.id, Key.ArrowRight, EXPECTED_SIMPLE_RIGHT),
        );
        test(
          'moving left',
          moveTest(VALUE_SIMPLE.id, Key.ArrowLeft, EXPECTED_SIMPLE_LEFT),
        );
      });

      suite('Constrained moves of row of value blocks', function () {
        setup(async function () {
          await appendBlock(this.browser, VALUE_ROW, 'join0', 'ADD0');
        });
        test(
          'moving right',
          moveTest(VALUE_ROW.id, Key.ArrowRight, EXPECTED_SIMPLE_RIGHT),
        );
        test(
          'moving left',
          moveTest(VALUE_ROW.id, Key.ArrowLeft, EXPECTED_SIMPLE_LEFT),
        );
      });

      suite('Constrained moves of unary expression block', function () {
        setup(async function () {
          await appendBlock(this.browser, VALUE_UNARY, 'join0', 'ADD0');
        });
        // TODO(#709): Reenable test once crash bug is fixed.
        test.skip(
          'moving right',
          moveTest(VALUE_UNARY.id, Key.ArrowRight, EXPECTED_UNARY_RIGHT),
        );
        test(
          'moving left',
          moveTest(VALUE_UNARY.id, Key.ArrowLeft, EXPECTED_UNARY_LEFT),
        );
      });

      suite('Constrained moves of a complex expression block', function () {
        setup(async function () {
          await appendBlock(this.browser, VALUE_COMPLEX, 'join0', 'ADD0');
        });
        test(
          'moving right',
          moveTest(VALUE_COMPLEX.id, Key.ArrowRight, EXPECTED_COMPLEX_RIGHT),
        );
        test(
          'moving left',
          moveTest(VALUE_COMPLEX.id, Key.ArrowLeft, EXPECTED_COMPLEX_LEFT),
        );
      });
    });
  }
});

suite(`Statement expression unconstrained move tests`, function () {
  // Increase timeout to 10s for this longer test (but disable
  // timeouts if when non-zero PAUSE_TIME is used to watch tests) run.
  this.timeout(PAUSE_TIME ? 0 : 10000);

  /** Serialized simple statement block with no statement inputs. */
  const STATEMENT_SIMPLE = {
    type: 'draw_emoji',
    id: 'simple_mover',
    fields: {emoji: '✨'},
  };

  /** Serialized statement block with multiple statement inputs. */
  const STATEMENT_COMPLEX = {
    type: 'controls_if',
    id: 'complex_mover',
    extraState: {hasElse: true},
  };

  /**
   * Expected connection candidates when moving STATEMENT_SIMPLE, after
   * pressing ArrowDown n times.
   */
  const EXPECTED_STATEMENT_SIMPLE_DOWN = [
    {id: 'text_print', index: 0, ownIndex: 1}, // Above print block
    {id: 'text_print', index: 1, ownIndex: 0}, // Below print block
    {id: 'controls_repeat_ext', index: 1, ownIndex: 0}, // Below repeat block
    {id: 'controls_if', index: 6, ownIndex: 0}, // In else condition
  ];

  /**
   * Expected connection candidates when moving STATEMENT_SIMPLE, after
   * pressing ArrowUp n times.
   */
  const EXPECTED_STATEMENT_SIMPLE_UP = [
    {id: 'controls_if', index: 1, ownIndex: 0}, // Below if-else block
    {id: 'controls_if', index: 6, ownIndex: 0}, // In else condition
    {id: 'controls_if', index: 5, ownIndex: 0}, // In do condition
    {id: 'controls_repeat_ext', index: 1, ownIndex: 0}, // Below repeat block
    {id: 'controls_if', index: 3, ownIndex: 0}, // Above repeat block
    {id: 'text_print', index: 1, ownIndex: 0}, // Below print block
    {id: 'text_print', index: 0, ownIndex: 1}, // Above print block
  ];

  /**
   * Expected connection candidates when moving STATEMENT_SIMPLE, after
   * pressing ArrowLeft n times.
   */
  const EXPECTED_STATEMENT_SIMPLE_LEFT = [
    {id: 'text_print', index: 0, ownIndex: 1}, // Above print block
  ];

  /**
   * Expected connection candidates when moving STATEMENT_SIMPLE, after
   * pressing ArrowRight n times.
   */
  const EXPECTED_STATEMENT_SIMPLE_RIGHT =
    EXPECTED_STATEMENT_SIMPLE_LEFT.concat().reverse();

  /**
   * Expected connection candidates when moving STATEMENT_COMPLEX, after
   * pressing ArrowDown n times.
   */
  const EXPECTED_STATEMENT_COMPLEX_DOWN = [
    {id: 'text_print', index: 0, ownIndex: 1}, // Above print block
    {id: 'text_print', index: 0, ownIndex: 4}, // As parent of print block
    {id: 'text_print', index: 0, ownIndex: 3}, // As parent of print block
    {id: 'text_print', index: 1, ownIndex: 0}, // Below print block
    {id: 'controls_if', index: 1, ownIndex: 0}, // Below if-else block
  ];

  /**
   * Expected connection candidates when moving STATEMENT_COMPLEX, after
   * pressing ArrowUp n times.
   */
  const EXPECTED_STATEMENT_COMPLEX_UP = [
    {id: 'controls_if', index: 1, ownIndex: 0}, // Below if-else block
    {id: 'text_print', index: 1, ownIndex: 0}, // Below print block
    {id: 'text_print', index: 0, ownIndex: 3}, // As parent of print block
    {id: 'text_print', index: 0, ownIndex: 4}, // As parent of print block
    {id: 'text_print', index: 0, ownIndex: 1}, // Above print block
  ];

  /**
   * Expected connection candidates when moving STATEMENT_COMPLEX, after
   * pressing ArrowLeft n times.
   */
  const EXPECTED_STATEMENT_COMPLEX_LEFT = [
    {id: 'controls_if', index: 3, ownIndex: 0}, // Above repeat block
    {id: 'text_print', index: 1, ownIndex: 0}, // Below print block
  ];

  /**
   * Expected connection candidates when moving STATEMENT_COMPLEX, after
   * pressing ArrowRight n times.
   */
  const EXPECTED_STATEMENT_COMPLEX_RIGHT = [
    {id: 'text_print', index: 1, ownIndex: 0}, // Below print block
    {id: 'controls_if', index: 3, ownIndex: 0}, // Above repeat block
  ];

  for (const renderer of ['geras', 'thrasos', 'zelos']) {
    // TODO(#707): These tests fail when run using zelos, so for now
    // we skip entire suite.  Stop skipping suite when bug is fixed.
    const suiteOrSkip = renderer === 'zelos' ? suite.skip : suite;
    suiteOrSkip(`using ${renderer}`, function () {
      // Clear the workspace and load start blocks.
      setup(async function () {
        this.browser = await testSetup(
          createTestUrl(
            new URLSearchParams({
              renderer,
              scenario: 'moveStatementTestBlocks',
            }),
          ),
          this.timeout(),
        );
        await this.browser.pause(PAUSE_TIME);
      });

      suite('Unconstrained moves of a simple statement block', function () {
        setup(async function () {
          await appendBlock(this.browser, STATEMENT_SIMPLE);
        });

        test('moving down', async function () {
          await moveBlock(
            this.browser,
            STATEMENT_SIMPLE.id,
            (await getCoordinate(this.browser, 'text_print')).x + 25,
            (await getCoordinate(this.browser, 'text_print')).y - 60,
          );
          await moveBlockAndAssertCandidateOrder(
            STATEMENT_SIMPLE.id,
            [Key.Alt, Key.ArrowDown],
            EXPECTED_STATEMENT_SIMPLE_DOWN,
            this.browser,
          );
        });

        test('moving up', async function () {
          await moveBlock(
            this.browser,
            STATEMENT_SIMPLE.id,
            (await getCoordinate(this.browser, 'text_print')).x + 25,
            (await getCoordinate(this.browser, 'text_print')).y + 240,
          );
          await moveBlockAndAssertCandidateOrder(
            STATEMENT_SIMPLE.id,
            [Key.Alt, Key.ArrowUp],
            EXPECTED_STATEMENT_SIMPLE_UP,
            this.browser,
          );
        });

        test('moving left', async function () {
          await moveBlock(
            this.browser,
            STATEMENT_SIMPLE.id,
            (await getCoordinate(this.browser, 'text_print')).x + 30,
            (await getCoordinate(this.browser, 'text_print')).y - 10,
          );
          await moveBlockAndAssertCandidateOrder(
            STATEMENT_SIMPLE.id,
            [Key.Alt, Key.ArrowLeft],
            EXPECTED_STATEMENT_SIMPLE_LEFT,
            this.browser,
          );
        });

        test('moving right', async function () {
          await moveBlock(
            this.browser,
            STATEMENT_SIMPLE.id,
            (await getCoordinate(this.browser, 'text_print')).x - 90,
            (await getCoordinate(this.browser, 'text_print')).y - 10,
          );
          await moveBlockAndAssertCandidateOrder(
            STATEMENT_SIMPLE.id,
            [Key.Alt, Key.ArrowRight],
            EXPECTED_STATEMENT_SIMPLE_RIGHT,
            this.browser,
          );
        });
      });

      suite('Unconstrained moves of a complex statement block', function () {
        setup(async function () {
          await appendBlock(this.browser, STATEMENT_COMPLEX);
        });

        test('moving down', async function () {
          await moveBlock(
            this.browser,
            STATEMENT_COMPLEX.id,
            (await getCoordinate(this.browser, 'text_print')).x - 22,
            (await getCoordinate(this.browser, 'text_print')).y - 125,
          );
          await moveBlockAndAssertCandidateOrder(
            STATEMENT_COMPLEX.id,
            [Key.Alt, Key.ArrowDown],
            EXPECTED_STATEMENT_COMPLEX_DOWN,
            this.browser,
          );
        });

        test('moving up', async function () {
          await moveBlock(
            this.browser,
            STATEMENT_COMPLEX.id,
            (await getCoordinate(this.browser, 'text_print')).x - 22,
            (await getCoordinate(this.browser, 'text_print')).y + 254,
          );
          await moveBlockAndAssertCandidateOrder(
            STATEMENT_COMPLEX.id,
            [Key.Alt, Key.ArrowUp],
            EXPECTED_STATEMENT_COMPLEX_UP,
            this.browser,
          );
        });

        test('moving left', async function () {
          await moveBlock(
            this.browser,
            STATEMENT_COMPLEX.id,
            (await getCoordinate(this.browser, 'text_print')).x + 80,
            (await getCoordinate(this.browser, 'text_print')).y + 35,
          );
          await moveBlockAndAssertCandidateOrder(
            STATEMENT_COMPLEX.id,
            [Key.Alt, Key.ArrowLeft],
            EXPECTED_STATEMENT_COMPLEX_LEFT,
            this.browser,
          );
        });

        test('moving right', async function () {
          await moveBlock(
            this.browser,
            STATEMENT_COMPLEX.id,
            (await getCoordinate(this.browser, 'text_print')).x - 35,
            (await getCoordinate(this.browser, 'text_print')).y + 35,
          );
          await moveBlockAndAssertCandidateOrder(
            STATEMENT_COMPLEX.id,
            [Key.Alt, Key.ArrowRight],
            EXPECTED_STATEMENT_COMPLEX_RIGHT,
            this.browser,
          );
        });
      });
    });
  }
});

suite(`Value expression unconstrained move tests`, function () {
  // Increase timeout to 10s for this longer test (but disable
  // timeouts if when non-zero PAUSE_TIME is used to watch tests) run.
  this.timeout(PAUSE_TIME ? 0 : 10000);

  /** Serialized simple reporter value block with no inputs. */
  const VALUE_SIMPLE = {
    type: 'text',
    id: 'simple_mover',
    fields: {TEXT: 'simple mover'},
  };

  /** Serialized value block with a single free (external) input. */
  const VALUE_UNARY = {
    type: 'text_changeCase',
    id: 'unary_mover',
    fields: {CASE: 'TITLECASE'},
  };

  /**
   * Expected connection candidates when moving VALUE_SIMPLE, after
   * pressing ArrowDown n times.
   */
  const EXPECTED_VALUE_DOWN = [
    {id: 'print1', index: 2, ownIndex: 0}, // Print block with no shadow.
    {id: 'print2', index: 2, ownIndex: 0}, // Print block with shadow.
    {id: 'print3', index: 2, ownIndex: 0}, // Replacing  join expression.
  ];

  /**
   * Expected connection candidates when moving VALUE_SIMPLE, after
   * pressing ArrowUp n times.
   */
  const EXPECTED_VALUE_UP = EXPECTED_VALUE_DOWN.concat().reverse();

  /**
   * Expected connection candidates when moving VALUE_SIMPLE, after
   * pressing ArrowLeft n times.
   */
  const EXPECTED_VALUE_LEFT = [
    {id: 'join1', index: 2, ownIndex: 0}, // Join second input
    {id: 'join1', index: 1, ownIndex: 0}, // Join first input
    {id: 'print3', index: 2, ownIndex: 0}, // Replacing  join expression.
  ];

  /**
   * Expected connection candidates when moving VALUE_SIMPLE, after
   * pressing ArrowRight n times.
   */
  const EXPECTED_VALUE_RIGHT = EXPECTED_VALUE_LEFT.concat().reverse();

  for (const renderer of ['geras', 'thrasos', 'zelos']) {
    // TODO(#707): These tests fail when run using zelos, so for now
    // we skip entire suite.  Stop skipping suite when bug is fixed.
    const suiteOrSkip = renderer === 'zelos' ? suite.skip : suite;
    suiteOrSkip(`using ${renderer}`, function () {
      // Clear the workspace and load start blocks.
      setup(async function () {
        this.browser = await testSetup(
          createTestUrl(
            new URLSearchParams({renderer, scenario: 'moveValueTestBlocks'}),
          ),
          this.timeout(),
        );
        await this.browser.pause(PAUSE_TIME);
      });

      suite('Unconstrained moves of a simple reporter block', function () {
        setup(async function () {
          await appendBlock(this.browser, VALUE_SIMPLE);
        });

        test('moving down', async function () {
          await moveBlock(
            this.browser,
            VALUE_SIMPLE.id,
            (await getInputCoordinates(this.browser, 'print1', 'TEXT')).x,
            (await getCoordinate(this.browser, 'join0')).y + 80,
          );
          await moveBlockAndAssertCandidateOrder(
            VALUE_SIMPLE.id,
            [Key.Alt, Key.ArrowDown],
            EXPECTED_VALUE_DOWN,
            this.browser,
          );
        });

        test('moving up', async function () {
          await moveBlock(
            this.browser,
            VALUE_SIMPLE.id,
            (await getInputCoordinates(this.browser, 'print1', 'TEXT')).x,
            (await getCoordinate(this.browser, 'join0')).y + 235,
          );
          await moveBlockAndAssertCandidateOrder(
            VALUE_SIMPLE.id,
            [Key.Alt, Key.ArrowUp],
            EXPECTED_VALUE_UP,
            this.browser,
          );
        });

        test('moving left', async function () {
          await moveBlock(
            this.browser,
            VALUE_SIMPLE.id,
            (await getInputCoordinates(this.browser, 'join1', 'ADD1')).x + 30,
            (await getCoordinate(this.browser, 'join1')).y,
          );
          await moveBlockAndAssertCandidateOrder(
            VALUE_SIMPLE.id,
            [Key.Alt, Key.ArrowLeft],
            EXPECTED_VALUE_LEFT,
            this.browser,
          );
        });

        test('moving right', async function () {
          await moveBlock(
            this.browser,
            VALUE_SIMPLE.id,
            (await getInputCoordinates(this.browser, 'join1', 'ADD1')).x - 310,
            (await getCoordinate(this.browser, 'join1')).y,
          );
          await moveBlockAndAssertCandidateOrder(
            VALUE_SIMPLE.id,
            [Key.Alt, Key.ArrowRight],
            EXPECTED_VALUE_RIGHT,
            this.browser,
          );
        });
      });

      suite('Unconstrained moves of a unary value block', function () {
        setup(async function () {
          await appendBlock(this.browser, VALUE_UNARY);
        });

        test('moving down', async function () {
          await moveBlock(
            this.browser,
            VALUE_UNARY.id,
            (await getInputCoordinates(this.browser, 'print1', 'TEXT')).x,
            (await getCoordinate(this.browser, 'join0')).y + 80,
          );
          await moveBlockAndAssertCandidateOrder(
            VALUE_UNARY.id,
            [Key.Alt, Key.ArrowDown],
            EXPECTED_VALUE_DOWN,
            this.browser,
          );
        });

        test('moving up', async function () {
          await moveBlock(
            this.browser,
            VALUE_UNARY.id,
            (await getInputCoordinates(this.browser, 'print1', 'TEXT')).x,
            (await getCoordinate(this.browser, 'join0')).y + 235,
          );
          await moveBlockAndAssertCandidateOrder(
            VALUE_UNARY.id,
            [Key.Alt, Key.ArrowUp],
            EXPECTED_VALUE_UP,
            this.browser,
          );
        });

        test('moving left', async function () {
          await moveBlock(
            this.browser,
            VALUE_UNARY.id,
            (await getInputCoordinates(this.browser, 'join1', 'ADD1')).x + 30,
            (await getCoordinate(this.browser, 'join1')).y,
          );
          await moveBlockAndAssertCandidateOrder(
            VALUE_UNARY.id,
            [Key.Alt, Key.ArrowLeft],
            EXPECTED_VALUE_LEFT,
            this.browser,
          );
        });

        test('moving right', async function () {
          await moveBlock(
            this.browser,
            VALUE_UNARY.id,
            (await getInputCoordinates(this.browser, 'join1', 'ADD1')).x - 310,
            (await getCoordinate(this.browser, 'join1')).y,
          );
          await moveBlockAndAssertCandidateOrder(
            VALUE_UNARY.id,
            [Key.Alt, Key.ArrowRight],
            EXPECTED_VALUE_RIGHT,
            this.browser,
          );
        });
      });
    });
  }
});

/**
 * Create a mocha test function moving a specified block in a
 * particular direction, checking that it has the expected
 * connection candidate after each step, and that once the move
 * finishes that the moving block is reconnected to its initial
 * location.
 *
 * @param mover Block ID of the block to be moved.
 * @param key Key to send to move one step.
 * @param candidates Array of expected connection candidates.
 * @returns function to pass as second argument to mocha's test function.
 */
function moveTest(
  mover: string,
  key: string | string[],
  candidates: Array<{id: string; index: number}>,
) {
  return async function (this: Mocha.Context) {
    // Navigate to block to be moved and intiate move.
    await focusOnBlock(this.browser, mover);
    const initialInfo = await getFocusedNeighbourInfo(this.browser);
    await sendKeyAndWait(this.browser, 'm');
    // Press specified key multiple times, checking connection candidates.
    for (let i = 0; i < candidates.length; i++) {
      const candidate = await getConnectionCandidate(this.browser);
      chai.assert.deepEqual(candidate, candidates[i]);
      await sendKeyAndWait(this.browser, key);
    }

    // Finish move and check final location of moved block.
    await sendKeyAndWait(this.browser, Key.Enter);
    const finalInfo = await getFocusedNeighbourInfo(this.browser);
    chai.assert.deepEqual(initialInfo, finalInfo);
  };
}

/**
 * Assert that repeatedly moving the "mover" block with the provided key command
 * results in a sequence of unique candidate connections that matches the
 * provided candidates in the same order.
 *
 * This allows for incremental movements that result in the same candidate
 * multiple times. After each time the block is moved, it's current candidate
 * connection will be compared to the previous candidate connection, and it will
 * repeatedly move the block until a different candidate is found before
 * comparing that new candidate to the next expected candidate in the sequence.
 *
 * @param mover The block to be moved.
 * @param key The key command to use to move the block.
 * @param candidates The ordered sequence of expected candidate connections.
 * @param browser The browser context.
 */
async function moveBlockAndAssertCandidateOrder(
  mover: string,
  key: string | string[],
  candidates: Array<{id: string; index: number; ownIndex: number} | null>,
  browser: Browser,
) {
  // Navigate to block to be moved and intiate move.
  await focusOnBlock(browser, mover);
  await sendKeyAndWait(browser, 'm');
  let lastCandidate: {id: string; index: number; ownIndex: number} | null =
    null;
  for (let i = 0; i < candidates.length; i++) {
    // Press specified key multiple times until a new candidate is found.
    let candidate: {id: string; index: number; ownIndex: number} | null = null;
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sendKeyAndWait(browser, key);

      candidate = await getConnectionCandidate(browser);
      // If no candidate was found yet, try moving the block again.
      if (candidate === null) {
        continue;
      }

      const sameAsLastCandidate =
        candidate.id === lastCandidate?.id &&
        candidate.index === lastCandidate?.index &&
        candidate.ownIndex === lastCandidate?.ownIndex;
      // If the current candidate still matches a previously verified one, move
      // and try again.
      if (sameAsLastCandidate) {
        continue;
      }

      // A new candidate connection was found. Verify that it's the next
      // expected candidate before moving again.
      break;
    }
    chai.assert.deepEqual(candidate, candidates[i], `At candidate index ${i}`);
    lastCandidate = candidate;
  }
}

/**
 * Get information about the currently-focused block's parent and
 * child blocks.
 *
 * @param browser The webdriverio browser session.
 * @returns A promise setting to
 *
 *         {parentId, parentIndex, nextId, valueId}
 *
 *     where parentId, parentIndex are the ID of the parent block and
 *     the index of the connection on that block to which the
 *     currently-focused block is connected, nextId is the ID of block
 *     connected to the focused block's next connection, and valueID
 *     is the ID of a block connected to the zeroth input of the
 *     focused block (or, in each case, null if there is no such
 *     block).
 */
function getFocusedNeighbourInfo(browser: Browser) {
  return browser.execute(() => {
    const focused = Blockly.getFocusManager().getFocusedNode();
    if (!focused) throw new Error('nothing focused');
    if (!(focused instanceof Blockly.BlockSvg)) {
      throw new TypeError('focused node is not a BlockSvg');
    }
    const block = focused; // Inferred as BlockSvg.
    const parent = block?.getParent();
    // N.B. explicitly converts any undefined values to null because
    // browser.execute does this implicitly and so otherwise this
    // function would return values that were not compliant with its
    // own inferred type signature!
    return {
      parentId: parent?.id ?? null,
      parentIndex:
        parent
          ?.getConnections_(true)
          .findIndex((conn) => conn.targetBlock() === block) ?? null,
      nextId: block?.getNextBlock()?.id ?? null,
      valueId: block?.inputList[0].connection?.targetBlock()?.id ?? null,
    };
  });
}

/**
 * Given a block ID and index of a connection on that block, find the
 * first block connected to that block (skipping any insertion markers),
 * and return that block's ID and a boolean indicating whether that
 * block is a shadow or not.
 *
 * @param browser The webdriverio browser session.
 * @param id The ID of the block having the connection we wish to examine.
 * @param index The index of the connection we wish to examine, within
 *     the array returned by calling .getConnections_(true) on that block.
 * @returns A promise settling to {id, shadow}, where id is the ID of
 *     the connected block or null if no block is connected, and
 *     shadow is true iff the connected block is a shadow.
 */
function getConnectedBlockInfo(browser: Browser, id: string, index: number) {
  return browser.execute(
    (id: string, index: number) => {
      const parent = Blockly.getMainWorkspace().getBlockById(id);
      if (!parent) throw new Error('parent block gone');
      let block = parent.getConnections_(true)[index].targetBlock() ?? null;
      while (block?.isInsertionMarker()) {
        // If insertion marker, try to follow next or zeroth input connection.
        const connection =
          block.nextConnection ?? block.inputList[0].connection;
        block = connection?.targetBlock() ?? null;
      }
      return {
        id: block?.id ?? null,
        shadow: block?.isShadow() ?? false,
      };
    },
    id,
    index,
  );
}

/**
 * Given a block ID, get the coordinates of that block, as returned by
 * getRelativeTosSurfaceXY().
 *
 * @param browser The webdriverio browser session.
 * @param id The ID of the block we wish to examine.
 * @returns The coordinates of the block.
 */
function getCoordinate(
  browser: Browser,
  id: string,
): Promise<Blockly.utils.Coordinate> {
  return browser.execute((id: string) => {
    const block = Blockly.getMainWorkspace().getBlockById(id);
    if (!block) throw new Error('block not found');
    return block.getRelativeToSurfaceXY();
  }, id);
}

/**
 * Given a block ID and input name, get the coordinates of that block's input.
 *
 * @param browser The webdriverio browser session.
 * @param id The ID of the block we wish to examine.
 * @param inputName The name of the input to examine.
 * @returns The coordinates of the input.
 */
function getInputCoordinates(
  browser: Browser,
  id: string,
  inputName: string,
): Promise<Blockly.utils.Coordinate> {
  return browser.execute(
    (id: string, inputName: string) => {
      const block = Blockly.getMainWorkspace().getBlockById(id);
      if (!block) throw new Error('block not found');
      const input = block.getInput(inputName);
      if (!input) throw new Error('input not found');
      const connection = input.connection;
      if (!connection) throw new Error('connection not found');
      return new Blockly.utils.Coordinate(connection.x, connection.y);
    },
    id,
    inputName,
  );
}

/**
 * Move a block with the given a block ID to the given workspace coordinates.
 *
 * @param browser The webdriverio browser session.
 * @param id The ID of the block to move.
 * @param x The destination x coordinate.
 * @param y The destination y coordinate.
 */
function moveBlock(
  browser: Browser,
  id: string,
  x: number,
  y: number,
): Promise<void> {
  return browser.execute(
    (id: string, x: number, y: number) => {
      const block = Blockly.getMainWorkspace().getBlockById(id);
      if (!block) throw new Error('block not found');
      const currentCoords = block.getRelativeToSurfaceXY();
      block.moveBy(x - currentCoords.x, y - currentCoords.y);
    },
    id,
    x,
    y,
  );
}

/**
 * Get information about the connection candidate for the
 * currently-moving block (if any).
 *
 * @param browser The webdriverio browser session.
 * @returns A promise setting to either null if there is no connection
 *     candidate, or otherwise if there is one to
 *
 *         {id, index, ownIndex}
 *
 *     where id is the block ID of the neighbour, index is the index
 *     of the candidate connection on the neighbour, and ownIndex is
 *     the index of the candidate connection on the moving block.
 */
function getConnectionCandidate(
  browser: Browser,
): Promise<{id: string; index: number; ownIndex: number} | null> {
  return browser.execute(() => {
    const focused = Blockly.getFocusManager().getFocusedNode();
    if (!focused) throw new Error('nothing focused');
    if (!(focused instanceof Blockly.BlockSvg)) {
      throw new TypeError('focused node is not a BlockSvg');
    }
    const block = focused; // Inferred as BlockSvg.
    const dragStrategy =
      block.getDragStrategy() as Blockly.dragging.BlockDragStrategy;
    if (!dragStrategy) throw new Error('no drag strategy');
    // @ts-expect-error connectionCandidate is private.
    const candidate = dragStrategy.connectionCandidate;
    if (!candidate) return null;
    const neighbourBlock = candidate.neighbour.getSourceBlock();
    if (!neighbourBlock) throw new TypeError('connection has no source block');
    const neighbourConnections = neighbourBlock.getConnections_(true);
    const index = neighbourConnections.indexOf(candidate.neighbour);
    const ownConnections = block.getConnections_(true);
    const ownIndex = ownConnections.indexOf(candidate.local);
    return {id: neighbourBlock.id, index, ownIndex};
  });
}

/**
 * Create a new block from serialised state (parsed JSON) and
 * optionally attach it to an existing block on the workspace.
 *
 * @param browser The WebdriverIO browser object.
 * @param state The JSON definition of the new block.
 * @param parentId The ID of the block to attach to. If undefined, the
 *     new block is not attached.
 * @param inputName The name of the input on the parent block to
 *     attach to. If undefined, the new block is attached to the
 *     parent's next connection.
 * @returns A promise that resolves with the new block's ID.
 */
async function appendBlock(
  browser: Browser,
  state: Blockly.serialization.blocks.State,
  parentId?: string,
  inputName?: string,
): Promise<string> {
  return await browser.execute(
    (state, parentId, inputName) => {
      const workspace = Blockly.getMainWorkspace();
      if (!workspace) throw new Error('workspace not found');

      const block = Blockly.serialization.blocks.append(state, workspace);
      if (!block) throw new Error('failed to create block from state');
      if (!parentId) return block.id;

      try {
        const parent = workspace.getBlockById(parentId);
        if (!parent) throw new Error(`parent block not found: ${parentId}`);

        let parentConnection;
        let childConnection;

        if (inputName) {
          parentConnection = parent.getInput(inputName)?.connection;
          if (!parentConnection) {
            throw new Error(`input ${inputName} not found on parent`);
          }
          childConnection = block.outputConnection ?? block.previousConnection;
        } else {
          parentConnection = parent.nextConnection;
          if (!parentConnection) {
            throw new Error('parent has no next connection');
          }
          childConnection = block.previousConnection;
        }
        if (!childConnection) throw new Error('new block not compatible');
        parentConnection.connect(childConnection);
        return block.id;
      } catch (e) {
        // If anything goes wrong during attachment, clean up the new block.
        block.dispose();
        throw e;
      }
    },
    state,
    parentId,
    inputName,
  );
}
