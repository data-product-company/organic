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
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCaretOffset, getLineAndColumnFromOffset, getEditorText } from './utils';

let currentPath: string | null = null;
let lastSavedContent: string = "";
let isDirty: boolean = false;
let isGlobalStyleDirty: boolean = false;
let lastSelection = { start: 0, end: 0 };
let hasActiveSession = false;
let isPasting = false;
let activeLinkElement: HTMLAnchorElement | null = null;
let savedLinkSelection = { start: 0, end: 0 };
let beforeInputTargetStart: number | null = null;

let currentZoom: number = 1.0;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

// Define default styling constants
const DEFAULT_FONT_FAMILY = "'Courier New', Courier, monospace";
const DEFAULT_FONT_SIZE = "16px";
const DEFAULT_FONT_COLOR = "#abb2bf";

async function setZoom(factor: number) {
  currentZoom = Math.min(Math.max(factor, MIN_ZOOM), MAX_ZOOM);
  try {
    const webview = getCurrentWebview();
    await webview.setZoom(currentZoom);
    updateStatus();
  } catch (err) {
    console.error("Failed to set zoom:", err);
  }
}

function showToast(message: string) {
  const toast = document.getElementById('toast') as HTMLElement;
  const toastMsg = document.getElementById('toast-message') as HTMLElement;
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

function getSelectionCharacterOffsetWithin(element: HTMLElement) {
  let start = 0;
  let end = 0;
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  const sel = win.getSelection();
  if (sel && sel.rangeCount > 0) {
    try {
      const range = sel.getRangeAt(0);
      start = getCaretOffset(element, range.startContainer, range.startOffset);
      end = getCaretOffset(element, range.endContainer, range.endOffset);
    } catch (e) {
      // Fallback in case of detached node selections during rapid edits
    }
  }
  return { start, end };
}

async function logForensicEvent(eventType: string, row: number, column: number, content: string | null) {
  if (!hasActiveSession) return;
  await invoke('log_forensic_event', {
    timestamp: Date.now(),
    eventType,
    row,
    column,
    content
  }).catch(console.error);
}

const textarea = document.getElementById('editor') as HTMLTextAreaElement;
let editor: HTMLElement;

if (textarea && textarea.tagName === 'TEXTAREA') {
  const div = document.createElement('div');
  div.id = 'editor';
  div.contentEditable = 'false';
  div.style.cssText = textarea.style.cssText;
  div.style.outline = 'none';
  div.style.overflowY = 'auto';
  textarea.parentNode?.replaceChild(div, textarea);
  editor = div;
} else {
  editor = document.getElementById('editor') as HTMLElement;
}

const btnNew = document.getElementById('btn-new') as HTMLButtonElement | null;
const btnOpen = document.getElementById('btn-open') as HTMLButtonElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnExportWord = document.getElementById('btn-export-word') as HTMLButtonElement | null;
const btnShareBundle = document.getElementById('btn-share-bundle') as HTMLButtonElement | null;
const fontSelect = document.getElementById('font-select') as HTMLSelectElement | null;
const fontSizeSelect = document.getElementById('font-size-select') as HTMLSelectElement | null;
const colorPicker = document.getElementById('color-picker') as HTMLInputElement | null;
const linkModal = document.getElementById('link-modal') as HTMLDivElement;
const linkModalTitle = document.getElementById('link-modal-title') as HTMLHeadingElement;
const linkTextInput = document.getElementById('link-text-input') as HTMLInputElement;
const linkUrlInput = document.getElementById('link-url-input') as HTMLInputElement;
const btnLinkSave = document.getElementById('btn-link-save') as HTMLButtonElement;
const btnLinkRemove = document.getElementById('btn-link-remove') as HTMLButtonElement;
const btnLinkCancel = document.getElementById('btn-link-cancel') as HTMLButtonElement;
const btnLink = document.getElementById('btn-link') as HTMLButtonElement | null;
const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement | null;
const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement | null;
const btnAlignLeft = document.getElementById('btn-align-left') as HTMLButtonElement | null;
const btnAlignCenter = document.getElementById('btn-align-center') as HTMLButtonElement | null;
const btnAlignRight = document.getElementById('btn-align-right') as HTMLButtonElement | null;
const btnJustify = document.getElementById('btn-justify') as HTMLButtonElement | null;
const btnClose = document.getElementById('btn-close') as HTMLButtonElement | null;

// Find & Replace UI Elements
const findReplaceContainer = document.getElementById('find-replace-container') as HTMLDivElement;
const findInput = document.getElementById('find-input') as HTMLInputElement;
const findStatus = document.getElementById('find-status') as HTMLSpanElement;
const replaceInput = document.getElementById('replace-input') as HTMLInputElement;
const btnFindNext = document.getElementById('btn-find-next') as HTMLButtonElement;
const btnReplace = document.getElementById('btn-replace') as HTMLButtonElement;
const btnReplaceAll = document.getElementById('btn-replace-all') as HTMLButtonElement;
const btnCloseFind = document.getElementById('btn-close-find') as HTMLButtonElement;

let matchIndices: number[] = [];
let currentMatchIndex = -1;

function setSelectionByCharacterOffset(root: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;

  lastSelection = { start, end };
  
  let currentOffset = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  function traverse(node: Node) {
    if (currentOffset > end) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (startNode === null && currentOffset + len >= start) {
        startNode = node;
        startOffset = start - currentOffset;
      }
      if (endNode === null && currentOffset + len >= end) {
        endNode = node;
        endOffset = end - currentOffset;
      }
      currentOffset += len;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const name = element.tagName.toUpperCase();
      if (name === 'BR') {
        if (node.nextSibling !== null) {
          currentOffset += 1;
        }
      } else if (name === 'DIV' || name === 'P' || name === 'LI') {
        if (currentOffset > 0) {
          currentOffset += 1;
        }
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
      }
    }
  }

  traverse(root);

  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function toggleFindReplace(show?: boolean) {
  const shouldShow = show !== undefined ? show : findReplaceContainer.style.display === 'none';
  if (shouldShow) {
    findReplaceContainer.style.display = 'flex';
    findInput.focus();
    findInput.select();
    updateFindResults();
  } else {
    findReplaceContainer.style.display = 'none';
    editor.focus();
  }
}

function updateFindResults() {
  const query = findInput.value;
  if (!query) {
    matchIndices = [];
    currentMatchIndex = -1;
    findStatus.textContent = '';
    return;
  }

  const text = getEditorText(editor);
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  matchIndices = [];
  let idx = lowerText.indexOf(lowerQuery, 0);
  while (idx !== -1) {
    matchIndices.push(idx);
    idx = lowerText.indexOf(lowerQuery, idx + lowerQuery.length);
  }

  const sel = getSelectionCharacterOffsetWithin(editor);
  currentMatchIndex = matchIndices.indexOf(sel.start);

  if (matchIndices.length === 0) {
    findStatus.textContent = '0 of 0';
  } else {
    findStatus.textContent = `${currentMatchIndex !== -1 ? currentMatchIndex + 1 : 0} of ${matchIndices.length}`;
  }
}

function findNext() {
  const query = findInput.value;
  if (!query) return;

  updateFindResults();

  if (matchIndices.length === 0) return;

  currentMatchIndex = (currentMatchIndex + 1) % matchIndices.length;
  const matchOffset = matchIndices[currentMatchIndex];
  setSelectionByCharacterOffset(editor, matchOffset, matchOffset + query.length);
  findStatus.textContent = `${currentMatchIndex + 1} of ${matchIndices.length}`;
}

function replaceNext() {
  const query = findInput.value;
  const replacement = replaceInput.value;
  if (!query) return;

  const selectedText = window.getSelection()?.toString() || "";

  if (selectedText.toLowerCase() === query.toLowerCase()) {
    (document as any).execCommand('insertText', false, replacement);
  }
  
  findNext();
}

function replaceAll() {
  const query = findInput.value;
  const replacement = replaceInput.value;
  if (!query) return;

  setSelectionByCharacterOffset(editor, 0, 0);

  let text = getEditorText(editor);
  let matchIndex = text.toLowerCase().indexOf(query.toLowerCase(), 0);
  let count = 0;

  while (matchIndex !== -1 && count < 10000) {
    setSelectionByCharacterOffset(editor, matchIndex, matchIndex + query.length);
    (document as any).execCommand('insertText', false, replacement);
    
    text = getEditorText(editor);
    matchIndex = text.toLowerCase().indexOf(query.toLowerCase(), matchIndex + replacement.length);
    count++;
  }
  updateFindResults();
}

function openLinkModal(link?: HTMLAnchorElement) {
  if (!hasActiveSession) return;
  activeLinkElement = link || null;
  savedLinkSelection = { ...lastSelection };

  if (activeLinkElement) {
    linkModalTitle.textContent = "Edit Link";
    linkTextInput.value = activeLinkElement.innerText;
    linkUrlInput.value = activeLinkElement.getAttribute('href') || '';
    btnLinkRemove.style.display = 'block';
  } else {
    linkModalTitle.textContent = "Insert Link";
    const plainText = getEditorText(editor);
    const selectedText = plainText.slice(savedLinkSelection.start, savedLinkSelection.end);
    linkTextInput.value = selectedText;
    linkUrlInput.value = '';
    btnLinkRemove.style.display = 'none';
  }
  linkModal.style.display = 'flex';
  linkUrlInput.focus();
}

btnLink?.addEventListener('mousedown', (e) => e.preventDefault());
btnLink?.addEventListener('click', () => {
  openLinkModal();
});

btnLinkCancel.addEventListener('click', () => {
  linkModal.style.display = 'none';
  activeLinkElement = null;
  editor.focus();
});

btnLinkRemove.addEventListener('click', () => {
  if (activeLinkElement) {
    const parent = activeLinkElement.parentNode;
    if (parent) {
      const textNode = document.createTextNode(activeLinkElement.innerText);
      parent.replaceChild(textNode, activeLinkElement);
    }
    linkModal.style.display = 'none';
    activeLinkElement = null;
    editor.focus();
    updateStatus();
  }
});

btnLinkSave.addEventListener('click', () => {
  const text = linkTextInput.value.trim();
  let url = linkUrlInput.value.trim();
  if (!text) {
    linkModal.style.display = 'none';
    return;
  }
  
  if (url && !/^https?:\/\//i.test(url) && !/^\//.test(url) && !/^mailto:/i.test(url) && !/^tel:/i.test(url)) {
    url = 'https://' + url;
  }

  if (activeLinkElement) {
    activeLinkElement.innerText = text;
    if (url) {
      activeLinkElement.setAttribute('href', url);
    } else {
      const parent = activeLinkElement.parentNode;
      if (parent) {
        const textNode = document.createTextNode(text);
        parent.replaceChild(textNode, activeLinkElement);
      }
    }
  } else {
    setSelectionByCharacterOffset(editor, savedLinkSelection.start, savedLinkSelection.end);
    if (url) {
      const originalText = getEditorText(editor).slice(savedLinkSelection.start, savedLinkSelection.end);
      if (text !== originalText) {
        (document as any).execCommand('insertText', false, text);
        setSelectionByCharacterOffset(editor, savedLinkSelection.start, savedLinkSelection.start + text.length);
      }
      (document as any).execCommand('createLink', false, url);
    }
  }
  
  linkModal.style.display = 'none';
  activeLinkElement = null;
  editor.focus();
  updateStatus();
});

// Create and inject Status Bar dynamically at the bottom
const statusBar = document.createElement('div');
statusBar.id = 'status-bar';
statusBar.style.cssText = `
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #1e1e1e;
  color: #abb2bf;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 12px;
  border-top: 1px solid #3e4451;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20px;
  box-sizing: content-box;
  z-index: 1000;
`;
const statusLeft = document.createElement('div');
statusLeft.id = 'status-left';
const statusRight = document.createElement('div');
statusRight.id = 'status-right';

statusBar.appendChild(statusLeft);
statusBar.appendChild(statusRight);
document.body.appendChild(statusBar);

editor.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const link = target.closest('a');
  if (link && editor.contains(link)) {
    e.preventDefault();
    openLinkModal(link);
  }
});

