<script setup lang="ts">
/**
 * Vue 3 Consumer 主界面：designer / viewer 切换 + 挂载参数注入。
 * 通过 template ref 持有元素实例并设置 property（document/dataAdapter/registry）。
 * 元素仅在对应 tab 渲染，因此按 tab 切换时注入参数（幂等）。
 */

import { onMounted, ref, watch } from 'vue';
import type {
  NebulaScreenDesignerElement,
  NebulaScreenViewerElement,
} from '@nebula/screen-dynamic-sdk';
import { createXjContractFixtureRegistry } from '@nebula/screen-dynamic-sdk';
import { sampleDocument } from './document.ts';
import { fakeAdapter } from './fake-adapter.ts';

type ViewMode = 'designer' | 'viewer';

const mode = ref<ViewMode>('designer');
const designerRef = ref<NebulaScreenDesignerElement | null>(null);
const viewerRef = ref<NebulaScreenViewerElement | null>(null);
const ready = ref(false);
const registryPromise = createXjContractFixtureRegistry();
let designerConfigured = false;
let viewerConfigured = false;

onMounted(async () => {
  await registryPromise;
  ready.value = true;
  await configure(mode.value);
});

watch(mode, async (next) => {
  await configure(next);
});

async function configure(next: ViewMode): Promise<void> {
  const registry = await registryPromise;

  if (next === 'designer' && !designerConfigured) {
    const designer = designerRef.value;
    if (designer !== null) {
      // 先注入注册表再注入文档（document 会冻结注册表）
      designer.componentRegistry = registry;
      designer.document = sampleDocument;
      designer.dataAdapter = fakeAdapter;
      designer.options = { projectId: 'demo-project', refreshIntervalSeconds: 0 };
      designer.addEventListener('nebula-ready', () => {
        const log = document.querySelector('#event-log');
        if (log !== null) log.textContent = 'designer ready';
      });
      designerConfigured = true;
    }
  }

  if (next === 'viewer' && !viewerConfigured) {
    const viewer = viewerRef.value;
    if (viewer !== null) {
      viewer.componentRegistry = registry;
      viewer.document = sampleDocument;
      viewer.dataAdapter = fakeAdapter;
      viewer.options = { projectId: 'demo-project', refreshIntervalSeconds: 0 };
      viewerConfigured = true;
    }
  }
}

function switchMode(next: ViewMode): void {
  mode.value = next;
}

function handleSave(): void {
  const designer = designerRef.value;
  if (designer === null) return;
  const doc = designer.save();
  const log = document.querySelector('#event-log');
  if (log !== null) log.textContent = `saved ${doc.components.length} components`;
}
</script>

<template>
  <div class="app">
    <div class="toolbar">
      <button :class="{ active: mode === 'designer' }" type="button" data-testid="tab-designer" @click="switchMode('designer')">Designer</button>
      <button :class="{ active: mode === 'viewer' }" type="button" data-testid="tab-viewer" @click="switchMode('viewer')">Viewer</button>
      <button v-if="mode === 'designer'" type="button" data-testid="btn-save" @click="handleSave">保存</button>
      <span id="event-log" data-testid="event-log" class="log" />
    </div>
    <div class="stage">
      <div v-if="mode === 'designer'" class="frame">
        <nebula-screen-designer ref="designerRef" data-testid="designer" theme="dark" />
      </div>
      <div v-else class="frame">
        <nebula-screen-viewer ref="viewerRef" data-testid="viewer" theme="dark" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  height: 44px;
  flex: none;
  padding: 0 12px;
  background: #0f172a;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
}
.toolbar button {
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
}
.toolbar button.active {
  background: #0284c7;
  border-color: #0284c7;
}
.log {
  margin-left: 12px;
  color: #38bdf8;
  font-size: 13px;
}
.stage {
  flex: 1;
  min-height: 0;
}
.frame {
  height: 100%;
}
</style>
