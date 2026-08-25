import { describe, expect, it } from 'vitest';
import { EnhancedStreamingMessageParser } from './enhanced-message-parser';

describe('EnhancedStreamingMessageParser', () => {
  it('does not duplicate output across streaming ticks once auto-wrap activates', () => {
    const parser = new EnhancedStreamingMessageParser({ artifactElement: () => '' });

    const fullMessage =
      'Here is the code:\n\nsrc/App.jsx\n```jsx\nfunction App() {\n  return <div>Hello</div>;\n}\n```\n\nDone!';

    let message = '';
    let lastOutput = '';

    /*
     * Simulate the AI SDK streaming this message in growing chunks, exactly like
     * useMessageParser.ts calling parse() with the cumulative text on every render.
     */
    for (const chunk of fullMessage) {
      message += chunk;

      const output = parser.parse('message_1', message);

      /*
       * parse() always returns the FULL parsed-so-far text (see class docstring). Once the
       * auto-wrap heuristic detects the completed code fence and re-parses from scratch, the
       * previous bug re-emitted the whole message on every subsequent tick, so this length
       * would grow far past the raw input length instead of tracking it.
       */
      expect(output.length).toBeLessThanOrEqual(message.length);

      lastOutput = output;
    }

    expect(lastOutput).toBe('Here is the code:\n\n\nDone!');
  });

  it('does not duplicate an earlier finished message when a later message triggers auto-wrap', () => {
    const parser = new EnhancedStreamingMessageParser({ artifactElement: () => '' });

    /*
     * Message 1 is already a complete, properly-tagged artifact (no auto-wrap involved), with
     * visible prose text outside the tags so a duplicated reparse would show up in the output.
     */
    const message1 =
      'Here you go:\n\n' +
      '<boltArtifact id="a1" title="app.js" type="bundled">\n' +
      '<boltAction type="file" filePath="app.js">\nconsole.log(1);\n</boltAction>\n' +
      '</boltArtifact>\n\nDone!';

    const firstOutput = parser.parse('message_1', message1);
    expect(firstOutput).toBe('Here you go:\n\n\n\nDone!');

    /*
     * Message 2 streams in without artifact tags, containing a code fence that triggers
     * the auto-wrap fallback (previously this called super.reset(), wiping message_1's state).
     */
    const message2 = 'other.js\n```js\nconsole.log(2);\n```\n';
    parser.parse('message_2', message2);

    /*
     * useMessageParser.ts re-parses every message on every render tick with the same
     * (unchanged) cumulative text. If message_1's tracked position was wiped by message_2's
     * auto-wrap reset, this call would reparse it from scratch and double the output.
     */
    const secondOutput = parser.parse('message_1', message1);

    expect(secondOutput).toBe(firstOutput);
  });

  it('reset() clears prior output so the next parse for a message starts fresh', () => {
    const parser = new EnhancedStreamingMessageParser({ artifactElement: () => '' });

    parser.parse('message_1', 'src/App.jsx\n```jsx\nfunction App() {}\n```\n');
    parser.reset();

    const output = parser.parse('message_1', 'Hello, world!');
    expect(output).toBe('Hello, world!');
  });
});
