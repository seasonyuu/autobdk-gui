import http from 'got';
import { createHash } from 'crypto';
import type {
  IAttendanceApproval,
  IAttendanceRecord,
  IAttendanceRecordList,
  IApproveBdkFlow,
  ICommon,
  INewSignAgain,
} from './types';

export type {
  IAttendanceApproval,
  IAttendanceRecord,
  IAttendanceRecordList,
  IApproveBdkFlow,
  ICommon,
  INewSignAgain,
} from './types';
export {
  AttendanceClockType as IAttendanceClockType,
  AttendanceRecordMonthStatus as IAttendanceRecordMonthStatus,
  AttendanceSituation as IAttendanceRecordSituation,
} from './types';

const XRXS_URL = 'https://e.xinrenxinshi.com';
// 与 WebView 中保持一致的移动端 UA，避免服务端因 UA 不一致而重定向
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

const DEFAULT_HEADERS = {
  'User-Agent': MOBILE_USER_AGENT,
  Referer: `${XRXS_URL}/`,
  'X-Requested-With': 'XMLHttpRequest',
  Accept: 'application/json, text/javascript, */*; q=0.01',
};

interface IEnvelope<T> {
  code: number;
  data: T;
  message: string;
  status: boolean;
}

export async function common(cookie: string): Promise<ICommon> {
  const appKey = 'employee';
  const appSecret = 'b1c057e2a7a34e789eddb5a230164a99';
  const version = '1.0.0';
  const timestamp = Date.now();

  const sign = createHash('md5')
    .update([
      'sign_method', 'md5',
      'timestamp', timestamp,
      'version', version,
      'app_key', appKey,
      appSecret,
    ].join(''))
    .digest('hex');

  const { data } = await http
    .get(`${XRXS_URL}/env/ajax-common`, {
      headers: {
        ...DEFAULT_HEADERS,
        Cookie: cookie,
      },
      searchParams: {
        timestamp,
        app_key: appKey,
        sign_method: 'md5',
        version,
        sign,
      },
    })
    .json() as IEnvelope<ICommon>;
  return data;
}

export interface ICredential {
  'Cookie': string;
  'X-CSRF-TOKEN': string;
}

export async function getAttendanceRecordList(
  cred: ICredential,
  yearmo = ''
): Promise<IAttendanceRecordList> {
  const { data } = await http
    .post(`${XRXS_URL}/attendance/ajax-get-attendance-record-list`, {
      headers: {
        ...DEFAULT_HEADERS,
        ...cred,
      },
      form: {
        yearmo,
      },
    })
    .json() as IEnvelope<IAttendanceRecordList>;
  return data;
}

// date: 20210826
export async function getAttendanceRecordByDate(
  cred: ICredential,
  date: string
): Promise<IAttendanceRecord> {
  const { data } = await http
    .post(`${XRXS_URL}/attendance/ajax-get-attendance-record-by-date`, {
      headers: {
        ...DEFAULT_HEADERS,
        ...cred,
      },
      form: {
        date,
      },
    })
    .json() as IEnvelope<IAttendanceRecord>;
  return data;
}

// date: 1630252800
export async function getApproveBdkFlow(
  cred: ICredential,
  date: string
): Promise<IApproveBdkFlow[]> {
  const { data } = await http
    .post(`${XRXS_URL}/attendance/ajax-get-approve-bdk-flow`, {
      headers: {
        ...DEFAULT_HEADERS,
        ...cred,
      },
      form: {
        date,
      },
    })
    .json() as IEnvelope<IApproveBdkFlow[]>;
  return data;
}

export async function newSignAgain(cred: ICredential): Promise<INewSignAgain> {
  const { data } = await http
    .post(`${XRXS_URL}/attendance/ajax-new-sign-again`, {
      headers: {
        ...DEFAULT_HEADERS,
        ...cred,
      },
    })
    .json() as IEnvelope<INewSignAgain>;
  return data;
}

// data: {"flow_type":6,"flowSettingId":2880415,"departmentId":"5aeccaaec68a4dcc91029f1d84621319","isClocking":0,"date":"1630425600","start_date":"2021-09-01 10:00","reason":"","image_path":"","timeRangeId":"2027489","bdkDate":"2021-09-01","clockType":1,"rangeModels":[],"custom_field":"[]"}
// data: {"flow_type":6,"flowSettingId":2880415,"departmentId":"5aeccaaec68a4dcc91029f1d84621319","isClocking":0,"date":"1630857600","start_date":"2021-09-06 19:00","reason":"","image_path":"","timeRangeId":"2027489","bdkDate":"2021-09-06","clockType":2,"rangeModels":[],"custom_field":"[]"}

export async function startAttendanceApproval(
  cred: ICredential,
  approval: IAttendanceApproval
): Promise<string | undefined> {
  const data = JSON.stringify({
    flow_type: approval.flow_type,
    flowSettingId: approval.flowSettingId,
    departmentId: approval.departmentId,
    isClocking: 0,
    date: approval.date,
    start_date: approval.start_date,
    reason: '',
    image_path: '',
    timeRangeId: approval.timeRangeId,
    bdkDate: approval.bdkDate,
    clockType: approval.clockType,
    rangeModels: [],
    custom_field: '[]',
  });
  const { status, message } = await http
    .post(`${XRXS_URL}/attendance/ajax-start-attendance-approval`, {
      headers: {
        ...DEFAULT_HEADERS,
        ...cred,
      },
      form: {
        data,
      },
    })
    .json() as IEnvelope<Record<string, never>>;
  return status ? undefined : message;
}
