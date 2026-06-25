import type { ComponentType } from 'react';
import { TextEditor, type EditorProps } from './text-editor';
import { NumberEditor } from './number-editor';
import { SelectEditor } from './select-editor';
import { DateEditor } from './date-editor';

export type { EditorProps };

/** 编辑器类型 */
export type EditorType = 'text' | 'number' | 'select' | 'date';

/** 编辑器渲染器注册表 */
const editorRenderers: Record<EditorType, ComponentType<EditorProps>> = {
  text: TextEditor,
  number: NumberEditor,
  select: SelectEditor as ComponentType<EditorProps>,
  date: DateEditor,
};

/** 根据编辑器类型获取渲染组件 */
export function getEditor(type: EditorType): ComponentType<EditorProps> {
  return editorRenderers[type] ?? TextEditor;
}

export { TextEditor, NumberEditor, SelectEditor, DateEditor };
