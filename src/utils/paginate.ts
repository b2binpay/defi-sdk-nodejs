export const DEFAULT_PAGE_SIZE = 100;

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  total?: number;
}

/**
 * Iterates every item of a paginated list, fetching pages lazily. Starts at `params.page` (default 1)
 * and stops at the first short or empty page, or once `total` items have been yielded.
 *
 * ```ts
 * for await (const invoice of paginate((p) => client.getInvoices(p), { statuses: [InvoiceStatus.Paid] })) { … }
 * ```
 */
export async function* paginate<P extends PageParams & object, T>(
  fetchPage: (params: NoInfer<P> & Required<PageParams>) => Promise<Page<T>>,
  params: P,
): AsyncGenerator<T, void, undefined> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  let page = params.page ?? 1;
  let yielded = 0;

  while (true) {
    const { items, total } = await fetchPage({ ...params, page, pageSize });
    yield* items;
    yielded += items.length;

    const isLastPage = items.length < pageSize || (total !== undefined && yielded >= total);
    if (isLastPage) {
      return;
    }
    page++;
  }
}

/** Collects every item of a paginated list into an array. Prefer `paginate` for large lists. */
export async function fetchAll<P extends PageParams & object, T>(
  fetchPage: (params: NoInfer<P> & Required<PageParams>) => Promise<Page<T>>,
  params: P,
): Promise<T[]> {
  const items: T[] = [];
  for await (const item of paginate(fetchPage, params)) {
    items.push(item);
  }
  return items;
}
