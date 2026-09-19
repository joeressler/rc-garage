import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LegalDocumentView } from './LegalDocumentView';

function renderDoc(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/legal/terms" element={<LegalDocumentView />} />
        <Route path="/legal/privacy" element={<LegalDocumentView />} />
        <Route path="/legal/guidelines" element={<LegalDocumentView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LegalDocumentView', () => {
  it('renders non-empty terms copy', () => {
    renderDoc('/legal/terms');
    expect(screen.getByRole('heading', { name: /terms of service/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hobby community purpose/i })).toBeInTheDocument();
    expect(screen.getByText(/no warranty of mechanical safety/i)).toBeInTheDocument();
  });

  it('renders non-empty privacy copy', () => {
    renderDoc('/legal/privacy');
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/localStorage/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /privacy policy/i }).length,
    ).toBeGreaterThan(0);
  });

  it('renders non-empty community guidelines copy', () => {
    renderDoc('/legal/guidelines');
    expect(screen.getByRole('heading', { name: /community guidelines/i })).toBeInTheDocument();
    expect(screen.getByText(/report sheet/i)).toBeInTheDocument();
  });
});
