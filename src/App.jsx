import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from "recharts";
import Papa from "papaparse";
import {
  LayoutDashboard, Users, ListChecks, Target, FileSpreadsheet, Settings as SettingsIcon,
  Search, Plus, X, Pencil, Trash2, RefreshCw, Upload, Download, AlertTriangle, Clock,
  ChevronRight, ArrowUpRight, ArrowDownRight, Check, StickyNote, Briefcase, Wallet, Calendar, PhoneCall, Building2
} from "lucide-react";
import * as db from "./lib/db";

/* ============================== 定数定義 ============================== */

/* 事業（プロセルエージェント／プロセルチャレンジ）。データは事業ごとに完全に分離して管理する。 */
const SERVICE_CONFIG = {
  agent: { id: "agent", name: "プロセルエージェント", tagline: "人材紹介事業", color: "#4F46E5" },
  challenge: { id: "challenge", name: "プロセルチャレンジ", tagline: "人材紹介事業", color: "#0D9488" },
};
const SERVICE_ORDER = ["agent", "challenge"];

/* 求職者ステータス：未面談（追客）→面談済み（応募先で管理）→クローズ（本人都合で終了） */
const CANDIDATE_STATUS_CONFIG = {
  new:         { label: "新規登録",                 phase: "pre",    color: "#64748B" },
  contacting:  { label: "連絡中",                   phase: "pre",    color: "#2563EB" },
  scheduling:  { label: "日程調整中",               phase: "pre",    color: "#7C3AED" },
  reschedule:  { label: "リスケ",                   phase: "pre",    color: "#D97706" },
  unreachable: { label: "連絡不通",                 phase: "pre",    color: "#DC2626" },
  interviewed: { label: "面談済み（応募先管理中）", phase: "active", color: "#0D9488" },
  withdrawn:   { label: "求職活動終了（本人都合）", phase: "closed", color: "#9CA3AF" },
};
const CANDIDATE_STATUS_ORDER = ["new", "contacting", "scheduling", "reschedule", "unreachable", "interviewed", "withdrawn"];
const CANDIDATE_PHASE_ORDER = ["pre", "active", "closed"];
const CANDIDATE_PHASE_LABEL = { pre: "未面談（追客中）", active: "面談済み", closed: "クローズ" };
const CANDIDATE_PHASE_BADGE_CLASS = {
  pre: "bg-amber-50 text-amber-700 border border-amber-200",
  active: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  closed: "bg-gray-100 text-gray-600 border border-gray-200",
};

/* 応募先（エントリー）ステータス：応募先ごとに選考の通過／お見送りを管理 */
const APPLICATION_STATUS_CONFIG = {
  entry:                { label: "エントリー",              category: "open", color: "#64748B" },
  documentScreening:    { label: "書類選考中",              category: "open", color: "#2563EB" },
  documentPassed:       { label: "書類選考通過",            category: "open", color: "#0891B2" },
  documentFailed:       { label: "書類選考NG（お見送り）",  category: "lost", color: "#EF4444" },
  interview1Scheduling: { label: "一次面接調整中",          category: "open", color: "#7C3AED" },
  interview1Passed:     { label: "一次面接通過",            category: "open", color: "#6D28D9" },
  interview1Failed:     { label: "一次面接NG（お見送り）",  category: "lost", color: "#EF4444" },
  interview2Scheduling: { label: "二次面接調整中",          category: "open", color: "#4338CA" },
  interview2Passed:     { label: "二次面接通過",            category: "open", color: "#3730A3" },
  interview2Failed:     { label: "二次面接NG（お見送り）",  category: "lost", color: "#EF4444" },
  finalScheduling:      { label: "最終面接調整中",          category: "open", color: "#312E81" },
  finalFailed:          { label: "最終面接NG（お見送り）",  category: "lost", color: "#EF4444" },
  offer:                { label: "内定",                    category: "won",  color: "#16A34A" },
  offerAccepted:        { label: "内定承諾",                category: "won",  color: "#15803D" },
  hired:                { label: "入社済み（成約）",        category: "won",  color: "#065F46" },
  declinedByCandidate:  { label: "辞退（候補者都合）",      category: "lost", color: "#9CA3AF" },
  rejected:             { label: "お見送り（その他）",      category: "lost", color: "#F59E0B" },
};
const APPLICATION_STATUS_ORDER = [
  "entry", "documentScreening", "documentPassed", "documentFailed",
  "interview1Scheduling", "interview1Passed", "interview1Failed",
  "interview2Scheduling", "interview2Passed", "interview2Failed",
  "finalScheduling", "finalFailed",
  "offer", "offerAccepted", "hired",
  "declinedByCandidate", "rejected",
];
const APPLICATION_CATEGORY_ORDER = ["open", "won", "lost"];
const APPLICATION_CATEGORY_LABEL = { open: "選考中", won: "成約", lost: "お見送り・辞退" };

const SOURCE_OPTIONS = ["LP", "Indeed", "求人ボックス", "送客サービス", "SNS"];

/* 企業からの問い合わせ（人材紹介依頼・商談）管理 */
const INQUIRY_TYPE_OPTIONS = ["人材紹介契約", "協業", "営業活動", "クレーム"];
const INQUIRY_TYPE_COLOR = {
  "人材紹介契約": "#4F46E5",
  "協業": "#0D9488",
  "営業活動": "#64748B",
  "クレーム": "#DC2626",
};
const INQUIRY_STATUS_CONFIG = {
  inquiry: { label: "問い合わせ", color: "#64748B" },
  scheduling: { label: "日程調整中", color: "#7C3AED" },
  meetingConfirmed: { label: "商談確定", color: "#4338CA" },
  meetingDone: { label: "商談実施済", color: "#0891B2" },
  contractSent: { label: "契約書送付済", color: "#D97706" },
  cloudSignSent: { label: "クラウドサイン送付済", color: "#EA580C" },
  contractSigned: { label: "契約締結済", color: "#16A34A" },
  jobCreated: { label: "求人作成済", color: "#065F46" },
};
const INQUIRY_STATUS_ORDER = [
  "inquiry", "scheduling", "meetingConfirmed", "meetingDone",
  "contractSent", "cloudSignSent", "contractSigned", "jobCreated",
];
const DEFAULT_CONSULTANTS = ["佐藤", "鈴木", "高橋"];

const GENDER_OPTIONS = ["男性", "女性", "その他", "回答しない"];
/* ヨミ（成約可能性の見立て）：A=高い、B=中程度、C=低い */
const YOMI_CONFIG = {
  A: { label: "A", color: "#16A34A" },
  B: { label: "B", color: "#D97706" },
  C: { label: "C", color: "#94A3B8" },
};
const YOMI_ORDER = ["A", "B", "C"];
const AGE_OPTIONS = Array.from({ length: 53 }, (_, i) => 18 + i); // 18歳〜70歳
const EDUCATION_OPTIONS = ["中卒", "高卒", "専門卒", "短大卒", "大卒", "大学院卒"];
const EMPLOYMENT_STATUS_OPTIONS = ["現職中", "業務委託", "契約社員", "派遣社員", "アルバイト", "無職"];
const YES_NO_OPTIONS = ["あり", "なし"];
const JOIN_TIMING_SUGGESTIONS = ["即日", "1ヶ月以内", "2ヶ月以内", "3ヶ月以内", "3ヶ月以降", "未定"];
const PREFECTURE_OPTIONS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const IMPORT_FIELDS = [
  { key: "name", label: "氏名", required: true, aliases: ["氏名", "名前", "name", "お名前"] },
  { key: "furigana", label: "フリガナ", aliases: ["フリガナ", "ふりがな", "furigana", "かな"] },
  { key: "email", label: "メールアドレス", aliases: ["メール", "email", "mail", "メールアドレス"] },
  { key: "phone", label: "電話番号", aliases: ["電話", "tel", "phone", "電話番号", "携帯"] },
  { key: "registeredDate", label: "登録日", aliases: ["登録日", "応募日", "date", "登録"] },
  { key: "source", label: "流入経路", aliases: ["流入", "経路", "source", "チャネル", "流入経路"] },
  { key: "desiredJobType", label: "希望職種", aliases: ["希望職種", "職種", "job", "希望業種"] },
  { key: "currentCompany", label: "現職", aliases: ["現職", "勤務先", "company", "在籍企業"] },
  { key: "assignedTo", label: "担当者", aliases: ["担当", "担当者", "assign", "コンサルタント"] },
  { key: "status", label: "ステータス", aliases: ["ステータス", "status", "状況", "状態"] },
  { key: "memo", label: "メモ", aliases: ["メモ", "備考", "note", "memo"] },
];

/* 追客リスト専用のCSV項目（スプレッドシートの列構成に合わせたもの） */
const FOLLOWUP_IMPORT_FIELDS = [
  { key: "name", label: "氏名", required: true, aliases: ["氏名", "名前", "name", "お名前"] },
  { key: "appliedDateTime", label: "応募日時", aliases: ["応募日時", "応募日", "date", "登録日時", "登録日"] },
  { key: "age", label: "年齢", aliases: ["年齢", "age"] },
  { key: "gender", label: "性別", aliases: ["性別", "gender"] },
  { key: "phone", label: "電話番号", aliases: ["電話", "tel", "phone", "電話番号", "携帯"] },
  { key: "jobTitle", label: "応募求人（職種）", aliases: ["応募求人", "職種", "job", "求人"] },
  { key: "companyName", label: "応募求人（会社名）", aliases: ["会社名", "企業名", "company"] },
  { key: "source", label: "流入経路", aliases: ["流入", "経路", "source", "チャネル", "流入経路"] },
  { key: "status", label: "選考ステータス", aliases: ["ステータス", "status", "選考ステータス", "状況"] },
];

/* ============================== ユーティリティ ============================== */

function uid(prefix = "c") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function currentMonthKey() { return todayStr().slice(0, 7); }
function monthKeyOf(dateStr) {
  if (!dateStr || typeof dateStr !== "string" || dateStr.length < 7) return null;
  return dateStr.slice(0, 7);
}
function inMonth(dateStr, month) { return !!dateStr && monthKeyOf(dateStr) === month; }
function shiftMonth(monthStr, delta) {
  const [y, m] = (monthStr || currentMonthKey()).split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonthKey(monthStr) { return shiftMonth(monthStr, -1); }

/* ----------------------------- 営業日・祝日カレンダー ----------------------------- */
/* 日本の国民の祝日を計算する（固定日・ハッピーマンデー・春分・秋分・振替休日に対応）。
   春分・秋分は近似計算式のため、概ね2000〜2099年の範囲で正確な値となる。 */

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function vernalEquinoxDay(year) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}
function autumnalEquinoxDay(year) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}
function nthMondayOfMonth(year, month, n) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const firstMonday = firstWeekday === 1 ? 1 : ((8 - firstWeekday) % 7) + 1;
  return firstMonday + (n - 1) * 7;
}

const _holidayCache = {};
function getJapaneseHolidays(year) {
  if (_holidayCache[year]) return _holidayCache[year];
  const holidays = {};
  const add = (m, d, name) => { holidays[`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`] = name; };
  add(1, 1, "元日");
  add(1, nthMondayOfMonth(year, 1, 2), "成人の日");
  add(2, 11, "建国記念の日");
  add(2, 23, "天皇誕生日");
  add(3, vernalEquinoxDay(year), "春分の日");
  add(4, 29, "昭和の日");
  add(5, 3, "憲法記念日");
  add(5, 4, "みどりの日");
  add(5, 5, "こどもの日");
  add(7, nthMondayOfMonth(year, 7, 3), "海の日");
  add(8, 11, "山の日");
  add(9, nthMondayOfMonth(year, 9, 3), "敬老の日");
  add(9, autumnalEquinoxDay(year), "秋分の日");
  add(10, nthMondayOfMonth(year, 10, 2), "スポーツの日");
  add(11, 3, "文化の日");
  add(11, 23, "勤労感謝の日");

  /* 振替休日：祝日が日曜にあたる場合、その後の最初の祝日でない日を休日とする */
  const additions = {};
  Object.keys(holidays).sort().forEach((dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    if (d.getDay() === 0) {
      const next = new Date(d);
      do { next.setDate(next.getDate() + 1); } while (holidays[toISODate(next)] || additions[toISODate(next)]);
      additions[toISODate(next)] = "振替休日";
    }
  });
  const merged = { ...holidays, ...additions };
  _holidayCache[year] = merged;
  return merged;
}

function isBusinessDay(dateStr, customHolidaySet) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (getJapaneseHolidays(d.getFullYear())[dateStr]) return false;
  if (customHolidaySet && customHolidaySet.has(dateStr)) return false;
  return true;
}

function countBusinessDaysInMonth(month, customHolidaySet) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isBusinessDay(dateStr, customHolidaySet)) count++;
  }
  return count;
}

