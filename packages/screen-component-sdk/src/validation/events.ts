/**
 * 事件校验（Spec §7.5）
 *
 * - event id 在单个 manifest 内唯一，并匹配 `^[a-z][A-Za-z0-9]*$`
 * - event name 必须非空
 * - events 缺省或为空表示组件没有蓝图 source handle
 */

import { EVENT_ID_PATTERN } from '../contracts/event.js';
import type { ScreenComponentManifestV1 } from '../contracts/manifest.js';
import {
  createValidationDiagnostic,
  type ScreenComponentValidationDiagnostic,
} from '../contracts/diagnostic.js';

export function validateEvents(
  manifest: ScreenComponentManifestV1,
  diagnostics: ScreenComponentValidationDiagnostic[],
): boolean {
  const { events } = manifest;
  if (events === undefined) return true;

  let valid = true;
  const ids = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const path: ReadonlyArray<string | number> = ['events', i];

    // event id
    if (typeof event.id !== 'string' || event.id.length === 0) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_EVENT_DEFINITION',
          [...path, 'id'],
          'event id 必须是非空字符串',
        ),
      );
      valid = false;
    } else if (!EVENT_ID_PATTERN.test(event.id)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_EVENT_DEFINITION',
          [...path, 'id'],
          `event id "${event.id}" 不匹配 ${EVENT_ID_PATTERN.source}`,
        ),
      );
      valid = false;
    } else if (ids.has(event.id)) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_EVENT_DEFINITION',
          [...path, 'id'],
          `event id "${event.id}" 在 manifest 内重复`,
        ),
      );
      valid = false;
    } else {
      ids.add(event.id);
    }

    // event name
    if (typeof event.name !== 'string' || event.name.length === 0) {
      diagnostics.push(
        createValidationDiagnostic(
          'INVALID_EVENT_DEFINITION',
          [...path, 'name'],
          'event name 必须是非空字符串',
        ),
      );
      valid = false;
    }
  }

  return valid;
}
