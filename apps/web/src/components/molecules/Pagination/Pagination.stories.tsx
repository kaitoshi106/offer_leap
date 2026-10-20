import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { storyCopy } from '@/stories/copy';

import { Pagination } from './Pagination';

const meta = {
  title: 'Molecules/Pagination',
  component: Pagination,
  args: { page: 1, pages: 5, onChange: () => {}, labels: { nav: '', previous: '', next: '', status: '' } },
  argTypes: {
    labels: { control: false },
    onChange: { control: false },
    page: { control: false },
    pageSize: { control: false },
  },
  decorators: [(Story) => <div className="w-[28rem]">{Story()}</div>],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: function Render(args, { globals }) {
    const copy = storyCopy(globals).pagination;
    const [page, setPage] = useState(1);
    return (
      <Pagination
        {...args}
        page={page}
        onChange={setPage}
        labels={{
          nav: copy.nav,
          previous: copy.previous,
          next: copy.next,
          status: copy.status(page, args.pages),
        }}
      />
    );
  },
};

/** With a page-size picker: 95 items, 10 / 50 / 100 per page. */
export const WithPageSize: Story = {
  render: function Render(_args, { globals }) {
    const copy = storyCopy(globals).pagination;
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const pages = Math.ceil(95 / pageSize);
    return (
      <Pagination
        page={page}
        pages={pages}
        onChange={setPage}
        labels={{ nav: copy.nav, previous: copy.previous, next: copy.next, status: copy.status(page, pages) }}
        pageSize={{
          value: pageSize,
          options: [10, 50, 100],
          onChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          label: copy.pageSize,
          optionLabel: copy.pageSizeOption,
        }}
      />
    );
  },
};