// Adjust editor margin so it doesn't hide behind the fixed status bar
editor.style.marginBottom = '40px';

// Open File Helper
async function openFile() {
  try {
    const result = await invoke<[string, string]>('open_document');
    currentPath = result[0];
    let fileContent = result[1];

    // Clean up Word HTML template wrappers if importing a .doc file
    if (currentPath && currentPath.endsWith('.doc')) {
      const bodyMatch = fileContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        fileContent = bodyMatch[1];
      }
    }

    editor.innerHTML = fileContent;
    editor.contentEditable = "true";
    lastSavedContent = fileContent;
    hasActiveSession = true;
    isGlobalStyleDirty = false;
    // Place cursor at the end for existing documents
    const text = getEditorText(editor);
    setSelectionByCharacterOffset(editor, text.length, text.length);
    editor.focus();

    updateStatus();

    // Get the plain text from the rendered editor to preserve line breaks accurately
    const plainText = getEditorText(editor);

    const { line, column } = getLineAndColumnFromOffset(plainText, 0);
    await logForensicEvent('open', line, column, plainText);
    await invoke('sync_forensic_db');
    await emit('session-changed');
  } catch (err) {
    console.log("Open cancelled or failed:", err);
  }
}

// Save File Helper
async function saveFile(): Promise<boolean> {
  try {
    if (!hasActiveSession) return false;
    // Log document save checkpoint BEFORE writing to disk with content signature
    const signature = await invoke<string>('generate_content_signature', { content: editor.innerHTML });
    const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), 0);
    await logForensicEvent('save', line, column, signature);

    const savedPath = await invoke<string>('save_document', {
      path: currentPath,
      content: editor.innerHTML,
    });

    currentPath = savedPath;
    lastSavedContent = editor.innerHTML;
    isGlobalStyleDirty = false;
    updateStatus();
    return true;
  } catch (err) {
    console.log("Save cancelled or failed:", err);
    return false;
  }
}

