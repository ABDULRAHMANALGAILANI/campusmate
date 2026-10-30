import {
  useEffect,
  useState,
} from "react";


// =========================================================
// LANGUAGES: English, Bahasa Melayu, Türkçe, العربية
//
// The pages are written in English. When another language is
// chosen, every piece of interface text on screen is swapped
// for its translation (src/i18n/<code>.json), including text
// that appears later, buttons, placeholders and pop-up
// messages. Things people type (names, messages, class
// titles) are left alone unless they exactly match an
// interface word.
//
// Add a translation: put "English text": "translation" in the
// language's JSON file.
// =========================================================

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "ms", label: "Bahasa Melayu", short: "BM" },
  { code: "tr", label: "Türkçe", short: "TR" },
  { code: "ar", label: "العربية", short: "ع", dir: "rtl" },
];

const STORAGE_KEY = "campusmate-language";

const LOADERS = {
  ms: () => import("../i18n/ms.json"),
  tr: () => import("../i18n/tr.json"),
  ar: () => import("../i18n/ar.json"),
};

const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);

let current = "en";
let dictionary = {};
// Entries like "{0}/{1} handed in" also match "3/12 handed in"
let patterns = [];
let observer = null;
const listeners = new Set();

// node -> { original, applied }
const textMemory = new WeakMap();
// element -> { [attribute]: { original, applied } }
const attributeMemory = new WeakMap();


function readSaved() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((language) => language.code === saved) ? saved : null;
  } catch {
    return null;
  }
}


function save(code) {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode: the choice lasts until the tab closes
  }
}


// First visit: use the browser's language if we have it
function guessLanguage() {
  const wanted = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LANGUAGES.some((language) => language.code === wanted) ? wanted : "en";
}


export function getLanguage() {
  return current;
}


// For dates and numbers ("Mon, 12 Oct" in each language).
// Arabic keeps 0-9 digits so marks and IDs read the same.
export function localeTag() {
  return { en: undefined, ms: "ms-MY", tr: "tr-TR", ar: "ar-u-nu-latn" }[current];
}


// Translate one piece of text (also usable from code)
export function t(text) {
  if (current === "en" || typeof text !== "string") return text;

  const exact = dictionary[text];
  if (exact) return exact;

  const trimmed = text.trim();
  if (!trimmed) return text;

  let found = dictionary[trimmed];

  if (!found) {
    for (const pattern of patterns) {
      const match = pattern.regex.exec(trimmed);
      if (match) {
        found = pattern.output.replace(/\{(\d)\}/g, (_, index) => match[Number(index) + 1] ?? "");
        break;
      }
    }
  }

  if (!found) return text;

  const start = text.slice(0, text.indexOf(trimmed));
  const end = text.slice(text.indexOf(trimmed) + trimmed.length);
  return start + found + end;
}


function skip(node) {
  const element = node.nodeType === 1 ? node : node.parentElement;
  if (!element) return true;
  if (SKIP_TAGS.has(element.tagName)) return true;
  return Boolean(element.closest("[data-no-translate], [contenteditable='true']"));
}


function translateTextNode(node) {
  if (skip(node)) return;

  const value = node.nodeValue;
  const memory = textMemory.get(node);

  // This is the text we put there ourselves
  if (memory && value === memory.applied) return;

  // New (English) text from the page
  const translated = t(value);
  textMemory.set(node, { original: value, applied: translated });

  if (translated !== value) node.nodeValue = translated;
}


function translateAttributes(element) {
  if (skip(element)) return;

  let memory = attributeMemory.get(element);

  for (const name of ATTRIBUTES) {
    if (!element.hasAttribute(name)) continue;

    const value = element.getAttribute(name);
    const saved = memory?.[name];

    if (saved && value === saved.applied) continue;

    const translated = t(value);
    if (!memory) {
      memory = {};
      attributeMemory.set(element, memory);
    }
    memory[name] = { original: value, applied: translated };

    if (translated !== value) element.setAttribute(name, translated);
  }
}


function translateTree(root) {
  if (!root) return;

  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }

  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;

  if (root.nodeType === 1) translateAttributes(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === 3) translateTextNode(node);
    else translateAttributes(node);
    node = walker.nextNode();
  }
}


// Put the English back (switching to English)
function restoreTree(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === 3) {
      const memory = textMemory.get(node);
      if (memory && node.nodeValue === memory.applied && memory.applied !== memory.original) {
        node.nodeValue = memory.original;
      }
      textMemory.delete(node);
    } else {
      const memory = attributeMemory.get(node);
      if (memory) {
        for (const [name, saved] of Object.entries(memory)) {
          if (node.getAttribute(name) === saved.applied) node.setAttribute(name, saved.original);
        }
        attributeMemory.delete(node);
      }
    }
    node = walker.nextNode();
  }
}


function applyDocumentSettings() {
  const language = LANGUAGES.find((item) => item.code === current) || LANGUAGES[0];
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.dir || "ltr";
}


function startObserver() {
  if (observer || current === "en") return;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        translateTextNode(mutation.target);
      } else if (mutation.type === "attributes") {
        translateAttributes(mutation.target);
      } else {
        mutation.addedNodes.forEach((node) => translateTree(node));
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
}


function stopObserver() {
  observer?.disconnect();
  observer = null;
}


export async function setLanguage(code) {
  const next = LANGUAGES.some((language) => language.code === code) ? code : "en";

  if (next !== "en") {
    const module = await LOADERS[next]();
    dictionary = module.default || module;
    patterns = Object.entries(dictionary)
      .filter(([key]) => /\{\d\}/.test(key))
      .map(([key, output]) => ({
        regex: new RegExp(
          "^" + key.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\d\}/g, "(.+?)") + "$"
        ),
        output,
      }));
  }

  const previous = current;
  current = next;
  save(next);
  applyDocumentSettings();

  if (next === "en") {
    stopObserver();
    dictionary = {};
    patterns = [];
    if (previous !== "en") restoreTree(document.body);
  } else {
    if (previous !== "en") restoreTree(document.body);
    translateTree(document.body);
    startObserver();
  }

  listeners.forEach((listener) => listener(next));
}


// Called once when the app starts (main.jsx)
export async function startLanguage() {
  // Pop-up messages (confirm / alert) are translated too
  const nativeConfirm = window.confirm.bind(window);
  const nativeAlert = window.alert.bind(window);
  window.confirm = (message) => nativeConfirm(t(String(message ?? "")));
  window.alert = (message) => nativeAlert(t(String(message ?? "")));

  const code = readSaved() || guessLanguage();

  if (code === "en") {
    applyDocumentSettings();
    return;
  }

  try {
    await setLanguage(code);
  } catch {
    current = "en";
    applyDocumentSettings();
  }
}


export function useLanguage() {
  const [language, setState] = useState(current);

  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);

  return [language, setLanguage];
}
