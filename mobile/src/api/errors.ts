export const NETWORK_ERROR_MESSAGE =
  'Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ máy chủ.';
export const TIMEOUT_ERROR_MESSAGE =
  'Máy chủ phản hồi quá lâu. Vui lòng thử lại.';

/** Error thrown by every API call. `message` is always Vietnamese text for the UI. */
export class ApiError extends Error {
  /** HTTP status, or 0 for network errors / timeouts. */
  readonly status: number;
  /** Machine code from the backend (`detail`), e.g. "username_taken", or "network" / "timeout". */
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function fallbackMessage(status: number): string {
  if (status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (status === 403) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }
  if (status === 404) {
    return 'Không tìm thấy dữ liệu.';
  }
  if (status === 409) {
    return 'Dữ liệu bị trùng.';
  }
  if (status === 413) {
    return 'Ảnh quá lớn.';
  }
  if (status === 422 || status === 400) {
    return 'Dữ liệu không hợp lệ.';
  }
  if (status >= 500) {
    return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  }
  return `Có lỗi xảy ra (mã ${status}).`;
}

/** Turns any thrown value into a Vietnamese message for the UI. */
export function errorMessage(
  error: unknown,
  fallback = 'Có lỗi xảy ra. Vui lòng thử lại.',
): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}