// Export to Word Helper
async function exportToWord() {
  if (!hasActiveSession) return;
  try {
    const htmlContent = editor.innerHTML;
    const activeFont = fontSelect ? fontSelect.value : "'Courier New', Courier, monospace";
    const activeSize = fontSizeSelect ? fontSizeSelect.value : "16px";
    const header = 
      `<html xmlns:o='urn:schemas-microsoft-com:office:office' ` +
      `xmlns:w='urn:schemas-microsoft-com:office:word' ` +
      `xmlns='http://www.w3.org/TR/REC-html40'>` +
      `<head>` +
      `<meta charset="utf-8">` +
      `<title>Export to Word</title>` +
      `<!--[if gte mso 9]>` +
      `<xml>` +
      `<w:WordDocument>` +
      `<w:View>Print</w:View>` +
      `<w:Zoom>100</w:Zoom>` +
      `<w:DoNotOptimizeForBrowser/>` +
      `</w:WordDocument>` +
      `</xml>` +
      `<![endif]-->` +
      `<style>` +
      `body { font-family: ${activeFont}; font-size: ${activeSize}; line-height: 1.5; }` +
      `</style>` +
      `</head>` +
      `<body>`;
    const footer = `</body></html>`;
    const fullWordContent = header + htmlContent + footer;

    const savedPath = await invoke<string>('export_to_word', {
      content: fullWordContent
    });
    console.log("Exported successfully to:", savedPath);
  } catch (err) {
    console.log("Export cancelled or failed:", err);
  }
}

function showCloseModal(): Promise<'save' | 'discard' | 'cancel'> {
  return new Promise((resolve) => {
    const modal = document.getElementById('close-modal') as HTMLElement;
    const btnSave = document.getElementById('modal-save') as HTMLButtonElement;
    const btnDiscard = document.getElementById('modal-discard') as HTMLButtonElement;
    const btnCancel = document.getElementById('modal-cancel') as HTMLButtonElement;

    modal.style.display = 'flex';

    const cleanup = (value: 'save' | 'discard' | 'cancel') => {
      modal.style.display = 'none';
      btnSave.removeEventListener('click', onSave);
      btnDiscard.removeEventListener('click', onDiscard);
      btnCancel.removeEventListener('click', onCancel);
      resolve(value);
    };

    const onSave = () => cleanup('save');
    const onDiscard = () => cleanup('discard');
    const onCancel = () => cleanup('cancel');

    btnSave.addEventListener('click', onSave);
    btnDiscard.addEventListener('click', onDiscard);
    btnCancel.addEventListener('click', onCancel);
  });
}

