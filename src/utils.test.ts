import { describe, it, expect } from 'vitest';
import { getLineAndColumnFromOffset, getCaretOffset, getEditorText, getEditorLines, rgbToHex, findMatchingOption } from './utils';

describe('getLineAndColumnFromOffset', () => {
  it('calculates line and column on a single line', () => {
    const text = 'Hello World';
    expect(getLineAndColumnFromOffset(text, 0)).toEqual({ line: 1, column: 1 });
    expect(getLineAndColumnFromOffset(text, 5)).toEqual({ line: 1, column: 6 });
    expect(getLineAndColumnFromOffset(text, 11)).toEqual({ line: 1, column: 12 });
  });

  it('handles multiple lines correctly', () => {
    const text = 'Hello\nWorld\nTest';
    expect(getLineAndColumnFromOffset(text, 5)).toEqual({ line: 1, column: 6 });
    expect(getLineAndColumnFromOffset(text, 6)).toEqual({ line: 2, column: 1 });
    expect(getLineAndColumnFromOffset(text, 11)).toEqual({ line: 2, column: 6 });
    expect(getLineAndColumnFromOffset(text, 12)).toEqual({ line: 3, column: 1 });
  });

  it('handles trailing newline and offsets beyond length', () => {
    const text = 'Hello\n';
    expect(getLineAndColumnFromOffset(text, 6)).toEqual({ line: 2, column: 1 });
    expect(getLineAndColumnFromOffset(text, 10)).toEqual({ line: 2, column: 1 });
  });

  it('handles empty string content gracefully', () => {
    const text = '';
    expect(getLineAndColumnFromOffset(text, 0)).toEqual({ line: 1, column: 1 });
    expect(getLineAndColumnFromOffset(text, 5)).toEqual({ line: 1, column: 1 });
  });
});

describe('getCaretOffset', () => {
  it('gets offset in a simple text node', () => {
    const root = document.createElement('div');
    const textNode = document.createTextNode('Hello World');
    root.appendChild(textNode);

    expect(getCaretOffset(root, textNode, 0)).toBe(0);
    expect(getCaretOffset(root, textNode, 5)).toBe(5);
    expect(getCaretOffset(root, textNode, 11)).toBe(11);
  });

  it('handles multiple nested text nodes and inline elements', () => {
    const root = document.createElement('div');
    const textNode1 = document.createTextNode('Hello ');
    const span = document.createElement('span');
    const textNode2 = document.createTextNode('Beautiful ');
    span.appendChild(textNode2);
    const textNode3 = document.createTextNode('World');
    root.appendChild(textNode1);
    root.appendChild(span);
    root.appendChild(textNode3);

    expect(getCaretOffset(root, textNode1, 6)).toBe(6);
    expect(getCaretOffset(root, textNode2, 0)).toBe(6);
    expect(getCaretOffset(root, textNode2, 10)).toBe(16);
    expect(getCaretOffset(root, textNode3, 5)).toBe(21);
  });

  it('handles BR line breaks correctly', () => {
    const root = document.createElement('div');
    const textNode1 = document.createTextNode('Line 1');
    const br = document.createElement('br');
    const textNode2 = document.createTextNode('Line 2');
    root.appendChild(textNode1);
    root.appendChild(br);
    root.appendChild(textNode2);

    expect(getCaretOffset(root, textNode2, 0)).toBe(7);
    expect(getCaretOffset(root, textNode2, 6)).toBe(13);
  });

  it('handles DIV blocks correctly', () => {
    const root = document.createElement('div');
    const div1 = document.createElement('div');
    div1.appendChild(document.createTextNode('Line 1'));
    const div2 = document.createElement('div');
    const textNode2 = document.createTextNode('Line 2');
    div2.appendChild(textNode2);
    root.appendChild(div1);
    root.appendChild(div2);
    expect(getCaretOffset(root, textNode2, 0)).toBe(7);
  });

  it('handles paragraph elements (P tags) correctly', () => {
    const root = document.createElement('div');
    const p1 = document.createElement('p');
    p1.appendChild(document.createTextNode('Para 1'));
    const p2 = document.createElement('p');
    const textNode2 = document.createTextNode('Para 2');
    p2.appendChild(textNode2);
    root.appendChild(p1);
    root.appendChild(p2);

    expect(getCaretOffset(root, textNode2, 0)).toBe(7);
  });
});

