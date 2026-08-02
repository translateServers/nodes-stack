const styleSheetCache = new WeakMap<Document, CSSStyleSheet>();

function createStyleSheet(root: ShadowRoot, cssText: string): CSSStyleSheet | null {
  const document = root.ownerDocument;
  const cached = styleSheetCache.get(document);
  if (cached !== undefined) return cached;
  const StyleSheet = document.defaultView?.CSSStyleSheet;
  if (StyleSheet === undefined || !('replaceSync' in StyleSheet.prototype)) return null;
  try {
    const styleSheet = new StyleSheet();
    styleSheet.replaceSync(cssText);
    styleSheetCache.set(document, styleSheet);
    return styleSheet;
  } catch {
    return null;
  }
}

export function installScreenEditorStyles(root: ShadowRoot, cssText: string): void {
  const styleSheet = createStyleSheet(root, cssText);
  if (styleSheet !== null && 'adoptedStyleSheets' in root) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, styleSheet];
    return;
  }

  const style = root.ownerDocument.createElement('style');
  style.dataset['nebulaScreenStyles'] = '';
  style.textContent = cssText;
  root.prepend(style);
}