function emptyCustomHoliday() {
  return { id: uid("hol"), startDate: todayStr(), endDate: todayStr(), label: "" };
}
/* カスタム休暇（範囲指定）を、日付ごとのSetに展開する */
function buildCustomHolidaySet(customHolidays) {
  const set = new Set();
  (customHolidays || []).forEach((h) => {
    if (!h.startDate) return;
    const start = new Date(h.startDate + "T00:00:00");
    const end = new Date((h.endDate || h.startDate) + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    const cur = new Date(start);
    let guard = 0;
    while (cur <= end && guard < 400) {
      set.add(toISODate(cur));
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
  });
  return set;
}
function nowDateTimeStr() {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${date}T${time}`;
}

/* ----------------------------- 追客タスク（応募から5営業日・1日2回×10回） ----------------------------- */
/* 応募日を1営業日目として、5営業日（10チェック）を必須の追客タスクとする。
   各スロットは0〜9のインデックス：slot = (営業日-1)*2 + (回数-1) */

function emptyFollowUpChecklist() { return Array(10).fill(false); }

/* 応募日（営業日でなければ直後の営業日）を1日目として、最初の5営業日の日付を返す */
function businessDayDatesFromRegistration(registeredDate, customHolidaySet) {
  if (!registeredDate) return [];
  const dates = [];
  const cur = new Date(registeredDate + "T00:00:00");
  if (isNaN(cur.getTime())) return [];
  let guard = 0;
  while (dates.length < 5 && guard < 60) {
    const ds = toISODate(cur);
    if (isBusinessDay(ds, customHolidaySet)) dates.push(ds);
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return dates;
}

/* 本日に対応する2つのチェック欄（スロット番号）。本日が対象期間外ならnull */
function todaysFollowUpSlots(registeredDate, customHolidaySet) {
  const dates = businessDayDatesFromRegistration(registeredDate, customHolidaySet);
  const idx = dates.indexOf(todayStr());
  if (idx === -1) return null;
  return { dayIndex: idx, slots: [idx * 2, idx * 2 + 1], date: dates[idx] };
}

/* 追客タスクのアラート判定：未面談中の求職者で、(a)本日分が両方完了していない、
   または (b) 5営業日の期間が終了したのに10回完了していない場合にtrueを返す */
function isFollowUpAlertActive(cand, customHolidaySet) {
  if (candidateStatusInfo(cand.status).phase !== "pre") return false;
  const dates = businessDayDatesFromRegistration(cand.registeredDate, customHolidaySet);
  if (dates.length === 0) return false;
  const checklist = cand.followUpChecklist || emptyFollowUpChecklist();
  const today = todayStr();
  const lastDay = dates[dates.length - 1];
  if (today > lastDay) return checklist.some((v) => !v);
  const todayIdx = dates.indexOf(today);
  if (todayIdx === -1) return false;
  return !(checklist[todayIdx * 2] && checklist[todayIdx * 2 + 1]);
}

/* 追客タスクの1スロットをON/OFFし、追客ログ（日時・何回目か）と活動履歴の両方に記録する */
function toggleFollowUpChecklistSlot(cand, slotIndex, customHolidaySet, staffName) {
  const checklist = [...(cand.followUpChecklist || emptyFollowUpChecklist())];
  const newValue = !checklist[slotIndex];
  checklist[slotIndex] = newValue;
  const dayNum = Math.floor(slotIndex / 2) + 1;
  const touchNum = (slotIndex % 2) + 1;
  const dates = businessDayDatesFromRegistration(cand.registeredDate, customHolidaySet);
  const dateStr = dates[dayNum - 1] || "";
  const next = { ...cand, followUpChecklist: checklist, updatedAt: new Date().toISOString() };
  if (newValue) {
    next.lastContactDate = todayStr();
    const logEntry = {
      id: uid("fu"), date: nowDateTimeStr(), staffName: staffName || "",
      memo: `${dayNum}営業日目・${touchNum}回目の追客タスクを完了（${fmtDate(dateStr)}）`,
      createdAt: new Date().toISOString(), checklistSlot: slotIndex,
    };
    next.followUpLog = [...(cand.followUpLog || []), logEntry];
    next.activities = [...(cand.activities || []), { id: uid("a"), date: new Date().toISOString(), content: `追客タスク完了：${dayNum}営業日目・${touchNum}回目（${fmtDate(dateStr)}）` }];
  } else {
    next.followUpLog = (cand.followUpLog || []).filter((e) => e.checklistSlot !== slotIndex);
    next.activities = [...(cand.activities || []), { id: uid("a"), date: new Date().toISOString(), content: `追客タスクのチェックを解除：${dayNum}営業日目・${touchNum}回目` }];
  }
  return next;
}
function fmtDateTime(dtStr) {
  if (!dtStr) return "—";
  const [datePart, timePart] = dtStr.split("T");
  return timePart ? `${fmtDate(datePart)} ${timePart}` : fmtDate(datePart);
}
/* "2026/5/17 20:48" のような結合済みの応募日時文字列を、できる範囲で日付・時刻に分解する */
function parseApplicationDateTime(raw) {
  const str = (raw || "").trim();
  if (!str) return { date: todayStr(), time: "" };
  const withTime = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[^\d]+(\d{1,2}):(\d{2})/);
  if (withTime) {
    const [, y, mo, d, h, mi] = withTime;
    return { date: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, time: `${h.padStart(2, "0")}:${mi}` };
  }
  const dateOnly = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return { date: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, time: "" };
  }
  return { date: todayStr(), time: "" };
}
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d1 = new Date(dateStr.slice(0, 10) + "T00:00:00");
  const d2 = new Date(todayStr() + "T00:00:00");
  if (isNaN(d1.getTime())) return null;
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}
function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const parts = dateStr.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[0]}/${parts[1]}/${parts[2]}` : dateStr;
}
function fmtMonth(monthStr) {
  if (!monthStr) return "—";
  const [y, m] = monthStr.split("-");
  return `${y}年${m}月`;
}
function normalize(str) { return (str || "").toString().toLowerCase().trim(); }

function candidateStatusInfo(key) {
  return CANDIDATE_STATUS_CONFIG[key] || { label: key || "未設定", phase: "pre", color: "#64748B" };
}
function applicationStatusInfo(key) {
  return APPLICATION_STATUS_CONFIG[key] || { label: key || "未設定", category: "open", color: "#64748B" };
}
function inquiryStatusInfo(key) {
  return INQUIRY_STATUS_CONFIG[key] || { label: key || "未設定", color: "#64748B" };
}

/* ----------------------------- 企業問い合わせ操作 ----------------------------- */

function emptyInquiry() {
  const now = new Date().toISOString();
  return {
    id: uid("inq"), inquiryDate: todayStr(), companyName: "", contactPersonName: "",
    inquiryType: "", inquiryContent: "", status: "inquiry", assignedTo: "",
    activities: [], createdAt: now, updatedAt: now,
  };
}

function applyInquiryStatusChange(inq, newStatus) {
  const oldLabel = inquiryStatusInfo(inq.status).label;
  const newLabel = inquiryStatusInfo(newStatus).label;
  return {
    ...inq, status: newStatus, updatedAt: new Date().toISOString(),
    activities: [...(inq.activities || []), { id: uid("a"), date: new Date().toISOString(), content: `ステータス変更：${oldLabel} → ${newLabel}` }],
  };
}

function addNoteToInquiry(inq, text) {
  return {
    ...inq, updatedAt: new Date().toISOString(),
    activities: [...(inq.activities || []), { id: uid("a"), date: new Date().toISOString(), content: text }],
  };
}

/* CSVなどから取り込むステータス文言が正式名称と異なる場合の補助的なエイリアス */
const CANDIDATE_STATUS_ALIASES = {
  new: ["新規", "未対応"],
  contacting: ["架電中", "tel", "連絡"],
  scheduling: ["調整中", "日程調整"],
  reschedule: ["再調整"],
  unreachable: ["不通", "未接続", "連絡つかず"],
  interviewed: ["面談実施", "面談済", "面談完了", "面談済み"],
  withdrawn: ["辞退", "離脱", "終了", "見送り"],
};

function guessCandidateStatusKeyFromLabel(label) {
  const norm = normalize(label);
  if (!norm) return "new";
  for (const key of CANDIDATE_STATUS_ORDER) {
    if (normalize(CANDIDATE_STATUS_CONFIG[key].label) === norm) return key;
  }
  for (const key of CANDIDATE_STATUS_ORDER) {
    const l = normalize(CANDIDATE_STATUS_CONFIG[key].label);
    if (l.includes(norm) || norm.includes(l)) return key;
  }
  for (const key of CANDIDATE_STATUS_ORDER) {
    const aliases = CANDIDATE_STATUS_ALIASES[key] || [];
    if (aliases.some((al) => norm.includes(normalize(al)))) return key;
  }
  return "new";
}

function targetKey(assignee, month) { return `${assignee}__${month}`; }
function emptyRevenue() { return { caTarget: 0, raTarget: 0, totalTarget: 0, caActual: 0, raActual: 0, totalActual: 0 }; }

/* 担当者別KPI（月次・8項目）。面談実施数（合計）以外は、担当者が日次カレンダーで入力した値の合計を実績とする。 */
const KPI_ROWS = [
  { key: "meetingScheduled", label: "面談予定数", hasCalendar: true },
  { key: "firstMeetingDone", label: "初回面談実施数", hasCalendar: true },
  { key: "followMeetingDone", label: "フォロー面談実施数", hasCalendar: true },
  { key: "meetingDoneTotal", label: "面談実施数", hasCalendar: false },
  { key: "documentPassed", label: "書類通過数", hasCalendar: true },
  { key: "offers", label: "内定数", hasCalendar: true },
  { key: "offerAccepted", label: "内定承諾数", hasCalendar: true },
];
function emptyKpiTarget() {
  return {
    meetingScheduled: 0, firstMeetingDone: 0, followMeetingDone: 0, meetingDoneTotal: 0,
    documentPassed: 0, offers: 0, offerAccepted: 0,
    revenueTarget: 0, revenueActual: 0,
  };
}

/* ----------------------------- 日次KPIカレンダー（売上・面談予定数など共通） ----------------------------- */

function dailyKpiKey(metricKey, assignee, date) { return `${metricKey}__${assignee}__${date}`; }

/* その担当者・月・指標の日次入力合計を算出する */
function computeMonthMetricActual(dailyKpiValues, metricKey, assignee, month) {
  const prefix = `${metricKey}__${assignee}__${month}`;
  let total = 0;
  Object.keys(dailyKpiValues || {}).forEach((key) => {
    if (key.startsWith(prefix)) total += Number(dailyKpiValues[key]) || 0;
  });
  return total;
}

/* スコープ（全体／個人）のKPI実績一式を、日次カレンダーの合計から算出する */
function computeScopeKpiActuals(dailyKpiValues, scope, consultants, month) {
  const names = scope === "all" ? consultants : [scope];
  const sumMetric = (key) => names.reduce((sum, name) => sum + computeMonthMetricActual(dailyKpiValues, key, name, month), 0);
  const firstMeetingDone = sumMetric("firstMeetingDone");
  const followMeetingDone = sumMetric("followMeetingDone");
  return {
    meetingScheduled: sumMetric("meetingScheduled"),
    firstMeetingDone,
    followMeetingDone,
    meetingDoneTotal: firstMeetingDone + followMeetingDone,
    documentPassed: sumMetric("documentPassed"),
    offers: sumMetric("offers"),
    offerAccepted: sumMetric("offerAccepted"),
  };
}

/* 月のカレンダー表示用に、週ごとの日付セル配列（null=その月に含まれない空白セル）を組み立てる */
function buildCalendarWeeks(month) {
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* 求職者＋応募先一覧から、月次の実績をまとめて算出する（件数／人数の両方を返す。ダッシュボード用） */
function computeActuals(candidateList, month) {
  const apps = candidateList.flatMap((c) => (c.applications || []).map((a) => ({ ...a, candidateId: c.id })));
  const offerApps = apps.filter((a) => inMonth(a.offerDate, month));
  const hireApps = apps.filter((a) => inMonth(a.hireDate, month));
  return {
    interviews: candidateList.filter((c) => inMonth(c.firstInterviewDate, month)).length,
    offerEntries: offerApps.length,
    offerCandidates: new Set(offerApps.map((a) => a.candidateId)).size,
    hireEntries: hireApps.length,
    hireCandidates: new Set(hireApps.map((a) => a.candidateId)).size,
  };
}

/* 求職者1人分の応募先データから、選考サマリー（プロセス中の求人数・各段階の通過数）を集計する。
   これらは応募先データから自動算出される参考値で、手入力フィールドではない。 */
const STATUSES_INTERVIEW_CONFIRMED_OR_LATER = [
  "interview1Scheduling", "interview1Passed", "interview1Failed",
  "interview2Scheduling", "interview2Passed", "interview2Failed",
  "finalScheduling", "finalFailed",
  "offer", "offerAccepted", "hired",
];
const STATUSES_PASSED_AT_LEAST_ONE_INTERVIEW = ["interview1Passed", "interview2Passed", "offer", "offerAccepted", "hired"];

function computeApplicationSummaryCounts(applications) {
  const apps = applications || [];
  return {
    inProcessCount: apps.length,
    documentPassedCount: apps.filter((a) => !!a.documentPassedDate).length,
    interviewConfirmedCount: apps.filter((a) => STATUSES_INTERVIEW_CONFIRMED_OR_LATER.includes(a.status)).length,
    interviewPassedCount: apps.filter((a) => STATUSES_PASSED_AT_LEAST_ONE_INTERVIEW.includes(a.status)).length,
    offerCount: apps.filter((a) => !!a.offerDate).length,
  };
}

/* ----------------------------- 求職者ステータス変更 ----------------------------- */

function applyCandidateStatusChange(cand, newStatus) {
  const today = todayStr();
  const oldLabel = candidateStatusInfo(cand.status).label;
  const newLabel = candidateStatusInfo(newStatus).label;
  const newPhase = candidateStatusInfo(newStatus).phase;
  let updated = { ...cand, status: newStatus, lastContactDate: today, updatedAt: new Date().toISOString() };
  if (newPhase === "active" && (!updated.interviews || updated.interviews.length === 0)) {
    const now = new Date().toISOString();
    updated.interviews = [{ id: uid("iv"), type: "initial", scheduledDate: today, completedDate: today, memo: "", createdAt: now, updatedAt: now }];
    updated.firstInterviewDate = today;
  }
  if (newPhase === "closed" && !updated.closedDate) updated.closedDate = today;
  updated.activities = [
    ...(cand.activities || []),
    { id: uid("a"), date: new Date().toISOString(), content: `ステータス変更：${oldLabel} → ${newLabel}` },
  ];
  return updated;
}

function addNoteToCandidate(cand, text) {
  const today = todayStr();
  return {
    ...cand,
    lastContactDate: today,
    updatedAt: new Date().toISOString(),
    activities: [...(cand.activities || []), { id: uid("a"), date: new Date().toISOString(), content: text }],
  };
}

/* ----------------------------- 追客ログ（電話・連絡記録）操作 ----------------------------- */

function emptyFollowUpEntry() {
  const now = new Date().toISOString();
  return { id: uid("fu"), date: nowDateTimeStr(), staffName: "", memo: "", createdAt: now };
}

function addFollowUpEntryToCandidate(cand, data) {
  const entry = { ...emptyFollowUpEntry(), ...data };
  const today = todayStr();
  return {
    ...cand,
    followUpLog: [...(cand.followUpLog || []), entry],
    lastContactDate: today,
    updatedAt: new Date().toISOString(),
    activities: [
      ...(cand.activities || []),
      { id: uid("a"), date: new Date().toISOString(), content: `追客ログを追加（${fmtDateTime(entry.date)}・${entry.staffName || "対応者未設定"}）` },
    ],
  };
}

function updateFollowUpEntryInCandidate(cand, entryId, fields) {
  return {
    ...cand,
    updatedAt: new Date().toISOString(),
    followUpLog: (cand.followUpLog || []).map((e) => (e.id === entryId ? { ...e, ...fields } : e)),
  };
}

function removeFollowUpEntryFromCandidate(cand, entryId) {
  return {
    ...cand,
    updatedAt: new Date().toISOString(),
    followUpLog: (cand.followUpLog || []).filter((e) => e.id !== entryId),
  };
}

/* 前月から未解決（未面談・未クローズ）の求職者を、同じレコードのまま次月の管理対象に進める。
   追客ログは新しい月の対応として空白に戻し、それ以外（ステータス・応募先など）は引き継ぐ。 */
function rollCandidateToMonth(cand, newMonth) {
  return {
    ...cand,
    cohortMonth: newMonth,
    followUpLog: [],
    updatedAt: new Date().toISOString(),
    activities: [
      ...(cand.activities || []),
      { id: uid("a"), date: new Date().toISOString(), content: `追客リストを${fmtMonth(newMonth)}へ移動（追客ログをリセット）` },
    ],
  };
}

/* ----------------------------- 面談（初回／フォロー）操作 ----------------------------- */

function emptyInterview(existingInterviews) {
  const hasInitial = (existingInterviews || []).some((iv) => iv.type === "initial");
  const now = new Date().toISOString();
  return { id: uid("iv"), type: hasInitial ? "followup" : "initial", scheduledDate: todayStr(), completedDate: "", memo: "", createdAt: now, updatedAt: now };
}

function recomputeFirstInterviewDate(interviews) {
  const dates = (interviews || []).filter((iv) => iv.type === "initial" && iv.completedDate).map((iv) => iv.completedDate).sort();
  return dates[0] || "";
}

function addInterviewToCandidate(cand, data) {
  const iv = { ...emptyInterview(cand.interviews), ...data };
  const interviews = [...(cand.interviews || []), iv];
  let next = {
    ...cand,
    interviews,
    firstInterviewDate: recomputeFirstInterviewDate(interviews),
    updatedAt: new Date().toISOString(),
    activities: [
      ...(cand.activities || []),
      { id: uid("a"), date: new Date().toISOString(), content: `面談を追加（${iv.type === "initial" ? "初回面談" : "フォロー面談"}・予定日 ${fmtDate(iv.scheduledDate)}）` },
    ],
  };
  if (iv.completedDate && candidateStatusInfo(next.status).phase === "pre") {
    next = applyCandidateStatusChange(next, "interviewed");
  }
  return next;
}

function updateInterviewFieldsInCandidate(cand, ivId, fields) {
  const interviews = (cand.interviews || []).map((iv) => (iv.id === ivId ? { ...iv, ...fields, updatedAt: new Date().toISOString() } : iv));
  let next = { ...cand, interviews, firstInterviewDate: recomputeFirstInterviewDate(interviews), updatedAt: new Date().toISOString() };
  const updatedIv = interviews.find((iv) => iv.id === ivId);
  if (updatedIv && updatedIv.completedDate && candidateStatusInfo(next.status).phase === "pre") {
    next = applyCandidateStatusChange(next, "interviewed");
  }
  return next;
}

function removeInterviewFromCandidate(cand, ivId) {
  const interviews = (cand.interviews || []).filter((iv) => iv.id !== ivId);
  return { ...cand, interviews, firstInterviewDate: recomputeFirstInterviewDate(interviews), updatedAt: new Date().toISOString() };
}

/* ----------------------------- 応募先（エントリー）操作 ----------------------------- */

function emptyApplication() {
  const now = new Date().toISOString();
  return {
    id: uid("app"), companyName: "", jobTitle: "", status: "entry",
    appliedDate: todayStr(), documentPassedDate: "", offerDate: "", offerAcceptedDate: "", hireDate: "", closedDate: "", memo: "",
    createdAt: now, updatedAt: now,
  };
}

/* 書類選考通過より後の段階に進んだ場合は、明示的に「書類選考通過」を経由していなくても
   通過日を自動的に補完する（一次面接調整中などへ直接進めた場合も実績集計に反映されるように）。 */
const STATUSES_AFTER_DOCUMENT_SCREENING = APPLICATION_STATUS_ORDER.filter(
  (k) => !["entry", "documentScreening", "documentFailed"].includes(k)
);
const STATUSES_IMPLYING_OFFER_ACCEPTED = ["offerAccepted", "hired"];

function applyApplicationStatusChange(app, newStatus) {
  const today = todayStr();
  const info = applicationStatusInfo(newStatus);
  const updated = { ...app, status: newStatus, updatedAt: new Date().toISOString() };
  if (STATUSES_AFTER_DOCUMENT_SCREENING.includes(newStatus) && !updated.documentPassedDate) updated.documentPassedDate = today;
  if (newStatus === "offer" && !updated.offerDate) updated.offerDate = today;
  if (STATUSES_IMPLYING_OFFER_ACCEPTED.includes(newStatus) && !updated.offerAcceptedDate) updated.offerAcceptedDate = today;
  if (newStatus === "hired" && !updated.hireDate) updated.hireDate = today;
  if (info.category === "lost" && !updated.closedDate) updated.closedDate = today;
  return updated;
}

/* 求職者オブジェクトに対して応募先を追加・更新・削除する純粋関数群。
   いずれも候補者がまだ「未面談」の場合は、応募先登録をもって自動的に「面談済み」に進める。 */
function addApplicationToCandidate(cand, data) {
  const app = { ...emptyApplication(), ...data };
  let next = {
    ...cand,
    applications: [...(cand.applications || []), app],
    updatedAt: new Date().toISOString(),
    activities: [
      ...(cand.activities || []),
      { id: uid("a"), date: new Date().toISOString(), content: `［${app.companyName || "応募先未設定"}］を応募先として追加（${applicationStatusInfo(app.status).label}）` },
    ],
  };
  if (candidateStatusInfo(next.status).phase === "pre") {
    next = applyCandidateStatusChange(next, "interviewed");
  }
  return next;
}

function updateApplicationStatusInCandidate(cand, appId, newStatus) {
  const app = (cand.applications || []).find((a) => a.id === appId);
  if (!app) return cand;
  const oldLabel = applicationStatusInfo(app.status).label;
  const newLabel = applicationStatusInfo(newStatus).label;
  const updatedApp = applyApplicationStatusChange(app, newStatus);
  return {
    ...cand,
    lastContactDate: todayStr(),
    updatedAt: new Date().toISOString(),
    applications: cand.applications.map((a) => (a.id === appId ? updatedApp : a)),
    activities: [
      ...(cand.activities || []),
      { id: uid("a"), date: new Date().toISOString(), content: `［${app.companyName || "応募先未設定"}］ステータス変更：${oldLabel} → ${newLabel}` },
    ],
  };
}

function updateApplicationFieldsInCandidate(cand, appId, fields) {
  return {
    ...cand,
    updatedAt: new Date().toISOString(),
    applications: (cand.applications || []).map((a) => (a.id === appId ? { ...a, ...fields, updatedAt: new Date().toISOString() } : a)),
  };
}

function removeApplicationFromCandidate(cand, appId) {
  const app = (cand.applications || []).find((a) => a.id === appId);
  return {
    ...cand,
    updatedAt: new Date().toISOString(),
    applications: (cand.applications || []).filter((a) => a.id !== appId),
    activities: app
      ? [...(cand.activities || []), { id: uid("a"), date: new Date().toISOString(), content: `［${app.companyName || "応募先未設定"}］を応募先一覧から削除` }]
      : cand.activities,
  };
}

/* ----------------------------- 旧バージョンデータの自動移行 ----------------------------- */
/* 以前のバージョンは「求職者1人＝1ステータス」で選考状況も持っていたため、
   応募先（複数社対応）が無い旧データを安全に新しい構造へ変換する。 */
function emptyCandidate() {
  const now = new Date().toISOString();
  return {
    id: uid(), name: "", furigana: "", email: "", phone: "", yomi: "",
    registeredDate: todayStr(), applicationTime: "", source: "", desiredJobType: "", currentCompany: "",
    status: "new", assignedTo: "", tags: [], memo: "",
    lastContactDate: todayStr(), nextActionDate: "",
    firstInterviewDate: "", closedDate: "",
    gender: "", age: "", education: "", disabilityType: "", residence: "", workExperienceCount: "",
    employmentStatus: "", currentSalary: "", desiredSalary: "", minDesiredSalary: "",
    desiredWorkLocation: [], desiredJoinTiming: "", jobChangeAxis: "",
    hasSelfApplication: "", usesOtherAgency: "", proposedJobType: "",
    cohortMonth: currentMonthKey(), followUpLog: [], followUpChecklist: emptyFollowUpChecklist(),
    interviews: [], applications: [], activities: [],
    createdAt: now, updatedAt: now,
  };
}

function dateDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 現状把握用のサンプル求職者データを1名分組み立てる（求職者一覧・追客リストの両方に表示される） */
function createSampleCandidate(service, consultants) {
  const assignedTo = consultants[0] || "";
  const regDate = dateDaysAgo(4);

  let cand = emptyCandidate();
  cand = {
    ...cand,
    name: "山田 太郎",
    yomi: "A",
    furigana: "ヤマダ タロウ",
    email: "yamada.taro@example.com",
    phone: "090-1234-5678",
    registeredDate: regDate,
    applicationTime: "10:15",
    source: "Indeed",
    desiredJobType: "カスタマーサクセス（法人向け）",
    currentCompany: "株式会社サンプル商事",
    assignedTo,
    nextActionDate: dateDaysAgo(-3),
    gender: "男性",
    age: "28",
    education: "大卒",
    residence: "東京都渋谷区",
    workExperienceCount: "2",
    employmentStatus: "現職中",
    currentSalary: "450",
    desiredSalary: "550",
    minDesiredSalary: "500",
    desiredWorkLocation: ["東京都", "神奈川県"],
    desiredJoinTiming: "1ヶ月以内",
    jobChangeAxis: "裁量を持って働けるか、年収アップ、フルリモート可否を重視しています。",
    hasSelfApplication: "あり",
    usesOtherAgency: "なし",
    proposedJobType: "カスタマーサクセス／インサイドセールス",
    memo: "これはサンプルデータです。内容をご確認のうえ、編集または削除してください。",
    tags: ["サンプル"],
  };
  if (service === "challenge") {
    cand.disabilityType = "精神障がい（オープン就労希望）";
  }

  // 追客ログ：初回ヒアリングの架電記録
  cand = addFollowUpEntryToCandidate(cand, {
    date: `${dateDaysAgo(3)}T11:30`,
    staffName: assignedTo,
    memo: "初回ヒアリング。学歴・転職軸・希望条件を確認し、面談日程を打診。",
  });
  cand = applyCandidateStatusChange(cand, "contacting");

  // 面談：初回面談を実施済みとして登録（自動的に「面談済み」へ進む）
  cand = addInterviewToCandidate(cand, {
    type: "initial",
    scheduledDate: dateDaysAgo(1),
    completedDate: dateDaysAgo(1),
    memo: "オンラインにて初回面談を実施。経歴・希望条件のすり合わせを行った。",
  });

  // 応募先：1件登録し、一次面接調整中まで進める
  cand = addApplicationToCandidate(cand, {
    companyName: "株式会社サンプル",
    jobTitle: "カスタマーサクセス（法人向け）",
  });
  const appId = cand.applications[0].id;
  cand = updateApplicationStatusInCandidate(cand, appId, "interview1Scheduling");

  return cand;
}

/* ============================== 共有UIパーツ ============================== */

function ColorBadge({ label, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: `${color}1A`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
function CandidateStatusBadge({ status }) {
  const info = candidateStatusInfo(status);
  return <ColorBadge label={info.label} color={info.color} />;
}
function ApplicationStatusBadge({ status }) {
  const info = applicationStatusInfo(status);
  return <ColorBadge label={info.label} color={info.color} />;
}

function YomiBadge({ yomi }) {
  const info = YOMI_CONFIG[yomi];
  if (!info) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold text-white shrink-0"
      style={{ backgroundColor: info.color }}
      title={`ヨミ：${info.label}`}
    >
      {info.label}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent = "indigo" }) {
  const accentClass = {
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
  }[accent];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
      <div className={`rounded-lg p-2 ${accentClass}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-semibold text-slate-900 leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function DiffBadge({ diff }) {
  if (diff > 0) return <span className="inline-flex items-center gap-0.5 text-emerald-600 text-xs font-semibold"><ArrowUpRight size={13} />+{diff}</span>;
  if (diff < 0) return <span className="inline-flex items-center gap-0.5 text-rose-600 text-xs font-semibold"><ArrowDownRight size={13} />{diff}</span>;
  return <span className="text-slate-400 text-xs font-semibold">±0</span>;
}

function ProgressBar({ actual, target }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : actual > 0 ? 100 : 0;
  const over = target > 0 && actual >= target;
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${over ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const cls = toast.type === "error" ? "bg-rose-600" : "bg-slate-900";
  return <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 ${cls} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50`}>{toast.msg}</div>;
}

function MetricCalendar({ assignee, month, metricKey, unit, label, dailyKpiValues, onSetDay }) {
  const weeks = useMemo(() => buildCalendarWeeks(month), [month]);
  const [y, m] = month.split("-");
  const total = useMemo(() => {
    let t = 0;
    const prefix = `${metricKey}__${assignee}__${month}`;
    Object.keys(dailyKpiValues || {}).forEach((k) => { if (k.startsWith(prefix)) t += Number(dailyKpiValues[k]) || 0; });
    return t;
  }, [dailyKpiValues, metricKey, assignee, month]);

  function valueFor(day) {
    if (!day) return "";
    const date = `${y}-${m}-${String(day).padStart(2, "0")}`;
    return dailyKpiValues[dailyKpiKey(metricKey, assignee, date)] || "";
  }
  function handleChange(day, val) {
    const date = `${y}-${m}-${String(day).padStart(2, "0")}`;
    onSetDay(metricKey, assignee, date, val);
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => (
              <div key={di} className={`rounded-md py-1 text-center ${day ? "bg-white border border-slate-200" : ""}`}>
                {day && (
                  <>
                    <div className="text-[9px] text-slate-400 leading-none">{day}</div>
                    <input
                      type="number"
                      min={0}
                      value={valueFor(day)}
                      onChange={(e) => handleChange(day, e.target.value)}
                      placeholder="0"
                      className="w-full text-[11px] text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="text-right text-xs text-slate-600 mt-2 font-semibold">月合計：{total.toLocaleString("ja-JP")}{unit || ""}</div>
      <p className="text-[10px] text-slate-400 mt-1">各日に{label}を入力すると、自動的に月合計が算出されます。</p>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className="col-span-1">
      <label className="text-xs font-medium text-slate-500 mb-1 block">{label}{required && <span className="text-rose-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

/* 都道府県などの複数選択フィールド。選択済みはチップ表示、「選択する」を押すとチェックボックス一覧が開く。 */
function MultiSelectField({ label, options, selected, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const values = selected || [];

  function toggle(opt) {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  }

  return (
    <div className="col-span-2">
      <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
      <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.5rem]">
          {values.length === 0 && <span className="text-xs text-slate-400">未選択</span>}
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
              {v}
              <button onClick={() => toggle(v)} className="hover:text-indigo-900"><X size={10} /></button>
            </span>
          ))}
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-indigo-600 flex items-center gap-1 hover:bg-indigo-50 px-1.5 py-0.5 rounded-lg -ml-1.5">
          <Plus size={12} /> {expanded ? "閉じる" : "選択する"}
        </button>
        {expanded && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 mt-2 max-h-48 overflow-y-auto border-t border-slate-100 pt-2">
            {options.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-xs text-slate-600 px-1 py-1 hover:bg-slate-50 rounded cursor-pointer">
                <input type="checkbox" checked={values.includes(opt)} onChange={() => toggle(opt)} className="accent-indigo-600" />
                {opt}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== 売上目標・進捗 ============================== */

function RevenueSection({ revenue, month, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const current = revenue[month] || emptyRevenue();

  function startEdit() { setDraft({ ...emptyRevenue(), ...current }); setEditing(true); }
  function cancelEdit() { setDraft(null); setEditing(false); }
  function saveEdit() {
    onSave(month, {
      caTarget: Number(draft.caTarget) || 0, raTarget: Number(draft.raTarget) || 0, totalTarget: Number(draft.totalTarget) || 0,
      caActual: Number(draft.caActual) || 0, raActual: Number(draft.raActual) || 0, totalActual: Number(draft.totalActual) || 0,
    });
    setDraft(null); setEditing(false);
  }
  function autoFillTotal() {
    setDraft((d) => ({
      ...d,
      totalTarget: (Number(d.caTarget) || 0) + (Number(d.raTarget) || 0),
      totalActual: (Number(d.caActual) || 0) + (Number(d.raActual) || 0),
    }));
  }

  const rows = [
    { key: "ca", label: "CA売上" },
    { key: "ra", label: "RA売上" },
    { key: "total", label: "合算売上" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Wallet size={15} className="text-emerald-600" /> 売上目標・進捗（{fmtMonth(month)}）
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={autoFillTotal} className="text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded-lg whitespace-nowrap">合算をCA+RAで自動計算</button>
            <button onClick={cancelEdit} className="text-xs text-slate-400 px-2">キャンセル</button>
            <button onClick={saveEdit} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg">保存</button>
          </div>
        ) : (
          <button onClick={startEdit} className="text-xs flex items-center gap-1 text-indigo-600 px-2 py-1"><Pencil size={12} /> 実績・目標を編集</button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {rows.map(({ key, label }) => {
          const target = editing ? Number(draft[`${key}Target`]) || 0 : Number(current[`${key}Target`]) || 0;
          const actual = editing ? Number(draft[`${key}Actual`]) || 0 : Number(current[`${key}Actual`]) || 0;
          return (
            <div key={key} className={key === "total" ? "md:border-l md:border-slate-100 md:pl-4" : ""}>
              <div className="text-xs text-slate-500 mb-1">{label}</div>
              {editing ? (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <input type="number" value={draft[`${key}Actual`]} onChange={(e) => setDraft((d) => ({ ...d, [`${key}Actual`]: e.target.value }))} placeholder="実績（万円）" className="input text-xs" />
                  <span className="text-slate-400 text-xs">/</span>
                  <input type="number" value={draft[`${key}Target`]} onChange={(e) => setDraft((d) => ({ ...d, [`${key}Target`]: e.target.value }))} placeholder="目標（万円）" className="input text-xs" />
                </div>
              ) : (
                <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                  <span className="text-xl font-semibold text-slate-900">{actual.toLocaleString("ja-JP")}<span className="text-xs font-normal text-slate-400 ml-0.5">万円</span></span>
                  <span className="text-xs text-slate-400">目標 {target.toLocaleString("ja-JP")}万円</span>
                  <DiffBadge diff={actual - target} />
                </div>
              )}
              <ProgressBar actual={actual} target={target} />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-3">※売上は会計システム等の実績に基づき、毎月手入力で更新してください（個人別の集計は行いません。単位は万円）。</p>
    </div>
  );
}

/* ============================== ダッシュボード ============================== */

function DashboardPanel({ candidates, month, setMonth, onOpen, revenue, onSaveRevenue }) {
  const stats = useMemo(() => {
    const newCount = candidates.filter((c) => inMonth(c.registeredDate, month)).length;
    const a = computeActuals(candidates, month);

    const candidateStageCounts = CANDIDATE_STATUS_ORDER.map((key) => ({
      key, label: candidateStatusInfo(key).label, color: candidateStatusInfo(key).color,
      count: candidates.filter((c) => c.status === key).length,
    })).filter((s) => s.count > 0);

    const allApps = candidates.flatMap((c) => (c.applications || []).map((app) => ({ ...app, candidateId: c.id, candidateName: c.name })));
    const applicationStatusCounts = APPLICATION_STATUS_ORDER.map((key) => ({
      key, label: applicationStatusInfo(key).label, color: applicationStatusInfo(key).color,
      count: allApps.filter((app) => app.status === key).length,
    })).filter((s) => s.count > 0);

    const followUps = candidates
      .filter((c) => candidateStatusInfo(c.status).phase === "pre")
      .map((c) => ({ c, days: daysSince(c.lastContactDate || c.registeredDate) }))
      .filter((x) => x.days !== null && x.days >= 5)
      .sort((x, y) => y.days - x.days).slice(0, 6);

    const overdue = candidates
      .filter((c) => candidateStatusInfo(c.status).phase !== "closed" && c.nextActionDate && c.nextActionDate < todayStr())
      .sort((x, y) => (x.nextActionDate > y.nextActionDate ? 1 : -1)).slice(0, 6);

    const stalled = allApps
      .filter((app) => applicationStatusInfo(app.status).category === "open")
      .map((app) => ({ app, days: daysSince((app.updatedAt || "").slice(0, 10)) }))
      .filter((x) => x.days !== null && x.days >= 10)
      .sort((x, y) => y.days - x.days).slice(0, 6);

    return { newCount, ...a, candidateStageCounts, applicationStatusCounts, followUps, overdue, stalled };
  }, [candidates, month]);

  const funnelSteps = [
    { label: "新規登録", value: stats.newCount },
    { label: "面談実施", value: stats.interviews },
    { label: "内定（件）", value: stats.offerEntries },
    { label: "入社（件）", value: stats.hireEntries },
  ];
  const maxFunnel = Math.max(1, funnelSteps[0].value);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900">ダッシュボード</h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700" />
      </div>

      <RevenueSection revenue={revenue} month={month} onSave={onSaveRevenue} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="今月の新規登録" value={stats.newCount} accent="indigo" />
        <KpiCard icon={ListChecks} label="今月の面談実施" value={stats.interviews} accent="amber" />
        <KpiCard icon={Target} label="今月の内定（件数）" value={stats.offerEntries} sub={`対象者 ${stats.offerCandidates}名`} accent="emerald" />
        <KpiCard icon={Check} label="今月の入社（件数）" value={stats.hireEntries} sub={`対象者 ${stats.hireCandidates}名`} accent="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-700 mb-3">月次ファネル（{fmtMonth(month)}・目安）</div>
        <div className="space-y-2">
          {funnelSteps.map((step, i) => {
            const widthPct = Math.max(8, Math.round((step.value / maxFunnel) * 100));
            const prevValue = i > 0 ? funnelSteps[i - 1].value : null;
            const cvr = prevValue ? (prevValue > 0 ? Math.round((step.value / prevValue) * 100) : 0) : null;
            return (
              <div key={step.label} className="flex items-center gap-3">
                <div className="w-24 text-xs text-slate-500 shrink-0">{step.label}</div>
                <div className="flex-1 h-7 bg-slate-100 rounded-md overflow-hidden">
                  <div className="h-full rounded-md bg-indigo-500 flex items-center justify-end px-2 transition-all" style={{ width: `${widthPct}%` }}>
                    <span className="text-white text-xs font-semibold">{step.value}</span>
                  </div>
                </div>
                <div className="w-14 text-xs text-slate-400 text-right shrink-0">{cvr !== null ? `${cvr}%` : ""}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">※内定・入社は「応募先（エントリー）」単位の件数です。同一人物が複数内定を持つ場合は重複して数えられます。</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">求職者ステータス分布（全期間）</div>
            <MiniBarChart data={stats.candidateStageCounts} height={Math.max(140, stats.candidateStageCounts.length * 28)} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">応募先ステータス分布（全期間）</div>
            <MiniBarChart data={stats.applicationStatusCounts} height={Math.max(140, stats.applicationStatusCounts.length * 24)} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-500" /> 要対応リスト
          </div>
          <div className="space-y-2 max-h-[27rem] overflow-y-auto pr-1">
            {stats.overdue.map(({ id, name, nextActionDate }) => (
              <button key={"od-" + id} onClick={() => onOpen(id)} className="w-full flex items-center justify-between text-left text-sm px-2.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors">
                <span className="text-slate-700 truncate">{name}</span>
                <span className="text-rose-600 text-xs shrink-0 ml-2">期限超過：{fmtDate(nextActionDate)}</span>
              </button>
            ))}
            {stats.followUps.map(({ c, days }) => (
              <button key={"fu-" + c.id} onClick={() => onOpen(c.id)} className="w-full flex items-center justify-between text-left text-sm px-2.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
                <span className="text-slate-700 truncate">{c.name}</span>
                <span className="text-amber-600 text-xs shrink-0 ml-2">未接触 {days}日</span>
              </button>
            ))}
            {stats.stalled.map(({ app, days }) => (
              <button key={"st-" + app.id} onClick={() => onOpen(app.candidateId)} className="w-full flex items-center justify-between text-left text-sm px-2.5 py-2 rounded-lg bg-sky-50 hover:bg-sky-100 transition-colors">
                <span className="text-slate-700 truncate flex items-center gap-1"><Clock size={12} className="text-sky-500 shrink-0" />{app.candidateName}［{app.companyName || "応募先未設定"}］</span>
                <span className="text-sky-600 text-xs shrink-0 ml-2">結果待ち {days}日</span>
              </button>
            ))}
            {stats.overdue.length === 0 && stats.followUps.length === 0 && stats.stalled.length === 0 && (
              <div className="text-sm text-slate-400 py-6 text-center">対応待ちはありません</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({ data, height }) {
  if (data.length === 0) return <div className="text-sm text-slate-400 py-6 text-center">データがありません</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: "#475569" }} />
        <Tooltip />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={13}>
          {data.map((s) => <Cell key={s.key} fill={s.color} />)}
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#334155" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ============================== 求職者一覧 ============================== */

function CandidateCard({ c, onOpen }) {
  const overdue = c.nextActionDate && c.nextActionDate < todayStr() && candidateStatusInfo(c.status).phase !== "closed";
  const contactDays = daysSince(c.lastContactDate || c.registeredDate);
  const apps = c.applications || [];
  const appCounts = apps.reduce((acc, a) => {
    const cat = applicationStatusInfo(a.status).category;
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  return (
    <button onClick={() => onOpen(c.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3.5 hover:border-indigo-300 hover:shadow-sm transition-all flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-slate-900 truncate">{c.name || "（氏名未設定）"}</span>
          <YomiBadge yomi={c.yomi} />
          <CandidateStatusBadge status={c.status} />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          {c.assignedTo && <span>担当：{c.assignedTo}</span>}
          {c.desiredJobType && <span className="truncate">希望職種：{c.desiredJobType}</span>}
          <span>登録：{fmtDate(c.registeredDate)}</span>
          {contactDays !== null && <span>最終接触：{contactDays}日前</span>}
        </div>
        {apps.length > 0 && (
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Briefcase size={12} className="text-slate-400" />
            応募先 {apps.length}社（成約{appCounts.won || 0}・選考中{appCounts.open || 0}・見送り{appCounts.lost || 0}）
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {overdue && <span className="text-xs text-rose-600 font-medium flex items-center gap-0.5"><AlertTriangle size={12} /> 期限超過</span>}
        {!overdue && c.nextActionDate && <span className="text-xs text-slate-400">次回：{fmtDate(c.nextActionDate)}</span>}
        <ChevronRight size={16} className="text-slate-300" />
      </div>
    </button>
  );
}

function CandidateListPanel({ candidates, consultants, onOpen, onNew, onExport, onAddSample, addingSample }) {
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return candidates
      .filter((c) => phaseFilter === "all" || candidateStatusInfo(c.status).phase === phaseFilter)
      .filter((c) => assigneeFilter === "all" || c.assignedTo === assigneeFilter)
      .filter((c) => {
        if (!search.trim()) return true;
        const q = normalize(search);
        return (
          normalize(c.name).includes(q) || normalize(c.email).includes(q) ||
          normalize(c.phone).includes(q) || normalize(c.currentCompany).includes(q) ||
          normalize(c.desiredJobType).includes(q) ||
          (c.applications || []).some((a) => normalize(a.companyName).includes(q))
        );
      })
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [candidates, phaseFilter, assigneeFilter, search]);

  const counts = {
    all: candidates.length,
    pre: candidates.filter((c) => candidateStatusInfo(c.status).phase === "pre").length,
    active: candidates.filter((c) => candidateStatusInfo(c.status).phase === "active").length,
    closed: candidates.filter((c) => candidateStatusInfo(c.status).phase === "closed").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900">求職者一覧</h2>
        <div className="flex items-center gap-2">
          <button onClick={onAddSample} disabled={addingSample} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Plus size={14} /> サンプルを追加</button>
          <button onClick={onExport} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Download size={14} /> CSV出力</button>
          <button onClick={onNew} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"><Plus size={14} /> 新規登録</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {[["all", `すべて (${counts.all})`], ["pre", `未面談 (${counts.pre})`], ["active", `面談済み (${counts.active})`], ["closed", `クローズ (${counts.closed})`]].map(([key, label]) => (
          <button key={key} onClick={() => setPhaseFilter(key)} className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${phaseFilter === key ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="氏名・メール・電話・会社名・応募先で検索" className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm" />
        </div>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-600">
          <option value="all">担当者：すべて</option>
          {consultants.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">
            該当する求職者がいません。「新規登録」または「CSVインポート」から追加してください。
          </div>
        ) : (
          filtered.map((c) => <CandidateCard key={c.id} c={c} onOpen={onOpen} />)
        )}
      </div>
    </div>
  );
}

/* ============================== 企業問い合わせ ============================== */

function InquiryStatusBadge({ status }) {
  const info = inquiryStatusInfo(status);
  return <ColorBadge label={info.label} color={info.color} />;
}

function InquiryCard({ inq, onOpen }) {
  return (
    <button onClick={() => onOpen(inq.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-3.5 hover:border-indigo-300 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <span className="font-medium text-slate-900 truncate">{inq.companyName || "（企業名未設定）"}</span>
        <InquiryStatusBadge status={inq.status} />
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        {inq.inquiryType && <ColorBadge label={inq.inquiryType} color={INQUIRY_TYPE_COLOR[inq.inquiryType] || "#64748B"} />}
        {inq.contactPersonName && <span>先方担当：{inq.contactPersonName}</span>}
        {inq.assignedTo && <span>自社担当：{inq.assignedTo}</span>}
        <span>問い合わせ日：{fmtDate(inq.inquiryDate)}</span>
      </div>
      {inq.inquiryContent && <div className="text-xs text-slate-500 mt-1.5 truncate">{inq.inquiryContent}</div>}
    </button>
  );
}

function InquiryListPanel({ inquiries, consultants, onOpen, onNew }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return inquiries
      .filter((i) => statusFilter === "all" || i.status === statusFilter)
      .filter((i) => typeFilter === "all" || i.inquiryType === typeFilter)
      .filter((i) => assigneeFilter === "all" || i.assignedTo === assigneeFilter)
      .filter((i) => {
        if (!search.trim()) return true;
        const q = normalize(search);
        return normalize(i.companyName).includes(q) || normalize(i.contactPersonName).includes(q) || normalize(i.inquiryContent).includes(q);
      })
      .sort((a, b) => (b.inquiryDate || "").localeCompare(a.inquiryDate || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [inquiries, statusFilter, typeFilter, assigneeFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900">企業問い合わせ</h2>
        <button onClick={onNew} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"><Plus size={14} /> 新規登録</button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-600">
          <option value="all">ステータス：すべて</option>
          {INQUIRY_STATUS_ORDER.map((k) => <option key={k} value={k}>{INQUIRY_STATUS_CONFIG[k].label}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-600">
          <option value="all">種別：すべて</option>
          {INQUIRY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-600">
          <option value="all">担当者：すべて</option>
          {consultants.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="企業名・担当者名・内容で検索" className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">
            該当する問い合わせがありません。「新規登録」から追加してください。
          </div>
        ) : (
          filtered.map((inq) => <InquiryCard key={inq.id} inq={inq} onOpen={onOpen} />)
        )}
      </div>
    </div>
  );
}

function InquiryModal({ inquiry, consultants, isNew, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(inquiry);
  const [noteText, setNoteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  function handleStatusChange(newStatus) { setForm((f) => applyInquiryStatusChange(f, newStatus)); }
  function handleAddNote() {
    if (!noteText.trim()) return;
    setForm((f) => addNoteToInquiry(f, noteText.trim()));
    setNoteText("");
  }
  function handleSave() { onSave({ ...form, updatedAt: new Date().toISOString() }); }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-40 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-semibold text-slate-900">{isNew ? "企業問い合わせを新規登録" : "企業問い合わせ詳細"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">ステータス</label>
            <select
              value={form.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium"
              style={{ color: inquiryStatusInfo(form.status).color }}
            >
              {INQUIRY_STATUS_ORDER.map((k) => <option key={k} value={k}>{INQUIRY_STATUS_CONFIG[k].label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="問い合わせ日"><input type="date" value={form.inquiryDate} onChange={(e) => set("inquiryDate", e.target.value)} className="input" /></Field>
            <Field label="問い合わせ種別">
              <select value={form.inquiryType} onChange={(e) => set("inquiryType", e.target.value)} className="input">
                <option value="">未選択</option>
                {INQUIRY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="企業名" required><input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} className="input" /></Field>
            <Field label="担当者名（先方）"><input value={form.contactPersonName} onChange={(e) => set("contactPersonName", e.target.value)} className="input" /></Field>
            <Field label="担当者（自社）">
              <select value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} className="input">
                <option value="">未割当</option>
                {consultants.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="問い合わせ内容"><textarea value={form.inquiryContent} onChange={(e) => set("inquiryContent", e.target.value)} rows={3} className="input resize-none" /></Field>

          {!isNew && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block flex items-center gap-1"><StickyNote size={13} /> 活動履歴</label>
              <div className="flex gap-2 mb-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                  placeholder="対応内容を記録（例：電話で日程調整、契約書送付済み）"
                  className="input flex-1"
                />
                <button onClick={handleAddNote} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 shrink-0">追加</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-2.5 bg-slate-50">
                {(form.activities || []).length === 0 && <div className="text-xs text-slate-400 text-center py-3">活動履歴はまだありません</div>}
                {[...(form.activities || [])].reverse().map((a) => (
                  <div key={a.id} className="text-xs">
                    <span className="text-slate-400">{new Date(a.date).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="text-slate-700 ml-2">{a.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3.5 flex items-center justify-between">
          {!isNew ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">削除しますか？</span>
                <button onClick={() => onDelete(form.id)} className="text-rose-600 font-medium">削除する</button>
                <button onClick={() => setConfirmDelete(false)} className="text-slate-400">キャンセル</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-700"><Trash2 size={14} /> 削除</button>
            )
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50">キャンセル</button>
            <button onClick={handleSave} disabled={!form.companyName.trim()} className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">保存する</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== 面談記録の行 ============================== */

function InterviewRow({ iv, onUpdateFields, onRemove, confirmId, setConfirmId }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
      <div className="flex items-center gap-2">
        <select
          value={iv.type}
          onChange={(e) => onUpdateFields({ type: e.target.value })}
          className="input bg-white text-xs font-medium flex-1"
        >
          <option value="initial">初回面談</option>
          <option value="followup">フォロー面談</option>
        </select>
        {confirmId === iv.id ? (
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <button onClick={onRemove} className="text-rose-600 font-medium">削除</button>
            <button onClick={() => setConfirmId(null)} className="text-slate-400">キャンセル</button>
          </div>
        ) : (
          <button onClick={() => setConfirmId(iv.id)} className="text-slate-400 hover:text-rose-500 shrink-0 p-1"><Trash2 size={14} /></button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-400 block mb-0.5">予定日</label>
          <input type="date" value={iv.scheduledDate} onChange={(e) => onUpdateFields({ scheduledDate: e.target.value })} className="input bg-white text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-slate-400 block mb-0.5">実施日（実施済みのみ入力）</label>
          <input type="date" value={iv.completedDate} onChange={(e) => onUpdateFields({ completedDate: e.target.value })} className="input bg-white text-xs" />
        </div>
      </div>
      <input value={iv.memo || ""} onChange={(e) => onUpdateFields({ memo: e.target.value })} placeholder="面談メモ" className="input bg-white text-xs" />
    </div>
  );
}

/* ============================== 追客ログの行 ============================== */

function FollowUpLogRow({ entry, consultants, onUpdateFields, onRemove, confirmId, setConfirmId }) {
  return (
    <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex items-center gap-2 flex-wrap">
      <input
        type="datetime-local"
        value={entry.date}
        onChange={(e) => onUpdateFields({ date: e.target.value })}
        className="input bg-white text-xs flex-1 min-w-[150px]"
      />
      <input
        list="consultant-options"
        value={entry.staffName}
        onChange={(e) => onUpdateFields({ staffName: e.target.value })}
        placeholder="対応者"
        className="input bg-white text-xs w-24 shrink-0"
      />
      <datalist id="consultant-options">{consultants.map((c) => <option key={c} value={c} />)}</datalist>
      <input
        value={entry.memo || ""}
        onChange={(e) => onUpdateFields({ memo: e.target.value })}
        placeholder="メモ（任意）"
        className="input bg-white text-xs flex-1 min-w-[100px]"
      />
      {confirmId === entry.id ? (
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <button onClick={onRemove} className="text-rose-600 font-medium">削除</button>
          <button onClick={() => setConfirmId(null)} className="text-slate-400">キャンセル</button>
        </div>
      ) : (
        <button onClick={() => setConfirmId(entry.id)} className="text-slate-400 hover:text-rose-500 shrink-0 p-1"><Trash2 size={14} /></button>
      )}
    </div>
  );
}

/* ============================== 追客リスト（月次） ============================== */

/* テーブルの各行に表示する「本日の追客タスク」セル。本日が対象期間内なら直接チェックできる。 */
function TodayFollowUpCell({ candidate, customHolidaySet, onToggle }) {
  if (candidateStatusInfo(candidate.status).phase !== "pre") {
    return <span className="text-xs text-slate-300">—</span>;
  }
  const dates = businessDayDatesFromRegistration(candidate.registeredDate, customHolidaySet);
  const checklist = candidate.followUpChecklist || emptyFollowUpChecklist();
  const totalDone = checklist.filter(Boolean).length;
  const todayIdx = dates.indexOf(todayStr());

  if (todayIdx === -1) {
    const lastDay = dates[dates.length - 1];
    if (lastDay && todayStr() > lastDay) {
      return (
        <span className={`text-xs font-medium whitespace-nowrap ${totalDone >= 10 ? "text-emerald-600" : "text-rose-600"}`}>
          {totalDone}/10（期間終了）
        </span>
      );
    }
    return <span className="text-xs text-slate-400 whitespace-nowrap">{dates[0] ? `Day1：${fmtDate(dates[0])}〜` : "—"}</span>;
  }

  const slot1 = todayIdx * 2;
  const slot2 = todayIdx * 2 + 1;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-[10px] text-slate-400">Day{todayIdx + 1}/5</span>
      <label className="flex items-center gap-1 cursor-pointer text-xs text-slate-600">
        <input type="checkbox" checked={!!checklist[slot1]} onChange={() => onToggle(slot1)} className="accent-indigo-600" />①
      </label>
      <label className="flex items-center gap-1 cursor-pointer text-xs text-slate-600">
        <input type="checkbox" checked={!!checklist[slot2]} onChange={() => onToggle(slot2)} className="accent-indigo-600" />②
      </label>
    </div>
  );
}

function emptyQuickAddForm(month) {
  return {
    registeredDate: todayStr(), applicationTime: "", name: "", age: "", gender: "",
    phone: "", companyName: "", jobTitle: "", source: "", cohortMonth: month,
  };
}

function FollowUpPanel({ candidates, consultants, myName, customHolidays, onUpsertCandidate, onOpenDetail }) {
  const customHolidaySet = useMemo(() => buildCustomHolidaySet(customHolidays), [customHolidays]);
  const [month, setMonth] = useState(currentMonthKey());
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [draft, setDraft] = useState(() => emptyQuickAddForm(currentMonthKey()));
  const [confirmRoll, setConfirmRoll] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");

  const monthCandidates = useMemo(
    () => candidates
      .filter((c) => c.cohortMonth === month)
      .filter((c) => sourceFilter === "all" || c.source === sourceFilter)
      .sort((a, b) => (a.registeredDate + (a.applicationTime || "")).localeCompare(b.registeredDate + (b.applicationTime || ""))),
    [candidates, month, sourceFilter]
  );

  const prevMonth = prevMonthKey(month);
  const rollCandidates = useMemo(
    () => candidates.filter((c) => c.cohortMonth === prevMonth && candidateStatusInfo(c.status).phase === "pre"),
    [candidates, prevMonth]
  );

  function handleMonthChange(newMonth) {
    setMonth(newMonth);
    setDraft(emptyQuickAddForm(newMonth));
    setConfirmRoll(false);
    setShowImport(false);
  }

  function handleRollForward() {
    rollCandidates.forEach((c) => onUpsertCandidate(rollCandidateToMonth(c, month)));
    setConfirmRoll(false);
  }

  function handleToggleFollowUpSlot(cand, slotIndex) {
    onUpsertCandidate(toggleFollowUpChecklistSlot(cand, slotIndex, customHolidaySet, myName));
  }

  function handleQuickAddSubmit() {
    if (!draft.name.trim()) return;
    let cand = emptyCandidate();
    cand = {
      ...cand,
      name: draft.name.trim(),
      age: draft.age, gender: draft.gender, phone: draft.phone, source: draft.source,
      registeredDate: draft.registeredDate, applicationTime: draft.applicationTime,
      cohortMonth: month, status: "new",
      lastContactDate: draft.registeredDate,
    };
    if (draft.companyName.trim() || draft.jobTitle.trim()) {
      cand = addApplicationToCandidate(cand, { companyName: draft.companyName.trim(), jobTitle: draft.jobTitle.trim() });
      // addApplicationToCandidate may bump status to "interviewed" only if phase was pre and an interview already exists;
      // for a brand-new applicant we want them to stay in 未面談 until an actual interview happens, so keep original status.
      cand.status = "new";
    }
    onUpsertCandidate(cand);
    setDraft(emptyQuickAddForm(month));
    setShowAdd(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900">追客リスト（月次）</h2>
        <div className="flex items-center gap-2">
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600">
            <option value="all">流入経路：すべて</option>
            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="month" value={month} onChange={(e) => handleMonthChange(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
        </div>
      </div>

      {rollCandidates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-amber-700">
            {fmtMonth(prevMonth)}に未解決（未面談）の求職者が <strong>{rollCandidates.length}件</strong> あります。
          </div>
          {confirmRoll ? (
            <div className="flex items-center gap-2 text-xs shrink-0">
              <span className="text-amber-700">{fmtMonth(month)}へ移動しますか？（追客ログはリセットされます）</span>
              <button onClick={handleRollForward} className="bg-amber-600 text-white px-2.5 py-1 rounded-lg">実行する</button>
              <button onClick={() => setConfirmRoll(false)} className="text-amber-700">キャンセル</button>
            </div>
          ) : (
            <button onClick={() => setConfirmRoll(true)} className="text-xs bg-white border border-amber-300 text-amber-700 px-2.5 py-1.5 rounded-lg shrink-0 whitespace-nowrap">{fmtMonth(month)}へコピー</button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 flex-wrap">
        <button onClick={() => exportFollowUpCsv(monthCandidates, month)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          <Download size={14} /> CSV出力
        </button>
        <button onClick={() => { setShowImport((v) => !v); setShowAdd(false); }} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          <Upload size={14} /> {showImport ? "閉じる" : "CSVインポート"}
        </button>
        <button onClick={() => { setShowAdd((v) => !v); setShowImport(false); }} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
          <Plus size={14} /> {showAdd ? "閉じる" : "追客対象を追加"}
        </button>
      </div>

      {showImport && (
        <FollowUpCsvImportPanel
          month={month}
          existingCandidates={candidates}
          onImport={(built) => built.forEach((c) => onUpsertCandidate(c))}
          onClose={() => setShowImport(false)}
        />
      )}

      {showAdd && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="氏名" required><input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="input" /></Field>
            <Field label="電話番号"><input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className="input" /></Field>
            <Field label="年齢">
              <select value={draft.age} onChange={(e) => setDraft((d) => ({ ...d, age: e.target.value }))} className="input">
                <option value="">未選択</option>
                {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a}歳</option>)}
              </select>
            </Field>
            <Field label="性別">
              <select value={draft.gender} onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))} className="input">
                <option value="">未選択</option>
                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="応募日"><input type="date" value={draft.registeredDate} onChange={(e) => setDraft((d) => ({ ...d, registeredDate: e.target.value }))} className="input" /></Field>
            <Field label="応募時刻（任意）"><input type="time" value={draft.applicationTime} onChange={(e) => setDraft((d) => ({ ...d, applicationTime: e.target.value }))} className="input" /></Field>
            <Field label="応募求人（職種）"><input value={draft.jobTitle} onChange={(e) => setDraft((d) => ({ ...d, jobTitle: e.target.value }))} placeholder="例：カスタマーサクセス（法人向け）" className="input" /></Field>
            <Field label="応募求人（会社名）"><input value={draft.companyName} onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))} placeholder="例：株式会社hokan" className="input" /></Field>
            <Field label="流入経路">
              <select value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} className="input">
                <option value="">未選択</option>
                {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex justify-end">
            <button onClick={handleQuickAddSubmit} disabled={!draft.name.trim()} className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">登録する</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {monthCandidates.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{fmtMonth(month)}の追客対象はまだありません。</div>
        ) : (
          <table className="w-full text-sm min-w-[1180px]">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">応募日時</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">氏名</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">年齢</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">性別</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">電話番号</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">応募求人</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">流入経路</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">選考ステータス</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">本日の追客タスク</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap">追客ログ</th>
                <th className="text-left font-normal py-2 px-3 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {monthCandidates.map((c) => {
                const firstApp = (c.applications || [])[0];
                const log = c.followUpLog || [];
                const latest = log[log.length - 1];
                const alert = isFollowUpAlertActive(c, customHolidaySet);
                return (
                  <tr key={c.id} className={`border-b border-slate-50 last:border-0 ${alert ? "bg-rose-50 hover:bg-rose-100" : "hover:bg-slate-50/60"}`}>
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-xs">{fmtDate(c.registeredDate)}{c.applicationTime ? ` ${c.applicationTime}` : ""}</td>
                    <td className="py-2 px-3 text-slate-800 font-medium whitespace-nowrap">
                      <button onClick={() => onOpenDetail(c.id)} className="hover:text-indigo-600 hover:underline">{c.name || "（未設定）"}</button>
                      {alert && <AlertTriangle size={12} className="inline-block ml-1 text-rose-500" />}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{c.age ? `${c.age}歳` : "—"}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{c.gender || "—"}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{c.phone || "—"}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap max-w-[180px] truncate">
                      {firstApp ? `${firstApp.jobTitle || "（職種未設定）"} / ${firstApp.companyName || "（会社名未設定）"}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{c.source || "—"}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <select
                        value={c.status}
                        onChange={(e) => onUpsertCandidate(applyCandidateStatusChange(c, e.target.value))}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 font-medium"
                        style={{ color: candidateStatusInfo(c.status).color }}
                      >
                        {CANDIDATE_PHASE_ORDER.map((phase) => (
                          <optgroup key={phase} label={CANDIDATE_PHASE_LABEL[phase]}>
                            {CANDIDATE_STATUS_ORDER.filter((k) => CANDIDATE_STATUS_CONFIG[k].phase === phase).map((k) => (
                              <option key={k} value={k}>{CANDIDATE_STATUS_CONFIG[k].label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <TodayFollowUpCell candidate={c} customHolidaySet={customHolidaySet} onToggle={(slot) => handleToggleFollowUpSlot(c, slot)} />
                    </td>
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-xs">
                      {log.length > 0 ? `${log.length}件・最終 ${fmtDateTime(latest.date)} ${latest.staffName || ""}` : "未記録"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <button
                        onClick={() => onUpsertCandidate(addFollowUpEntryToCandidate(c, { staffName: myName || "" }))}
                        className="text-xs flex items-center gap-1 text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded-lg whitespace-nowrap"
                      >
                        <Plus size={12} /> 今すぐ記録
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-slate-400">行をクリックすると詳細画面が開き、面談・応募先・プロフィールなど全項目を編集できます。</p>
    </div>
  );
}

/* ============================== 応募先（エントリー）行 ============================== */

function ApplicationRow({ app, onUpdateFields, onChangeStatus, onRemove, confirmId, setConfirmId }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
      <div className="flex items-center gap-2">
        <input
          value={app.companyName}
          onChange={(e) => onUpdateFields({ companyName: e.target.value })}
          placeholder="応募先企業名"
          className="input bg-white font-medium flex-1"
        />
        {confirmId === app.id ? (
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <button onClick={onRemove} className="text-rose-600 font-medium">削除</button>
            <button onClick={() => setConfirmId(null)} className="text-slate-400">キャンセル</button>
          </div>
        ) : (
          <button onClick={() => setConfirmId(app.id)} className="text-slate-400 hover:text-rose-500 shrink-0 p-1"><Trash2 size={14} /></button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={app.jobTitle} onChange={(e) => onUpdateFields({ jobTitle: e.target.value })} placeholder="求人名・職種" className="input bg-white text-xs" />
        <input type="date" value={app.appliedDate} onChange={(e) => onUpdateFields({ appliedDate: e.target.value })} className="input bg-white text-xs" />
      </div>
      <select
        value={app.status}
        onChange={(e) => onChangeStatus(e.target.value)}
        className="input bg-white text-xs font-medium"
        style={{ color: applicationStatusInfo(app.status).color }}
      >
        {APPLICATION_CATEGORY_ORDER.map((cat) => (
          <optgroup key={cat} label={APPLICATION_CATEGORY_LABEL[cat]}>
            {APPLICATION_STATUS_ORDER.filter((k) => APPLICATION_STATUS_CONFIG[k].category === cat).map((k) => (
              <option key={k} value={k}>{APPLICATION_STATUS_CONFIG[k].label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <input value={app.memo || ""} onChange={(e) => onUpdateFields({ memo: e.target.value })} placeholder="この応募先に関するメモ" className="input bg-white text-xs" />
      {(app.offerDate || app.hireDate) && (
        <div className="text-[11px] text-slate-400">
          {app.offerDate && `内定日：${fmtDate(app.offerDate)}　`}
          {app.hireDate && `入社日：${fmtDate(app.hireDate)}`}
        </div>
      )}
    </div>
  );
}

/* ============================== 求職者詳細／編集モーダル ============================== */

function CandidateModal({ candidate, consultants, isNew, myName, service, customHolidays, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(candidate);
  const [noteText, setNoteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAppId, setConfirmAppId] = useState(null);
  const [confirmIvId, setConfirmIvId] = useState(null);
  const [confirmFuId, setConfirmFuId] = useState(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  function handleStatusChange(newStatus) { setForm((f) => applyCandidateStatusChange(f, newStatus)); }
  function handleAddNote() {
    if (!noteText.trim()) return;
    setForm((f) => addNoteToCandidate(f, noteText.trim()));
    setNoteText("");
  }
  function handleSave() {
    const tags = typeof form.tagsInput === "string" ? form.tagsInput.split(",").map((t) => t.trim()).filter(Boolean) : form.tags;
    onSave({ ...form, tags, updatedAt: new Date().toISOString() });
  }
  function handleAddApplication() { setForm((f) => addApplicationToCandidate(f, {})); }
  function handleAppStatusChange(appId, newStatus) { setForm((f) => updateApplicationStatusInCandidate(f, appId, newStatus)); }
  function handleAppFieldsChange(appId, fields) { setForm((f) => updateApplicationFieldsInCandidate(f, appId, fields)); }
  function handleAppRemove(appId) {
    setForm((f) => removeApplicationFromCandidate(f, appId));
    setConfirmAppId(null);
  }
  function handleAddInterview() { setForm((f) => addInterviewToCandidate(f, {})); }
  function handleInterviewFieldsChange(ivId, fields) { setForm((f) => updateInterviewFieldsInCandidate(f, ivId, fields)); }
  function handleInterviewRemove(ivId) {
    setForm((f) => removeInterviewFromCandidate(f, ivId));
    setConfirmIvId(null);
  }
  function handleQuickAddFollowUp() { setForm((f) => addFollowUpEntryToCandidate(f, { staffName: myName || "" })); }
  const customHolidaySet = useMemo(() => buildCustomHolidaySet(customHolidays), [customHolidays]);
  function handleToggleChecklistSlot(slot) { setForm((f) => toggleFollowUpChecklistSlot(f, slot, customHolidaySet, myName)); }
  function handleFollowUpFieldsChange(entryId, fields) { setForm((f) => updateFollowUpEntryInCandidate(f, entryId, fields)); }
  function handleFollowUpRemove(entryId) {
    setForm((f) => removeFollowUpEntryFromCandidate(f, entryId));
    setConfirmFuId(null);
  }

  const interviews = form.interviews || [];
  const apps = form.applications || [];
  const appCounts = apps.reduce((acc, a) => {
    const cat = applicationStatusInfo(a.status).category;
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const summaryCounts = computeApplicationSummaryCounts(apps);

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-40 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-semibold text-slate-900">{isNew ? "求職者を新規登録" : "求職者詳細"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">求職者ステータス</label>
            <select
              value={form.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium"
              style={{ color: candidateStatusInfo(form.status).color }}
            >
              {CANDIDATE_PHASE_ORDER.map((phase) => (
                <optgroup key={phase} label={CANDIDATE_PHASE_LABEL[phase]}>
                  {CANDIDATE_STATUS_ORDER.filter((k) => CANDIDATE_STATUS_CONFIG[k].phase === phase).map((k) => (
                    <option key={k} value={k}>{CANDIDATE_STATUS_CONFIG[k].label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* 基本情報 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="氏名" required><input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" /></Field>
            <Field label="ヨミ">
              <select value={form.yomi} onChange={(e) => set("yomi", e.target.value)} className="input">
                <option value="">未設定</option>
                {YOMI_ORDER.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="フリガナ"><input value={form.furigana} onChange={(e) => set("furigana", e.target.value)} className="input" /></Field>
            <Field label="メールアドレス"><input value={form.email} onChange={(e) => set("email", e.target.value)} className="input" /></Field>
            <Field label="電話番号"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" /></Field>
            <Field label="希望職種"><input value={form.desiredJobType} onChange={(e) => set("desiredJobType", e.target.value)} className="input" /></Field>
            <Field label="現職"><input value={form.currentCompany} onChange={(e) => set("currentCompany", e.target.value)} className="input" /></Field>
            <Field label="流入経路">
              <select value={form.source} onChange={(e) => set("source", e.target.value)} className="input">
                <option value="">未選択</option>
                {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="登録日"><input type="date" value={form.registeredDate} onChange={(e) => set("registeredDate", e.target.value)} className="input" /></Field>
            <Field label="応募時刻（任意）"><input type="time" value={form.applicationTime} onChange={(e) => set("applicationTime", e.target.value)} className="input" /></Field>
            <Field label="担当者">
              <select value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} className="input">
                <option value="">未割当</option>
                {consultants.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </Field>
            <Field label="追客リスト管理月"><input type="month" value={form.cohortMonth} onChange={(e) => set("cohortMonth", e.target.value)} className="input" /></Field>
            <Field label="次回アクション予定日"><input type="date" value={form.nextActionDate} onChange={(e) => set("nextActionDate", e.target.value)} className="input" /></Field>
            <Field label="最終接触日"><input type="date" value={form.lastContactDate} onChange={(e) => set("lastContactDate", e.target.value)} className="input" /></Field>
            <Field label="タグ（カンマ区切り）">
              <input defaultValue={(form.tags || []).join(", ")} onChange={(e) => set("tagsInput", e.target.value)} placeholder="例：ハイクラス, 急募" className="input" />
            </Field>
          </div>

          {/* 属性・経歴 */}
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2 pt-1 border-t border-slate-100">属性・経歴</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="性別">
                <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className="input">
                  <option value="">未選択</option>
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="年齢">
                <select value={form.age} onChange={(e) => set("age", e.target.value)} className="input">
                  <option value="">未選択</option>
                  {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a}歳</option>)}
                </select>
              </Field>
              <Field label="学歴">
                <select value={form.education} onChange={(e) => set("education", e.target.value)} className="input">
                  <option value="">未選択</option>
                  {EDUCATION_OPTIONS.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
                </select>
              </Field>
              {service === "challenge" && (
                <Field label="障がい種別">
                  <input value={form.disabilityType} onChange={(e) => set("disabilityType", e.target.value)} placeholder="例：精神障がい（うつ病）" className="input" />
                </Field>
              )}
              <Field label="居住地"><input value={form.residence} onChange={(e) => set("residence", e.target.value)} placeholder="例：東京都渋谷区" className="input" /></Field>
              <Field label="経験社数">
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} value={form.workExperienceCount} onChange={(e) => set("workExperienceCount", e.target.value)} className="input" />
                  <span className="text-xs text-slate-400 shrink-0">社</span>
                </div>
              </Field>
              <Field label="現職有無">
                <select value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)} className="input">
                  <option value="">未選択</option>
                  {EMPLOYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* 転職条件 */}
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2 pt-1 border-t border-slate-100">転職条件</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="現年収（万円）"><input type="number" min={0} value={form.currentSalary} onChange={(e) => set("currentSalary", e.target.value)} className="input" /></Field>
              <Field label="希望年収（万円）"><input type="number" min={0} value={form.desiredSalary} onChange={(e) => set("desiredSalary", e.target.value)} className="input" /></Field>
              <Field label="最低希望年収（万円）"><input type="number" min={0} value={form.minDesiredSalary} onChange={(e) => set("minDesiredSalary", e.target.value)} className="input" /></Field>
              <Field label="希望入社時期">
                <input list="join-timing-options" value={form.desiredJoinTiming} onChange={(e) => set("desiredJoinTiming", e.target.value)} className="input" />
                <datalist id="join-timing-options">{JOIN_TIMING_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
              </Field>
              <MultiSelectField label="希望勤務地（複数選択可）" options={PREFECTURE_OPTIONS} selected={form.desiredWorkLocation} onChange={(v) => set("desiredWorkLocation", v)} />
              <Field label="提案職種"><input value={form.proposedJobType} onChange={(e) => set("proposedJobType", e.target.value)} className="input" /></Field>
              <Field label="自己応募の有無">
                <select value={form.hasSelfApplication} onChange={(e) => set("hasSelfApplication", e.target.value)} className="input">
                  <option value="">未選択</option>
                  {YES_NO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="他社エージェント活用有無">
                <select value={form.usesOtherAgency} onChange={(e) => set("usesOtherAgency", e.target.value)} className="input">
                  <option value="">未選択</option>
                  {YES_NO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="転職活動の軸"><textarea value={form.jobChangeAxis} onChange={(e) => set("jobChangeAxis", e.target.value)} rows={2} placeholder="例：年収アップ、フルリモート、マネジメント経験を積みたい" className="input resize-none" /></Field>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-500">メモ</label>
              <span className="text-[11px] text-slate-400">{(form.memo || "").length} / 1000</span>
            </div>
            <textarea
              value={form.memo}
              onChange={(e) => set("memo", e.target.value.slice(0, 1000))}
              maxLength={1000}
              rows={3}
              className="input resize-none"
            />
          </div>

          {/* 追客タスク（応募から5営業日・1日2回） */}
          {!isNew && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block flex items-center gap-1">
                <PhoneCall size={13} /> 追客タスク（応募日を1営業日目として5営業日・1日2回）
              </label>
              {(() => {
                const dates = businessDayDatesFromRegistration(form.registeredDate, customHolidaySet);
                const checklist = form.followUpChecklist || emptyFollowUpChecklist();
                if (dates.length === 0) {
                  return <div className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">応募日が未設定のため、追客タスクを表示できません</div>;
                }
                return (
                  <div className="grid grid-cols-5 gap-1.5">
                    {dates.map((date, dayIdx) => (
                      <div key={dayIdx} className={`border rounded-lg p-1.5 text-center ${date === todayStr() ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}>
                        <div className="text-[10px] text-slate-400 leading-tight mb-1">{dayIdx + 1}日目<br />{fmtDate(date)}</div>
                        {[0, 1].map((t) => {
                          const slot = dayIdx * 2 + t;
                          return (
                            <label key={t} className="flex items-center justify-center gap-1 text-[11px] text-slate-600 py-0.5 cursor-pointer">
                              <input type="checkbox" checked={!!checklist[slot]} onChange={() => handleToggleChecklistSlot(slot)} className="accent-indigo-600" />
                              {t + 1}回目
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
              <p className="text-[11px] text-slate-400 mt-1.5">合計{(form.followUpChecklist || emptyFollowUpChecklist()).filter(Boolean).length}/10件完了。チェックすると、日時付きで下の「追客ログ」にも記録されます。</p>
            </div>
          )}

          {/* 追客ログ */}
          {!isNew && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <PhoneCall size={13} /> 追客ログ（{(form.followUpLog || []).length}件）
                </label>
                <div className="flex items-center gap-1">
                  <button onClick={handleQuickAddFollowUp} className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700">
                    <Plus size={12} /> 今すぐ記録{myName ? `（${myName}）` : ""}
                  </button>
                </div>
              </div>
              {(form.followUpLog || []).length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">まだ追客ログがありません</div>
              ) : (
                <div className="space-y-2">
                  {[...(form.followUpLog || [])].reverse().map((entry) => (
                    <FollowUpLogRow
                      key={entry.id}
                      entry={entry}
                      consultants={consultants}
                      onUpdateFields={(fields) => handleFollowUpFieldsChange(entry.id, fields)}
                      onRemove={() => handleFollowUpRemove(entry.id)}
                      confirmId={confirmFuId}
                      setConfirmId={setConfirmFuId}
                    />
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-1.5">月次の追客リストで「次月へコピー」を行うと、このログはリセットされます（ステータスや応募先は引き継がれます）。</p>
            </div>
          )}

          {/* 面談記録 */}
          {!isNew && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Calendar size={13} /> 面談（{interviews.length}件）
                </label>
                <button onClick={handleAddInterview} className="flex items-center gap-1 text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded-lg"><Plus size={12} /> 面談を追加</button>
              </div>
              {interviews.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">まだ面談が登録されていません</div>
              ) : (
                <div className="space-y-2">
                  {interviews.map((iv) => (
                    <InterviewRow
                      key={iv.id}
                      iv={iv}
                      onUpdateFields={(fields) => handleInterviewFieldsChange(iv.id, fields)}
                      onRemove={() => handleInterviewRemove(iv.id)}
                      confirmId={confirmIvId}
                      setConfirmId={setConfirmIvId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 選考サマリー（応募先データから自動算出） */}
          {!isNew && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-2">選考サマリー（応募先データから自動算出）</div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  ["プロセス応募求人数", summaryCounts.inProcessCount],
                  ["書類通過数", summaryCounts.documentPassedCount],
                  ["面接確定数", summaryCounts.interviewConfirmedCount],
                  ["面接通過数", summaryCounts.interviewPassedCount],
                  ["内定数", summaryCounts.offerCount],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-50 rounded-lg py-2 px-1">
                    <div className="text-lg font-semibold text-slate-800">{value}</div>
                    <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 応募先一覧 */}
          {!isNew && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Briefcase size={13} /> 応募先（{apps.length}社）
                  {apps.length > 0 && <span className="text-slate-400">・成約{appCounts.won || 0}・選考中{appCounts.open || 0}・見送り{appCounts.lost || 0}</span>}
                </label>
                <button onClick={handleAddApplication} className="flex items-center gap-1 text-xs text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded-lg"><Plus size={12} /> 応募先を追加</button>
              </div>
              {apps.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-lg">まだ応募先が登録されていません</div>
              ) : (
                <div className="space-y-2">
                  {apps.map((app) => (
                    <ApplicationRow
                      key={app.id}
                      app={app}
                      onUpdateFields={(fields) => handleAppFieldsChange(app.id, fields)}
                      onChangeStatus={(status) => handleAppStatusChange(app.id, status)}
                      onRemove={() => handleAppRemove(app.id)}
                      confirmId={confirmAppId}
                      setConfirmId={setConfirmAppId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 活動履歴 */}
          {!isNew && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block flex items-center gap-1"><StickyNote size={13} /> 活動履歴</label>
              <div className="flex gap-2 mb-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                  placeholder="対応内容を記録（例：架電し来週面談打診）"
                  className="input flex-1"
                />
                <button onClick={handleAddNote} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 shrink-0">追加</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-2.5 bg-slate-50">
                {(form.activities || []).length === 0 && <div className="text-xs text-slate-400 text-center py-3">活動履歴はまだありません</div>}
                {[...(form.activities || [])].reverse().map((a) => (
                  <div key={a.id} className="text-xs">
                    <span className="text-slate-400">{new Date(a.date).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="text-slate-700 ml-2">{a.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3.5 flex items-center justify-between">
          {!isNew ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">削除しますか？</span>
                <button onClick={() => onDelete(form.id)} className="text-rose-600 font-medium">削除する</button>
                <button onClick={() => setConfirmDelete(false)} className="text-slate-400">キャンセル</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-700"><Trash2 size={14} /> 削除</button>
            )
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50">キャンセル</button>
            <button onClick={handleSave} disabled={!form.name.trim()} className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">保存する</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== 進捗管理（担当者別KPI） ============================== */

function ProgressPanel({ candidates, consultants, kpiMonthly, dailyKpiValues, customHolidays, onSaveKpi, onSetDailyMetric, myName }) {
  const isMine = !!myName && consultants.includes(myName);
  const [month, setMonth] = useState(currentMonthKey());
  const [scope, setScope] = useState(isMine ? myName : "all");
  const [draft, setDraft] = useState(() =>
    isMine ? { ...emptyKpiTarget(), ...(kpiMonthly[targetKey(myName, currentMonthKey())] || {}) } : null
  );
  const [expandedCalendars, setExpandedCalendars] = useState({});
  function toggleCalendar(key) { setExpandedCalendars((prev) => ({ ...prev, [key]: !prev[key] })); }

  const customHolidaySet = useMemo(() => buildCustomHolidaySet(customHolidays), [customHolidays]);
  const businessDays = useMemo(() => countBusinessDaysInMonth(month, customHolidaySet), [month, customHolidaySet]);
  function perDay(target) {
    return businessDays > 0 ? (Number(target) || 0) / businessDays : 0;
  }

  const scopeTarget = useMemo(() => {
    if (scope === "all") {
      return consultants.reduce((acc, name) => {
        const t = kpiMonthly[targetKey(name, month)] || emptyKpiTarget();
        const merged = { ...acc };
        KPI_ROWS.forEach((r) => { merged[r.key] = (merged[r.key] || 0) + (t[r.key] || 0); });
        merged.revenueTarget = (merged.revenueTarget || 0) + (t.revenueTarget || 0);
        return merged;
      }, emptyKpiTarget());
    }
    return kpiMonthly[targetKey(scope, month)] || emptyKpiTarget();
  }, [scope, month, kpiMonthly, consultants]);

  const scopeActual = useMemo(
    () => computeScopeKpiActuals(dailyKpiValues, scope, consultants, month),
    [dailyKpiValues, scope, consultants, month]
  );

  const revenueActual = useMemo(() => {
    const names = scope === "all" ? consultants : [scope];
    return names.reduce((sum, name) => sum + computeMonthMetricActual(dailyKpiValues, "revenue", name, month), 0);
  }, [scope, month, dailyKpiValues, consultants]);

  const breakdown = useMemo(() => {
    return consultants.map((name) => {
      const t = kpiMonthly[targetKey(name, month)] || emptyKpiTarget();
      return {
        name, target: t,
        actual: computeScopeKpiActuals(dailyKpiValues, name, consultants, month),
        revenueActual: computeMonthMetricActual(dailyKpiValues, "revenue", name, month),
      };
    });
  }, [consultants, kpiMonthly, dailyKpiValues, month]);

  function startEdit() { setDraft({ ...emptyKpiTarget(), ...(kpiMonthly[targetKey(scope, month)] || {}) }); }
  function cancelEdit() { setDraft(null); }
  function saveEdit() {
    const parsed = { ...(kpiMonthly[targetKey(scope, month)] || emptyKpiTarget()) };
    KPI_ROWS.forEach((r) => { parsed[r.key] = Number(draft[r.key]) || 0; });
    parsed.revenueTarget = Number(draft.revenueTarget) || 0;
    onSaveKpi(scope, month, parsed);
    setDraft(null);
  }
  function handleMonthChange(newMonth) {
    setMonth(newMonth);
    if (scope !== "all") {
      setDraft((d) => (d ? { ...emptyKpiTarget(), ...(kpiMonthly[targetKey(scope, newMonth)] || {}) } : null));
    }
  }

  return (
    <div className="space-y-5">
      {isMine && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
          「{myName}」さんのKPI入力画面を自動的に開いています。他の担当者を見る場合は右上のセレクトボックスから切り替えてください。
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900">進捗管理（担当者別KPI）</h2>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => handleMonthChange(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
          <select value={scope} onChange={(e) => { setScope(e.target.value); setDraft(null); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="all">全体</option>
            {consultants.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-y-1">
          <div className="text-sm font-semibold text-slate-700">{scope === "all" ? "全体" : scope} ／ {fmtMonth(month)}</div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{fmtMonth(month)}の営業日数：{businessDays}日</span>
            {scope !== "all" && (
              draft ? (
                <div className="flex gap-2">
                  <button onClick={cancelEdit} className="text-xs text-slate-400 px-2">キャンセル</button>
                  <button onClick={saveEdit} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg">保存</button>
                </div>
              ) : (
                <button onClick={startEdit} className="text-xs flex items-center gap-1 text-indigo-600 px-2 py-1"><Pencil size={12} /> 目標を編集</button>
              )
            )}
          </div>
        </div>

        <div className="space-y-4">
          {KPI_ROWS.map((row) => (
            <div key={row.key}>
              <ProgressRow
                label={row.label}
                target={scopeTarget[row.key]}
                actual={scopeActual[row.key]}
                draftValue={draft ? draft[row.key] : null}
                onDraftChange={(v) => setDraft((d) => ({ ...d, [row.key]: v }))}
                editing={!!draft}
                perDayTarget={perDay(draft ? draft[row.key] : scopeTarget[row.key])}
              />
              {row.hasCalendar && scope !== "all" && (
                <div className="mt-1.5">
                  <button onClick={() => toggleCalendar(row.key)} className="text-xs flex items-center gap-1 text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded-lg">
                    <Calendar size={12} /> {expandedCalendars[row.key] ? "カレンダーを閉じる" : `日次カレンダーで${row.label}を入力`}
                  </button>
                  {expandedCalendars[row.key] && (
                    <div className="mt-2">
                      <MetricCalendar assignee={scope} month={month} metricKey={row.key} label={row.label} dailyKpiValues={dailyKpiValues} onSetDay={onSetDailyMetric} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="border-t border-slate-100 pt-4">
            <ProgressRow
              label="売上（万円）"
              target={scopeTarget.revenueTarget}
              actual={revenueActual}
              draftValue={draft ? draft.revenueTarget : null}
              onDraftChange={(v) => setDraft((d) => ({ ...d, revenueTarget: v }))}
              editing={!!draft}
              perDayTarget={perDay(draft ? draft.revenueTarget : scopeTarget.revenueTarget)}
              perDayUnit="万円"
            />
            {scope !== "all" && (
              <div className="mt-2">
                <button onClick={() => toggleCalendar("revenue")} className="text-xs flex items-center gap-1 text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded-lg">
                  <Calendar size={12} /> {expandedCalendars.revenue ? "カレンダーを閉じる" : "日次カレンダーで売上を入力"}
                </button>
                {expandedCalendars.revenue && (
                  <div className="mt-2">
                    <MetricCalendar assignee={scope} month={month} metricKey="revenue" unit="万円" label="売上（万円）" dailyKpiValues={dailyKpiValues} onSetDay={onSetDailyMetric} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">※面談実施数（合計）以外の実績は、担当者が日次カレンダーで入力した値の合計です（ダッシュボードの実データ集計とは別管理の自己申告値です）。1営業日あたりの目標は、月次目標を{fmtMonth(month)}の営業日数（{businessDays}日：土日・祝日・設定タブで登録した休暇を除く）で割って算出しています。</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto">
        <div className="text-sm font-semibold text-slate-700 mb-3">担当者別の目標と実績（{fmtMonth(month)}）</div>
        {consultants.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">担当者が登録されていません。設定タブから追加してください。</div>
        ) : (
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left font-normal py-2">担当者</th>
                {KPI_ROWS.map((row) => <th key={row.key} className="text-right font-normal py-2 whitespace-nowrap">{row.label}</th>)}
                <th className="text-right font-normal py-2 whitespace-nowrap">売上（万円）</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row) => (
                <tr key={row.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-700 whitespace-nowrap">{row.name}</td>
                  {KPI_ROWS.map((k) => (
                    <td key={k.key} className="py-2 text-right text-slate-600 whitespace-nowrap">{row.actual[k.key] || 0} / {row.target[k.key] || 0}</td>
                  ))}
                  <td className="py-2 text-right text-slate-600 whitespace-nowrap">{row.revenueActual.toLocaleString("ja-JP")} / {(row.target.revenueTarget || 0).toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ProgressRow({ label, target, actual, subActual, draftValue, onDraftChange, editing, actualEditable, draftActualValue, onActualDraftChange, perDayTarget, perDayUnit }) {
  const diff = (actual || 0) - (target || 0);
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1 flex-wrap gap-y-1">
        <span className="text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          {editing ? (
            <input type="number" min={0} value={draftValue} onChange={(e) => onDraftChange(Number(e.target.value))} className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-right" placeholder="目標" />
          ) : (
            <span className="text-slate-400 text-xs">目標 {target || 0}</span>
          )}
          {editing && actualEditable ? (
            <input type="number" min={0} value={draftActualValue} onChange={(e) => onActualDraftChange(Number(e.target.value))} className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-right font-semibold" placeholder="実績" />
          ) : (
            <span className="font-semibold text-slate-800">実績 {actual || 0}</span>
          )}
          <DiffBadge diff={diff} />
        </div>
      </div>
      <ProgressBar actual={actual || 0} target={target || 0} />
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-slate-400">{subActual || ""}</span>
        {typeof perDayTarget === "number" && (target || 0) > 0 && (
          <span className="text-[11px] text-slate-400">1営業日あたり目標：{perDayTarget.toFixed(1)}{perDayUnit || ""}</span>
        )}
      </div>
    </div>
  );
}

/* ============================== CSVインポート ============================== */

function autoMapHeaders(headers, fields = IMPORT_FIELDS) {
  const mapping = {};
  const used = new Set();
  for (const field of fields) {
    const match = headers.find((h) => {
      if (used.has(h)) return false;
      const nh = normalize(h);
      return field.aliases.some((al) => nh.includes(normalize(al)));
    });
    if (match) { mapping[field.key] = match; used.add(match); }
  }
  return mapping;
}

function downloadCsvTemplate() {
  const headers = IMPORT_FIELDS.map((f) => f.label);
  const example = ["山田太郎", "ヤマダタロウ", "taro@example.com", "090-1234-5678", todayStr(), "自社サイト", "営業", "株式会社サンプル", "佐藤", "新規登録", "初回面談調整中"];
  const csv = Papa.unparse({ fields: headers, data: [example] });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "求職者インポートテンプレート.csv"; a.click();
  URL.revokeObjectURL(url);
}

function CsvImportPanel({ existingCandidates, onImport }) {
  const [step, setStep] = useState("upload");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = Papa.parse(ev.target.result, { header: true, skipEmptyLines: true });
      const hdrs = parsed.meta.fields || [];
      setHeaders(hdrs); setRows(parsed.data); setMapping(autoMapHeaders(hdrs)); setStep("map");
    };
    reader.readAsText(file, "utf-8");
  }

  const existingEmails = useMemo(() => new Set(existingCandidates.map((c) => normalize(c.email)).filter(Boolean)), [existingCandidates]);

  function buildCandidates() {
    return rows.map((row) => {
      const get = (key) => (mapping[key] ? row[mapping[key]] : "") || "";
      const rawStatus = get("status");
      const cand = emptyCandidate();
      cand.name = get("name").trim();
      cand.furigana = get("furigana").trim();
      cand.email = get("email").trim();
      cand.phone = get("phone").trim();
      const regDate = get("registeredDate").trim();
      cand.registeredDate = /^\d{4}-\d{2}-\d{2}$/.test(regDate) ? regDate : todayStr();
      cand.source = get("source").trim();
      cand.desiredJobType = get("desiredJobType").trim();
      cand.currentCompany = get("currentCompany").trim();
      cand.assignedTo = get("assignedTo").trim();
      cand.memo = get("memo").trim();
      cand.status = rawStatus ? guessCandidateStatusKeyFromLabel(rawStatus) : "new";
      cand.lastContactDate = cand.registeredDate;
      cand.activities = [{ id: uid("a"), date: new Date().toISOString(), content: "CSVインポートにより登録" }];
      return cand;
    }).filter((c) => c.name);
  }

  function confirmImport() {
    const built = buildCandidates();
    const dupes = built.filter((c) => c.email && existingEmails.has(normalize(c.email))).length;
    onImport(built);
    setResult({ count: built.length, dupes });
    setStep("done");
  }
  function reset() { setStep("upload"); setHeaders([]); setRows([]); setMapping({}); setFileName(""); setResult(null); }

  const previewCandidates = step === "preview" ? buildCandidates() : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-slate-900">CSVインポート</h2>
        <button onClick={downloadCsvTemplate} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Download size={14} /> テンプレートをダウンロード</button>
      </div>

      {step === "upload" && (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-10 text-center">
          <Upload size={28} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-1">求職者データのCSVファイルを選択してください（UTF-8）</p>
          <p className="text-xs text-slate-400 mb-4">※応募先（企業ごとの選考状況）は登録後に求職者詳細から追加してください</p>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm cursor-pointer hover:bg-indigo-700">
            <Upload size={14} /> ファイルを選択
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
        </div>
      )}

      {step === "map" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="text-sm text-slate-500">{fileName}（{rows.length}件） — 取り込む列を確認してください</div>
          <div className="grid md:grid-cols-2 gap-3">
            {IMPORT_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{field.label}{field.required && <span className="text-rose-400 ml-0.5">*</span>}</label>
                <select value={mapping[field.key] || ""} onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))} className="input">
                  <option value="">取り込まない</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={reset} className="px-4 py-2 text-sm text-slate-500">やり直す</button>
            <button onClick={() => setStep("preview")} disabled={!mapping.name} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-40">プレビューへ</button>
          </div>
          {!mapping.name && <div className="text-xs text-rose-500">「氏名」の列は必須です</div>}
        </div>
      )}

      {step === "preview" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="text-sm text-slate-600"><strong>{previewCandidates.length}件</strong> を取り込みます（氏名が空白の行はスキップされます）。</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-left font-normal py-1.5">氏名</th>
                  <th className="text-left font-normal py-1.5">ステータス</th>
                  <th className="text-left font-normal py-1.5">担当者</th>
                  <th className="text-left font-normal py-1.5">登録日</th>
                  <th className="text-left font-normal py-1.5">メール</th>
                </tr>
              </thead>
              <tbody>
                {previewCandidates.slice(0, 6).map((c, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1.5">{c.name}</td>
                    <td className="py-1.5"><CandidateStatusBadge status={c.status} /></td>
                    <td className="py-1.5">{c.assignedTo || "—"}</td>
                    <td className="py-1.5">{fmtDate(c.registeredDate)}</td>
                    <td className="py-1.5 truncate">{c.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewCandidates.length > 6 && <div className="text-xs text-slate-400 mt-2">他 {previewCandidates.length - 6} 件…</div>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setStep("map")} className="px-4 py-2 text-sm text-slate-500">列の確認に戻る</button>
            <button onClick={confirmImport} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">この内容でインポート</button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <Check size={32} className="mx-auto text-emerald-500" />
          <div className="text-slate-700 font-medium">{result.count}件の求職者を登録しました</div>
          {result.dupes > 0 && <div className="text-xs text-amber-600">既存データと同じメールアドレスが {result.dupes}件 含まれていました。重複の可能性があるため、一覧から確認してください。</div>}
          <button onClick={reset} className="text-sm text-indigo-600 mt-2">続けてインポートする</button>
        </div>
      )}
    </div>
  );
}

/* ============================== 追客リストCSV出力 ============================== */

function exportFollowUpCsv(monthCandidates, month) {
  const headers = ["応募日", "応募時刻", "氏名", "年齢", "性別", "電話番号", "応募求人（職種）", "応募求人（会社名）", "流入経路", "選考ステータス", "追客ログ件数", "最終追客日時", "最終追客対応者"];
  const data = monthCandidates.map((c) => {
    const firstApp = (c.applications || [])[0];
    const log = c.followUpLog || [];
    const latest = log[log.length - 1];
    return [
      c.registeredDate, c.applicationTime || "", c.name, c.age || "", c.gender || "", c.phone || "",
      firstApp?.jobTitle || "", firstApp?.companyName || "", c.source || "",
      candidateStatusInfo(c.status).label,
      log.length,
      latest ? fmtDateTime(latest.date) : "",
      latest?.staffName || "",
    ];
  });
  const csv = Papa.unparse({ fields: headers, data });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `追客リスト_${month}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function downloadFollowUpCsvTemplate() {
  const headers = FOLLOWUP_IMPORT_FIELDS.map((f) => f.label);
  const example = ["2026/6/17 20:48", "28", "男", "07091065470", "カスタマーサクセス（法人向け）", "株式会社サンプル", "Indeed", "新規登録"];
  // 氏名列を先頭に追加（FOLLOWUP_IMPORT_FIELDS の並び順と合わせる）
  const exampleRow = ["山田太郎", ...example];
  const csv = Papa.unparse({ fields: headers, data: [exampleRow] });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "追客リストインポートテンプレート.csv"; a.click();
  URL.revokeObjectURL(url);
}

function FollowUpCsvImportPanel({ month, existingCandidates, onImport, onClose }) {
  const [step, setStep] = useState("upload");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = Papa.parse(ev.target.result, { header: true, skipEmptyLines: true });
      const hdrs = parsed.meta.fields || [];
      setHeaders(hdrs); setRows(parsed.data); setMapping(autoMapHeaders(hdrs, FOLLOWUP_IMPORT_FIELDS)); setStep("map");
    };
    reader.readAsText(file, "utf-8");
  }

  const existingPhones = useMemo(
    () => new Set(existingCandidates.filter((c) => c.cohortMonth === month).map((c) => normalize(c.phone)).filter(Boolean)),
    [existingCandidates, month]
  );

  function buildCandidates() {
    return rows.map((row) => {
      const get = (key) => (mapping[key] ? row[mapping[key]] : "") || "";
      const { date, time } = parseApplicationDateTime(get("appliedDateTime"));
      let cand = emptyCandidate();
      cand.name = get("name").trim();
      cand.age = get("age").trim();
      cand.gender = get("gender").trim();
      cand.phone = get("phone").trim();
      cand.source = get("source").trim();
      cand.registeredDate = date;
      cand.applicationTime = time;
      cand.cohortMonth = month;
      cand.lastContactDate = date;
      cand.activities = [{ id: uid("a"), date: new Date().toISOString(), content: "CSVインポート（追客リスト）により登録" }];
      const rawStatus = get("status").trim();
      cand.status = rawStatus ? guessCandidateStatusKeyFromLabel(rawStatus) : "new";
      const jobTitle = get("jobTitle").trim();
      const companyName = get("companyName").trim();
      if (jobTitle || companyName) {
        cand = addApplicationToCandidate(cand, { jobTitle, companyName });
        cand.status = rawStatus ? guessCandidateStatusKeyFromLabel(rawStatus) : "new"; // 自動の面談済み昇格を打ち消す
      }
      return cand;
    }).filter((c) => c.name);
  }

  function confirmImport() {
    const built = buildCandidates();
    const dupes = built.filter((c) => c.phone && existingPhones.has(normalize(c.phone))).length;
    onImport(built);
    setResult({ count: built.length, dupes });
    setStep("done");
  }
  function reset() { setStep("upload"); setHeaders([]); setRows([]); setMapping({}); setFileName(""); setResult(null); }

  const previewCandidates = step === "preview" ? buildCandidates() : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-slate-700">追客リストCSVインポート（{fmtMonth(month)}）</div>
        <div className="flex items-center gap-2">
          <button onClick={downloadFollowUpCsvTemplate} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Download size={12} /> テンプレート</button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
      </div>

      {step === "upload" && (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
          <Upload size={24} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-4">CSVファイルを選択してください（UTF-8）。{fmtMonth(month)}の追客対象として登録されます。</p>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm cursor-pointer hover:bg-indigo-700">
            <Upload size={14} /> ファイルを選択
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <div className="text-sm text-slate-500">{fileName}（{rows.length}件） — 取り込む列を確認してください</div>
          <div className="grid md:grid-cols-2 gap-3">
            {FOLLOWUP_IMPORT_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{field.label}{field.required && <span className="text-rose-400 ml-0.5">*</span>}</label>
                <select value={mapping[field.key] || ""} onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))} className="input">
                  <option value="">取り込まない</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={reset} className="px-4 py-2 text-sm text-slate-500">やり直す</button>
            <button onClick={() => setStep("preview")} disabled={!mapping.name} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-40">プレビューへ</button>
          </div>
          {!mapping.name && <div className="text-xs text-rose-500">「氏名」の列は必須です</div>}
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="text-sm text-slate-600"><strong>{previewCandidates.length}件</strong> を{fmtMonth(month)}の追客対象として取り込みます。</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-left font-normal py-1.5">氏名</th>
                  <th className="text-left font-normal py-1.5">応募日時</th>
                  <th className="text-left font-normal py-1.5">応募求人</th>
                  <th className="text-left font-normal py-1.5">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {previewCandidates.slice(0, 6).map((c, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1.5">{c.name}</td>
                    <td className="py-1.5">{fmtDate(c.registeredDate)} {c.applicationTime}</td>
                    <td className="py-1.5 truncate">{c.applications?.[0] ? `${c.applications[0].jobTitle || ""} / ${c.applications[0].companyName || ""}` : "—"}</td>
                    <td className="py-1.5"><CandidateStatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewCandidates.length > 6 && <div className="text-xs text-slate-400 mt-2">他 {previewCandidates.length - 6} 件…</div>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setStep("map")} className="px-4 py-2 text-sm text-slate-500">列の確認に戻る</button>
            <button onClick={confirmImport} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">この内容でインポート</button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="p-6 text-center space-y-3">
          <Check size={28} className="mx-auto text-emerald-500" />
          <div className="text-slate-700 font-medium">{result.count}件を{fmtMonth(month)}の追客リストに登録しました</div>
          {result.dupes > 0 && <div className="text-xs text-amber-600">同月内に同じ電話番号の求職者が {result.dupes}件 含まれていました。重複の可能性があるため一覧から確認してください。</div>}
          <div className="flex justify-center gap-3">
            <button onClick={reset} className="text-sm text-indigo-600">続けてインポートする</button>
            <button onClick={onClose} className="text-sm text-slate-500">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== 設定 ============================== */

function SettingsPanel({ consultants, onAdd, onRemove, myName, onSetMyName, customHolidays, onAddHoliday, onRemoveHoliday }) {
  const [name, setName] = useState("");
  const [holidayDraft, setHolidayDraft] = useState(() => emptyCustomHoliday());

  function submitHoliday() {
    if (!holidayDraft.startDate) return;
    onAddHoliday({ ...holidayDraft, endDate: holidayDraft.endDate || holidayDraft.startDate });
    setHolidayDraft(emptyCustomHoliday());
  }

  const sortedHolidays = [...(customHolidays || [])].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="space-y-5 max-w-md">
      <h2 className="text-lg font-semibold text-slate-900">設定</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="text-sm font-semibold text-slate-700 mb-1">あなたの担当者名</div>
        <p className="text-xs text-slate-400 mb-3">設定すると、次回以降「進捗管理」タブを開いたときに自動的にあなたのKPI入力画面が開きます。この端末・アカウントのみの個人設定で、他の人には影響しません。</p>
        <select value={myName} onChange={(e) => onSetMyName(e.target.value)} className="input">
          <option value="">未設定</option>
          {consultants.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="text-sm font-semibold text-slate-700 mb-3">担当者（コンサルタント）</div>
        <div className="space-y-2 mb-4">
          {consultants.map((c) => (
            <div key={c} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-sm text-slate-700">{c}</span>
              <button onClick={() => onRemove(c)} className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
            </div>
          ))}
          {consultants.length === 0 && <div className="text-sm text-slate-400 text-center py-3">担当者が未登録です</div>}
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onAdd(name.trim()); setName(""); } }}
            placeholder="担当者名を入力"
            className="input flex-1"
          />
          <button onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(""); } }} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm shrink-0">追加</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="text-sm font-semibold text-slate-700 mb-1">営業日設定（休暇・年末年始など）</div>
        <p className="text-xs text-slate-400 mb-3">土日・日本の祝日は自動的に営業日から除外されます。それ以外の休暇（夏季休暇、年末年始など）はここで期間を指定して登録してください。進捗管理タブのKPI日割り計算に反映されます。</p>
        <div className="space-y-2 mb-4">
          {sortedHolidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 gap-2">
              <div className="text-sm text-slate-700 min-w-0">
                <span className="truncate">{h.label || "（名称未設定）"}</span>
                <span className="text-xs text-slate-400 block">{fmtDate(h.startDate)}{h.endDate && h.endDate !== h.startDate ? `〜${fmtDate(h.endDate)}` : ""}</span>
              </div>
              <button onClick={() => onRemoveHoliday(h.id)} className="text-slate-400 hover:text-rose-500 shrink-0"><X size={14} /></button>
            </div>
          ))}
          {sortedHolidays.length === 0 && <div className="text-sm text-slate-400 text-center py-3">登録された休暇はありません</div>}
        </div>
        <div className="space-y-2">
          <input
            value={holidayDraft.label}
            onChange={(e) => setHolidayDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="名称（例：年末年始休暇）"
            className="input"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">開始日</label>
              <input type="date" value={holidayDraft.startDate} onChange={(e) => setHolidayDraft((d) => ({ ...d, startDate: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">終了日（単日の場合は省略可）</label>
              <input type="date" value={holidayDraft.endDate} onChange={(e) => setHolidayDraft((d) => ({ ...d, endDate: e.target.value }))} className="input" />
            </div>
          </div>
          <button onClick={submitHoliday} className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm">休暇を追加</button>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">このCRMのデータはチーム全員で共有されます。同時に編集すると、後から保存した内容が優先されます。</p>
    </div>
  );
}

/* ============================== メインアプリ ============================== */

function CRM({ service, onSwitchService }) {
  const serviceInfo = SERVICE_CONFIG[service];
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [kpiMonthly, setKpiMonthly] = useState({});
  const [dailyKpiValues, setDailyKpiValues] = useState({});
  const [revenue, setRevenue] = useState({});
  const [customHolidays, setCustomHolidays] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [showNewInquiry, setShowNewInquiry] = useState(false);
  const [myName, setMyName] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState(null);
  const [dashMonth, setDashMonth] = useState(currentMonthKey());
  const [isAddingSample, setIsAddingSample] = useState(false);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  /* あなたの担当者名はこの端末（ブラウザ）だけの個人設定として保存する（ログイン機能がないため） */
  const myNameStorageKey = `myName:${service}`;

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cands, cons, kpi, dailyKpi, rev, holidays, inqs] = await Promise.all([
        db.fetchCandidates(service),
        db.fetchConsultants(service),
        db.fetchKpiTargets(service),
        db.fetchDailyKpiValues(service),
        db.fetchCompanyRevenue(service),
        db.fetchCustomHolidays(service),
        db.fetchInquiries(service),
      ]);

      let finalConsultants = cons;
      if (finalConsultants.length === 0) {
        await db.seedConsultants(service, DEFAULT_CONSULTANTS);
        finalConsultants = DEFAULT_CONSULTANTS;
      }

      setCandidates(cands);
      setConsultants(finalConsultants);
      setKpiMonthly(kpi);
      setDailyKpiValues(dailyKpi);
      setRevenue(rev);
      setCustomHolidays(holidays);
      setInquiries(inqs);
      setMyName(localStorage.getItem(myNameStorageKey) || "");
    } catch (e) {
      console.error(e);
      showToast("データの読み込みに失敗しました。Supabaseの接続設定をご確認ください", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, service, myNameStorageKey]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function reportError(e, msg) {
    console.error(e);
    showToast(msg, "error");
  }

  /* setState は常に「直前の最新状態」を引数で受け取る関数型の更新を使う。
     これにより、ボタンの連続タップなどで更新が重なっても取りこぼしが起きない。
     画面への反映は即時に行い、データベースへの保存はバックグラウンドで行う。 */

  function handleUpsertCandidate(cand) {
    setCandidates((prev) => {
      const exists = prev.some((c) => c.id === cand.id);
      return exists ? prev.map((c) => (c.id === cand.id ? cand : c)) : [...prev, cand];
    });
    db.upsertCandidate(service, cand).catch((e) => reportError(e, "保存に失敗しました"));
    setSelectedId(null); setShowNew(false);
    showToast("保存しました");
  }
  function handleDeleteCandidate(id) {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    db.deleteCandidateRow(id).catch((e) => reportError(e, "削除に失敗しました"));
    setSelectedId(null);
    showToast("削除しました");
  }
  function handleImportCandidates(newOnes) {
    setCandidates((prev) => [...prev, ...newOnes]);
    db.insertManyCandidates(service, newOnes).catch((e) => reportError(e, "保存に失敗しました"));
    showToast(`${newOnes.length}件をインポートしました`);
  }
  function handleAddSampleCandidate() {
    if (isAddingSample) return;
    setIsAddingSample(true);
    const sample = createSampleCandidate(service, consultants);
    setCandidates((prev) => [...prev, sample]);
    db.upsertCandidate(service, sample).catch((e) => reportError(e, "保存に失敗しました"));
    showToast("サンプル求職者を1名追加しました（求職者一覧・追客リストの両方でご確認いただけます）");
    setTimeout(() => setIsAddingSample(false), 1200);
  }
  function handleSaveKpi(scope, month, parsed) {
    if (scope === "all" || !parsed) return;
    setKpiMonthly((prev) => ({ ...prev, [targetKey(scope, month)]: parsed }));
    db.saveKpiTarget(service, scope, month, parsed).catch((e) => reportError(e, "保存に失敗しました"));
    showToast("KPIを保存しました");
  }
  function handleSetDailyMetric(metricKey, assignee, date, value) {
    const key = dailyKpiKey(metricKey, assignee, date);
    const num = Number(value);
    setDailyKpiValues((prev) => {
      const next = { ...prev };
      if (!value || isNaN(num) || num === 0) delete next[key];
      else next[key] = num;
      return next;
    });
    db.setDailyMetric(service, metricKey, assignee, date, value).catch((e) => reportError(e, "保存に失敗しました"));
  }
  function handleSaveRevenue(month, parsed) {
    setRevenue((prev) => ({ ...prev, [month]: parsed }));
    db.saveCompanyRevenue(service, month, parsed).catch((e) => reportError(e, "保存に失敗しました"));
    showToast("売上実績・目標を保存しました");
  }
  function handleAddConsultant(name) {
    setConsultants((prev) => (prev.includes(name) ? prev : [...prev, name]));
    db.addConsultant(service, name).catch((e) => reportError(e, "保存に失敗しました"));
  }
  function handleRemoveConsultant(name) {
    setConsultants((prev) => prev.filter((c) => c !== name));
    db.removeConsultant(service, name).catch((e) => reportError(e, "削除に失敗しました"));
  }
  function handleAddCustomHoliday(holiday) {
    setCustomHolidays((prev) => [...prev, holiday]);
    db.addCustomHoliday(service, holiday).catch((e) => reportError(e, "保存に失敗しました"));
    showToast("休暇を登録しました");
  }
  function handleRemoveCustomHoliday(id) {
    setCustomHolidays((prev) => prev.filter((h) => h.id !== id));
    db.removeCustomHoliday(id).catch((e) => reportError(e, "削除に失敗しました"));
    showToast("休暇を削除しました");
  }
  function handleUpsertInquiry(inq) {
    setInquiries((prev) => {
      const exists = prev.some((i) => i.id === inq.id);
      return exists ? prev.map((i) => (i.id === inq.id ? inq : i)) : [...prev, inq];
    });
    db.upsertInquiry(service, inq).catch((e) => reportError(e, "保存に失敗しました"));
    setSelectedInquiryId(null); setShowNewInquiry(false);
    showToast("保存しました");
  }
  function handleDeleteInquiry(id) {
    setInquiries((prev) => prev.filter((i) => i.id !== id));
    db.deleteInquiryRow(id).catch((e) => reportError(e, "削除に失敗しました"));
    setSelectedInquiryId(null);
    showToast("削除しました");
  }
  function handleSetMyName(name) {
    setMyName(name);
    try { localStorage.setItem(myNameStorageKey, name); } catch (e) { console.error(e); }
    showToast(name ? `担当者名を「${name}」に設定しました` : "担当者名の設定を解除しました");
  }

  function handleExportCsv() {
    const headers = IMPORT_FIELDS.map((f) => f.label);
    const data = candidates.map((c) => [
      c.name, c.furigana, c.email, c.phone, c.registeredDate, c.source,
      c.desiredJobType, c.currentCompany, c.assignedTo, candidateStatusInfo(c.status).label, c.memo,
    ]);
    const csv = Papa.unparse({ fields: headers, data });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `求職者一覧_${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const selectedCandidate = candidates.find((c) => c.id === selectedId) || null;
  const selectedInquiry = inquiries.find((i) => i.id === selectedInquiryId) || null;

  const tabs = [
    { key: "dashboard", label: "ダッシュボード", icon: LayoutDashboard },
    { key: "list", label: "求職者一覧", icon: Users },
    { key: "followup", label: "追客リスト", icon: PhoneCall },
    { key: "inquiries", label: "企業問い合わせ", icon: Building2 },
    { key: "progress", label: "進捗管理", icon: Target },
    { key: "import", label: "CSVインポート", icon: FileSpreadsheet },
    { key: "settings", label: "設定", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style>{`.input { width: 100%; border: 1px solid #E2E8F0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; background: white; }
        .input:focus { outline: 2px solid #818CF8; outline-offset: 1px; border-color: #818CF8; }`}</style>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-white rounded-lg p-1.5 shrink-0" style={{ backgroundColor: serviceInfo.color }}><Users size={16} /></div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 leading-tight truncate">人材事業CRM</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: serviceInfo.color }}>{serviceInfo.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onSwitchService} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 whitespace-nowrap">事業を切り替え</button>
            <button onClick={loadAll} className="text-slate-400 hover:text-slate-600 p-1.5" title="最新の情報に更新">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto pb-1.5">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${activeTab === t.key ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"}`}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {loading ? (
          <div className="text-center text-slate-400 py-20 text-sm">読み込み中…</div>
        ) : (
          <>
            {activeTab === "dashboard" && <DashboardPanel candidates={candidates} month={dashMonth} setMonth={setDashMonth} onOpen={setSelectedId} revenue={revenue} onSaveRevenue={handleSaveRevenue} />}
            {activeTab === "list" && <CandidateListPanel candidates={candidates} consultants={consultants} onOpen={setSelectedId} onNew={() => setShowNew(true)} onExport={handleExportCsv} onAddSample={handleAddSampleCandidate} addingSample={isAddingSample} />}
            {activeTab === "followup" && <FollowUpPanel candidates={candidates} consultants={consultants} myName={myName} customHolidays={customHolidays} onUpsertCandidate={handleUpsertCandidate} onOpenDetail={setSelectedId} />}
            {activeTab === "inquiries" && <InquiryListPanel inquiries={inquiries} consultants={consultants} onOpen={setSelectedInquiryId} onNew={() => setShowNewInquiry(true)} />}
            {activeTab === "progress" && <ProgressPanel candidates={candidates} consultants={consultants} kpiMonthly={kpiMonthly} dailyKpiValues={dailyKpiValues} customHolidays={customHolidays} onSaveKpi={handleSaveKpi} onSetDailyMetric={handleSetDailyMetric} myName={myName} />}
            {activeTab === "import" && <CsvImportPanel existingCandidates={candidates} onImport={handleImportCandidates} />}
            {activeTab === "settings" && <SettingsPanel consultants={consultants} onAdd={handleAddConsultant} onRemove={handleRemoveConsultant} myName={myName} onSetMyName={handleSetMyName} customHolidays={customHolidays} onAddHoliday={handleAddCustomHoliday} onRemoveHoliday={handleRemoveCustomHoliday} />}
          </>
        )}
      </main>

      {selectedCandidate && (
        <CandidateModal candidate={selectedCandidate} consultants={consultants} isNew={false} myName={myName} service={service} customHolidays={customHolidays} onClose={() => setSelectedId(null)} onSave={handleUpsertCandidate} onDelete={handleDeleteCandidate} />
      )}
      {showNew && (
        <CandidateModal candidate={emptyCandidate()} consultants={consultants} isNew={true} myName={myName} service={service} customHolidays={customHolidays} onClose={() => setShowNew(false)} onSave={handleUpsertCandidate} onDelete={() => {}} />
      )}

      {selectedInquiry && (
        <InquiryModal inquiry={selectedInquiry} consultants={consultants} isNew={false} onClose={() => setSelectedInquiryId(null)} onSave={handleUpsertInquiry} onDelete={handleDeleteInquiry} />
      )}
      {showNewInquiry && (
        <InquiryModal inquiry={emptyInquiry()} consultants={consultants} isNew={true} onClose={() => setShowNewInquiry(false)} onSave={handleUpsertInquiry} onDelete={() => {}} />
      )}

      <Toast toast={toast} />
    </div>
  );
}

/* ============================== 事業選択画面 ============================== */

function ServiceSelector({ onChoose }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex bg-slate-900 text-white rounded-xl p-2.5 mb-4"><Users size={22} /></div>
          <h1 className="text-xl font-semibold text-slate-900">人材事業CRM</h1>
          <p className="text-sm text-slate-500 mt-1.5">ご利用する事業を選択してください</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {SERVICE_ORDER.map((id) => {
            const s = SERVICE_CONFIG[id];
            return (
              <button
                key={id}
                onClick={() => onChoose(id)}
                className="bg-white border border-slate-200 rounded-2xl p-6 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white" style={{ backgroundColor: s.color }}>
                  <Users size={18} />
                </div>
                <div className="font-semibold text-slate-900 mb-1">{s.name}</div>
                <div className="text-xs text-slate-400 mb-4">{s.tagline}</div>
                <div className="flex items-center gap-1 text-sm font-medium" style={{ color: s.color }}>
                  入室する <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 text-center mt-6">選択した事業はこの端末に記憶され、次回以降は自動的に開きます。後から切り替えることもできます。</p>
      </div>
    </div>
  );
}

export default function App() {
  const [service, setService] = useState(null);
  const [loadingService, setLoadingService] = useState(true);

  useEffect(() => {
    try {
      const val = localStorage.getItem("myService");
      if (val && SERVICE_CONFIG[val]) setService(val);
    } catch (e) {
      console.error(e);
      // 未設定（初回利用）の場合はそのまま選択画面を表示する
    }
    setLoadingService(false);
  }, []);

  function chooseService(id) {
    setService(id);
    try { localStorage.setItem("myService", id); } catch (e) { console.error(e); }
  }
  function switchService() {
    setService(null);
    try { localStorage.removeItem("myService"); } catch (e) { console.error(e); }
  }

  if (loadingService) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 text-sm">読み込み中…</div>;
  }
  if (!service) {
    return <ServiceSelector onChoose={chooseService} />;
  }
  return <CRM service={service} onSwitchService={switchService} />;
}
