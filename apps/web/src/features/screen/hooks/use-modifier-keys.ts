/**
 * 修饰键状态 hook
 *
 * 统一管理 Space/Shift/Alt/Ctrl 的"按住状态"，供：
 * - screen-canvas.tsx（平移/等比/旋转吸附）
 * - 工具状态机（临时切换）
 * 共用，消除原本散落在 screen-canvas.tsx 第 179-215 行的
 * 独立 document.addEventListener('keydown'/'keyup')。
 *
 * ref 形式用于高频回调（如 pointermove）中避免闭包陈旧；
 * state 形式用于触发 UI 重渲染（如光标样式）。
 *
 * 焦点切走时（window blur）兜底重置所有修饰键，
 * 避免 keyup 事件丢失导致 spaceHeld 卡死。
 */

import { useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

/**
 * 判断当前焦点是否在表单元素（input/textarea/select）或 contenteditable 元素上。
 * 用于修饰键 hook 中决定是否阻止默认行为：
 * - true：不阻止默认行为，让用户在表单/contenteditable 中正常输入
 * - false：阻止默认行为，触发画布平移等功能
 *
 * react-hotkeys-hook 的 enableOnFormTags 选项只覆盖 input/textarea/select，
 * 不覆盖 contenteditable 元素，因此需要此函数补充判断。
 */
export function isFormElementFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable
  );
}

export interface ModifierKeysApi {
  /** ref 形式，避免闭包陈旧（高频 pointer 回调用） */
  spaceRef: React.RefObject<boolean>;
  shiftRef: React.RefObject<boolean>;
  altRef: React.RefObject<boolean>;
  ctrlRef: React.RefObject<boolean>;
  /** state 形式，触发 UI 重渲染（光标样式等） */
  spaceHeld: boolean;
  shiftHeld: boolean;
  altHeld: boolean;
  ctrlHeld: boolean;
}

export function useModifierKeys(): ModifierKeysApi {
  const spaceRef = useRef(false);
  const shiftRef = useRef(false);
  const altRef = useRef(false);
  const ctrlRef = useRef(false);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [altHeld, setAltHeld] = useState(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);

  // 焦点切走时兜底重置所有修饰键状态，避免 keyup 丢失导致卡死
  useEffect(() => {
    const handleBlur = () => {
      spaceRef.current = false;
      shiftRef.current = false;
      altRef.current = false;
      ctrlRef.current = false;
      setSpaceHeld(false);
      setShiftHeld(false);
      setAltHeld(false);
      setCtrlHeld(false);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // Space：keydown 压栈，keyup 出栈
  // 在表单/contenteditable 中不阻止默认行为，让用户正常输入空格；
  // 其他情况下 preventDefault 阻止页面随空格滚动
  // enableOnFormTags: false 让 input/textarea/select 聚焦时不响应（contenteditable 由 isFormElementFocused 补充）
  useHotkeys(
    'space',
    (e) => {
      if (isFormElementFocused()) return;
      e.preventDefault();
      spaceRef.current = true;
      setSpaceHeld(true);
    },
    { keydown: true, keyup: false, enableOnFormTags: false },
  );
  useHotkeys(
    'space',
    () => {
      spaceRef.current = false;
      setSpaceHeld(false);
    },
    { keydown: false, keyup: true, enableOnFormTags: false },
  );

  // Shift
  useHotkeys(
    'shift',
    () => {
      shiftRef.current = true;
      setShiftHeld(true);
    },
    { keydown: true, keyup: false, enableOnFormTags: false },
  );
  useHotkeys(
    'shift',
    () => {
      shiftRef.current = false;
      setShiftHeld(false);
    },
    { keydown: false, keyup: true, enableOnFormTags: false },
  );

  // Alt
  useHotkeys(
    'alt',
    () => {
      altRef.current = true;
      setAltHeld(true);
    },
    { keydown: true, keyup: false, enableOnFormTags: false },
  );
  useHotkeys(
    'alt',
    () => {
      altRef.current = false;
      setAltHeld(false);
    },
    { keydown: false, keyup: true, enableOnFormTags: false },
  );

  // Ctrl（Mac 上 cmd 由 mod 处理，这里单独管 ctrl）
  useHotkeys(
    'ctrl',
    () => {
      ctrlRef.current = true;
      setCtrlHeld(true);
    },
    { keydown: true, keyup: false, enableOnFormTags: false },
  );
  useHotkeys(
    'ctrl',
    () => {
      ctrlRef.current = false;
      setCtrlHeld(false);
    },
    { keydown: false, keyup: true, enableOnFormTags: false },
  );

  return {
    spaceRef,
    shiftRef,
    altRef,
    ctrlRef,
    spaceHeld,
    shiftHeld,
    altHeld,
    ctrlHeld,
  };
}
