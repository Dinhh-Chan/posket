/** Client-side checks mirroring the backend rules (API.md "Auth"). */

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameError(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length === 0) {
    return 'Nhập tên người dùng';
  }
  if (u.length < 3 || u.length > 20) {
    return 'Tên người dùng dài 3–20 ký tự';
  }
  if (!/^[a-z0-9_.]+$/.test(u)) {
    return 'Chỉ dùng chữ thường không dấu, số, dấu _ và .';
  }
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < 6) {
    return 'Mật khẩu cần ít nhất 6 ký tự';
  }
  return null;
}

export function displayNameError(name: string): string | null {
  const n = name.trim();
  if (n.length === 0) {
    return 'Nhập tên hiển thị';
  }
  if (n.length > 40) {
    return 'Tên hiển thị tối đa 40 ký tự';
  }
  return null;
}
