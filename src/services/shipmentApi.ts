import type { Shipment, ShipmentMetricsSummary, DriveDataResponse, SheetTotalRow, SheetSummaryRow } from "@/types/shipment";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

function parseDate(val: unknown): string | undefined {
  if (!val || val === "") return undefined;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? undefined : d.toISOString().split("T")[0];
}

const DOCS = ["PI", "INV", "PKL", "BL", "CO", "HC", "DON_KD", "AN", "BB_LM", "PHI_TK", "THUE_NK", "15B", "QDTQ", "MV", "TRA_CONG"] as const;

type FlowStageKey = "buying" | "shipping" | "arrived" | "declared" | "fifteenb" | "customs" | "delivered";

function normalizeText(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_]/g, "");
}

function pickRowString(row: SheetSummaryRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text !== "") return text;
  }
  return "";
}

function pickFieldFromRow(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text !== "") return text;
  }
  return "";
}

function inferEmailFromText(text: string): string {
  const direct = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (direct) return direct;
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed;
  return "";
}

function inferNameFromEmail(email: string): string {
  if (!email) return "";
  const localPart = email.split("@")[0] || "";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  return cleaned || email;
}

function buildUploaderContact(row: SheetSummaryRow, docKey: string): { email?: string; name?: string } {
  const raw = row as Record<string, unknown>;
  const candidates = [
    `${docKey}_email`,
    `${docKey} email`,
    `email_${docKey}`,
    `${docKey}Email`,
    `${docKey}_name`,
    `${docKey} name`,
    `name_${docKey}`,
    `${docKey}Name`,
    `up_${docKey}`,
    `upload_${docKey}`,
    `${docKey}_up`,
    `${docKey} up`,
  ];
  const text = pickFieldFromRow(raw, candidates);
  const email = inferEmailFromText(text);
  const name = pickFieldFromRow(raw, [
    `${docKey}_name`,
    `${docKey} name`,
    `name_${docKey}`,
    `${docKey}Name`,
  ]) || inferNameFromEmail(email);
  return {
    email: email || undefined,
    name: name || undefined,
  };
}

function hasDoc(documents: import("@/types/shipment").ShipmentDocument[], key: string): boolean {
  return documents.some((d) => d.status === "ok" && normalizeText(d.name).includes(key));
}

function buildDocuments(
  totalDocs: number,
  receivedDocs: number,
  missingDocsText: string,
  row?: SheetSummaryRow
): import("@/types/shipment").ShipmentDocument[] {
  const missingSet = new Set(
    missingDocsText
      .split(/[,;\n]/)
      .map((v) => normalizeText(v.trim()))
      .filter(Boolean)
  );

  return DOCS.map((key, idx) => {
    const missing = missingSet.has(key) || idx >= receivedDocs || idx >= totalDocs;
    const contact = row ? buildUploaderContact(row, key) : {};
    return {
      id: key,
      name: `Chứng từ ${key}`,
      type: "file",
      status: missing ? "missing" : "ok",
      note: missing ? "Thiếu theo getSheetTotal" : undefined,
      uploaderEmail: contact.email,
      uploaderName: contact.name,
    } as import("@/types/shipment").ShipmentDocument;
  }).reverse();
}

function deriveFlowStage(
  documents: import("@/types/shipment").ShipmentDocument[],
  eta?: string
): { key: FlowStageKey; label: string; isLate?: boolean } {
  const has = (k: string) => hasDoc(documents, k);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const etaLate = Boolean(eta && new Date(`${eta}T00:00:00`) < todayStart);

  if (has("TRA_CONG")) return { key: "delivered", label: "Giao hàng thành công" };
  if (has("QDTQ") || has("MV")) return { key: "customs", label: "Thông quan", isLate: etaLate };
  if (has("15B")) return { key: "fifteenb", label: "Mẫu 15B", isLate: etaLate };
  if (has("BB_LM") || has("PHI_TK") || has("THUE_NK")) return { key: "declared", label: "Nộp tờ khai", isLate: etaLate };
  if (has("DON_KD") || has("AN")) return { key: "arrived", label: "Đã đến cảng", isLate: etaLate };
  if (has("INV") || has("PKL") || has("BL") || has("CO") || has("HC")|| has("BL")) {
    return { key: "shipping", label: "Đang vận chuyển biển", isLate: etaLate };
  }
  return { key: "buying", label: "Lên đơn hàng", isLate: etaLate };
}

