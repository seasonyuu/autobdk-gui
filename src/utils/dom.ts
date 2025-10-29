/**
 * 转义 HTML 字符串
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 切换下拉菜单显示状态
 */
export function toggleDropdown(
  dropdown: HTMLElement,
  otherDropdowns: HTMLElement[]
): void {
  // 关闭其他下拉菜单
  otherDropdowns.forEach((d) => d.classList.add('hidden'));

  // 切换当前下拉菜单
  dropdown.classList.toggle('hidden');
}

/**
 * 关闭所有下拉菜单
 */
export function closeAllDropdowns(dropdowns: HTMLElement[]): void {
  dropdowns.forEach((d) => d.classList.add('hidden'));
}
