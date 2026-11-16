import { fetchAll, type PageParams, paginate } from './paginate';

const pagesOf = (all: number[], withTotal = true) =>
  jest.fn(async ({ page = 1, pageSize = 100 }: PageParams) => {
    const items = all.slice((page - 1) * pageSize, page * pageSize);
    return withTotal ? { items, total: all.length } : { items };
  });

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe('paginate', () => {
  it('walks every page and stops at the short one', async () => {
    const fetchPage = pagesOf(range(5));

    expect(await fetchAll(fetchPage, { pageSize: 2 })).toEqual(range(5));
    expect(fetchPage.mock.calls.map(([p]) => p.page)).toEqual([1, 2, 3]);
  });

  it('stops on total without requesting an empty trailing page', async () => {
    const fetchPage = pagesOf(range(4));

    await fetchAll(fetchPage, { pageSize: 2 });

    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('stops on an empty page when the API reports no total', async () => {
    const fetchPage = pagesOf(range(4), false);

    expect(await fetchAll(fetchPage, { pageSize: 2 })).toEqual(range(4));
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('keeps the caller filters and defaults pageSize to 100', async () => {
    const fetchPage = jest.fn(async (_params: PageParams & { status: string }) => ({ items: [1], total: 1 }));

    await fetchAll(fetchPage, { status: 'PAID' });

    expect(fetchPage).toHaveBeenCalledWith({ status: 'PAID', page: 1, pageSize: 100 });
  });

  it('fetches lazily — breaking out early skips later pages', async () => {
    const fetchPage = pagesOf(range(10));

    for await (const item of paginate(fetchPage, { pageSize: 2 })) {
      if (item === 1) {
        break;
      }
    }

    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