// Share Replay Bundle Helper
async function shareBundle() {
  if (!hasActiveSession) return;
  if (!currentPath) {
    // Prompt user to save the document first
    const saved = await saveFile();
    if (!saved || !currentPath) return;
  }
  try {
    const zipPath = await invoke<string>('share_replay_bundle', {
      docPath: currentPath
    });
    const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), 0);
    await logForensicEvent('share_bundle', line, column, zipPath);
    await invoke('sync_forensic_db');

    const filename = zipPath.split(/[/\\]/).pop() || zipPath;
    showToast(`Bundle created: ${filename}`);
    console.log("Replay bundle created successfully at:", zipPath);
  } catch (err) {
    console.error("Failed to create share bundle:", err);
    showToast(`Failed to create bundle: ${err}`);
  }
}

// Close File Helper
async function closeFile(): Promise<boolean> {
  let savedOrDiscarded = false;
  if (isDirty) {
    const choice = await showCloseModal();
    if (choice === 'cancel') {
      return false;
    }
    if (choice === 'save') {
      const saved = await saveFile();
      if (!saved) {
        return false; // Abort close if save was cancelled or failed!
      }
      savedOrDiscarded = true;
    } else {
      savedOrDiscarded = false;
    }
  }
  try {
    if (isDirty && !savedOrDiscarded) {
      // Wiped/Discarded: do NOT log 'close' or sync to companion .tsgr
      await invoke('close_document');
    } else if (hasActiveSession) {
      const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), 0);
      await logForensicEvent('close', line, column, null);
      await invoke('sync_forensic_db');
      await invoke('close_document');
    await emit('session-changed');
    }
    currentPath = null;
    editor.innerHTML = "";
    editor.contentEditable = "false";
    lastSavedContent = "";
    isDirty = false;
    isGlobalStyleDirty = false;
    hasActiveSession = false;

    // Reset editor styles to default
    editor.style.fontFamily = '';
    editor.style.fontSize = '';
    editor.style.color = '';

    // Clear global (non-document-specific) style preferences
    localStorage.removeItem('organic-font-family');
    localStorage.removeItem('organic-font-size');
    localStorage.removeItem('organic-font-color');

    // Reset toolbar UI controls to their default state
    if (fontSelect) {
      fontSelect.value = DEFAULT_FONT_FAMILY;
    }
    if (fontSizeSelect) {
      fontSizeSelect.value = DEFAULT_FONT_SIZE;
    }
    if (colorPicker) {
      colorPicker.value = DEFAULT_FONT_COLOR;
    }
    updateStatus();
    return true;
  } catch (err) {
    console.error("Failed to close document:", err);
    return false;
  }
}

// New File Helper
async function newFile() {
  const closed = await closeFile();
  if (!closed) return;

  currentPath = null;
  editor.innerHTML = "";
  editor.contentEditable = "true";
  lastSavedContent = "";
  hasActiveSession = true;
  isDirty = false;
  isGlobalStyleDirty = false;
  setSelectionByCharacterOffset(editor, 0, 0);
  editor.focus();

  // Fall back to global preferences for new files
  const savedFont = localStorage.getItem('organic-font-family') || DEFAULT_FONT_FAMILY;
  if (fontSelect) {
    fontSelect.value = savedFont;
    editor.style.fontFamily = savedFont;
  }
  const savedSize = localStorage.getItem('organic-font-size') || DEFAULT_FONT_SIZE;
  if (fontSizeSelect) {
    fontSizeSelect.value = savedSize;
    editor.style.fontSize = savedSize;
  }
  const savedColor = localStorage.getItem('organic-font-color') || DEFAULT_FONT_COLOR;
  if (colorPicker) {
    colorPicker.value = savedColor;
    editor.style.color = savedColor;
  }

  updateStatus();

  const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), 0);
  await logForensicEvent('new', line, column, null);
  await emit('session-changed');
}

// Update Status Bar & Change/Dirty State
function updateStatus() {
  const plainText = getEditorText(editor);
  const charCount = plainText.length;
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;

  isDirty = hasActiveSession && (editor.innerHTML !== lastSavedContent || isGlobalStyleDirty);

  const fileLabel = hasActiveSession ? (currentPath ? currentPath : 'Untitled') : 'No Document Open';
  const dirtyIndicator = isDirty ? ' * (Unsaved Changes)' : '';
  statusLeft.textContent = `${fileLabel}${dirtyIndicator}`;
  statusLeft.style.color = isDirty ? '#e06c75' : '#abb2bf'; // Subtle red if dirty

  const zoomPercent = `${Math.round(currentZoom * 100)}%`;
  statusRight.innerHTML = `<span id="status-zoom" style="cursor: pointer; text-decoration: underline;" title="Click to reset zoom">Zoom: ${zoomPercent}</span> | Words: ${wordCount} | Chars: ${charCount}`;

  const zoomBtn = document.getElementById('status-zoom');
  if (zoomBtn) {
    zoomBtn.addEventListener('click', () => setZoom(1.0));
  }

  if (hasActiveSession) {
    editor.style.opacity = '1.0';
    editor.style.pointerEvents = 'auto';
  } else {
    editor.style.opacity = '0.5';
    editor.style.pointerEvents = 'none';
  }

  // Update native OS window title next to Organic -
  const win = getCurrentWindow();
  if (!hasActiveSession) {
    win.setTitle("Organic Replay");
  } else {
    const displayName = currentPath ? (currentPath.split(/[/\\]/).pop() || currentPath) : "Untitled";
    const titleDirtyIndicator = isDirty ? " *" : "";
    win.setTitle(`Organic Replay - ${displayName}${titleDirtyIndicator}`);
  }
}

