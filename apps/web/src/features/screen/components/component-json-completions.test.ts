import { describe, expect, it } from 'vitest';
import { getComponentJsonPropertySuggestions } from './component-json-completions';

const schema = {
  properties: {
    name: { description: '组件名称', type: 'string' },
    props: {
      properties: {
        content: { default: '默认文本', description: '文本内容', type: 'string' },
      },
      type: 'object',
    },
    dataSource: {
      anyOf: [
        {
          properties: {
            staticData: { type: 'array' },
            type: { const: 'static' },
          },
          type: 'object',
        },
        {
          properties: {
            apiConfig: { type: 'object' },
            type: { const: 'api' },
          },
          type: 'object',
        },
      ],
    },
    zIndex: { type: 'integer' },
  },
  type: 'object',
} as const;

describe('getComponentJsonPropertySuggestions', () => {
  it('returns root fields for an incomplete root object property', () => {
    const text = '{\n  "';
    const suggestions = getComponentJsonPropertySuggestions(text, text.length, schema);

    expect(suggestions).toEqual(
      expect.arrayContaining([
        { detail: '组件名称', insertText: '"name": ""', label: 'name' },
        { insertText: '"zIndex": 0', label: 'zIndex' },
      ]),
    );
  });

  it('uses the nested props schema and its default value', () => {
    const text = '{\n  "props": {\n    "';
    const suggestions = getComponentJsonPropertySuggestions(text, text.length, schema);

    expect(suggestions).toEqual([
      { detail: '文本内容', insertText: '"content": "默认文本"', label: 'content' },
    ]);
  });

  it('merges data source branch fields from a discriminated union schema', () => {
    const text = '{\n  "dataSource": {\n    "';
    const suggestions = getComponentJsonPropertySuggestions(text, text.length, schema);

    expect(suggestions).toEqual(
      expect.arrayContaining([
        { insertText: '"apiConfig": {}', label: 'apiConfig' },
        { insertText: '"staticData": []', label: 'staticData' },
      ]),
    );
  });
});
