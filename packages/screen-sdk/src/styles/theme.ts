import type { ScreenEditorTheme } from '@nebula/screen-editor-core';

type ThemeVariableKind = 'color' | 'font-family' | 'length';

interface ThemeVariableDefinition {
  dark: string;
  internal: string;
  kind: ThemeVariableKind;
  light: string;
  public: string;
}

export const SCREEN_EDITOR_THEME_VARIABLES = [
  {
    public: '--nebula-screen-font-family',
    internal: '--nebula-resolved-font-family',
    kind: 'font-family',
    light: '"Geist Variable", system-ui, sans-serif',
    dark: '"Geist Variable", system-ui, sans-serif',
  },
  {
    public: '--nebula-screen-background',
    internal: '--nebula-resolved-background',
    kind: 'color',
    light: 'oklch(0.985 0.02 290)',
    dark: 'oklch(0.12 0.03 290)',
  },
  {
    public: '--nebula-screen-foreground',
    internal: '--nebula-resolved-foreground',
    kind: 'color',
    light: 'oklch(0.25 0.12 290)',
    dark: 'oklch(0.96 0.01 290)',
  },
  {
    public: '--nebula-screen-surface',
    internal: '--nebula-resolved-surface',
    kind: 'color',
    light: 'oklch(1 0 0)',
    dark: 'oklch(0.18 0.04 290)',
  },
  {
    public: '--nebula-screen-muted',
    internal: '--nebula-resolved-muted',
    kind: 'color',
    light: 'oklch(0.96 0.02 290)',
    dark: 'oklch(0.25 0.04 290)',
  },
  {
    public: '--nebula-screen-primary',
    internal: '--nebula-resolved-primary',
    kind: 'color',
    light: 'oklch(0.58 0.28 290)',
    dark: 'oklch(0.7 0.25 290)',
  },
  {
    public: '--nebula-screen-border',
    internal: '--nebula-resolved-border',
    kind: 'color',
    light: 'oklch(0.92 0.02 290)',
    dark: 'oklch(1 0 0 / 12%)',
  },
  {
    public: '--nebula-screen-danger',
    internal: '--nebula-resolved-danger',
    kind: 'color',
    light: 'oklch(0.577 0.245 27.325)',
    dark: 'oklch(0.704 0.191 22.216)',
  },
  {
    public: '--nebula-screen-radius',
    internal: '--nebula-resolved-radius',
    kind: 'length',
    light: '0.625rem',
    dark: '0.625rem',
  },
] as const satisfies readonly ThemeVariableDefinition[];

function supportsCssValue(document: Document, kind: ThemeVariableKind, value: string): boolean {
  const probe = document.createElement('span');
  switch (kind) {
    case 'color':
      probe.style.color = value;
      return probe.style.color !== '';
    case 'font-family':
      probe.style.fontFamily = value;
      return probe.style.fontFamily !== '';
    case 'length':
      probe.style.borderRadius = value;
      return probe.style.borderRadius !== '';
  }
}

export function applyScreenEditorThemeVariables(
  host: HTMLElement,
  targets: readonly HTMLElement[],
  theme: ScreenEditorTheme,
): void {
  const computed = host.ownerDocument.defaultView?.getComputedStyle(host);
  for (const definition of SCREEN_EDITOR_THEME_VARIABLES) {
    const customValue = computed?.getPropertyValue(definition.public).trim() ?? '';
    const fallback = theme === 'dark' ? definition.dark : definition.light;
    const value =
      customValue !== '' && supportsCssValue(host.ownerDocument, definition.kind, customValue)
        ? customValue
        : fallback;
    for (const target of targets) target.style.setProperty(definition.internal, value);
  }
}