describe('getEditorLines', () => {
  it('handles nested divs and lists correctly', () => {
    const root = document.createElement('div');
    const div1 = document.createElement('div');
    div1.appendChild(document.createTextNode('Line 1'));
    const div2 = document.createElement('div');
    const p = document.createElement('p');
    p.appendChild(document.createTextNode('Line 2'));
    div2.appendChild(p);
    root.appendChild(div1);
    root.appendChild(div2);
    expect(getEditorLines(root)).toEqual(['Line 1', 'Line 2']);
  });

  it('handles empty block elements with BR line breaks correctly', () => {
    const root = document.createElement('div');
    const p1 = document.createElement('p');
    p1.appendChild(document.createTextNode('Line 1'));
    const p2 = document.createElement('p');
    p2.appendChild(document.createElement('br'));
    const p3 = document.createElement('p');
    p3.appendChild(document.createTextNode('Line 2'));
    root.appendChild(p1);
    root.appendChild(p2);
    root.appendChild(p3);
    expect(getEditorLines(root)).toEqual(['Line 1', '', 'Line 2']);
  });
});

describe('getEditorText', () => {
  it('returns text matching getCaretOffset with tabs and newlines', () => {
    const root = document.createElement('div');
    const div1 = document.createElement('div');
    div1.appendChild(document.createTextNode('a\tb'));
    const div2 = document.createElement('div');
    div2.appendChild(document.createTextNode('c'));
    root.appendChild(div1);
    root.appendChild(div2);
    expect(getEditorText(root)).toBe('a\tb\nc');
  });
});

describe('Hello World Document Integration', () => {
  it('correctly parses helloworld.txt HTML into lines and matching text', () => {
    const root = document.createElement('div');
    root.innerHTML = `<div style="text-align: center;"><span style="background-color: rgb(30, 30, 30); font-size: 32px; color: rgb(255, 255, 255); font-weight: bold;">Hello World!</span></div><div><br></div><div>Can you prove your authorship in the AI-era? How do you answer that question?</div><div><br></div><div>We are super-excited to launch Organic Replay: “Human, not A.I.” document editor.</div><div><br></div><div><u>We are making it available as GNU GPLv3.</u></div><div><br></div><div>Brought to you by Data Product Company LLC (https://www.dataproduct.company).</div><div><br></div><div>Write confidently!</div>`;

    const expectedLines = [
      "Hello World!",
      "",
      "Can you prove your authorship in the AI-era? How do you answer that question?",
      "",
      "We are super-excited to launch Organic Replay: “Human, not A.I.” document editor.",
      "",
      "We are making it available as GNU GPLv3.",
      "",
      "Brought to you by Data Product Company LLC (https://www.dataproduct.company).",
      "",
      "Write confidently!"
    ];

    expect(getEditorLines(root)).toEqual(expectedLines);
    expect(getEditorText(root)).toBe(expectedLines.join("\n"));
  });
});

describe('rgbToHex conversion utility', () => {
  it('converts basic rgb strings to hex format', () => {
    expect(rgbToHex('rgb(255, 255, 255)')).toBe('#ffffff');
    expect(rgbToHex('rgb(224, 108, 117)')).toBe('#e06c75');
    expect(rgbToHex('rgb(0, 0, 0)')).toBe('#000000');
  });

  it('converts rgba strings and single-digit components cleanly', () => {
    expect(rgbToHex('rgba(119, 187, 65, 0.8)')).toBe('#77bb41');
    expect(rgbToHex('rgb(9, 15, 8)')).toBe('#090f08');
  });

  it('handles invalid input scenarios gracefully', () => {
    expect(rgbToHex('invalid-format')).toBe('#000000');
  });
});

describe('findMatchingOption dropdown helper', () => {
  it('identifies exact style option matches', () => {
    const select = document.createElement('select');
    const opt = document.createElement('option');
    opt.value = 'Georgia, serif';
    select.appendChild(opt);

    expect(findMatchingOption(select, 'Georgia, serif', false)).toBe('Georgia, serif');
  });

  it('falls back to token and keyword mapping for system fallback fonts', () => {
    const select = document.createElement('select');
    const optSystem = document.createElement('option');
    optSystem.value = 'system-ui, -apple-system, sans-serif';
    const optCourier = document.createElement('option');
    optCourier.value = "'Courier New', Courier, monospace";
    select.appendChild(optSystem);
    select.appendChild(optCourier);

    expect(findMatchingOption(select, 'Helvetica Neue', false)).toBe('system-ui, -apple-system, sans-serif');
    expect(findMatchingOption(select, 'Courier', false)).toBe("'Courier New', Courier, monospace");
  });

  it('resolves floating point equivalents and string values for font sizes', () => {
    const select = document.createElement('select');
    const opt16 = document.createElement('option');
    opt16.value = '16px';
    select.appendChild(opt16);

    expect(findMatchingOption(select, '16.0px', true)).toBe('16px');
  });
});

describe('Zero-width space tracking integration', () => {
  it('verifies that zero-width space characters are parsed as parts of lines', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span>\u200btext</span>';
    expect(getEditorText(root)).toBe('\u200btext');
  });
});