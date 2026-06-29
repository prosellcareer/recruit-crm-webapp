import { supabase } from "./supabaseClient";

/* ============================== ユーティリティ ============================== */

function emptyToNull(v) { return v === "" || v === undefined ? null : v; }
function nullToEmpty(v) { return v === null || v === undefined ? "" : v; }

/* ============================== 求職者（candidates） ============================== */

function candidateToRow(service, c) {
  return {
    id: c.id,
    service,
    name: c.name || "",
    yomi: c.yomi || "",
    furigana: c.furigana || "",
    email: c.email || "",
    phone: c.phone || "",
    registered_date: emptyToNull(c.registeredDate),
    application_time: c.applicationTime || "",
    source: c.source || "",
    desired_job_type: c.desiredJobType || "",
    current_company: c.currentCompany || "",
    status: c.status || "new",
    assigned_to: c.assignedTo || "",
    tags: c.tags || [],
    memo: c.memo || "",
    last_contact_date: emptyToNull(c.lastContactDate),
    next_action_date: emptyToNull(c.nextActionDate),
    first_interview_date: emptyToNull(c.firstInterviewDate),
    closed_date: emptyToNull(c.closedDate),
    gender: c.gender || "",
    age: c.age || "",
    education: c.education || "",
    disability_type: c.disabilityType || "",
    residence: c.residence || "",
    work_experience_count: c.workExperienceCount || "",
    employment_status: c.employmentStatus || "",
    current_salary: c.currentSalary || "",
    desired_salary: c.desiredSalary || "",
    min_desired_salary: c.minDesiredSalary || "",
    desired_work_location: c.desiredWorkLocation || [],
    desired_join_timing: c.desiredJoinTiming || "",
    job_change_axis: c.jobChangeAxis || "",
    has_self_application: c.hasSelfApplication || "",
    uses_other_agency: c.usesOtherAgency || "",
    proposed_job_type: c.proposedJobType || "",
    cohort_month: c.cohortMonth || "",
    interviews: c.interviews || [],
    applications: c.applications || [],
    follow_up_log: c.followUpLog || [],
    follow_up_checklist: c.followUpChecklist || Array(10).fill(false),
    activities: c.activities || [],
  };
}

function rowToCandidate(row) {
  return {
    id: row.id,
    name: row.name || "",
    yomi: row.yomi || "",
    furigana: row.furigana || "",
    email: row.email || "",
    phone: row.phone || "",
    registeredDate: nullToEmpty(row.registered_date),
    applicationTime: row.application_time || "",
    source: row.source || "",
    desiredJobType: row.desired_job_type || "",
    currentCompany: row.current_company || "",
    status: row.status || "new",
    assignedTo: row.assigned_to || "",
    tags: row.tags || [],
    memo: row.memo || "",
    lastContactDate: nullToEmpty(row.last_contact_date),
    nextActionDate: nullToEmpty(row.next_action_date),
    firstInterviewDate: nullToEmpty(row.first_interview_date),
    closedDate: nullToEmpty(row.closed_date),
    gender: row.gender || "",
    age: row.age || "",
    education: row.education || "",
    disabilityType: row.disability_type || "",
    residence: row.residence || "",
    workExperienceCount: row.work_experience_count || "",
    employmentStatus: row.employment_status || "",
    currentSalary: row.current_salary || "",
    desiredSalary: row.desired_salary || "",
    minDesiredSalary: row.min_desired_salary || "",
    desiredWorkLocation: row.desired_work_location || [],
    desiredJoinTiming: row.desired_join_timing || "",
    jobChangeAxis: row.job_change_axis || "",
    hasSelfApplication: row.has_self_application || "",
    usesOtherAgency: row.uses_other_agency || "",
    proposedJobType: row.proposed_job_type || "",
    cohortMonth: row.cohort_month || "",
    interviews: row.interviews || [],
    applications: row.applications || [],
    followUpLog: row.follow_up_log || [],
    followUpChecklist: row.follow_up_checklist || Array(10).fill(false),
    activities: row.activities || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchCandidates(service) {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("service", service)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToCandidate);
}

export async function upsertCandidate(service, candidate) {
  const { error } = await supabase.from("candidates").upsert(candidateToRow(service, candidate));
  if (error) throw error;
}

export async function insertManyCandidates(service, candidateArray) {
  if (!candidateArray.length) return;
  const rows = candidateArray.map((c) => candidateToRow(service, c));
  const { error } = await supabase.from("candidates").insert(rows);
  if (error) throw error;
}

export async function deleteCandidateRow(id) {
  const { error } = await supabase.from("candidates").delete().eq("id", id);
  if (error) throw error;
}

/* ============================== 担当者（consultants） ============================== */

export async function fetchConsultants(service) {
  const { data, error } = await supabase
    .from("consultants")
    .select("name")
    .eq("service", service)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => r.name);
}

export async function addConsultant(service, name) {
  const { error } = await supabase.from("consultants").insert({ service, name });
  if (error && error.code !== "23505") throw error; // 23505 = 重複（既に登録済み）は無視する
}

export async function removeConsultant(service, name) {
  const { error } = await supabase.from("consultants").delete().eq("service", service).eq("name", name);
  if (error) throw error;
}

export async function seedConsultants(service, names) {
  if (!names.length) return;
  const rows = names.map((name) => ({ service, name }));
  const { error } = await supabase.from("consultants").insert(rows);
  if (error && error.code !== "23505") throw error;
}

/* ============================== 担当者別KPI目標（kpi_targets） ============================== */

