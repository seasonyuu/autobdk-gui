import type { ApprovalItem } from '../../types';
import { AttendanceAnalyzer } from './analyzer';
import { CheckinDialog } from './ui';
import { CheckinExecutor } from './executor';

/**
 * 一键打卡管理器
 * 负责协调分析、UI显示和执行补签的整个流程
 */
export class CheckinManager {
  private dialog: CheckinDialog;
  private items: ApprovalItem[] = [];
  private isProcessing = false;

  constructor(
    dialogElement: HTMLDivElement,
    titleElement: HTMLHeadingElement,
    contentElement: HTMLDivElement,
    private csrf: string,
    private yearmo: string,
    private onRefreshCalendar: () => Promise<void>
  ) {
    this.dialog = new CheckinDialog(dialogElement, titleElement, contentElement);
  }

  /**
   * 启动一键打卡流程
   */
  async start(): Promise<void> {
    // 重置状态
    this.items = [];
    this.isProcessing = false;

    // 打开对话框
    this.dialog.show();
    this.dialog.setTitle('一键打卡');
    this.dialog.showLoading();

    try {
      // 分析考勤数据
      const analyzer = new AttendanceAnalyzer(this.csrf, this.yearmo);
      this.items = await analyzer.analyze();

      console.log('Found', this.items.length, 'items to approve');

      // 显示预览
      this.dialog.showPreview(
        this.items,
        () => this.executeCheckin(),
        () => this.dialog.hide()
      );
    } catch (error) {
      console.error('Failed to analyze attendance:', error);
      this.dialog.showError(
        '分析考勤数据失败',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 执行补签流程
   */
  private async executeCheckin(): Promise<void> {
    if (this.isProcessing || this.items.length === 0) return;

    this.isProcessing = true;

    // 更新对话框标题和显示
    this.dialog.setTitle('正在补签...');
    this.dialog.showProgress(this.items);

    try {
      // 创建执行器并执行
      const executor = new CheckinExecutor(this.csrf);

      await executor.execute(this.items, (index, item) => {
        this.dialog.updateItem(index, item);
      });

      // 显示结果
      this.dialog.setTitle('补签结果');
      this.dialog.showResult(
        this.items,
        () => this.dialog.hide(),
        async () => {
          this.dialog.hide();
          await this.onRefreshCalendar();
        }
      );
    } catch (error) {
      console.error('Approval process error:', error);
      this.dialog.showError(
        '补签过程出错',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 检查是否正在处理
   */
  isRunning(): boolean {
    return this.isProcessing;
  }
}
