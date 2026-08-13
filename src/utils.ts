/*
 * Organic Replay - A minimalist, distraction-free document editor designed with forensic integrity.
 * Copyright (C) 2026  Data Product Company LLC <https://www.dataproduct.company>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
export function getCaretOffset(root: HTMLElement, targetNode: Node, targetOffset: number): number {
  let offset = 0;
  let found = false;

  function traverse(node: Node) {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      if (node === targetNode) {
        offset += targetOffset;
        found = true;
        return;
      }
      offset += node.textContent?.length || 0;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const name = element.tagName.toUpperCase();
      if (name === 'BR') {
        if (node === targetNode) {
          found = true;
          return;
        }
        if (node.nextSibling !== null) {
          offset += 1;
        }
      } else if (name === 'DIV' || name === 'P' || name === 'LI') {
        if (offset > 0) {
          offset += 1;
        }
        if (node === targetNode && targetOffset === 0) {
          found = true;
          return;
        }
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        if (node === targetNode && i === targetOffset) {
          found = true;
          return;
        }
        traverse(node.childNodes[i]);
      }
      if (node === targetNode && targetOffset === node.childNodes.length) {
        found = true;
        return;
      }
    }
  }

  traverse(root);
  return offset;
}

export function getLineAndColumnFromOffset(text: string, offset: number): { line: number; column: number } {
  const lines = text.split('\n');
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length;
    if (offset <= currentOffset + lineLength) {
      return { line: i + 1, column: offset - currentOffset + 1 };
    }
    currentOffset += lineLength + 1;
  }
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function getEditorLines(root: HTMLElement): string[] {
  const lines: string[] = [""];
  let blockStarted = true;

  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      lines[lines.length - 1] += node.textContent || "";
      if ((node.textContent || "").length > 0) {
        blockStarted = false;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const name = element.tagName.toUpperCase();
      if (name === 'BR') {
        if (element.nextSibling !== null) {
          lines.push("");
        }
        blockStarted = false;
      } else if (name === 'DIV' || name === 'P' || name === 'LI') {
        if (!blockStarted) {
          if (lines.length > 1 || lines[0] !== "") {
            lines.push("");
          }
        }
        blockStarted = true;
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
      }
    }
  }

  traverse(root);
  return lines;
}

export function getEditorText(root: HTMLElement): string {
  return getEditorLines(root).join("\n");
}