import { describe, expect, it } from 'vitest';
import { ButtonCustomElement } from './button-component';
import { EllipseCustomElement } from './ellipse-component';
import { ImageCustomElement } from './image-component';
import { RectCustomElement } from './rect-component';

const BASE_MODEL = {
  apiVersion: 1 as const,
  componentId: 'component-1',
  mode: 'design' as const,
  interactive: false,
  props: {},
  style: {},
  size: { width: 100, height: 100 },
};

describe('built-in Custom Elements', () => {
  it('renders rect styles from model', () => {
    const element = new RectCustomElement();
    element.model = {
      ...BASE_MODEL,
      style: { backgroundColor: '#ff0000', borderWidth: 2, borderRadius: 8, opacity: 0.5 },
    };

    const target = element.firstElementChild as HTMLElement;
    expect(target.style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(target.style.borderWidth).toBe('2px');
    expect(target.style.borderRadius).toBe('8px');
    expect(target.style.opacity).toBe('0.5');
  });

  it('renders ellipse with fixed 50% border radius', () => {
    const element = new EllipseCustomElement();
    element.model = { ...BASE_MODEL, style: { backgroundColor: '#00ff00', borderRadius: 4 } };

    const target = element.firstElementChild as HTMLElement;
    expect(target.style.backgroundColor).toBe('rgb(0, 255, 0)');
    expect(target.style.borderRadius).toBe('50%');
  });

  it('renders image placeholder and image states', () => {
    const element = new ImageCustomElement();
    element.model = { ...BASE_MODEL, props: { src: '', alt: '' } };
    expect(element.textContent).toBe('未设置图片');

    element.model = {
      ...BASE_MODEL,
      props: { src: 'https://example.com/image.png', alt: 'Example' },
      style: { objectFit: 'contain', borderRadius: 6 },
    };
    const image = element.querySelector('img');
    expect(image?.src).toBe('https://example.com/image.png');
    expect(image?.alt).toBe('Example');
    expect(image?.style.objectFit).toBe('contain');
    expect(image?.style.borderRadius).toBe('6px');
  });

  it('renders button text and styles from model', () => {
    const element = new ButtonCustomElement();
    element.model = {
      ...BASE_MODEL,
      props: { text: '提交' },
      style: { backgroundColor: '#0000ff', color: '#ffffff', fontSize: 18, borderRadius: 12 },
    };

    const root = element.firstElementChild as HTMLElement;
    const label = element.querySelector('span');
    expect(label?.textContent).toBe('提交');
    expect(label?.title).toBe('提交');
    expect(root.style.backgroundColor).toBe('rgb(0, 0, 255)');
    expect(root.style.color).toBe('rgb(255, 255, 255)');
    expect(root.style.fontSize).toBe('18px');
    expect(root.style.borderRadius).toBe('12px');
  });
});
