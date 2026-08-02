/**
 * 属性面板校验（Spec §7.4）
 *
 * 校验 property pointer/control 与 propsSchema 一致性。
 * - pointer 使用相对 props 根的 RFC 6901 JSON Pointer
 * - pointer 必须指向 propsSchema 中已声明的属性
 * - control 必须与目标 schema 类型兼容
 * - section id 在 manifest 内唯一；field id 在 section 内唯一
 * - 同一 pointer 不得绑定两个字段
 */

import {
  PROPERTY_CONTROL_TYPES,
  type ScreenComponentPropertyField,
  type ScreenComponentPropertySection,
} from '../contracts/property.js';
import type { ScreenComponentManifest } from '../contracts/manifest.js';
import {
  createValidationDiagnostic,
  type ScreenComponentValidationDiagnostic,
} from '../contracts/diagnostic.js';
import { parseJsonPointer } from '../props/json-pointer.js';

type SchemaObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is SchemaObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Reflect.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * 在 propsSchema 中按路径段查找对应的子 schema。
 */
function findSchemaByPath(propsSchema: unknown, segments: string[]): SchemaObject | undefined {
  let current: unknown = propsSchema;
  for (const segment of segments) {
    if (!isPlainObject(current)) return undefined;
    const properties = current['properties'];
    if (!isPlainObject(properties)) return undefined;
    const child = properties[segment];
    if (!isPlainObject(child)) return undefined;
    current = child;
  }
  return isPlainObject(current) ? current : undefined;
}

/**
 * 检查 control 是否与 schema type 兼容（Spec §7.4）。
 */
function isControlCompatible(
  control: ScreenComponentPropertyField['control'],
  schemaType: string | undefined,
): boolean {
  switch (control) {
    case 'text':
    case 'textarea':
      return schemaType === 'string' || schemaType === undefined;
    case 'color':
      return schemaType === 'string' || schemaType === undefined;
    case 'switch':
      return schemaType === 'boolean' || schemaType === undefined;
    case 'number':
      return schemaType === 'number' || schemaType === 'integer' || schemaType === undefined;
    case 'select':
      return (
        schemaType === 'string' ||
        schemaType === 'number' ||
        schemaType === 'integer' ||
        schemaType === undefined
      );
    default:
      return false;
  }
}

/**
 * 校验 manifest 的 propertyPanel（Spec §7.4）。
 */
