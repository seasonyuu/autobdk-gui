import type { ApprovalItem } from '../../types';
import { parseTimestamp } from '../../utils/date';

/**
 * 补签执行器
 * 负责执行补签流程
 */
export class CheckinExecutor {
  constructor(private csrf: string) {}

  /**
   * 执行补签流程
   * @param items 补签项列表
   * @param onProgress 进度回调函数
   */
  async execute(
    items: ApprovalItem[],
    onProgress: (index: number, item: ApprovalItem) => void
  ): Promise<void> {
    // 1. 获取补签配置
    const signResult = await (window as any).electronAPI?.newSignAgain?.(this.csrf);

    if (!signResult?.success || !signResult.data) {
      throw new Error(signResult?.error || '获取补签配置失败');
    }

    const config = signResult.data;

    // 2. 逐个提交补签
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 更新状态为处理中
      item.status = 'processing';
      onProgress(i, item);

      // 提交补签申请
      await this.submitApproval(item, config);

      // 通知进度更新
      onProgress(i, item);

      // 等待10秒（除了最后一项）
      if (i < items.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }

  /**
   * 提交单个补签申请
   */
  private async submitApproval(item: ApprovalItem, config: any): Promise<void> {
    const { year, month, day } = parseTimestamp(item.timestamp);

    const approval = {
      flow_type: config.flow_type,
      flowSettingId: config.flowSettingId,
      departmentId: config.departmentList[0].departmentId,
      date: `${Math.floor(new Date(year, month - 1, day, 0, 0, 0).getTime() / 1000)}`,
      start_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${item.time}`,
      timeRangeId: item.rangeId,
      bdkDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      clockType: item.clockType,
    };

    // 重试逻辑（最多5次）
    let lastError: string | undefined;

    for (let retry = 0; retry < 5; retry++) {
      const result = await (window as any).electronAPI?.startAttendanceApproval?.(
        this.csrf,
        approval
      );

      if (result?.success) {
        item.status = 'success';
        return;
      } else {
        lastError = result?.error || '未知错误';

        // 如果不是"重复提交"错误，直接失败
        if (!lastError.includes('重复提交')) {
          item.status = 'error';
          item.error = lastError;
          return;
        }

        // 如果是"重复提交"，继续重试
      }
    }

    // 所有重试都失败
    item.status = 'error';
    item.error = lastError || '重复提交多次失败';
  }
}