function mapToShipment(row: SheetSummaryRow, totalMap: Map<string, SheetTotalRow>, index: number): Shipment {
  const orderCode = String(row["Số HĐ"] ?? "").trim();
  const docInfo = totalMap.get(orderCode);
  const totalDocs = docInfo?.requist_docs ?? 0;
  const receivedDocs = docInfo?.total_docs ?? 0;
  const missingDocs = docInfo?.mis_docs ?? "";
  const traCong = pickRowString(row, ["TRA_CONG", "TRA CONG", "TRA-CONG", "TRA CÔNG", "Trả công"]);
  const eta = parseDate(pickRowString(row, ["ETA", "Eta"]));
  const ata = parseDate(pickRowString(row, ["ATA", "Ata"]));
  const documents = docInfo ? buildDocuments(totalDocs, receivedDocs, missingDocs, row) : [];
  const flowStage = deriveFlowStage(documents, eta);
  const hasCompletedDocs = totalDocs > 0 && receivedDocs >= totalDocs;
  const isDelivered = Boolean(traCong) || (docInfo?.status === 1 && hasCompletedDocs);
  const finalFlowStageKey: FlowStageKey = isDelivered ? "delivered" : flowStage.key;
  const finalFlowStageLabel = isDelivered ? "Giao hàng thành công" : flowStage.label;
  const isLate = !isDelivered && flowStage.isLate;

  return {
    id: `SH-${orderCode}-${index}`,
    orderCode,
    shipName: String(row["Tên hàng"] ?? "").trim(),
    supplier: String(row["KHÁCH HÀNG"] ?? "").trim(),
    factory: String(row["NHÀ MÁY"] ?? "").trim() || undefined,
    factoryCode: String(row["MÃ NHÀ MÁY"] ?? "").trim() || undefined,
    origin: String(row["XUẤT XỨ"] ?? "").trim() || undefined,
    vessel: String(row["Hãng tàu"] ?? "").trim() || undefined,
    bill: String(row["BL NO."] ?? "").trim() || undefined,
    etd: parseDate(row["ETD"]),
    eta,
    ata,
    port: String(row["Cảng"] ?? "").trim() || undefined,
    contCount: typeof row["Cont"] === "number" ? row["Cont"] : undefined,
    status: isDelivered ? "completed" : flowStage.key === "buying" ? "missing_docs" : "shipping",
    docStatus: docInfo?.status ?? 0,
    traCong: traCong || undefined,
    flowStageKey: finalFlowStageKey,
    flowStageLabel: finalFlowStageLabel,
    flowStageLate: isLate || undefined,
    totalDocs,
    receivedDocs,
    missingDocs,
    driveUrl: docInfo?.["folder url"] || undefined,
    timeUpdate: docInfo?.time_update,
    documents,
    thuong: typeof row["Thùng"] === "number" ? row["Thùng"] : undefined,
    trlg: typeof row["Trlg"] === "number" ? row["Trlg"] : undefined,
    giaB: typeof row["Giá bán($)"] === "number" ? row["Giá bán($)"] : undefined,
    thanhTien: typeof row["Thành tiền ($)"] === "number" ? row["Thành tiền ($)"] : undefined,
    updatedAt: docInfo?.time_update ?? new Date().toISOString(),
    createdAt: parseDate(pickRowString(row, ["Ngày HĐ", "NGÀY HĐ", "Ngay HD"])) ?? new Date().toISOString(),
  };
}

async function fetchSheetTotalMap(): Promise<Map<string, SheetTotalRow>> {
  const res = await fetch(`${API_BASE}/api/getSheetTotal`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getSheetTotal lỗi: ${res.status}`);
  const json = await res.json();
  const map = new Map<string, SheetTotalRow>();
  for (const row of (json.data ?? []) as SheetTotalRow[]) {
    const key = String(row.foldername ?? "").trim();
    if (key) map.set(key, row);
  }
  return map;
}

async function fetchSheetSummaryRows(): Promise<{ rows: SheetSummaryRow[]; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/api/getSheetSummary`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getSheetSummary lỗi: ${res.status}`);
  const json = await res.json();
  const rows: SheetSummaryRow[] = (json.data ?? []).filter(
    (r: SheetSummaryRow) => r["Số HĐ"] != null && r["Số HĐ"] !== "" && r["Tên hàng"] != null && r["Tên hàng"] !== ""
  );
  return { rows, updatedAt: json.updatedAt ?? new Date().toISOString() };
}

export async function fetchShipments() {
  const [totalResult, summaryResult] = await Promise.allSettled([fetchSheetTotalMap(), fetchSheetSummaryRows()]);
  if (totalResult.status === "rejected" && summaryResult.status === "rejected") {
    return { shipments: [], lastUpdated: new Date().toISOString(), updatedBy: "", error: String(summaryResult.reason) };
  }
  const totalMap = totalResult.status === "fulfilled" ? totalResult.value : new Map<string, SheetTotalRow>();
  if (summaryResult.status === "rejected") {
    return { shipments: [], lastUpdated: new Date().toISOString(), updatedBy: "", error: String(summaryResult.reason) };
  }
  const { rows, updatedAt } = summaryResult.value;
  const shipments = rows.map((row, idx) => mapToShipment(row, totalMap, idx)).filter((s) => s.orderCode !== "");
  return { shipments, lastUpdated: updatedAt, updatedBy: "Admin hệ thống" };
}

export async function triggerUpdateAll(): Promise<DriveDataResponse> {
  const res = await fetch(`${API_BASE}/api/updateAll`, { method: "GET", cache: "no-store" });
  if (!res.ok) return { success: false, message: "updateAll lỗi", updatedAt: new Date().toISOString() };
  return await res.json();
}

export function computeMetrics(shipments: Shipment[]): ShipmentMetricsSummary {
  return {
    total: shipments.length,
    completed: shipments.filter((s) => s.status === "completed").length,
    shipping: shipments.filter((s) => s.status === "shipping").length,
    missing_docs: shipments.filter((s) => s.status === "missing_docs").length,
  };
}
