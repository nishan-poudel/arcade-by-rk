import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios'
import { appConfig } from '../config'

/** Only emit diagnostic logs in non-production environments. */
const devLog = (...args: unknown[]) => {
  if (appConfig.isDev) { console.error(...args) }
}

/**
 * API Client
 *
 * Centralized Axios instance with interceptors for request/response handling.
 */

class ApiClient {
  private instance: AxiosInstance

  constructor(baseURL: string) {
    this.instance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        // TODO: Add auth token when backend is ready
        return config
      },
      (error) => Promise.reject(error),
    )

    // Response interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          devLog('[api] 401 Unauthorized')
        }
        if (error.response?.status === 403) {
          devLog('[api] 403 Forbidden')
        }
        if (error.response?.status === 500) {
          devLog('[api] 500 Server error')
        }
        return Promise.reject(error)
      },
    )
  }

  async get<T>(url: string) {
    return this.instance.get<T>(url)
  }

  async post<T>(url: string, data?: unknown) {
    return this.instance.post<T>(url, data)
  }

  async put<T>(url: string, data?: unknown) {
    return this.instance.put<T>(url, data)
  }

  async patch<T>(url: string, data?: unknown) {
    return this.instance.patch<T>(url, data)
  }

  async delete<T>(url: string) {
    return this.instance.delete<T>(url)
  }
}

export const apiClient = new ApiClient(appConfig.apiBaseUrl)
