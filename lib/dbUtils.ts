// Database query optimization utilities

import { Prisma } from "@prisma/client";

// Common select fields to reduce payload size
export const userSelectFields: Prisma.UserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  enrollmentId: true,
  createdAt: true,
};

export const courseSelectFields: Prisma.CourseSelect = {
  id: true,
  code: true,
  name: true,
  credits: true,
  department: true,
  level: true,
  description: true,
  isActive: true,
};

export const programSelectFields: Prisma.ProgramSelect = {
  id: true,
  name: true,
  code: true,
  type: true,
  totalCreditsRequired: true,
  icCredits: true,
  dcCredits: true,
  deCredits: true,
  feCredits: true,
  mtpIstpCredits: true,
};

// Pagination helper
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function getPaginationParams(params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// Batch operations helper
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

// Transaction helper with retry
export async function withTransaction<T>(
  operation: (tx: any) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // This would use prisma.$transaction in actual implementation
      return await operation(null);
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on specific errors (deadlocks, timeouts)
      const isRetryable = 
        error instanceof Error &&
        (error.message.includes("deadlock") || 
         error.message.includes("timeout"));

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 100)
      );
    }
  }

  throw lastError;
}

// Cache key generator
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join(",");
  return `${prefix}:${sortedParams}`;
}

// Search query builder
export function buildSearchQuery(searchTerm: string, fields: string[]) {
  if (!searchTerm) return {};

  const conditions = fields.map(field => ({
    [field]: {
      contains: searchTerm,
      mode: "insensitive" as Prisma.QueryMode,
    },
  }));

  return { OR: conditions };
}

// Date range filter builder
export function buildDateRangeFilter(
  field: string,
  startDate?: Date,
  endDate?: Date
) {
  const filter: any = {};

  if (startDate) {
    filter.gte = startDate;
  }

  if (endDate) {
    filter.lte = endDate;
  }

  return Object.keys(filter).length > 0 ? { [field]: filter } : {};
}
