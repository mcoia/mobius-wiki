/**
 * Response Wrapper Utilities
 *
 * Provides consistent response formatting across all API endpoints.
 * All endpoints should return wrapped responses for consistency.
 */

/**
 * Wrap single resource response
 * @param data - The resource to wrap
 * @returns Wrapped response with data property
 * @example
 * const wiki = { id: 1, title: 'My Wiki' };
 * return wrapData(wiki);
 * // Returns: { data: { id: 1, title: 'My Wiki' } }
 */
export function wrapData<T>(data: T): { data: T } {
  return { data };
}

/**
 * Wrap collection response with metadata
 * @param data - The array of resources to wrap
 * @param total - Optional total count (defaults to array length)
 * @returns Wrapped response with data and meta properties
 * @example
 * const wikis = [{ id: 1, title: 'Wiki 1' }, { id: 2, title: 'Wiki 2' }];
 * return wrapCollection(wikis);
 * // Returns: { data: [...], meta: { total: 2 } }
 */
export function wrapCollection<T>(
  data: T[],
  total?: number
): { data: T[]; meta: { total: number } } {
  return {
    data,
    meta: { total: total ?? data.length }
  };
}
