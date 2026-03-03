/**
 * TypeScript Type Definitions
 *
 * Shared types used across the application.
 */

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  message: string
  code: string
  status: number
  details?: Record<string, unknown>
}

export interface RequestMetadata {
  loading: boolean
  error: ApiError | null
  lastFetch: number | null
}