// Click Events
if (btnNew) {
  btnNew.addEventListener('click', newFile);
}
btnOpen.addEventListener('click', openFile);
btnSave.addEventListener('click', saveFile);
if (btnShareBundle) {
  btnShareBundle.addEventListener('click', shareBundle);
}
if (btnExportWord) {
  btnExportWord.addEventListener('click', exportToWord);
}
if (btnClose) {
  btnClose.addEventListener('click', closeFile);
}

if (btnUndo) {
  btnUndo.addEventListener('mousedown', (e) => e.preventDefault());
  btnUndo.addEventListener('click', () => {
    (document as any).execCommand('undo', false);
    editor.focus();
    updateStatus();
  });
}
if (btnRedo) {
  btnRedo.addEventListener('mousedown', (e) => e.preventDefault());
  btnRedo.addEventListener('click', () => {
    (document as any).execCommand('redo', false);
    editor.focus();
    updateStatus();
  });
}

if (btnAlignLeft) {
  btnAlignLeft.addEventListener('mousedown', (e) => e.preventDefault());
  btnAlignLeft.addEventListener('click', () => {
    (document as any).execCommand('justifyLeft', false);
    editor.focus();
    updateStatus();
  });
}
if (btnAlignCenter) {
  btnAlignCenter.addEventListener('mousedown', (e) => e.preventDefault());
  btnAlignCenter.addEventListener('click', () => {
    (document as any).execCommand('justifyCenter', false);
    editor.focus();
    updateStatus();
  });
}
if (btnAlignRight) {
  btnAlignRight.addEventListener('mousedown', (e) => e.preventDefault());
  btnAlignRight.addEventListener('click', () => {
    (document as any).execCommand('justifyRight', false);
    editor.focus();
    updateStatus();
  });
}
if (btnJustify) {
  btnJustify.addEventListener('mousedown', (e) => e.preventDefault());
  btnJustify.addEventListener('click', () => {
    (document as any).execCommand('justifyFull', false);
    editor.focus();
    updateStatus();
  });
}

btnFindNext.addEventListener('click', findNext);
btnReplace.addEventListener('click', replaceNext);
btnReplaceAll.addEventListener('click', replaceAll);
btnCloseFind.addEventListener('click', () => toggleFindReplace(false));

listen('menu-new', async () => {
  await newFile();
});

listen('menu-zoom-in', async () => {
  await setZoom(currentZoom + ZOOM_STEP);
});

listen('menu-zoom-out', async () => {
  await setZoom(currentZoom - ZOOM_STEP);
});

listen('menu-reset-zoom', async () => {
  await setZoom(1.0);
});

findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    findNext();
  }
});

replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    replaceNext();
  }
});

listen('menu-find', () => {
  toggleFindReplace(true);
});

findInput.addEventListener('input', updateFindResults);

function breakOutOfStyledSpanIfAtEdge() {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed) return;

  const range = sel.getRangeAt(0);
  let container = range.startContainer;
  let parent = container.nodeType === Node.TEXT_NODE ? container.parentNode : container as Node;

  // Check if we are at the end of a text node within a styled span
  if (
    container.nodeType === Node.TEXT_NODE &&
    range.startOffset === container.textContent?.length &&
    parent &&
    parent.nodeName === 'SPAN' &&
    (parent as HTMLElement).style.cssText !== ''
  ) {
    // Check if this is the last meaningful content in the editor
    let currentNode: Node | null = parent;
    while (currentNode && !currentNode.nextSibling) {
      if (currentNode.parentNode === editor) {
        // Move the selection to the very end of the editor content, outside the span
        sel.collapse(editor, editor.childNodes.length);
        // Ensure subsequent typing doesn't inherit any lingering styles
        resetEditorTypingStyle();
        break;
      }
      currentNode = currentNode.parentNode;
    }
  }
}

// Prevent Tab key from losing focus and instead insert a tab character
editor.addEventListener('keydown', (e: any) => {
  if (e.key === 'Tab') {
    if (hasActiveSession) {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const tabNode = document.createTextNode('\t');
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);
        sel.removeAllRanges();
        sel.addRange(range);

        // Dispatch input event so the forensic logger can log the tab keypress
        editor.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText',
          data: '\t',
          bubbles: true,
          cancelable: true
        }));
      }
    }
  } else {
    // For any other key press, check if we need to break out of a style
    if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
      breakOutOfStyledSpanIfAtEdge();
    }
  }
});

// Listen for native macOS/OS menu events (emitted from Rust)
listen('menu-open', async () => {
  await openFile();
});

listen('menu-save', async () => {
  await saveFile();
});

listen('menu-export-word', async () => {
  await exportToWord();
});

listen('menu-share-bundle', async () => {
  await shareBundle();
});

listen('menu-close-doc', async () => {
  await closeFile();
});

