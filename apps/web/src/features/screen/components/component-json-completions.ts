import { getLocation } from 'jsonc-parser';
import type { ComponentJsonSchema } from '@nebula/screen-editor-core';

export interface ComponentJsonPropertySuggestion {
  readonly detail?: string;
  readonly insertText: string;
  readonly label: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSchemaProperties(schema: Record<string, unknown>): Record<string, unknown> | undefined {
  const directProperties = schema['properties'];
  if (isRecord(directProperties)) return directProperties;

  const combinedProperties: Record<string, unknown> = {};
  for (const keyword of ['anyOf', 'oneOf'] as const) {
    const alternatives = schema[keyword];
    if (!Array.isArray(alternatives)) continue;
    for (const alternative of alternatives) {
      if (!isRecord(alternative)) continue;
      const properties = getSchemaProperties(alternative);
      if (properties !== undefined) Object.assign(combinedProperties, properties);
    }
  }
  return Object.keys(combinedProperties).length === 0 ? undefined : combinedProperties;
}

function getSchemaAtPath(
  schema: ComponentJsonSchema,
  path: ReadonlyArray<string | number>,
): Record<string, unknown> | undefined {
  let current: Record<string, unknown> = schema;
  for (const segment of path) {
    if (typeof segment === 'number') {
      const items = current['items'];
      if (!isRecord(items)) return undefined;
      current = items;
      continue;
    }
    const properties = getSchemaProperties(current);
    if (properties === undefined) return undefined;
    const property = properties[segment];
    if (!isRecord(property)) return undefined;
    current = property;
  }
  return current;
}

function getParentPath(
  path: ReadonlyArray<string | number>,
  isAtPropertyKey: boolean,
): Array<string | number> {
  if (!isAtPropertyKey || path.length === 0) return [...path];
  return path.slice(0, -1);
}

function getFirstSchemaType(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return undefined;
  let firstType: string | undefined;
  value.some((candidate: unknown) => {
    if (typeof candidate !== 'string') return false;
    firstType = candidate;
    return true;
  });
  return firstType;
}

function getInsertText(label: string, propertySchema: Record<string, unknown>): string {
  const defaultValue = propertySchema['default'];
  if (defaultValue !== undefined) {
    const serializedDefault = JSON.stringify(defaultValue);
    if (serializedDefault !== undefined) return `"${label}": ${serializedDefault}`;
  }

  const normalizedType = getFirstSchemaType(propertySchema['type']);
  if (normalizedType === 'string') return `"${label}": ""`;
  if (normalizedType === 'number' || normalizedType === 'integer') return `"${label}": 0`;
  if (normalizedType === 'boolean') return `"${label}": false`;
  if (normalizedType === 'array') return `"${label}": []`;
  if (normalizedType === 'object') return `"${label}": {}`;
  return `"${label}": null`;
}

export function getComponentJsonPropertySuggestions(
  text: string,
  offset: number,
  schema: ComponentJsonSchema,
): ComponentJsonPropertySuggestion[] {
  const location = getLocation(text, offset);
  const parentPath = getParentPath(location.path, location.isAtPropertyKey);
  const parentSchema = getSchemaAtPath(schema, parentPath);
  if (parentSchema === undefined) return [];
  const properties = getSchemaProperties(parentSchema);
  if (properties === undefined) return [];

  return Object.entries(properties)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([label, propertySchema]) => ({
      ...(typeof propertySchema['description'] === 'string'
        ? { detail: propertySchema['description'] }
        : {}),
      insertText: getInsertText(label, propertySchema),
      label,
    }));
}
