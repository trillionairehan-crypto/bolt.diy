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

  it('reset() clears prior output so the next parse for a message starts fresh', () => {
    const parser = new EnhancedStreamingMessageParser({ artifactElement: () => '' });

    parser.parse('message_1', 'src/App.jsx\n```jsx\nfunction App() {}\n```\n');
    parser.reset();

    const output = parser.parse('message_1', 'Hello, world!');
    expect(output).toBe('Hello, world!');
  });
});