listen('menu-bold', () => {
  (document as any).execCommand('bold', false);
  updateStatus();
});

listen('menu-italic', () => {
  (document as any).execCommand('italic', false);
  updateStatus();
});

listen('menu-underline', () => {
  (document as any).execCommand('underline', false);
  updateStatus();
});

listen('menu-align-left', () => {
  (document as any).execCommand('justifyLeft', false);
  updateStatus();
});

listen('menu-center', () => {
  (document as any).execCommand('justifyCenter', false);
  updateStatus();
});

listen('menu-align-right', () => {
  (document as any).execCommand('justifyRight', false);
  updateStatus();
});

listen('menu-justify', () => {
  (document as any).execCommand('justifyFull', false);
  updateStatus();
});

function resetEditorTypingStyle() {
  editor.style.fontFamily = '';
  editor.style.fontSize = '';
  editor.style.color = '';
}

listen<string>('menu-font', (event) => {
  const font = event.payload;
  if (fontSelect) {
    fontSelect.value = font;
  }
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    (document as any).execCommand('styleWithCSS', false, 'true');
    (document as any).execCommand('fontName', false, font);
    requestAnimationFrame(() => {
      sel.collapseToEnd();
      resetEditorTypingStyle();
    });
  } else {
    editor.style.fontFamily = font;
    localStorage.setItem('organic-font-family', font);
    if (hasActiveSession) {
      isGlobalStyleDirty = true;
    }
  }
  editor.focus();
  updateStatus();
});

function applyColor(color: string) {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    (document as any).execCommand('styleWithCSS', false, 'true');
    (document as any).execCommand('foreColor', false, color);
    requestAnimationFrame(() => {
      sel.collapseToEnd();
      resetEditorTypingStyle();
    });
  } else {
    // No selection: apply color to the next typed characters by creating a temporary styled span.
    const span = document.createElement('span');
    span.style.color = color;
    span.innerHTML = '&#8203;'; // Zero-width space
    (document as any).execCommand('insertHTML', false, span.outerHTML);
    
    // The cursor is now inside the span, ready for typing.
    // The 'breakOutOfStyledSpanIfAtEdge' logic will handle exiting the span.
  }
  editor.focus();
  updateStatus();
}

listen<string>('menu-color', (event) => {
  const color = event.payload;
  if (colorPicker) {
    colorPicker.value = color;
  }
  applyColor(color);
});

listen<string>('menu-size', (event) => {
  const size = event.payload;
  if (fontSizeSelect) {
    fontSizeSelect.value = size;
  }
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    (document as any).execCommand('styleWithCSS', false, 'true');
    (document as any).execCommand('fontSize', false, '7');
    const elements = editor.querySelectorAll('font[size="7"], span[style*="xxx-large"]');
    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.removeAttribute('size');
      htmlEl.style.fontSize = size;
    });
    requestAnimationFrame(() => {
      sel.collapseToEnd();
      resetEditorTypingStyle();
    });
  } else {
    editor.style.fontSize = size;
    localStorage.setItem('organic-font-size', size);
    if (hasActiveSession) {
      isGlobalStyleDirty = true;
    }
  }
  editor.focus();
  updateStatus();
});

// Listen for typing/input changes
editor.addEventListener('beforeinput', (e: any) => {
  if (isPasting) {
    return;
  }
  if (e.inputType === "insertFromPaste") {
    return;
  }
  if (e.inputType === "historyUndo") {
    const sel = getSelectionCharacterOffsetWithin(editor);
    const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), sel.start);
    logForensicEvent('undo', line, column, null);
    return;
  }
  if (e.inputType === "historyRedo") {
    const sel = getSelectionCharacterOffsetWithin(editor);
    const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), sel.start);
    logForensicEvent('redo', line, column, null);
    return;
  }
  if (e.inputType && (e.inputType.startsWith('format') || e.inputType.startsWith('history'))) {
    return;
  }
  lastSelection = getSelectionCharacterOffsetWithin(editor);
  // If text is selected, this is a replacement (pasted or rewritten by Apple Tools)
    let replaceOffset = lastSelection.start;
  let selectedText = document.getSelection()?.toString() || "";
  if (!selectedText && e.getTargetRanges && e.getTargetRanges().length > 0) {
    try {
      const range = e.getTargetRanges()[0];
        replaceOffset = getCaretOffset(editor, range.startContainer, range.startOffset);
      const domRange = document.createRange();
      domRange.setStart(range.startContainer, range.startOffset);
      domRange.setEnd(range.endContainer, range.endOffset);
      selectedText = domRange.toString();
    } catch (err) {
      // Fallback
    }
  }
    
    beforeInputTargetStart = replaceOffset;

    if (selectedText && (!e.inputType || !e.inputType.startsWith('delete'))) {
      const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), replaceOffset);
      logForensicEvent('before_replace', line, column, selectedText);
  }
});

