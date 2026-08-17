"use client";
import React, { useMemo, useState } from "react";

interface DashboardInfoBarProps {
  lastUpdated: string;
  updatedBy?: string;
  onRefresh: () => Promise<void>;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Mock active users
const ACTIVE_USERS = [
  { id: 1, name: "Nguyễn Văn An", initials: "AN", color: "#465fff" },
  { id: 2, name: "Trần Thị Bích", initials: "TB", color: "#12b76a" },
  { id: 3, name: "Lê Minh Hoàng", initials: "LH", color: "#f79009" },
];

export default function DashboardInfoBar({ lastUpdated, updatedBy, onRefresh }: DashboardInfoBarProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshSuccess, setShowRefreshSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const updateHistory = useMemo(() => ([
    { time: "17/08/2026 09:15", user: "Admin hệ thống", action: "Cập nhật dữ liệu từ Google Sheet" },
    { time: "17/08/2026 08:40", user: "Admin hệ thống", action: "Đồng bộ chứng từ và trạng thái" },
    { time: "16/08/2026 22:05", user: "Admin hệ thống", action: "Làm mới bảng tổng hợp" },
  ]), []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShowRefreshSuccess(false);
    try {
      await onRefresh();
      setShowRefreshSuccess(true);
      setTimeout(() => setShowRefreshSuccess(false), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Left: Active users + last updated */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
        {/* Active Users */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {ACTIVE_USERS.map((user) => (
              <div
                key={user.id}
                title={user.name}
                className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white dark:border-gray-900 text-white text-xs font-semibold ring-2 ring-transparent hover:ring-2 hover:z-10 transition-all cursor-default"
                style={{ backgroundColor: user.color }}
              >
                {user.initials}
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-800 dark:text-white/90">
              {ACTIVE_USERS.length} người đang truy cập
            </p>
            <p className="text-xs text-gray-400">{ACTIVE_USERS.map(u => u.name.split(" ").pop()).join(", ")}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-gray-700" />

        {/* Last Updated */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cập nhật lần cuối</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {formatRelativeTime(lastUpdated)} · {formatDateTime(lastUpdated)}
                {updatedBy && <span className="text-gray-400"> bởi {updatedBy}</span>}
              </p>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 text-[10px] font-bold text-gray-500 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:hover:border-brand-500/50 dark:hover:text-brand-400"
                aria-label="Xem lịch sử cập nhật"
                title="Xem lịch sử cập nhật"
              >
                i
              </button>
            </div>
            {showHistory && (
              <div className="mt-2 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Lịch sử cập nhật</p>
                <div className="flex flex-col gap-2">
                  {updateHistory.map((item) => (
                    <div key={`${item.time}-${item.action}`} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{item.action}</p>
                      <p className="text-[11px] text-gray-400">{item.time} · {item.user}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Refresh button */}
      <div className="flex items-center gap-2">
        {showRefreshSuccess && (
          <span className="flex items-center gap-1 text-xs text-success-600 font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Đã cập nhật!
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-600 transition-all duration-200 hover:bg-brand-100 hover:border-brand-300 disabled:opacity-60 disabled:cursor-not-allowed dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isRefreshing ? "animate-spin" : ""}
          >
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {isRefreshing ? "Đang cập nhật..." : "Cập nhật dữ liệu"}
        </button>
      </div>
    </div>
  );
}
