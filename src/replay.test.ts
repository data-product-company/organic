import { describe, it, expect } from 'vitest';
import { reconstructDocumentUpTo, deleteTextAt, insertTextAt, ForensicEvent } from './replay';

describe('Forensic Replay Engine', () => {
  it('reconstructs simple typed text sequences', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'H' },
      { id: 3, timestamp: 1002, row: 1, column: 2, event_type: 'input', content: 'e' },
      { id: 4, timestamp: 1003, row: 1, column: 3, event_type: 'input', content: 'y' },
    ];

    const result = reconstructDocumentUpTo(3, mockEvents);
    expect(result).toBe('Hey');
  });

  it('respects newline splits and character deletions', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'A' },
      { id: 3, timestamp: 1002, row: 1, column: 2, event_type: 'input', content: 'B' },
      { id: 4, timestamp: 1003, row: 1, column: 3, event_type: 'input', content: 'Enter' },
      { id: 5, timestamp: 1004, row: 2, column: 1, event_type: 'input', content: 'C' },
      { id: 6, timestamp: 1005, row: 2, column: 1, event_type: 'input', content: 'deleteContentBackward' },
    ];

    const result = reconstructDocumentUpTo(5, mockEvents);
    expect(result).toBe('AB\n');
  });

  it('handles empty line feeds safely', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'Enter' },
    ];
    const result = reconstructDocumentUpTo(1, mockEvents);
    expect(result).toBe('\n');
  });

  it('ignores formatting and history events like formatBold and formatUnderline', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'h' },
      { id: 3, timestamp: 1002, row: 1, column: 2, event_type: 'input', content: 'i' },
      { id: 4, timestamp: 1003, row: 1, column: 3, event_type: 'input', content: 'formatBold' },
      { id: 5, timestamp: 1004, row: 1, column: 3, event_type: 'input', content: '!' },
      { id: 6, timestamp: 1005, row: 1, column: 4, event_type: 'input', content: 'formatUnderline' },
      { id: 7, timestamp: 1006, row: 1, column: 4, event_type: 'input', content: 'formatJustifyFull' },
      { id: 8, timestamp: 1007, row: 1, column: 4, event_type: 'input', content: 'formatJustifyLeft' },
      { id: 9, timestamp: 1008, row: 1, column: 4, event_type: 'input', content: 'formatJustifyCenter' },
      { id: 10, timestamp: 1009, row: 1, column: 4, event_type: 'input', content: 'formatJustifyRight' },
    ];

    const result = reconstructDocumentUpTo(9, mockEvents);
    expect(result).toBe('hi!');
  });

  it('reconstructs a document starting from an open event with multiple empty lines', () => {
    const mockEvents: ForensicEvent[] = [
      {
        id: 1,
        timestamp: 1000,
        row: 1,
        column: 1,
        event_type: 'open',
        content: 'this is a new document\n\nit should be clean to replay\n\ni want to make sure that formatting is retained during replay.'
      }
    ];
    const result = reconstructDocumentUpTo(0, mockEvents);
    expect(result).toBe('this is a new document\n\nit should be clean to replay\n\ni want to make sure that formatting is retained during replay.');
  });

  it('successfully calculates total reconstruction states through index ranges', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'F' },
      { id: 3, timestamp: 1002, row: 1, column: 2, event_type: 'input', content: 'a' },
      { id: 4, timestamp: 1003, row: 1, column: 3, event_type: 'input', content: 's' },
      { id: 5, timestamp: 1004, row: 1, column: 4, event_type: 'input', content: 't' },
    ];

    // Reconstruct half-way
    const halfState = reconstructDocumentUpTo(2, mockEvents);
    expect(halfState).toBe('Fa');

    // Reconstruct fully
    const finalState = reconstructDocumentUpTo(4, mockEvents);
    expect(finalState).toBe('Fast');
  });

  it('replays mass edits and text replacements correctly using before_replace and multiline input', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'open', content: 'this is a new document\n\nit should be clean to replay' },
      // Select and replace "it should be clean to replay" (row 3, col 1) with a multiline rewrite
      { id: 2, timestamp: 1001, row: 3, column: 1, event_type: 'before_replace', content: 'it should be clean to replay' },
      { id: 3, timestamp: 1002, row: 3, column: 1, event_type: 'input', content: 'i want to make sure\nthat formatting is retained\nduring replay.' },
    ];

    const result = reconstructDocumentUpTo(2, mockEvents);
    expect(result).toBe('this is a new document\n\ni want to make sure\nthat formatting is retained\nduring replay.');
  });

  it('replays multiline deletions correctly', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'open', content: 'line1\nline2\nline3' },
      { id: 2, timestamp: 1001, row: 1, column: 4, event_type: 'before_replace', content: 'e1\nline2\nli' },
    ];
    const result = reconstructDocumentUpTo(1, mockEvents);
    expect(result).toBe('linne3');
  });

  it('directly tests insertTextAt with single and multiline strings', () => {
    const lines = ['hello', 'world'];
    insertTextAt(lines, 0, 5, ' there');
    expect(lines).toEqual(['hello there', 'world']);

    const lines2 = ['start', 'end'];
    insertTextAt(lines2, 0, 5, '\nmiddle\n');
    expect(lines2).toEqual(['start', 'middle', '', 'end']);
  });

  it('directly tests deleteTextAt with single and multiline strings', () => {
    const lines = ['hello there', 'world'];
    deleteTextAt(lines, 0, 5, ' there');
    expect(lines).toEqual(['hello', 'world']);

    const lines2 = ['start', 'middle', 'empty', 'end'];
    deleteTextAt(lines2, 0, 4, 't\nmiddle\nemp');
    expect(lines2).toEqual(['starty', 'end']);
  });

  it('replays undo and redo events correctly', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'H' },
      { id: 3, timestamp: 1002, row: 1, column: 2, event_type: 'input', content: 'e' },
      { id: 4, timestamp: 1003, row: 1, column: 3, event_type: 'input', content: 'y' },
      { id: 5, timestamp: 1004, row: 1, column: 4, event_type: 'undo', content: null },
      { id: 6, timestamp: 1005, row: 1, column: 3, event_type: 'redo', content: null },
    ];

    const afterUndo = reconstructDocumentUpTo(4, mockEvents);
    expect(afterUndo).toBe('He');

    const afterRedo = reconstructDocumentUpTo(5, mockEvents);
    expect(afterRedo).toBe('Hey');
  });

  it('replays backspace line-merges correctly', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'open', content: 'hello\nworld' },
      { id: 2, timestamp: 1001, row: 1, column: 6, event_type: 'input', content: 'deleteContentBackward' },
    ];
    const result = reconstructDocumentUpTo(1, mockEvents);
    expect(result).toBe('helloworld');
  });

  it('replays clipboard multiline paste correctly', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'clipboard_paste', content: 'first\nsecond\nthird' },
    ];
    const result = reconstructDocumentUpTo(1, mockEvents);
    expect(result).toBe('first\nsecond\nthird');
  });

  it('ignores duplicate input events after clipboard paste', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'clipboard_paste', content: 'hello' },
      { id: 3, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'hello' },
    ];
    const result = reconstructDocumentUpTo(2, mockEvents);
    expect(result).toBe('hello');
  });

  it('ignores duplicate input events before clipboard paste', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'hello' },
      { id: 3, timestamp: 1001, row: 1, column: 1, event_type: 'clipboard_paste', content: 'hello' },
    ];
    const result = reconstructDocumentUpTo(2, mockEvents);
    expect(result).toBe('hello');
  });

  it('reconstructs tab key insertion events correctly', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: '\t' },
      { id: 3, timestamp: 1002, row: 1, column: 2, event_type: 'input', content: 'a' },
    ];
    const result = reconstructDocumentUpTo(2, mockEvents);
    expect(result).toBe('\ta');
  });

  it('reconstructs complex mid-line tab insertions and mixed tab/text sequences', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'hello' },
      { id: 3, timestamp: 1002, row: 1, column: 6, event_type: 'input', content: '\t' },
      { id: 4, timestamp: 1003, row: 1, column: 7, event_type: 'input', content: 'world' },
    ];
    const result = reconstructDocumentUpTo(3, mockEvents);
    expect(result).toBe('hello\tworld');
  });

  it('handles deleting tab characters correctly during replay', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'open', content: 'a\tb' },
      { id: 2, timestamp: 1001, row: 1, column: 2, event_type: 'input', content: 'deleteContentForward' },
    ];
    const result = reconstructDocumentUpTo(1, mockEvents);
    expect(result).toBe('ab');
  });

  it('replays forward-delete line-merges correctly', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'open', content: 'hello\nworld' },
      { id: 2, timestamp: 1001, row: 1, column: 6, event_type: 'input', content: 'deleteContentForward' },
    ];
    const result = reconstructDocumentUpTo(1, mockEvents);
    expect(result).toBe('helloworld');
  });

  it('handles multiple sequential paste events correctly', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'clipboard_paste', content: 'first\n' },
      { id: 3, timestamp: 1002, row: 2, column: 1, event_type: 'clipboard_paste', content: 'second\n' },
      { id: 4, timestamp: 1003, row: 3, column: 1, event_type: 'clipboard_paste', content: 'third' },
    ];
    const result = reconstructDocumentUpTo(3, mockEvents);
    expect(result).toBe('first\nsecond\nthird');
  });

  it('safely ignores share_bundle events during playback reconstruction', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'H' },
      { id: 3, timestamp: 1002, row: 1, column: 1, event_type: 'share_bundle', content: 'test.zip' },
    ];
    const result = reconstructDocumentUpTo(2, mockEvents);
    expect(result).toBe('H');
  });

  it('replays clipboard_cut events correctly', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'open', content: 'hello world' },
      { id: 2, timestamp: 1001, row: 1, column: 7, event_type: 'clipboard_cut', content: 'world' },
    ];
    const result = reconstructDocumentUpTo(1, mockEvents);
    expect(result).toBe('hello ');
  });

  it('safely ignores composition_start and composition_end events during playback', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'composition_start', content: null },
      { id: 3, timestamp: 1002, row: 1, column: 1, event_type: 'input', content: 'a' },
      { id: 4, timestamp: 1003, row: 1, column: 2, event_type: 'composition_end', content: 'a' },
    ];
    const result = reconstructDocumentUpTo(3, mockEvents);
    expect(result).toBe('a');
  });

  it('safely ignores zoom events during playback reconstruction', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'Z' },
      { id: 3, timestamp: 1002, row: 1, column: 2, event_type: 'zoom_in', content: null },
      { id: 4, timestamp: 1003, row: 1, column: 2, event_type: 'zoom_out', content: null },
      { id: 5, timestamp: 1004, row: 1, column: 2, event_type: 'reset_zoom', content: null },
    ];
    const result = reconstructDocumentUpTo(4, mockEvents);
    expect(result).toBe('Z');
  });

  it('handles complex undo/redo sequences across multiline edits', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'First' },
      { id: 3, timestamp: 1002, row: 1, column: 6, event_type: 'input', content: 'Enter' },
      { id: 4, timestamp: 1003, row: 2, column: 1, event_type: 'input', content: 'Second' },
      { id: 5, timestamp: 1004, row: 2, column: 7, event_type: 'undo', content: null },
      { id: 6, timestamp: 1005, row: 2, column: 1, event_type: 'undo', content: null },
      { id: 7, timestamp: 1006, row: 1, column: 6, event_type: 'redo', content: null },
    ];

    // After writing "First\nSecond" and undoing once, we should have "First\n"
    const stateAfterOneUndo = reconstructDocumentUpTo(4, mockEvents);
    expect(stateAfterOneUndo).toBe('First\n');

    // After undoing twice, we should have "First"
    const stateAfterTwoUndos = reconstructDocumentUpTo(5, mockEvents);
    expect(stateAfterTwoUndos).toBe('First');

    // After redoing once, we should be back to "First\n"
    const stateAfterRedo = reconstructDocumentUpTo(6, mockEvents);
    expect(stateAfterRedo).toBe('First\n');
  });

  it('correctly replays text after center alignment and subsequent multiline typing', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'Hello World!' },
      { id: 3, timestamp: 1002, row: 1, column: 13, event_type: 'input', content: 'insertParagraph' },
      { id: 4, timestamp: 1003, row: 2, column: 1, event_type: 'input', content: 'insertParagraph' },
      // Center alignment logs before_replace and then input with the same text
      { id: 5, timestamp: 1004, row: 1, column: 1, event_type: 'before_replace', content: 'Hello World!' },
      { id: 6, timestamp: 1005, row: 1, column: 1, event_type: 'input', content: 'Hello World!' },
      { id: 7, timestamp: 1006, row: 3, column: 1, event_type: 'input', content: 'C' },
    ];
    const result = reconstructDocumentUpTo(6, mockEvents);
    expect(result).toBe('Hello World!\n\nC');
  });

  it('replays a full document load and subsequent edit using the helloworld.txt content', () => {
    const helloworldPlain = 'Hello World!\n\nCan you prove your authorship in the AI-era? How do you answer that question?\n\nWe are super-excited to launch Organic Replay: “Human, not A.I.” document editor.\n\nWe are making it available as GNU GPLv3.\n\nBrought to you by Data Product Company LLC (https://www.dataproduct.company).\n\nWrite confidently!';

    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'open', content: helloworldPlain },
      // Make a text addition to "Write confidently!" -> "Write confidently with forensic integrity!"
      // Row 11 has "Write confidently!" (length 18, so offset column is 18)
      { id: 2, timestamp: 1001, row: 11, column: 18, event_type: 'input', content: ' with forensic integrity' }
    ];

    const result = reconstructDocumentUpTo(1, mockEvents);
    const expectedEnd = 'Hello World!\n\nCan you prove your authorship in the AI-era? How do you answer that question?\n\nWe are super-excited to launch Organic Replay: “Human, not A.I.” document editor.\n\nWe are making it available as GNU GPLv3.\n\nBrought to you by Data Product Company LLC (https://www.dataproduct.company).\n\nWrite confidently with forensic integrity!';
    expect(result).toBe(expectedEnd);
  });

  it('correctly replays text when before_replace is followed by a null or format input during center-alignment', () => {
    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'Hello World!' },
      // Center alignment logs before_replace and then input with null content
      { id: 3, timestamp: 1002, row: 1, column: 1, event_type: 'before_replace', content: 'Hello World!' },
      { id: 4, timestamp: 1003, row: 1, column: 1, event_type: 'input', content: null },
    ];
    const result = reconstructDocumentUpTo(3, mockEvents);
    expect(result).toBe('Hello World!');
  });

  it('correctly replays a full chronological document session with multi-paragraphs, quotes, center styling, and templates', () => {
    const helloworldPlain = 'Hello World!\n\nCan you prove your authorship in the AI-era?\n\nWith Organic Replay you can!\n\nWe are excited to launch Organic Replay: “Human, not A.I.” document editor.\n\nIt comes with replay so you or others can see how the document came into being.\n\nBrought to you by Data Product Company LLC (www.dataproduct.company).\n\nWrite confidently!\n\nPS: It’s GNU GPLv3 :)';

    const mockEvents: ForensicEvent[] = [
      { id: 1, timestamp: 1000, row: 1, column: 1, event_type: 'new', content: null },
      // L:1 typing "Hello World!"
      { id: 2, timestamp: 1001, row: 1, column: 1, event_type: 'input', content: 'H' },
      { id: 3, timestamp: 1002, row: 1, column: 2, event_type: 'input', content: 'e' },
      { id: 4, timestamp: 1003, row: 1, column: 3, event_type: 'input', content: 'l' },
      { id: 5, timestamp: 1004, row: 1, column: 4, event_type: 'input', content: 'l' },
      { id: 6, timestamp: 1005, row: 1, column: 5, event_type: 'input', content: 'o' },
      { id: 7, timestamp: 1006, row: 1, column: 6, event_type: 'input', content: ' ' },
      { id: 8, timestamp: 1007, row: 1, column: 7, event_type: 'input', content: 'W' },
      { id: 9, timestamp: 1008, row: 1, column: 8, event_type: 'input', content: 'o' },
      { id: 10, timestamp: 1009, row: 1, column: 9, event_type: 'input', content: 'r' },
      { id: 11, timestamp: 1010, row: 1, column: 10, event_type: 'input', content: 'l' },
      { id: 12, timestamp: 1011, row: 1, column: 11, event_type: 'input', content: 'd' },
      { id: 13, timestamp: 1012, row: 1, column: 12, event_type: 'input', content: '!' },
      { id: 14, timestamp: 1013, row: 1, column: 13, event_type: 'input', content: 'insertParagraph' },
      { id: 15, timestamp: 1014, row: 2, column: 1, event_type: 'input', content: 'insertParagraph' },
      // L:3 typing "Can you prove your authorship in the AI-era?"
      { id: 16, timestamp: 1015, row: 3, column: 1, event_type: 'input', content: 'C' },
      { id: 17, timestamp: 1016, row: 3, column: 2, event_type: 'input', content: 'a' },
      { id: 18, timestamp: 1017, row: 3, column: 3, event_type: 'input', content: 'n' },
      { id: 19, timestamp: 1018, row: 3, column: 4, event_type: 'input', content: ' ' },
      { id: 20, timestamp: 1019, row: 3, column: 5, event_type: 'input', content: 'y' },
      { id: 21, timestamp: 1020, row: 3, column: 6, event_type: 'input', content: 'o' },
      { id: 22, timestamp: 1021, row: 3, column: 7, event_type: 'input', content: 'u' },
      { id: 23, timestamp: 1022, row: 3, column: 8, event_type: 'input', content: ' ' },
      { id: 24, timestamp: 1023, row: 3, column: 9, event_type: 'input', content: 'p' },
      { id: 25, timestamp: 1024, row: 3, column: 10, event_type: 'input', content: 'r' },
      { id: 26, timestamp: 1025, row: 3, column: 11, event_type: 'input', content: 'o' },
      { id: 27, timestamp: 1026, row: 3, column: 12, event_type: 'input', content: 'v' },
      { id: 28, timestamp: 1027, row: 3, column: 13, event_type: 'input', content: 'e' },
      { id: 29, timestamp: 1028, row: 3, column: 14, event_type: 'input', content: ' ' },
      { id: 30, timestamp: 1029, row: 3, column: 15, event_type: 'input', content: 'y' },
      { id: 31, timestamp: 1030, row: 3, column: 16, event_type: 'input', content: 'o' },
      { id: 32, timestamp: 1031, row: 3, column: 17, event_type: 'input', content: 'u' },
      { id: 33, timestamp: 1032, row: 3, column: 18, event_type: 'input', content: 'r' },
      { id: 34, timestamp: 1033, row: 3, column: 19, event_type: 'input', content: ' ' },
      { id: 35, timestamp: 1034, row: 3, column: 20, event_type: 'input', content: 'a' },
      { id: 36, timestamp: 1035, row: 3, column: 21, event_type: 'input', content: 'u' },
      { id: 37, timestamp: 1036, row: 3, column: 22, event_type: 'input', content: 't' },
      { id: 38, timestamp: 1037, row: 3, column: 23, event_type: 'input', content: 'h' },
      { id: 39, timestamp: 1038, row: 3, column: 24, event_type: 'input', content: 'o' },
      { id: 40, timestamp: 1039, row: 3, column: 25, event_type: 'input', content: 'r' },
      { id: 41, timestamp: 1040, row: 3, column: 26, event_type: 'input', content: 's' },
      { id: 42, timestamp: 1041, row: 3, column: 27, event_type: 'input', content: 'h' },
      { id: 43, timestamp: 1042, row: 3, column: 28, event_type: 'input', content: 'i' },
      { id: 44, timestamp: 1043, row: 3, column: 29, event_type: 'input', content: 'p' },
      { id: 45, timestamp: 1044, row: 3, column: 30, event_type: 'input', content: ' ' },
      { id: 46, timestamp: 1045, row: 3, column: 31, event_type: 'input', content: 'i' },
      { id: 47, timestamp: 1046, row: 3, column: 32, event_type: 'input', content: 'n' },
      { id: 48, timestamp: 1047, row: 3, column: 33, event_type: 'input', content: ' ' },
      { id: 49, timestamp: 1048, row: 3, column: 34, event_type: 'input', content: 't' },
      { id: 50, timestamp: 1049, row: 3, column: 35, event_type: 'input', content: 'h' },
      { id: 51, timestamp: 1050, row: 3, column: 36, event_type: 'input', content: 'e' },
      { id: 52, timestamp: 1051, row: 3, column: 37, event_type: 'input', content: ' ' },
      { id: 53, timestamp: 1052, row: 3, column: 38, event_type: 'input', content: 'A' },
      { id: 54, timestamp: 1053, row: 3, column: 39, event_type: 'input', content: 'I' },
      { id: 55, timestamp: 1054, row: 3, column: 40, event_type: 'input', content: '-' },
      { id: 56, timestamp: 1055, row: 3, column: 41, event_type: 'input', content: 'e' },
      { id: 57, timestamp: 1056, row: 3, column: 42, event_type: 'input', content: 'r' },
      { id: 58, timestamp: 1057, row: 3, column: 43, event_type: 'input', content: 'a' },
      { id: 59, timestamp: 1058, row: 3, column: 44, event_type: 'input', content: '?' },
      { id: 60, timestamp: 1059, row: 3, column: 45, event_type: 'input', content: 'insertParagraph' },
      { id: 61, timestamp: 1060, row: 4, column: 1, event_type: 'input', content: 'insertParagraph' },
      // L:5 typing "With Organic Replay you can!"
      { id: 62, timestamp: 1061, row: 5, column: 1, event_type: 'input', content: 'W' },
      { id: 63, timestamp: 1062, row: 5, column: 2, event_type: 'input', content: 'i' },
      { id: 64, timestamp: 1063, row: 5, column: 3, event_type: 'input', content: 't' },
      { id: 65, timestamp: 1064, row: 5, column: 4, event_type: 'input', content: 'h' },
      { id: 66, timestamp: 1065, row: 5, column: 5, event_type: 'input', content: ' ' },
      { id: 67, timestamp: 1066, row: 5, column: 6, event_type: 'input', content: 'O' },
      { id: 68, timestamp: 1067, row: 5, column: 7, event_type: 'input', content: 'r' },
      { id: 69, timestamp: 1068, row: 5, column: 8, event_type: 'input', content: 'g' },
      { id: 70, timestamp: 1069, row: 5, column: 9, event_type: 'input', content: 'a' },
      { id: 71, timestamp: 1070, row: 5, column: 10, event_type: 'input', content: 'n' },
      { id: 72, timestamp: 1071, row: 5, column: 11, event_type: 'input', content: 'i' },
      { id: 73, timestamp: 1072, row: 5, column: 12, event_type: 'input', content: 'c' },
      { id: 74, timestamp: 1073, row: 5, column: 13, event_type: 'input', content: ' ' },
      { id: 75, timestamp: 1074, row: 5, column: 14, event_type: 'input', content: 'R' },
      { id: 76, timestamp: 1075, row: 5, column: 15, event_type: 'input', content: 'e' },
      { id: 77, timestamp: 1076, row: 5, column: 16, event_type: 'input', content: 'p' },
      { id: 78, timestamp: 1077, row: 5, column: 17, event_type: 'input', content: 'l' },
      { id: 79, timestamp: 1078, row: 5, column: 18, event_type: 'input', content: 'a' },
      { id: 80, timestamp: 1079, row: 5, column: 19, event_type: 'input', content: 'y' },
      { id: 81, timestamp: 1080, row: 5, column: 20, event_type: 'input', content: ' ' },
      { id: 82, timestamp: 1081, row: 5, column: 21, event_type: 'input', content: 'y' },
      { id: 83, timestamp: 1082, row: 5, column: 22, event_type: 'input', content: 'o' },
      { id: 84, timestamp: 1083, row: 5, column: 23, event_type: 'input', content: 'u' },
      { id: 85, timestamp: 1084, row: 5, column: 24, event_type: 'input', content: ' ' },
      { id: 86, timestamp: 1085, row: 5, column: 25, event_type: 'input', content: 'c' },
      { id: 87, timestamp: 1086, row: 5, column: 26, event_type: 'input', content: 'a' },
      { id: 88, timestamp: 1087, row: 5, column: 27, event_type: 'input', content: 'n' },
      { id: 89, timestamp: 1088, row: 5, column: 28, event_type: 'input', content: '!' },
      { id: 90, timestamp: 1089, row: 5, column: 29, event_type: 'input', content: 'insertParagraph' },
      { id: 91, timestamp: 1090, row: 6, column: 1, event_type: 'input', content: 'insertParagraph' },
      // L:7 typing 'We are excited to launch Organic Replay: "Human, not A.I." document editor.' with quotes replacement
      { id: 92, timestamp: 1091, row: 7, column: 1, event_type: 'input', content: 'W' },
      { id: 93, timestamp: 1092, row: 7, column: 2, event_type: 'input', content: 'e' },
      { id: 94, timestamp: 1093, row: 7, column: 3, event_type: 'input', content: ' ' },
      { id: 95, timestamp: 1094, row: 7, column: 4, event_type: 'input', content: 'a' },
      { id: 96, timestamp: 1095, row: 7, column: 5, event_type: 'input', content: 'r' },
      { id: 97, timestamp: 1096, row: 7, column: 6, event_type: 'input', content: 'e' },
      { id: 98, timestamp: 1097, row: 7, column: 7, event_type: 'input', content: ' ' },
      { id: 99, timestamp: 1098, row: 7, column: 8, event_type: 'input', content: 'e' },
      { id: 100, timestamp: 1099, row: 7, column: 9, event_type: 'input', content: 'x' },
      { id: 101, timestamp: 1100, row: 7, column: 10, event_type: 'input', content: 'c' },
      { id: 102, timestamp: 1101, row: 7, column: 11, event_type: 'input', content: 'i' },
      { id: 103, timestamp: 1102, row: 7, column: 12, event_type: 'input', content: 't' },
      { id: 104, timestamp: 1103, row: 7, column: 13, event_type: 'input', content: 'e' },
      { id: 105, timestamp: 1104, row: 7, column: 14, event_type: 'input', content: 'd' },
      { id: 106, timestamp: 1105, row: 7, column: 15, event_type: 'input', content: ' ' },
      { id: 107, timestamp: 1106, row: 7, column: 16, event_type: 'input', content: 't' },
      { id: 108, timestamp: 1107, row: 7, column: 17, event_type: 'input', content: 'o' },
      { id: 109, timestamp: 1108, row: 7, column: 18, event_type: 'input', content: ' ' },
      { id: 110, timestamp: 1109, row: 7, column: 19, event_type: 'input', content: 'l' },
      { id: 111, timestamp: 1110, row: 7, column: 20, event_type: 'input', content: 'a' },
      { id: 112, timestamp: 1111, row: 7, column: 21, event_type: 'input', content: 'u' },
      { id: 113, timestamp: 1112, row: 7, column: 22, event_type: 'input', content: 'n' },
      { id: 114, timestamp: 1113, row: 7, column: 23, event_type: 'input', content: 'c' },
      { id: 115, timestamp: 1114, row: 7, column: 24, event_type: 'input', content: 'h' },
      { id: 116, timestamp: 1115, row: 7, column: 25, event_type: 'input', content: ' ' },
      { id: 117, timestamp: 1116, row: 7, column: 26, event_type: 'input', content: 'O' },
      { id: 118, timestamp: 1117, row: 7, column: 27, event_type: 'input', content: 'r' },
      { id: 119, timestamp: 1118, row: 7, column: 28, event_type: 'input', content: 'g' },
      { id: 120, timestamp: 1119, row: 7, column: 29, event_type: 'input', content: 'a' },
      { id: 121, timestamp: 1120, row: 7, column: 30, event_type: 'input', content: 'n' },
      { id: 122, timestamp: 1121, row: 7, column: 31, event_type: 'input', content: 'i' },
      { id: 123, timestamp: 1122, row: 7, column: 32, event_type: 'input', content: 'c' },
      { id: 124, timestamp: 1123, row: 7, column: 33, event_type: 'input', content: ' ' },
      { id: 125, timestamp: 1124, row: 7, column: 34, event_type: 'input', content: 'R' },
      { id: 126, timestamp: 1125, row: 7, column: 35, event_type: 'input', content: 'e' },
      { id: 127, timestamp: 1126, row: 7, column: 36, event_type: 'input', content: 'p' },
      { id: 128, timestamp: 1127, row: 7, column: 37, event_type: 'input', content: 'l' },
      { id: 129, timestamp: 1128, row: 7, column: 38, event_type: 'input', content: 'a' },
      { id: 130, timestamp: 1129, row: 7, column: 39, event_type: 'input', content: 'y' },
      { id: 131, timestamp: 1130, row: 7, column: 40, event_type: 'input', content: ':' },
      { id: 132, timestamp: 1131, row: 7, column: 41, event_type: 'input', content: ' ' },
      // Smart quote open replacements
      { id: 133, timestamp: 1132, row: 7, column: 42, event_type: 'before_replace', content: '"' },
      { id: 134, timestamp: 1133, row: 7, column: 42, event_type: 'input', content: '“' },
      { id: 135, timestamp: 1134, row: 7, column: 43, event_type: 'input', content: 'H' },
      { id: 136, timestamp: 1135, row: 7, column: 44, event_type: 'input', content: 'u' },
      { id: 137, timestamp: 1136, row: 7, column: 45, event_type: 'input', content: 'm' },
      { id: 138, timestamp: 1137, row: 7, column: 46, event_type: 'input', content: 'a' },
      { id: 139, timestamp: 1138, row: 7, column: 47, event_type: 'input', content: 'n' },
      { id: 140, timestamp: 1139, row: 7, column: 48, event_type: 'input', content: ',' },
      { id: 141, timestamp: 1140, row: 7, column: 49, event_type: 'input', content: ' ' },
      { id: 142, timestamp: 1141, row: 7, column: 50, event_type: 'input', content: 'n' },
      { id: 143, timestamp: 1142, row: 7, column: 51, event_type: 'input', content: 'o' },
      { id: 144, timestamp: 1143, row: 7, column: 52, event_type: 'input', content: 't' },
      { id: 145, timestamp: 1144, row: 7, column: 53, event_type: 'input', content: ' ' },
      { id: 146, timestamp: 1145, row: 7, column: 54, event_type: 'input', content: 'A' },
      { id: 147, timestamp: 1146, row: 7, column: 55, event_type: 'input', content: '.' },
      { id: 148, timestamp: 1147, row: 7, column: 56, event_type: 'input', content: 'I' },
      { id: 149, timestamp: 1148, row: 7, column: 57, event_type: 'input', content: '.' },
      // Smart quote close replacements
      { id: 150, timestamp: 1149, row: 7, column: 58, event_type: 'before_replace', content: '"' },
      { id: 151, timestamp: 1150, row: 7, column: 58, event_type: 'input', content: '”' },
      { id: 152, timestamp: 1151, row: 7, column: 59, event_type: 'input', content: ' ' },
      { id: 153, timestamp: 1152, row: 7, column: 60, event_type: 'input', content: 'd' },
      { id: 154, timestamp: 1153, row: 7, column: 61, event_type: 'input', content: 'o' },
      { id: 155, timestamp: 1154, row: 7, column: 62, event_type: 'input', content: 'c' },
      { id: 156, timestamp: 1155, row: 7, column: 63, event_type: 'input', content: 'u' },
      { id: 157, timestamp: 1156, row: 7, column: 64, event_type: 'input', content: 'm' },
      { id: 158, timestamp: 1157, row: 7, column: 65, event_type: 'input', content: 'e' },
      { id: 159, timestamp: 1158, row: 7, column: 66, event_type: 'input', content: 'n' },
      { id: 160, timestamp: 1159, row: 7, column: 67, event_type: 'input', content: 't' },
      { id: 161, timestamp: 1160, row: 7, column: 68, event_type: 'input', content: ' ' },
      { id: 162, timestamp: 1161, row: 7, column: 69, event_type: 'input', content: 'e' },
      { id: 163, timestamp: 1162, row: 7, column: 70, event_type: 'input', content: 'd' },
      { id: 164, timestamp: 1163, row: 7, column: 71, event_type: 'input', content: 'i' },
      { id: 165, timestamp: 1164, row: 7, column: 72, event_type: 'input', content: 't' },
      { id: 166, timestamp: 1165, row: 7, column: 73, event_type: 'input', content: 'o' },
      { id: 167, timestamp: 1166, row: 7, column: 74, event_type: 'input', content: 'r' },
      { id: 168, timestamp: 1167, row: 7, column: 75, event_type: 'input', content: '.' },
      { id: 169, timestamp: 1168, row: 7, column: 76, event_type: 'input', content: 'insertParagraph' },
      { id: 170, timestamp: 1169, row: 8, column: 1, event_type: 'input', content: 'insertParagraph' },
      // Alignment style triggers (should not destructively delete first-line text)
      { id: 171, timestamp: 1170, row: 1, column: 1, event_type: 'before_replace', content: 'Hello World!' },
      { id: 172, timestamp: 1171, row: 1, column: 1, event_type: 'input', content: null },
      { id: 173, timestamp: 1172, row: 1, column: 1, event_type: 'before_replace', content: 'Hello World!' },
      { id: 174, timestamp: 1173, row: 1, column: 1, event_type: 'input', content: null },
      // File load OPEN event
      { id: 175, timestamp: 1180, row: 1, column: 1, event_type: 'open', content: helloworldPlain },
      // L:5 append addition: " Mathematically!!" at col 29
      { id: 176, timestamp: 1190, row: 5, column: 29, event_type: 'input', content: ' ' },
      { id: 177, timestamp: 1191, row: 5, column: 30, event_type: 'input', content: 'M' },
      { id: 178, timestamp: 1192, row: 5, column: 31, event_type: 'input', content: 'a' },
      { id: 179, timestamp: 1193, row: 5, column: 32, event_type: 'input', content: 't' },
      { id: 180, timestamp: 1194, row: 5, column: 33, event_type: 'input', content: 'h' },
      { id: 181, timestamp: 1195, row: 5, column: 34, event_type: 'input', content: 'e' },
      { id: 182, timestamp: 1196, row: 5, column: 35, event_type: 'input', content: 'm' },
      { id: 183, timestamp: 1197, row: 5, column: 36, event_type: 'input', content: 'a' },
      { id: 184, timestamp: 1198, row: 5, column: 37, event_type: 'input', content: 't' },
      { id: 185, timestamp: 1199, row: 5, column: 38, event_type: 'input', content: 'i' },
      { id: 186, timestamp: 1200, row: 5, column: 39, event_type: 'input', content: 'c' },
      { id: 187, timestamp: 1201, row: 5, column: 40, event_type: 'input', content: 'a' },
      { id: 188, timestamp: 1202, row: 5, column: 41, event_type: 'input', content: 'l' },
      { id: 189, timestamp: 1203, row: 5, column: 42, event_type: 'input', content: 'l' },
      { id: 190, timestamp: 1204, row: 5, column: 43, event_type: 'input', content: 'y' },
      { id: 191, timestamp: 1205, row: 5, column: 44, event_type: 'input', content: '!' },
      { id: 192, timestamp: 1206, row: 5, column: 45, event_type: 'input', content: '!' },
    ];

    // 1. Verify document content states right before styling alignment & load actions are executed
    const preAlignmentText = reconstructDocumentUpTo(169, mockEvents);
    const expectedPreAlignment = [
      'Hello World!',
      '',
      'Can you prove your authorship in the AI-era?',
      '',
      'With Organic Replay you can!',
      '',
      'We are excited to launch Organic Replay: “Human, not A.I.” document editor.',
      '',
      ''
    ].join('\n');
    expect(preAlignmentText).toBe(expectedPreAlignment);

    // 2. Verify styling alignment action (indices 170-173) is styled gracefully without text content deletion
    const alignmentText = reconstructDocumentUpTo(173, mockEvents);
    expect(alignmentText).toBe(expectedPreAlignment);

    // 3. Verify load OPEN and subsequent append edit (indices 174-191) preserves formatting and applies edit
    const finalText = reconstructDocumentUpTo(191, mockEvents);
    const expectedFinalText = helloworldPlain.replace(
      'With Organic Replay you can!',
      'With Organic Replay you can! Mathematically!!'
    );
    expect(finalText).toBe(expectedFinalText);
  });
});