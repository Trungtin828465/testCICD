"use client";
import React, { useState, useMemo } from "react";
import type { Shipment, ShipmentStatus } from "@/types/shipment";

interface ShipmentTableProps {
  shipments: Shipment[];
  onRowClick: (shipment: Shipment) => void;
}

const PAGE_SIZE = 10;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  buying: { label: "Lên đơn hàng", color: "text-amber-700", bg: "bg-amber-50 dark:bg-amber-500/10", dot: "bg-amber-500" },
  shipping: { label: "Xin giấy phép / Vận chuyển biển", color: "text-blue-light-600", bg: "bg-blue-light-50 dark:bg-blue-light-500/10", dot: "bg-blue-light-500" },
  arrived: { label: "Đã đến cảng", color: "text-blue-light-600", bg: "bg-blue-light-50 dark:bg-blue-light-500/10", dot: "bg-blue-light-500" },
  declared: { label: "Nộp tờ khai", color: "text-blue-light-600", bg: "bg-blue-light-50 dark:bg-blue-light-500/10", dot: "bg-blue-light-500" },
  fifteenb: { label: "Mẫu 15B", color: "text-blue-light-600", bg: "bg-blue-light-50 dark:bg-blue-light-500/10", dot: "bg-blue-light-500" },
  customs: { label: "Thông quan", color: "text-blue-light-600", bg: "bg-blue-light-50 dark:bg-blue-light-500/10", dot: "bg-blue-light-500" },
  delivered: { label: "Giao hàng thành công", color: "text-success-600", bg: "bg-success-50 dark:bg-success-500/10", dot: "bg-success-500" },
};

type SortKey = "orderCode" | "shipName" | "supplier" | "eta" | "status" | "receivedDocs";
type SortDir = "asc" | "desc";

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (sortKey !== col) {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
        <polyline points="7 15 12 20 17 15" />
        <polyline points="7 9 12 4 17 9" />
      </svg>
    );
  }

  return sortDir === "asc" ? (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-500">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN");
}

function DocBar({ total, received, missingList }: { total: number; received: number; missingList: string }) {
  const pct = total > 0 ? (received / total) * 100 : 0;
  const missing = total - received;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${missing > 0 ? "bg-blue-500" : "bg-success-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-xs font-medium tabular-nums ${missing > 0 ? "text-blue-600" : "text-success-600"}`}>
          {received}/{total}
        </span>
      </div>
      {missing > 0 && missingList && (
        <p className="text-[10px] text-gray-400 truncate max-w-[160px]" title={missingList}>
          Thiếu: {missingList}
        </p>
      )}
    </div>
  );
}

