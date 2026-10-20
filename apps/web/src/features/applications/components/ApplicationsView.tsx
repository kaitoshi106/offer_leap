'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button, Heading, Icon, Text } from '@/components/atoms';
import { useToast } from '@/components/organisms';

import { ApplicationBoard } from './ApplicationBoard';
import { ApplicationFormDialog } from './ApplicationFormDialog';

/** `/applications`: the kanban board and the "add application" dialog. */
export function ApplicationsView() {
  const t = useTranslations('applications');
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading level={1} size="lg">
            {t('title')}
          </Heading>
          <Text tone="muted" className="max-w-2xl">
            {t('description')}
          </Text>
        </div>
        <Button leftIcon={<Icon name="file-text" size="sm" />} onClick={() => setAdding(true)}>
          {t('add')}
        </Button>
      </div>
      <ApplicationBoard />
      <ApplicationFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          toast.show({ tone: 'success', title: t('form.created') });
        }}
      />
    </div>
  );
}
