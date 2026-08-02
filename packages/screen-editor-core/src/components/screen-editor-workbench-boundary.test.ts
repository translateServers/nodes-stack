import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const WORKBENCH_PATH = resolve(import.meta.dirname, 'screen-editor-workbench.tsx');

function collectModuleSpecifiers(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const specifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function resolveSourceImport(filePath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const target = resolve(dirname(filePath), specifier);
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    resolve(target, 'index.ts'),
    resolve(target, 'index.tsx'),
  ];
  return (
    candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
  );
}

function collectTransitiveModuleSpecifiers(entryPath: string): Array<{
  filePath: string;
  specifier: string;
}> {
  const visited = new Set<string>();
  const imports: Array<{ filePath: string; specifier: string }> = [];
  function visit(filePath: string): void {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    for (const specifier of collectModuleSpecifiers(filePath)) {
      imports.push({ filePath, specifier });
      const dependencyPath = resolveSourceImport(filePath, specifier);
      if (dependencyPath !== null) visit(dependencyPath);
    }
  }
  visit(entryPath);
  return imports;
}

describe('ScreenEditorWorkbench host boundary', () => {
  it('does not import Router, Query, screen API, auth, dataset, Axios, or Sonner', () => {
    const specifiers = collectModuleSpecifiers(WORKBENCH_PATH);
    const forbidden = [
      '@tanstack/react-router',
      '@tanstack/react-query',
      'axios',
      'sonner',
      '@/api',
      '@/features/dataset',
      '../api',
    ];

    expect(
      specifiers.filter((specifier) =>
        forbidden.some(
          (candidate) => specifier === candidate || specifier.startsWith(`${candidate}/`),
        ),
      ),
    ).toEqual([]);
    expect(specifiers).not.toContain('../hooks');
  });

  it('uses container layout and loads only the V2 blueprint sheet dynamically', () => {
    const source = readFileSync(WORKBENCH_PATH, 'utf8');

    expect(source).not.toContain('h-screen');
    expect(source).not.toContain('w-screen');
    expect(source).not.toContain('window.');
    expect(source).not.toContain('document.');
    expect(source).toContain("import('../blueprint/sheet/blueprint-sheet-v2')");
    expect(source).not.toContain("from '../blueprint/sheet'");
  });

  it('does not reach application UI primitives or the application class utility', () => {
    const violations = collectTransitiveModuleSpecifiers(WORKBENCH_PATH).filter(
      ({ specifier }) => specifier.startsWith('@/components/ui/') || specifier === '@/lib/utils',
    );

    expect(violations).toEqual([]);
  });
});