editor.addEventListener('input', (e: any) => {
  if (isPasting) {
    return;
  }
  if (e.inputType === "insertFromPaste" || e.inputType === "deleteByCut") {
    return;
  }
  if (e.inputType && (e.inputType.startsWith('format') || e.inputType.startsWith('history'))) {
    return;
  }
  // Log input details (inserted characters, input types like deleteContentBackward, etc.)
  const sel = getSelectionCharacterOffsetWithin(editor);
  let insertedText = e.data || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
  const isNewLine = e.inputType === "insertLineBreak" || e.inputType === "insertParagraph" || insertedText === "\n";

    const startOffset = (beforeInputTargetStart !== null) ? beforeInputTargetStart : lastSelection.start;
    beforeInputTargetStart = null;

  // Extract the actual inserted text for block replacements and rich edits where e.data is null
  if (!insertedText && (e.inputType === "insertReplacementText" || e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop" || lastSelection.end > lastSelection.start)) {
    const currentText = getEditorText(editor);
      const start = startOffset;
    const end = sel.start;
    if (start >= 0 && end >= start && end <= currentText.length) {
      insertedText = currentText.slice(start, end);
    }
  }
  
  let offset: number;
  if (isNewLine) {
    offset = Math.max(0, sel.start - 1);
  } else {
    const insertedLength = insertedText ? insertedText.length : 0;
    offset = Math.max(0, sel.start - insertedLength);
  }
  
  const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), offset);
  logForensicEvent('input', line, column, insertedText || e.inputType || null);
  updateStatus();
  lastSelection = getSelectionCharacterOffsetWithin(editor);
});

// Removed keydown event to avoid duplication with input event
// editor.addEventListener('keydown', (e) => {
//   const sel = getSelectionCharacterOffsetWithin(editor);
//   const { line, column } = getLineAndColumnFromOffset(editor.innerHTML, sel.start);
//   logForensicEvent('keystroke', line, column, e.key);
// });

editor.addEventListener('copy', () => {
  const sel = getSelectionCharacterOffsetWithin(editor);
  const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), sel.start);
  const selection = document.getSelection()?.toString() || "";
  logForensicEvent('clipboard_copy', line, column, selection);
});

editor.addEventListener('cut', () => {
  const sel = getSelectionCharacterOffsetWithin(editor);
  const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), sel.start);
  logForensicEvent('clipboard_cut', line, column, document.getSelection()?.toString() || "");
});

editor.addEventListener('paste', (e: any) => {
  e.preventDefault();
  isPasting = true;
  const sel = getSelectionCharacterOffsetWithin(editor);
  const pastedText = e.clipboardData?.getData('text') || "";
  const pastedHtml = e.clipboardData?.getData('text/html');

  let cleanHtml = "";
  if (pastedHtml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(pastedHtml, 'text/html');
      const allElements = doc.querySelectorAll('*');
      allElements.forEach(el => {
        el.removeAttribute('style');
        if (el.tagName.toLowerCase() === 'font') {
          el.removeAttribute('color');
          el.removeAttribute('face');
          el.removeAttribute('size');
        }
      });
      cleanHtml = doc.body.innerHTML;
    } catch (err) {
      cleanHtml = pastedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
  } else {
    cleanHtml = pastedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  (document as any).execCommand('insertHTML', false, cleanHtml);

  const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), sel.start);
  logForensicEvent('clipboard_paste', line, column, pastedText);
  updateStatus();
  isPasting = false;
});

editor.addEventListener('compositionstart', () => {
  const sel = getSelectionCharacterOffsetWithin(editor);
  const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), sel.start);
  logForensicEvent('composition_start', line, column, null);
});

editor.addEventListener('compositionend', (e: any) => {
  const sel = getSelectionCharacterOffsetWithin(editor);
  const insertedText = e.data || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
  const insertedLength = insertedText ? insertedText.length : 0;
  const offset = Math.max(0, sel.start - insertedLength);
  const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), offset);
  logForensicEvent('composition_end', line, column, insertedText || null);
});

// Intercept window close requested
getCurrentWindow().onCloseRequested(async (event) => {
  if (isDirty) {
    event.preventDefault(); // Prevent window from closing immediately
    const choice = await showCloseModal();
    if (choice === 'cancel') {
      return;
    }
    if (choice === 'save') {
      const saved = await saveFile();
      if (!saved) {
        return;
      }
    }
    isDirty = false;
    await closeFile();
    getCurrentWindow().destroy();
  } else {
    // Log app close event
    const { line, column } = getLineAndColumnFromOffset(getEditorText(editor), 0);
    await logForensicEvent('close', line, column, null);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && findReplaceContainer.style.display === 'flex') {
    toggleFindReplace(false);
  }
});