export function validatePropertyPanel(
  manifest: ScreenComponentManifest,
  diagnostics: ScreenComponentValidationDiagnostic[],
): boolean {
  const { propertyPanel } = manifest;
  if (propertyPanel === undefined) return true;

  let valid = true;
  const sectionIds = new Set<string>();
  const allPointers = new Set<string>();

  for (let sIndex = 0; sIndex < propertyPanel.length; sIndex++) {
    const section: ScreenComponentPropertySection = propertyPanel[sIndex];
    const sectionPath: ReadonlyArray<string | number> = ['propertyPanel', sIndex];

    // section id
    if (typeof section.id !== 'string' || section.id.length === 0) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPERTY_PANEL',
          [...sectionPath, 'id'],
          'section id 必须是非空字符串',
        ),
      );
      valid = false;
    } else if (sectionIds.has(section.id)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPERTY_PANEL',
          [...sectionPath, 'id'],
          `section id "${section.id}" 在 manifest 内重复`,
        ),
      );
      valid = false;
    } else {
      sectionIds.add(section.id);
    }

    // section title
    if (typeof section.title !== 'string' || section.title.length === 0) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_PROPERTY_PANEL',
          [...sectionPath, 'title'],
          'section title 必须是非空字符串',
        ),
      );
      valid = false;
    }

    // fields
    const fieldIds = new Set<string>();

    for (let fIndex = 0; fIndex < section.fields.length; fIndex++) {
      const field = section.fields[fIndex];
      const fieldPath: ReadonlyArray<string | number> = [...sectionPath, 'fields', fIndex];

      // field id
      if (typeof field.id !== 'string' || field.id.length === 0) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'id'],
            'field id 必须是非空字符串',
          ),
        );
        valid = false;
      } else if (fieldIds.has(field.id)) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'id'],
            `field id "${field.id}" 在 section 内重复`,
          ),
        );
        valid = false;
      } else {
        fieldIds.add(field.id);
      }

      // field label
      if (typeof field.label !== 'string' || field.label.length === 0) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'label'],
            'field label 必须是非空字符串',
          ),
        );
        valid = false;
      }

      // field pointer
      if (typeof field.pointer !== 'string' || field.pointer.length === 0) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'pointer'],
            'field pointer 必须是非空字符串',
          ),
        );
        valid = false;
        continue;
      }

      const segments = parseJsonPointer(field.pointer);
      if (segments === null) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'pointer'],
            `pointer "${field.pointer}" 不是合法的 RFC 6901 相对 pointer`,
          ),
        );
        valid = false;
        continue;
      }

      // pointer 唯一性
      if (allPointers.has(field.pointer)) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'pointer'],
            `pointer "${field.pointer}" 在 manifest 内被多个字段绑定`,
          ),
        );
        valid = false;
      } else {
        allPointers.add(field.pointer);
      }

      // pointer 必须指向 propsSchema 中已声明的属性
      const targetSchema = findSchemaByPath(manifest.propsSchema, segments);
      if (targetSchema === undefined) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'pointer'],
            `pointer "${field.pointer}" 未在 propsSchema 中声明对应属性`,
          ),
        );
        valid = false;
        continue;
      }

      // control 类型
      if (!PROPERTY_CONTROL_TYPES.includes(field.control)) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'control'],
            `control "${field.control}" 不在允许列表 [${PROPERTY_CONTROL_TYPES.join(', ')}] 中`,
          ),
        );
        valid = false;
        continue;
      }

      // control 与 schema type 兼容
      const schemaType = targetSchema['type'];
      if (typeof schemaType === 'string' && !isControlCompatible(field.control, schemaType)) {
        diagnostics.push(
          createValidationDiagnostic(
            'INVALID_PROPERTY_PANEL',
            [...fieldPath, 'control'],
            `control "${field.control}" 与 schema type "${schemaType}" 不兼容`,
          ),
        );
        valid = false;
      }

      // number 控件的 min/max/step
      if (field.control === 'number') {
        if (
          field.min !== undefined &&
          (typeof field.min !== 'number' || !Number.isFinite(field.min))
        ) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_PROPERTY_PANEL',
              [...fieldPath, 'min'],
              'number 控件 min 必须是有限数字',
            ),
          );
          valid = false;
        }
        if (
          field.max !== undefined &&
          (typeof field.max !== 'number' || !Number.isFinite(field.max))
        ) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_PROPERTY_PANEL',
              [...fieldPath, 'max'],
              'number 控件 max 必须是有限数字',
            ),
          );
          valid = false;
        }
        if (
          field.step !== undefined &&
          (typeof field.step !== 'number' || !Number.isFinite(field.step) || field.step <= 0)
        ) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_PROPERTY_PANEL',
              [...fieldPath, 'step'],
              'number 控件 step 必须是正数',
            ),
          );
          valid = false;
        }
        if (
          field.min !== undefined &&
          field.max !== undefined &&
          typeof field.min === 'number' &&
          typeof field.max === 'number' &&
          field.min > field.max
        ) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_PROPERTY_PANEL',
              [...fieldPath, 'min'],
              'number 控件 min 不能大于 max',
            ),
          );
          valid = false;
        }
      }

      // select 控件的 options
      if (field.control === 'select') {
        if (field.options.length === 0) {
          diagnostics.push(
            createValidationDiagnostic(
              'INVALID_PROPERTY_PANEL',
              [...fieldPath, 'options'],
              'select 控件 options 必须是非空数组',
            ),
          );
          valid = false;
        } else {
          const optionValues = new Set<string>();
          for (let oIndex = 0; oIndex < field.options.length; oIndex++) {
            const option = field.options[oIndex];
            if (typeof option.label !== 'string' || option.label.length === 0) {
              diagnostics.push(
                createValidationDiagnostic(
                  'INVALID_PROPERTY_PANEL',
                  [...fieldPath, 'options', oIndex, 'label'],
                  'option label 必须是非空字符串',
                ),
              );
              valid = false;
            }
            if (typeof option.value !== 'string' && typeof option.value !== 'number') {
              diagnostics.push(
                createValidationDiagnostic(
                  'INVALID_PROPERTY_PANEL',
                  [...fieldPath, 'options', oIndex, 'value'],
                  'option value 必须是 string 或 number',
                ),
              );
              valid = false;
            }
            const valueKey = String(option.value);
            if (optionValues.has(valueKey)) {
              diagnostics.push(
                createValidationDiagnostic(
                  'INVALID_PROPERTY_PANEL',
                  [...fieldPath, 'options', oIndex, 'value'],
                  `option value "${valueKey}" 重复`,
                ),
              );
              valid = false;
            } else {
              optionValues.add(valueKey);
            }
          }
        }
      }
    }
  }

  return valid;
}
