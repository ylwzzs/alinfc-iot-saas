import { getAlipayClient } from './client';

/**
 * 查询设备日维度明细数据 - 单页
 */
export async function queryDeviceMetricsPage(
  appAuthToken: string,
  metricsDate: string,
  pageNum: number,
  pageSize: number,
  options?: {
    snList?: string[];
    storeId?: string;
  }
): Promise<{
  count: number;
  pageNum: number;
  pageSize: number;
  data: Record<string, unknown>[];
}> {
  const client = getAlipayClient();
  const bizContent: Record<string, unknown> = {
    metrics_date: metricsDate,
    page_num: pageNum,
    page_size: pageSize,
  };

  if (options?.snList && options.snList.length > 0) {
    bizContent.sn_list = options.snList;
  }
  if (options?.storeId) {
    bizContent.store_id = options.storeId;
  }

  const result = await client.exec(
    'alipay.commerce.operation.ndevice.metricsforday.batchquery',
    bizContent,
    { appAuthToken }
  );

  const response = (result as Record<string, Record<string, unknown>>)
    .alipay_commerce_operation_ndevice_metricsforday_batchquery_response;

  if (!response || response.code !== '10000') {
    throw new Error(`查询设备数据失败: ${response?.msg || response?.sub_msg || '未知错误'}`);
  }

  return {
    count: response.count as number,
    pageNum: response.page_num as number,
    pageSize: response.page_size as number,
    data: (response.data as Record<string, unknown>[]) || [],
  };
}

/**
 * 查询设备日维度明细数据 - 全量分页遍历
 * @returns 所有页的数据汇总
 */
export async function queryDeviceMetricsAll(
  appAuthToken: string,
  metricsDate: string,
  options?: {
    snList?: string[];
    storeId?: string;
    onProgress?: (current: number, total: number) => void;
    delayMs?: number;
  }
): Promise<Record<string, unknown>[]> {
  const allData: Record<string, unknown>[] = [];
  let pageNum = 1;
  const pageSize = 1000;
  let totalCount = 0;
  const delayMs = options?.delayMs || 200;

  // 先查询第一页获取总数
  const firstPage = await queryDeviceMetricsPage(appAuthToken, metricsDate, pageNum, pageSize, options);
  totalCount = firstPage.count;
  allData.push(...firstPage.data);
  options?.onProgress?.(firstPage.data.length, totalCount);

  // 继续查询后续页
  const totalPages = Math.ceil(totalCount / pageSize);
  for (pageNum = 2; pageNum <= totalPages; pageNum++) {
    await sleep(delayMs);
    const page = await queryDeviceMetricsPage(appAuthToken, metricsDate, pageNum, pageSize, options);
    allData.push(...page.data);
    options?.onProgress?.(allData.length, totalCount);
  }

  return allData;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
