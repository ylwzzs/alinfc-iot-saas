/**
 * 任务队列模块
 * 基于 Redis 的简单任务队列
 */
import { cache } from '../cache';
import { logger } from '../logger';

export interface Task {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: number;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

export type TaskHandler = (task: Task) => Promise<void>;

class TaskQueue {
  private queueKey = 'task:queue';
  private processingKey = 'task:processing';
  private handlers: Map<string, TaskHandler> = new Map();
  private isRunning = false;
  private pollInterval = 1000; // 1 秒轮询

  /**
   * 注册任务处理器
   */
  register(type: string, handler: TaskHandler): void {
    this.handlers.set(type, handler);
    logger.info('QUEUE', `任务处理器已注册: ${type}`);
  }

  /**
   * 添加任务
   */
  async add(
    type: string,
    payload: Record<string, unknown>,
    options: { priority?: number; maxRetries?: number } = {}
  ): Promise<string> {
    const task: Task = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type,
      payload,
      priority: options.priority || 0,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
    };

    // 按优先级添加到队列（使用 Redis sorted set）
    const client = (cache as any).client;
    await client.zAdd(`${cache['key']('')}${this.queueKey}`, [
      { score: -task.priority, value: JSON.stringify(task) },
    ]);

    logger.debug('QUEUE', `任务已添加: ${task.id}`, { type, priority: task.priority });
    return task.id;
  }

  /**
   * 获取下一个任务
   */
  private async pop(): Promise<Task | null> {
    const client = (cache as any).client;
    const key = `${cache['key']('')}${this.queueKey}`;

    // 获取优先级最高的任务
    const results = await client.zRange(key, 0, 0);
    if (results.length === 0) return null;

    const taskStr = results[0];
    // 从队列移除
    await client.zRem(key, taskStr);

    const task = JSON.parse(taskStr) as Task;
    return task;
  }

  /**
   * 处理单个任务
   */
  private async processTask(task: Task): Promise<boolean> {
    const handler = this.handlers.get(task.type);
    if (!handler) {
      logger.error('QUEUE', `未找到任务处理器: ${task.type}`, { taskId: task.id });
      return false;
    }

    try {
      await handler(task);
      logger.info('QUEUE', `任务完成: ${task.id}`, { type: task.type });
      return true;
    } catch (error) {
      task.retryCount++;
      const err = error as Error;

      logger.error('QUEUE', `任务失败: ${task.id}`, {
        type: task.type,
        retryCount: task.retryCount,
        error: err.message,
      });

      // 重试逻辑
      if (task.retryCount < task.maxRetries) {
        // 延迟重试（指数退避）
        const delay = Math.pow(2, task.retryCount) * 1000;
        setTimeout(() => {
          this.add(task.type, task.payload, {
            priority: task.priority,
            maxRetries: task.maxRetries,
          });
        }, delay);
        return false;
      }

      // 记录失败任务
      await this.recordFailedTask(task, err);
      return false;
    }
  }

  /**
   * 记录失败任务
   */
  private async recordFailedTask(task: Task, error: Error): Promise<void> {
    const client = (cache as any).client;
    const key = `${cache['key']('')}task:failed`;

    await client.lPush(key, JSON.stringify({
      task,
      error: error.message,
      failedAt: Date.now(),
    }));
  }

  /**
   * 启动队列处理
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('QUEUE', '队列处理器已启动');
    this.loop();
  }

  /**
   * 停止队列处理
   */
  stop(): void {
    this.isRunning = false;
    logger.info('QUEUE', '队列处理器已停止');
  }

  /**
   * 处理循环
   */
  private async loop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const task = await this.pop();
      if (task) {
        await this.processTask(task);
      }
    } catch (error) {
      logger.error('QUEUE', '队列处理错误', { error: (error as Error).message });
    }

    // 继续下一轮
    setTimeout(() => this.loop(), this.pollInterval);
  }

  /**
   * 获取队列统计
   */
  async stats(): Promise<{ pending: number; handlers: string[] }> {
    const client = (cache as any).client;
    const key = `${cache['key']('')}${this.queueKey}`;

    const pending = await client.zCard(key);
    return {
      pending,
      handlers: Array.from(this.handlers.keys()),
    };
  }
}

export const queue = new TaskQueue();
export default queue;
