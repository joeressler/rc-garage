import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSetupStore } from '../../stores/useSetupStore';
import { ClipboardTagsField } from './ClipboardTagsField';

describe('ClipboardTagsField', () => {
  beforeEach(() => {
    useSetupStore.getState().reset();
  });

  afterEach(() => {
    useSetupStore.getState().reset();
  });

  it('adds tags on enter and comma, strips hashes, and lowercases', () => {
    render(<ClipboardTagsField />);
    const input = screen.getByPlaceholderText('moab, comp');

    fireEvent.change(input, { target: { value: '#Moab' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useSetupStore.getState().meta.tags).toEqual(['moab']);

    fireEvent.change(input, { target: { value: 'Comp,' } });
    expect(useSetupStore.getState().meta.tags).toEqual(['moab', 'comp']);
  });

  it('rejects duplicates and tags shorter than two characters', () => {
    render(<ClipboardTagsField />);
    const input = screen.getByPlaceholderText('moab, comp');

    fireEvent.change(input, { target: { value: 'moab' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'MOAB' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useSetupStore.getState().meta.tags).toEqual(['moab']);
  });

  it('caps the tag list at ten entries', () => {
    useSetupStore.setState({
      meta: {
        ...useSetupStore.getState().meta,
        tags: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a0'],
      },
    });
    render(<ClipboardTagsField />);

    expect(screen.getByPlaceholderText('moab, comp')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('moab, comp'), {
      target: { value: 'extra,' },
    });
    expect(useSetupStore.getState().meta.tags).toHaveLength(10);
    expect(useSetupStore.getState().meta.tags).not.toContain('extra');
  });
});
