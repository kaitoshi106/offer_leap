import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FileDropzone, isAcceptedFile } from './FileDropzone';

const ACCEPT = ['application/pdf', '.docx'];
const pdf = (size = 10) => new File([new Uint8Array(size)], 'cv.pdf', { type: 'application/pdf' });

function setup(props: Partial<Parameters<typeof FileDropzone>[0]> = {}) {
  const onFile = vi.fn();
  const onReject = vi.fn();
  render(
    <FileDropzone
      title="Drop your CV"
      hint="PDF or DOCX"
      accept={ACCEPT}
      maxBytes={100}
      onFile={onFile}
      onReject={onReject}
      {...props}
    />,
  );
  return { onFile, onReject, input: screen.getByLabelText(/Drop your CV/) as HTMLInputElement };
}

describe('FileDropzone', () => {
  it('is a labelled file input described by its hint', () => {
    const { input } = setup();
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'application/pdf,.docx');
    expect(input).toHaveAccessibleDescription('PDF or DOCX');
  });

  it('passes a valid picked file on', async () => {
    const { input, onFile } = setup();
    await userEvent.upload(input, pdf());
    expect(onFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'cv.pdf' }));
  });

  it('rejects files that are too large or of the wrong type', async () => {
    const { input, onFile, onReject } = setup();
    await userEvent.upload(input, pdf(101));
    fireEvent.drop(input.closest('label')!, {
      dataTransfer: { files: [new File(['x'], 'photo.gif', { type: 'image/gif' })] },
    });
    expect(onReject.mock.calls.map(([reason]) => reason)).toEqual(['size', 'type']);
    expect(onFile).not.toHaveBeenCalled();
  });

  it('accepts dropped files and highlights while dragging', () => {
    const { onFile } = setup();
    const zone = screen.getByText('Drop your CV').closest('label')!;
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute('data-dragging');
    fireEvent.drop(zone, { dataTransfer: { files: [pdf()] } });
    expect(zone).not.toHaveAttribute('data-dragging');
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it('announces an error and marks the input invalid', () => {
    const { input } = setup({ error: 'File too large' });
    expect(screen.getByRole('alert')).toHaveTextContent('File too large');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('isAcceptedFile', () => {
  it('matches by MIME type or extension (browsers may leave the type empty)', () => {
    expect(isAcceptedFile(pdf(), ACCEPT)).toBe(true);
    expect(isAcceptedFile(new File(['x'], 'CV.DOCX', { type: '' }), ACCEPT)).toBe(true);
    expect(isAcceptedFile(new File(['x'], 'cv.txt', { type: 'text/plain' }), ACCEPT)).toBe(false);
  });
});
