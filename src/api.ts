import http from 'got';
import { createHash } from 'crypto';

const XRXS_URL = 'https://e.xinrenxinshi.com';

interface IEnvelope<T> {
  code: number;
  data: T;
  message: string;
  status: boolean;
}

interface ICommon {
  companyName: string;
  employeeName: string;
  csrf: string;
  redirect?: String;
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

  const { data } = await http.get(`${XRXS_URL}/env/ajax-common`, {
    headers: {
      Cookie: cookie,
    },
    searchParams: {
      timestamp,
      app_key: appKey,
      sign_method: 'md5',
      version,
      sign,
    },
  }).json() as IEnvelope<ICommon>;
  return data;
}

export interface ICredential {
  'Cookie': string;
  'X-CSRF-TOKEN': string;
}

export enum IAttendanceRecordMonthStatus {
  CURRENT = 0,
  NOT_CURRENT = -1,
}

export enum IAttendanceRecordSituation {
  NORMAL = 0,
  WARNING = -1,
}

interface IAttendanceRecordList {
  attandanceArchive: {
    begin: string;
    end: string;
    yearmo: string;
  };
  attendanceStatistics: {
    absentNum: number;
    lateNum: number;
    leaveEarlyNum: number;
    leaveOrOut: number;
    noWorkdayNum: number;
  };
  bdkUrl: string;
  isShowClockTime: boolean;
  records: {
    clockName: string | null;
    clockSettingId: number;
    containsData: number;
    date: number;
    detailInfo: null;
    isClocking: number;
    isToday: number;
    isWorkday: number;
    lunarShow: string | null;
    monthStatus: IAttendanceRecordMonthStatus;
    situation: IAttendanceRecordSituation;
    time: number;
  }[];
  schedulingType: number;
  showClockTime: boolean;
}

export async function getAttendanceRecordList(cred: ICredential, yearmo = ''): Promise<IAttendanceRecordList> {
  const { data } = await http.post(`${XRXS_URL}/attendance/ajax-get-attendance-record-list`, {
    headers: {
      ...cred,
    },
    form: {
      yearmo,
    },
  }).json() as IEnvelope<IAttendanceRecordList>;
  return data;
}

export enum IAttendanceClockType {
  上班 = 1,
  下班 = 2,
}

export interface IAttendanceRecord {
  bdkErrorMessage: null;
  bdkStatus: number;
  isFinish: number;
  isShowClockTime: number;
  signTimeList: {
    clockAttribution: IAttendanceClockType;
    clockTime: string;  // "12:45"
    rangeId: string;
    rangeName: keyof typeof IAttendanceClockType;
    statusDesc: string;  // 空字符串时表示没异常
  }[];
  situationDesc: null;
  timeRanges: {
    startingTime: string;  // "09:00"
    closingTime: string;
  }[];
}

// date: 20210826
export async function getAttendanceRecordByDate(cred: ICredential, date: string): Promise<IAttendanceRecord> {
  const { data } = await http.post(`${XRXS_URL}/attendance/ajax-get-attendance-record-by-date`, {
    headers: {
      ...cred,
    },
    form: {
      date,
    },
  }).json() as IEnvelope<IAttendanceRecord>;
  return data;
}

interface IApproveBdkFlow {
  flowSid: string;
  flowTypeName: string;
  isFinish: number;
  startDate: number;  // 1630407600
}

// date: 1630252800
export async function getApproveBdkFlow(cred: ICredential, date: string): Promise<IApproveBdkFlow[]> {
  const { data } = await http.post(`${XRXS_URL}/attendance/ajax-get-approve-bdk-flow`, {
    headers: {
      ...cred,
    },
    form: {
      date,
    },
  }).json() as IEnvelope<IApproveBdkFlow[]>;
  return data;
}

interface INewSignAgain {
  departmentList: {
    departmentId: string;
    departmentName: string;
  }[];
  flowSettingId: number;
  flow_type: number;  // 6
  flow_type_desc: string;  // "补卡"
}

export async function newSignAgain(cred: ICredential): Promise<INewSignAgain> {
  const { data } = await http.post(`${XRXS_URL}/attendance/ajax-new-sign-again`, {
    headers: {
      ...cred,
    },
  }).json() as IEnvelope<INewSignAgain>;
  return data;
}

export interface IAttendanceApproval {
  flow_type: number;
  flowSettingId: number;
  departmentId: string;
  date: string;  // "1630425600"
  start_date: string;  // "2021-09-01 10:00"
  timeRangeId: string;
  bdkDate: string;  // "2021-09-01"
  clockType: IAttendanceClockType,
}

// data: {"flow_type":6,"flowSettingId":2880415,"departmentId":"5aeccaaec68a4dcc91029f1d84621319","isClocking":0,"date":"1630425600","start_date":"2021-09-01 10:00","reason":"","image_path":"","timeRangeId":"2027489","bdkDate":"2021-09-01","clockType":1,"rangeModels":[],"custom_field":"[]"}
// data: {"flow_type":6,"flowSettingId":2880415,"departmentId":"5aeccaaec68a4dcc91029f1d84621319","isClocking":0,"date":"1630857600","start_date":"2021-09-06 19:00","reason":"","image_path":"","timeRangeId":"2027489","bdkDate":"2021-09-06","clockType":2,"rangeModels":[],"custom_field":"[]"}

export async function startAttendanceApproval(cred: ICredential, approval: IAttendanceApproval): Promise<string | undefined> {
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
    custom_field: "[]"
  });
  const { status, message } = await http.post(`${XRXS_URL}/attendance/ajax-start-attendance-approval`, {
    headers: {
      ...cred,
    },
    form: {
      data,
    },
  }).json() as IEnvelope<{}>;
  return status ? undefined : message;
}
