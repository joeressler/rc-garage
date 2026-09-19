import { useState, type KeyboardEvent } from 'react';
import { useSetupStore } from '../../stores/useSetupStore';

const TAG_MIN = 2;
const TAG_MAX = 30;
const TAG_LIMIT = 10;

function normalizeTag(raw: string): string | null {
  const value = raw.replace(/#/g, '').trim().toLowerCase();
  if (value.length < TAG_MIN || value.length > TAG_MAX) {
    return null;
  }
  return value;
}

/**
 * Purpose: edit clipboard discovery tags to the same 2–30 / max-10 contract the API persists.
 */
export function ClipboardTagsField() {
  const tags = useSetupStore((state) => state.meta.tags);
  const updateMeta = useSetupStore((state) => state.updateMeta);
  const [draft, setDraft] = useState('');

  const commitTokens = (raw: string) => {
    const next = [...tags];
    for (const token of raw.split(',')) {
      if (next.length >= TAG_LIMIT) {
        break;
      }
      const normalized = normalizeTag(token);
      if (!normalized || next.includes(normalized)) {
        continue;
      }
      next.push(normalized);
    }
    if (next.length !== tags.length) {
      updateMeta({ tags: next });
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    commitTokens(draft);
    setDraft('');
  };

  const handleChange = (value: string) => {
    if (value.includes(',')) {
      commitTokens(value);
      setDraft('');
      return;
    }
    setDraft(value);
  };

  const removeTag = (tag: string) => {
    updateMeta({ tags: tags.filter((entry) => entry !== tag) });
  };

  return (
    <div className="pt-2">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-readout-muted">
          Discovery Tags
        </span>
        <input
          type="text"
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="moab, comp"
          disabled={tags.length >= TAG_LIMIT}
          className="mt-1 w-full max-w-lg border border-metal-border bg-pit-black px-3 py-1.5 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange disabled:opacity-50"
        />
      </label>
      <p className="mt-1 font-mono text-[10px] text-readout-muted">
        Enter or comma to add. Max {TAG_LIMIT} tags, {TAG_MIN}–{TAG_MAX} characters.
      </p>
      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="border border-metal-border bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-readout-bright hover:border-hazard-orange hover:text-hazard-orange"
            >
              #{tag} ×
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
