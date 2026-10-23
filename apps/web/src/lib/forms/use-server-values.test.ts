import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { useServerValues } from './use-server-values';

interface Values {
  notes: string;
  company: string;
}

function useFormWithServer(values: Values) {
  const form = useForm<Values>({ defaultValues: values });
  useServerValues(form, values);
  return form;
}

describe('useServerValues', () => {
  it('takes newly saved values without throwing away what the user is typing', () => {
    const { result, rerender } = renderHook((values: Values) => useFormWithServer(values), {
      initialProps: { notes: '', company: 'Acme' },
    });
    act(() => result.current.setValue('notes', 'Call HR on Friday', { shouldDirty: true }));

    // Something else saved the record (e.g. its column changed): the company was renamed meanwhile.
    rerender({ notes: '', company: 'Acme Tech' });

    expect(result.current.getValues()).toEqual({ notes: 'Call HR on Friday', company: 'Acme Tech' });
    expect(result.current.formState.dirtyFields).toEqual({ notes: true });
  });

  it('leaves the form alone while the saved values stay the same', () => {
    const { result, rerender } = renderHook((values: Values) => useFormWithServer(values), {
      initialProps: { notes: '', company: 'Acme' },
    });
    act(() => result.current.setValue('company', 'Typed', { shouldDirty: true }));

    // A re-render with an equal (but new) object, like a refetch that changed nothing.
    rerender({ notes: '', company: 'Acme' });

    expect(result.current.getValues('company')).toBe('Typed');
  });
});
