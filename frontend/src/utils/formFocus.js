import { scrollElementIntoAppView } from "./scrollContainer";

export const APP_FORM_SELECTOR = "form, [data-app-form]";

const FIELD_SELECTOR = [
  "input:not([type='hidden']):not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
].join(",");

function isVisibleField(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
  const rects = el.getClientRects();
  return rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
}

export function getWritableFields(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FIELD_SELECTOR)].filter(isVisibleField);
}

export function firstWritableField(root) {
  const fields = getWritableFields(root);
  const prefer = fields.find((el) => {
    const type = String(el.type || "").toLowerCase();
    if (type === "file" || type === "checkbox" || type === "radio" || type === "hidden") return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "SELECT") return true;
    return ["text", "search", "email", "url", "tel", "password", "number", "date", "datetime-local", "month"].includes(
      type
    ) || !type;
  });
  return prefer || fields[0] || null;
}

const revealed = new WeakSet();

export function revealAndFocusForm(form) {
  if (!form || revealed.has(form)) return;
  if (form.dataset?.appFormSkip === "true") return;
  if (form.closest(".topBar") || form.closest(".appSidebar")) return;
  revealed.add(form);

  const run = () => {
    if (!form.isConnected) return;
    const alreadyInside = form.contains(document.activeElement) && document.activeElement !== form;
    if (!alreadyInside) {
      scrollElementIntoAppView(form, { behavior: "smooth", block: "start", offset: 88 });
    }
    if (alreadyInside) return;
    const field = firstWritableField(form);
    if (!field) return;
    try {
      field.focus({ preventScroll: true });
    } catch {
      field.focus();
    }
  };

  requestAnimationFrame(() => {
    window.setTimeout(run, 160);
  });
}

function submitForm(form) {
  if (form.tagName === "FORM" && typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return;
  }
  const submitBtn =
    form.querySelector('button[type="submit"]') ||
    form.querySelector("[data-form-submit]");
  if (submitBtn && !submitBtn.disabled) submitBtn.click();
}

/** Enter moves to the next field (or submits on the last). Tab stays native. */
export function onAppFormKeyDown(e) {
  if (e.defaultPrevented) return;
  const form = e.target?.closest?.(APP_FORM_SELECTOR);
  if (!form) return;

  if (e.key === "Tab") return;

  if (e.key !== "Enter") return;
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;

  const tag = el.tagName;
  const type = String(el.getAttribute("type") || "").toLowerCase();
  if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
  if (type === "submit" || type === "button" || type === "file" || type === "checkbox" || type === "radio") return;

  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    submitForm(form);
    return;
  }

  const fields = getWritableFields(form);
  const idx = fields.indexOf(el);
  if (idx < 0) return;

  e.preventDefault();
  if (idx < fields.length - 1) {
    fields[idx + 1].focus();
    return;
  }
  submitForm(form);
}

export function findAppForm(node) {
  if (!node || node.nodeType !== 1) return null;
  if (node.matches?.(APP_FORM_SELECTOR)) return node;
  return node.querySelector?.(APP_FORM_SELECTOR) || null;
}
