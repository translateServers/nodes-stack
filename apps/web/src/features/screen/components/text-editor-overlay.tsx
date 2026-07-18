/**
 * 文本编辑器浮层（任务 5.4）
 *
 * 在画布上叠加一个 textarea，用于编辑文本组件内容。
 * 支持多行（Enter 插入换行，Ctrl/Cmd+Enter 提交，Escape 取消，blur 提交）。
 *
 * 与统一交互会话状态的联动：
 * - 进入编辑：由调用方（ScreenCanvas）派发 'double-click' → interactionState='text-editing'
 * - 提交退出：派发 'commit' → interactionState='idle'
 * - 取消退出：派发 'escape' → interactionState='idle'
 *
 * 中文输入法 composition 期间 Enter/Escape 不误触发提交/取消：
 * - compositionstart → 标记 isComposing=true
 * - compositionend → 标记 isComposing=false（之后再次 keydown 才能提交/取消）
 *
 * 位置与尺寸：
 * - 跟随被编辑组件的位置、尺寸、旋转、字体大小、对齐方式
 * - 通过 transform 与画布 scale/offset 保持视觉一致
 *
 * 快捷键隔离（任务 5.5）：
 * - 文本编辑期间画布快捷键通过 canvasEnabled=!isEditingText 隔离（已实现）
 * - 编辑器自身的 keydown stopPropagation 防止穿透到画布
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ScreenComponent } from '@nebula/shared';
import {
  DEFAULT_TEXT_CONTENT,
  resolveTextCommit,
  type TextEditExitKind,
} from '../lib/text-editing-contract';

export interface TextEditorOverlayProps {
  /** 正在编辑的文本组件 */
  component: ScreenComponent;
  /** 是否为新建组件（影响提交时是否删除空内容组件） */
  isNewlyCreated: boolean;
  /** 画布缩放（用于字体大小、尺寸换算） */
  canvasScale: number;
  /** 画布偏移 */
  canvasOffset: { x: number; y: number };
  /** 提交/取消时的回调 */
  onExit: (result: {
    exitKind: TextEditExitKind;
    content: string;
    shouldCommitHistory: boolean;
    shouldDeleteComponent: boolean;
  }) => void;
}

/**
 * 文本编辑器浮层。
 *
 * 渲染一个绝对定位的 textarea，跟随被编辑组件的位置/尺寸/旋转/字体。
 * 自动聚焦并选中全部内容（便于用户直接替换）。
 */
export function TextEditorOverlay({
  component,
  isNewlyCreated,
  canvasScale,
  canvasOffset,
  onExit,
}: TextEditorOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 中文输入法 composition 状态：期间不处理 Enter/Escape
  const isComposingRef = useRef(false);
  // 防止 blur 与 keydown 重复触发退出
  const hasExitedRef = useRef(false);

  const initialContent = (component.props as { content?: unknown }).content ?? DEFAULT_TEXT_CONTENT;
  const initialStr = typeof initialContent === 'string' ? initialContent : DEFAULT_TEXT_CONTENT;

  const style = component.style as {
    fontSize?: number;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
  const fontSize = (style.fontSize ?? 14) * canvasScale;
  const textAlign = style.textAlign ?? 'center';

  // 组件在屏幕坐标系下的位置
  const screenX = component.position.x * canvasScale + canvasOffset.x;
  const screenY = component.position.y * canvasScale + canvasOffset.y;
  const screenWidth = component.position.width * canvasScale;
  const screenHeight = component.position.height * canvasScale;
  const rotation = component.position.rotation ?? 0;

  /** 退出编辑（保证只触发一次） */
  const exitOnce = useCallback(
    (exitKind: TextEditExitKind) => {
      if (hasExitedRef.current) return;
      hasExitedRef.current = true;
      const currentContent = textareaRef.current?.value ?? initialStr;
      const result = resolveTextCommit(initialStr, currentContent, exitKind, isNewlyCreated);
      onExit({
        exitKind: result.exitKind,
        content: result.content,
        shouldCommitHistory: result.shouldCommitHistory,
        shouldDeleteComponent: result.shouldDeleteComponent,
      });
    },
    [initialStr, isNewlyCreated, onExit],
  );

  // 挂载时自动聚焦并选中全部
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 阻止事件穿透到画布（避免触发画布快捷键）
      e.stopPropagation();

      // 中文输入法 composition 期间不处理提交/取消
      if (isComposingRef.current) return;

      // Escape：取消
      if (e.key === 'Escape') {
        e.preventDefault();
        exitOnce('cancel');
        return;
      }

      // Ctrl+Enter / Cmd+Enter：提交
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        exitOnce('commit');
        return;
      }

      // 普通 Enter：插入换行（textarea 默认行为，不阻止）
      // 其他按键（字符、Space、方向键、Delete、Backspace）默认由 textarea 处理
    },
    [exitOnce],
  );

  const handleBlur = useCallback(() => {
    // blur 视为提交（如果有变化）
    exitOnce('commit');
  }, [exitOnce]);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  return (
    <textarea
      ref={textareaRef}
      data-testid="text-editor"
      defaultValue={initialStr}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      className="absolute z-[9999] m-0 resize-none border-2 border-blue-500 bg-white/95 p-1 font-sans leading-snug text-black outline-none"
      style={{
        left: screenX,
        top: screenY,
        width: screenWidth,
        height: screenHeight,
        fontSize,
        textAlign,
        color: style.color ?? '#000000',
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'top left',
      }}
    />
  );
}
