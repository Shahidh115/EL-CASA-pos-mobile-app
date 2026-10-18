import { handleLocalApi } from '@/services/apiBridge'

export const api = {
  get: async <T = any>(url: string, config?: { params?: any }): Promise<{ data: T }> => {
    try {
      const res = await handleLocalApi('GET', url, undefined, config?.params)
      return { data: { data: res } as any }
    } catch (err: any) {
      return Promise.reject({
        message: err.message || 'Error occurred',
        data: err.data,
      })
    }
  },

  post: async <T = any>(url: string, data?: any): Promise<{ data: T }> => {
    try {
      const res = await handleLocalApi('POST', url, data)
      return { data: { data: res } as any }
    } catch (err: any) {
      return Promise.reject({
        message: err.message || 'Error occurred',
        data: err.data,
      })
    }
  },

  put: async <T = any>(url: string, data?: any): Promise<{ data: T }> => {
    try {
      const res = await handleLocalApi('PUT', url, data)
      return { data: { data: res } as any }
    } catch (err: any) {
      return Promise.reject({
        message: err.message || 'Error occurred',
        data: err.data,
      })
    }
  },

  delete: async <T = any>(url: string): Promise<{ data: T }> => {
    try {
      const res = await handleLocalApi('DELETE', url)
      return { data: { data: res } as any }
    } catch (err: any) {
      return Promise.reject({
        message: err.message || 'Error occurred',
        data: err.data,
      })
    }
  },
}

export async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const response = await promise
  return (response.data as any).data ?? response.data
}
