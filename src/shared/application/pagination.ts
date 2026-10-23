export type PageRequest = {
  page: number;
  limit: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function paginate<T>(
  items: T[],
  total: number,
  request: PageRequest,
): Paginated<T> {
  return {
    items,
    total,
    page: request.page,
    limit: request.limit,
    totalPages: Math.max(1, Math.ceil(total / request.limit)),
  };
}