export async function fetchKpiTargets(service) {
  const { data, error } = await supabase.from("kpi_targets").select("*").eq("service", service);
  if (error) throw error;
  const result = {};
  (data || []).forEach((row) => {
    result[`${row.assignee}__${row.month}`] = {
      meetingScheduled: row.meeting_scheduled || 0,
      firstMeetingDone: row.first_meeting_done || 0,
      followMeetingDone: row.follow_meeting_done || 0,
      meetingDoneTotal: row.meeting_done_total || 0,
      documentPassed: row.document_passed || 0,
      offers: row.offers || 0,
      offerAccepted: row.offer_accepted || 0,
      revenueTarget: Number(row.revenue_target) || 0,
      revenueActual: Number(row.revenue_actual_legacy) || 0,
    };
  });
  return result;
}

export async function saveKpiTarget(service, assignee, month, data) {
  const { error } = await supabase.from("kpi_targets").upsert({
    service, assignee, month,
    meeting_scheduled: data.meetingScheduled || 0,
    first_meeting_done: data.firstMeetingDone || 0,
    follow_meeting_done: data.followMeetingDone || 0,
    meeting_done_total: data.meetingDoneTotal || 0,
    document_passed: data.documentPassed || 0,
    offers: data.offers || 0,
    offer_accepted: data.offerAccepted || 0,
    revenue_target: data.revenueTarget || 0,
    revenue_actual_legacy: data.revenueActual || 0,
  });
  if (error) throw error;
}

/* ============================== 日次KPIカレンダー（daily_kpi_values） ============================== */
/* 売上・面談予定数・初回面談実施数など、担当者が日次で入力するすべての指標を1テーブルで管理する */

export async function fetchDailyKpiValues(service) {
  const { data, error } = await supabase.from("daily_kpi_values").select("*").eq("service", service);
  if (error) throw error;
  const result = {};
  (data || []).forEach((row) => {
    result[`${row.metric_key}__${row.assignee}__${row.rev_date}`] = Number(row.amount) || 0;
  });
  return result;
}

export async function setDailyMetric(service, metricKey, assignee, date, amount) {
  const num = Number(amount);
  if (!amount || isNaN(num) || num === 0) {
    const { error } = await supabase
      .from("daily_kpi_values")
      .delete()
      .eq("service", service)
      .eq("metric_key", metricKey)
      .eq("assignee", assignee)
      .eq("rev_date", date);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("daily_kpi_values")
      .upsert({ service, metric_key: metricKey, assignee, rev_date: date, amount: num });
    if (error) throw error;
  }
}

/* ============================== 会社全体の売上（company_revenue） ============================== */

export async function fetchCompanyRevenue(service) {
  const { data, error } = await supabase.from("company_revenue").select("*").eq("service", service);
  if (error) throw error;
  const result = {};
  (data || []).forEach((row) => {
    result[row.month] = {
      caTarget: Number(row.ca_target) || 0,
      raTarget: Number(row.ra_target) || 0,
      totalTarget: Number(row.total_target) || 0,
      caActual: Number(row.ca_actual) || 0,
      raActual: Number(row.ra_actual) || 0,
      totalActual: Number(row.total_actual) || 0,
    };
  });
  return result;
}

export async function saveCompanyRevenue(service, month, data) {
  const { error } = await supabase.from("company_revenue").upsert({
    service, month,
    ca_target: data.caTarget || 0,
    ra_target: data.raTarget || 0,
    total_target: data.totalTarget || 0,
    ca_actual: data.caActual || 0,
    ra_actual: data.raActual || 0,
    total_actual: data.totalActual || 0,
  });
  if (error) throw error;
}

/* ============================== 営業日設定（custom_holidays） ============================== */

export async function fetchCustomHolidays(service) {
  const { data, error } = await supabase
    .from("custom_holidays")
    .select("*")
    .eq("service", service)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    label: row.label || "",
  }));
}

export async function addCustomHoliday(service, holiday) {
  const { error } = await supabase.from("custom_holidays").insert({
    id: holiday.id,
    service,
    start_date: holiday.startDate,
    end_date: holiday.endDate || holiday.startDate,
    label: holiday.label || "",
  });
  if (error) throw error;
}

export async function removeCustomHoliday(id) {
  const { error } = await supabase.from("custom_holidays").delete().eq("id", id);
  if (error) throw error;
}

/* ============================== 企業問い合わせ（inquiries） ============================== */

function inquiryToRow(service, inq) {
  return {
    id: inq.id,
    service,
    inquiry_date: inq.inquiryDate || null,
    company_name: inq.companyName || "",
    contact_person_name: inq.contactPersonName || "",
    inquiry_type: inq.inquiryType || "",
    inquiry_content: inq.inquiryContent || "",
    status: inq.status || "inquiry",
    assigned_to: inq.assignedTo || "",
    activities: inq.activities || [],
  };
}

function rowToInquiry(row) {
  return {
    id: row.id,
    inquiryDate: row.inquiry_date || "",
    companyName: row.company_name || "",
    contactPersonName: row.contact_person_name || "",
    inquiryType: row.inquiry_type || "",
    inquiryContent: row.inquiry_content || "",
    status: row.status || "inquiry",
    assignedTo: row.assigned_to || "",
    activities: row.activities || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchInquiries(service) {
  const { data, error } = await supabase
    .from("inquiries")
    .select("*")
    .eq("service", service)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToInquiry);
}

export async function upsertInquiry(service, inquiry) {
  const { error } = await supabase.from("inquiries").upsert(inquiryToRow(service, inquiry));
  if (error) throw error;
}

export async function deleteInquiryRow(id) {
  const { error } = await supabase.from("inquiries").delete().eq("id", id);
  if (error) throw error;
}