function findMatchingOption(select: HTMLSelectElement, computedValue: string, isSize: boolean): string | null {
  const clean = (val: string) => val.replace(/['"]/g, '').toLowerCase().trim();
  const cleanComputed = clean(computedValue);

  // 1. Direct match on clean string
  for (let i = 0; i < select.options.length; i++) {
    const optionVal = select.options[i].value;
    if (clean(optionVal) === cleanComputed) {
      return optionVal;
    }
  }

  // 2. Token-based or substring matching
  for (let i = 0; i < select.options.length; i++) {
    const optionVal = select.options[i].value;
    const cleanOption = clean(optionVal);

    if (isSize) {
      if (cleanComputed === cleanOption || parseFloat(cleanComputed) === parseFloat(cleanOption)) {
        return optionVal;
      }
    } else {
      const optionFamilies = cleanOption.split(',').map(f => f.trim());
      const computedFamilies = cleanComputed.split(',').map(f => f.trim());

      if (optionFamilies.some(of => computedFamilies.includes(of))) {
        return optionVal;
      }
      if (optionFamilies.some(of => cleanComputed.includes(of))) {
        return optionVal;
      }
    }
  }

  // 3. Fallback to keyword matching
  if (!isSize) {
    if (cleanComputed.includes('system-ui') || cleanComputed.includes('-apple-system') || cleanComputed.includes('sans-serif') || cleanComputed.includes('helvetica') || cleanComputed.includes('arial') || cleanComputed.includes('blinkmacsystemfont')) {
      return "system-ui, -apple-system, sans-serif";
    }
    if (cleanComputed.includes('courier')) {
      return "'Courier New', Courier, monospace";
    }
    if (cleanComputed.includes('times')) {
      return "'Times New Roman', Times, serif";
    }
    if (cleanComputed.includes('georgia')) {
      return "Georgia, serif";
    }
    if (cleanComputed.includes('garamond')) {
      return "Garamond, 'EB Garamond', serif";
    }
    if (cleanComputed.includes('baskerville')) {
      return "Baskerville, 'Times New Roman', serif";
    }
  }
  return null;
}

function syncDropdownsWithCaret() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  let node = sel.anchorNode;
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode;
  }
  if (node && node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const computedStyle = window.getComputedStyle(element);
    if (fontSelect) {
      const matchedFont = findMatchingOption(fontSelect, computedStyle.fontFamily, false);
      if (matchedFont) fontSelect.value = matchedFont;
    }
    if (fontSizeSelect) {
      const matchedSize = findMatchingOption(fontSizeSelect, computedStyle.fontSize, true);
      if (matchedSize) fontSizeSelect.value = matchedSize;
    }
    if (colorPicker) {
      const color = computedStyle.color;
      colorPicker.value = rgbToHex(color);
    }
  }
}

document.addEventListener('selectionchange', () => {
  if (!hasActiveSession) return;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const anchorNode = sel.anchorNode;
    if (anchorNode && editor.contains(anchorNode)) {
      syncDropdownsWithCaret();
        const currentSel = getSelectionCharacterOffsetWithin(editor);
        lastSelection = currentSel;
    }
  }
});

function rgbToHex(rgb: string): string {
  const result = rgb.match(/\d+/g);
  if (!result) return '#000000';
  return "#" + result.map(x => {
    const hex = parseInt(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join('');
}

// Initialize status bar on startup
updateStatus();

// Initialize font color on startup and bind change handler
if (colorPicker) {
  const savedColor = localStorage.getItem('organic-font-color') || DEFAULT_FONT_COLOR;
  if (savedColor) {
    colorPicker.value = savedColor;
    if (!hasActiveSession) {
      editor.style.color = savedColor;
    }
  }
  colorPicker.addEventListener('input', () => {
    const color = colorPicker.value;
    applyColor(color);
  });
}

// Initialize font on startup and bind change handler
if (fontSelect) {
  const savedFont = localStorage.getItem('organic-font-family') || DEFAULT_FONT_FAMILY;
  if (savedFont) {
    fontSelect.value = savedFont;
    if (!hasActiveSession) {
      editor.style.fontFamily = savedFont;
    }
  }
  fontSelect.addEventListener('change', () => {
    const font = fontSelect.value;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      (document as any).execCommand('styleWithCSS', false, 'true');
      (document as any).execCommand('fontName', false, font);
    } else {
      editor.style.fontFamily = font;
      localStorage.setItem('organic-font-family', font);
      if (hasActiveSession) {
        isGlobalStyleDirty = true;
      }
    }
    editor.focus();
    updateStatus();
  });
}

// Initialize font size on startup and bind change handler
if (fontSizeSelect) {
  const savedSize = localStorage.getItem('organic-font-size') || DEFAULT_FONT_SIZE;
  if (savedSize) {
    fontSizeSelect.value = savedSize;
    if (!hasActiveSession) {
      editor.style.fontSize = savedSize;
    }
  }
  fontSizeSelect.addEventListener('change', () => {
    const size = fontSizeSelect.value;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      (document as any).execCommand('styleWithCSS', false, 'true');
      (document as any).execCommand('fontSize', false, '7');
      const elements = editor.querySelectorAll('font[size="7"], span[style*="xxx-large"]');
      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.removeAttribute('size');
        htmlEl.style.fontSize = size;
      });
    } else {
      editor.style.fontSize = size;
      localStorage.setItem('organic-font-size', size);
      if (hasActiveSession) {
        isGlobalStyleDirty = true;
      }
    }
    editor.focus();
    updateStatus();
  });
}

// Keyboard Shortcuts (Keystrokes Capture)
window.addEventListener('keydown', async (e) => {
  // Platform-agnostic modifier key check (Control on Win/Linux, Command on macOS)
  const isModifier = e.ctrlKey || e.metaKey;

  if (isModifier) {
    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        await newFile();
        break;
      case 's':
        if (e.shiftKey) {
          e.preventDefault();
          await exportToWord();
        } else {
          e.preventDefault(); // Prevent standard browser save dialog
          await saveFile();
        }
        break;
      case 'o':
        e.preventDefault(); // Prevent standard browser open dialog
        await openFile();
        break;
      case 'p':
        if (e.shiftKey) {
          e.preventDefault();
          await shareBundle();
        }
        break;
      case 'f':
        e.preventDefault();
        toggleFindReplace(true);
        break;
      case '=':
      case '+':
        e.preventDefault();
        await setZoom(currentZoom + ZOOM_STEP);
        break;
      case '-':
        e.preventDefault();
        await setZoom(currentZoom - ZOOM_STEP);
        break;
      case '0':
        e.preventDefault();
        await setZoom(1.0);
        break;
    }
  }
});

// Emit active signal so auxiliary windows can reload/sync
emit('main-window-active');