export default function ShipmentTable({ shipments, onRowClick }: ShipmentTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("orderCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    return [...shipments].sort((a, b) => {
      let va: string | number | undefined;
      let vb: string | number | undefined;
      if (sortKey === "receivedDocs") {
        va = a.receivedDocs;
        vb = b.receivedDocs;
        const cmp = (va ?? 0) < (vb ?? 0) ? -1 : (va ?? 0) > (vb ?? 0) ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      }
      va = a[sortKey as keyof Shipment] as string | undefined;
      vb = b[sortKey as keyof Shipment] as string | undefined;
      if (!va) va = "";
      if (!vb) vb = "";
      const cmp = String(va).localeCompare(String(vb), "vi");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [shipments, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, safePage]);

  const headerCls =
    "py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors";

  // Pagination page numbers
  function getPageNumbers() {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("...");
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Table header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Danh sách đơn hàng</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {shipments.length} đơn hàng
            {shipments.length > 0 && ` • Trang ${safePage}/${totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Click vào hàng để xem chi tiết</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
      </div>

      {/* Scrollable table */}
      {/* <div className="overflow-x-auto custom-scrollbar"> */}
        <div className="max-h-[600px] w-full overflow-auto custom-scrollbar">
          <table className="w-full min-w-[1100px] table-fixed">  
            <thead className="sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="py-3 px-4 w-[4%] text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-10">STT</th>
              <th className={`${headerCls} w-[12%]`} onClick={() => handleSort("orderCode")}>
                <div className="flex items-center gap-1.5">Số HĐ <SortIcon col="orderCode" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th className={`${headerCls} w-[22%]`} onClick={() => handleSort("shipName")}>
                <div className="flex items-center gap-1.5">Tên hàng <SortIcon col="shipName" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th className={`${headerCls} w-[12%]`} onClick={() => handleSort("supplier")}>
                <div className="flex items-center gap-1.5">Nhà cung cấp <SortIcon col="supplier" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th className={`${headerCls} w-[11%]`}>
                Cảng / Tàu
              </th>
              <th className={`${headerCls} w-[13%]`} onClick={() => handleSort("eta")}>
                <div className="flex items-center gap-1.5">ETD / ETA <SortIcon col="eta" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th className={`${headerCls} w-[15%]`} onClick={() => handleSort("status")}>
                <div className="flex items-center gap-1.5">Trạng thái <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th className={`${headerCls} w-[15%]`} onClick={() => handleSort("receivedDocs")}>
                <div className="flex items-center gap-1.5">Giấy tờ <SortIcon col="receivedDocs" sortKey={sortKey} sortDir={sortDir} /></div>
              </th>
              <th className="py-3 px-4 w-[5%]  text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    Không tìm thấy đơn hàng nào
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((shipment, rowIdx) => {
                const statusKey = shipment.flowStageKey || "buying";
                const sc = STATUS_CONFIG[statusKey] || STATUS_CONFIG.buying;
                const rowNum = (safePage - 1) * PAGE_SIZE + rowIdx + 1;
                return (
                  <tr
                    key={shipment.id}
                    onClick={() => onRowClick(shipment)}
                    className="group cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-500/5 transition-colors duration-150"
                  >
                    {/* Row number */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs text-gray-400 tabular-nums">{rowNum}</span>
                    </td>

                    {/* Order code */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm font-semibold text-brand-600 dark:text-brand-400 group-hover:text-brand-700">
                          {shipment.orderCode}
                        </span>
                        {shipment.bill && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[130px]" title={shipment.bill}>
                            BL: {shipment.bill}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Ship name */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        {/* <p className="text-sm font-medium text-gray-800 dark:text-white/90 max-w-[200px] truncate" title={shipment.shipName}>
                          {shipment.shipName}
                        </p> */}
                        <p
                          className="text-sm font-medium text-gray-800 dark:text-white/90 truncate w-full"
                          title={shipment.shipName}
                        >
                          {shipment.shipName}
                        </p>
                        {shipment.factory && (
                          <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{shipment.factory}{shipment.origin ? ` • ${shipment.origin}` : ""}</p>
                        )}
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-3.5 px-4">
                      <p className="text-xs font-medium text-gray-700 truncate dark:text-gray-300">{shipment.supplier}</p>
                    </td>

                    {/* Port / Vessel */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        {shipment.port && (
                          <div className="flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{shipment.port}</span>
                          </div>
                        )}
                        {shipment.vessel && (
                          <div className="flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
                              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                            </svg>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{shipment.vessel}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* ETD / ETA */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        {shipment.etd && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 w-7">ETD</span>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">{formatDate(shipment.etd)}</span>
                          </div>
                        )}
                        {shipment.eta && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-brand-400 w-7">ETA</span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{formatDate(shipment.eta)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${sc.color} ${sc.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                        {shipment.flowStageLabel || sc.label}
                      </span>
                    </td>

                    {/* Docs */}
                    <td className="py-3.5 px-4">
                      <DocBar
                        total={shipment.totalDocs}
                        received={shipment.receivedDocs}
                        missingList={shipment.missingDocs}
                      />
                    </td>

                    {/* Detail button */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); onRowClick(shipment); }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-400 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10 dark:hover:text-brand-400 transition-all"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400">
            Hiển thị <span className="font-medium text-gray-600 dark:text-gray-300">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)}</span> / {sorted.length} đơn hàng
          </p>
          <div className="flex items-center gap-1">
            {/* Prev */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            {/* Page numbers */}
            {getPageNumbers().map((pg, i) =>
              pg === "..." ? (
                <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
              ) : (
                <button
                  key={pg}
                  onClick={() => setPage(Number(pg))}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all border ${
                    pg === safePage
                      ? "border-brand-400 bg-brand-500 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10"
                  }`}
                >
                  {pg}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
