import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import getCategoryIcon from "../utils/CategoryIcons.jsx";
import SwipeableRow from "./SwipeableRow";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// TODO: Create your TransactionList component here
// 1. Loop through passed transactions array using .map()
// 2. Render each transaction row (showing icon, merchant name, category, date, and amount)
// 3. Style text and layout using classes in style.css (.tx, .tx-icon, .tx-body, etc.)
const formatDateTimeForInput = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDateTimeForDisplay = (dateString) => {
  if (!dateString) return "";
  // Ensure we display the date in local timezone to avoid shifting
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function TransactionList({
  user,
  token,
  status,
  filter,
  refreshTrigger,
  onDataAdded,
  timeFilter,
  categories = [],
  accounts = [],
}) {
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [transactionSelected, setTransactionSelected] = useState(null);
  const [transactionName, setTransactionName] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [transactionCategory, setTransactionCategory] = useState("");
  const [transactionAccount, setTransactionAccount] = useState("");
  const [error, setError] = useState("");
  const [transactionTag, setTransactionTag] = useState("");
  const [subCategories, setSubCategories] = useState([]);
  const [transactionIsIgnored, setTransactionIsIgnored] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const dateInputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  const getSoftBgColor = (hexColor) => {
    if (!hexColor) return "rgba(100,116,139,0.16)"; // Fallback grey
    return `${hexColor}26`; // Appends "26" (15% transparency in hex)
  };

  function formatFriendlyDate(dateString) {
    if (!dateString) return "Just now";

    const date = new Date(dateString);
    const now = new Date();

    // 1. Calculate difference in minutes
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    // If it was made less than 2 minutes ago, show "Just now"
    if (diffMins < 2) {
      return "Just now";
    }

    // Helpers to compare calendar days (avoids timezone bugs)
    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    // Create a Date object for "Yesterday"
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    // Formats time to look like "8:14 AM" or "4:32 PM"
    const timeString = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    // 2. If it is Today -> "Today, 8:14 AM"
    if (isSameDay(date, now)) {
      return `Today, ${timeString}`;
    }

    // 3. If it is Yesterday -> "Yesterday, 8:14 AM"
    if (isSameDay(date, yesterday)) {
      return `Yesterday, ${timeString}`;
    }

    // 4. More than 2 days ago -> "Jul 11"
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  // The key prop in HomeSkeleton now completely remounts this component when filters change,
  // naturally resetting the page to 1 and preventing all double-fetches!
  useEffect(() => {
    const querylimit = status === "home" ? 3 : 5; // Limit to 5 for home, 100 for ledger

    setIsLoading(true);

    axios
      .get(`${API_URL}/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          limit: querylimit,
          page: page,
          filter: filter ? filter : "all",
          period: timeFilter,
        },
      })
      .then((trRes) => {
        setTransactions(trRes.data.transactions);
        setTotalPages(trRes.data.pages);
      })
      .catch((error) => {
        console.error("Error fetching transactions:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token, status, filter, page, timeFilter, refreshTrigger]);

  useEffect(() => {
    if (!transactionSelected) return;
    axios
      .get(`${API_URL}/subCategories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          categoryName: transactionCategory,
        },
      })
      .then((response) => {
        setSubCategories(response.data);
      })
      .catch((error) => {
        console.error("Error fetching subcategories:", error);
      });
  }, [transactionCategory]);

  const handleDeleteTransaction = async (id) => {
    try {
      await axios.delete(`${API_URL}/transactions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (onDataAdded) onDataAdded();
    } catch (err) {
      console.error("Failed to delete transaction", err);
      showToast("Failed to delete transaction", "error");
    }
  };

  let startPage = Math.max(1, page - 1);
  let endPage = Math.min(totalPages, startPage + 2);

  if (endPage - startPage < 2) {
    startPage = Math.max(1, endPage - 2);
  }
  const visiblePages = [];
  for (let i = startPage; i <= endPage; i++) {
    visiblePages.push(i);
  }
  function moneyFormatter(value, currency_symbol) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency_symbol,
    }).format(Number(value));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <div className="tx-list">
        {isLoading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        ) : transactions.length > 0 ? (
          transactions.map((transaction) => {
            const isExpense = Number(transaction.amount) < 0;
            return (
              <SwipeableRow
                key={transaction.id}
                actionWidth={50}
                bg="var(--paper)"
                radius="0px"
                renderActions={({ close }) => (
                  <div
                    style={{
                      display: "flex",
                      width: "50px",
                      height: "100%",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <button
                      onClick={() => {
                        close();
                        handleDeleteTransaction(transaction.id);
                      }}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "var(--coral)",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      title="Delete Transaction"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                )}
              >
                <div
                  className="tx"
                  onClick={() => {
                    setSubCategories([]); // CLEAR OLD TAGS FIRST
                    setTransactionSelected(transaction);
                    setTransactionDate(
                      formatDateTimeForInput(transaction.date),
                    );
                    setTransactionAccount(transaction.account_name);
                    setTransactionAmount(Math.abs(transaction.amount));
                    setTransactionCategory(transaction.category_name);
                    setTransactionName(transaction.name);
                    setTransactionTag(transaction.tag_name || ""); // AVOID NULL VALUES
                    setTransactionIsIgnored(transaction.is_ignored || false);
                  }}
                >
                  <div
                    className="tx-icon"
                    style={{
                      background: getSoftBgColor(transaction.color),
                      color: transaction.color,
                    }}
                  >
                    {getCategoryIcon(transaction.plaid_primary_code)}
                  </div>
                  <div className="tx-body">
                    <div className="tx-name">{transaction.name} </div>
                    <div className="tx-meta">
                      {formatFriendlyDate(transaction.date)} ·{" "}
                      {transaction.category_name}{" "}
                      {transaction.source === "Manual" ? (
                        <span className="tag-manual">Manual</span>
                      ) : (
                        <span className="tag-auto">{transaction.source}</span>
                      )}
                    </div>
                  </div>
                  <div className={`tx-amount ${isExpense ? "neg" : "pos"}`}>
                    {moneyFormatter(
                      Number(transaction.amount),
                      transaction.currency,
                    )}
                  </div>
                </div>
              </SwipeableRow>
            );
          })
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 20px",
              textAlign: "center",
              color: "var(--slate)",
              gap: "12px",
              marginTop: status === "home" ? "10px" : "100px",
            }}
          >
            <div
              style={{
                background: "var(--line)",
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink)",
                marginBottom: "8px",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: "20px",
                color: "var(--ink)",
                fontFamily: "var(--mono)",
              }}
            >
              No transactions found
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "16px",
                lineHeight: "1.4",
                maxWidth: "250px",
                fontFamily: "var(--mono)",
                color: "var(--muted)",
              }}
            >
              Change category or period
            </p>
          </div>
        )}
      </div>
      {toast.visible && (
        <div
          onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
          style={{
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: "90%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "12px 24px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
            color: "var(--ink)",
            fontWeight: "500",
            cursor: "pointer",
            zIndex: 999999,
            animation: "slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor:
                toast.type === "success"
                  ? "rgba(46, 204, 113, 0.15)"
                  : "rgba(231, 76, 60, 0.15)",
              color: toast.type === "success" ? "var(--mint)" : "var(--coral)",
            }}
          >
            {toast.type === "success" ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            )}
          </div>
          <div>{toast.message}</div>
          <style>{`
            @keyframes slideDown {
              from { top: -100px; opacity: 0; transform: translateX(-50%) scale(0.9); }
              to { top: 24px; opacity: 1; transform: translateX(-50%) scale(1); }
            }
          `}</style>
        </div>
      )}
      {status === "ledger" && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            marginTop: "auto",
          }}
        >
          {/* FAR LEFT: Double Arrow (Jump to First Page) */}
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            style={{
              background: "transparent",
              border: "none",
              color: page === 1 ? "var(--line)" : "var(--ink)",
              cursor: page === 1 ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m11 17-5-5 5-5" />
              <path d="m18 17-5-5 5-5" />
            </svg>
          </button>

          {/* CENTER GROUP: Prev Arrow + Text + Next Arrow */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Prev Arrow */}
            <button
              onClick={() => setPage((prev) => prev - 1)}
              disabled={page === 1}
              style={{
                background: "transparent",
                border: "none",
                color: page === 1 ? "var(--line)" : "var(--ink)",
                cursor: page === 1 ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            {/* Page Text */}
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "13px",
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Page {page} of {totalPages}
            </span>

            {/* Next Arrow */}
            <button
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page === totalPages}
              style={{
                background: "transparent",
                border: "none",
                color: page === totalPages ? "var(--line)" : "var(--ink)",
                cursor: page === totalPages ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          {/* FAR RIGHT: Double Arrow (Jump to Last Page) */}
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            style={{
              background: "transparent",
              border: "none",
              color: page === totalPages ? "var(--line)" : "var(--ink)",
              cursor: page === totalPages ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 17 5-5-5-5" />
              <path d="m13 17 5-5-5-5" />
            </svg>
          </button>
        </div>
      )}
      {document.querySelector(".frame") &&
        createPortal(
          <div
            className={`sheet-backdrop ${transactionSelected ? "open" : ""}`}
            onClick={() => {
              setTransactionSelected(null);
              setTransactionDate("");
              setError("");
              setTransactionTag(""); // FIX: Clear the tag input
              setTransactionAmount("");
              setTransactionCategory("");
              setTransactionName("");
              setTransactionAccount("");
              setTransactionIsIgnored(false);
              setSubCategories([]);
            }}
          >
            <div
              className="sheet full-page"
              onClick={(e) => e.stopPropagation()}
              style={{ position: "relative" }}
            >
              <button
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
                onClick={() => {
                  setTransactionSelected(null);
                  setTransactionDate("");
                  setError("");
                  setTransactionTag(""); 
                  setTransactionAmount("");
                  setTransactionCategory("");
                  setTransactionName("");
                  setTransactionAccount("");
                  setTransactionIsIgnored(false);
                  setSubCategories([]);
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              {transactionSelected && (
                <div className="sheet-actions">
                  <h2 style={{ marginTop: 0, marginBottom: "20px" }}>
                    Edit Transaction
                  </h2>

                  <div className="field">
                    <label>Merchant</label>
                    <input
                      type="text"
                      placeholder="e.g. Target Store"
                      value={transactionName}
                      onChange={(e) => setTransactionName(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>
                      Amount{" "}
                      {transactionSelected?.source === "Bank Sync" && (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--muted)",
                            fontWeight: "normal",
                          }}
                        >
                          (Locked by Bank)
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={transactionAmount}
                      disabled={transactionSelected?.source === "Bank Sync"}
                      style={
                        transactionSelected?.source === "Bank Sync"
                          ? { opacity: 0.7, cursor: "not-allowed" }
                          : {}
                      }
                      onChange={(e) =>
                        setTransactionAmount(
                          e.target.value ? Math.abs(e.target.value) : "",
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label>
                      Date{" "}
                      {transactionSelected?.source === "Bank Sync" && (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--muted)",
                            fontWeight: "normal",
                          }}
                        >
                          (Locked by Bank)
                        </span>
                      )}
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "var(--paper)",
                        border: "1px solid var(--line)",
                        borderRadius: "12px",
                        cursor: transactionSelected?.source === "Bank Sync" ? "not-allowed" : "pointer",
                        color: transactionDate ? "var(--ink)" : "var(--muted)",
                        opacity: transactionSelected?.source === "Bank Sync" ? 0.7 : 1,
                        fontFamily: "var(--mono)",
                        fontSize: "15px",
                        position: "relative"
                      }}
                      onClick={() => {
                        // Keep JS fallback for desktop browsers just in case
                        if (transactionSelected?.source !== "Bank Sync" && dateInputRef.current) {
                          try {
                            dateInputRef.current.showPicker();
                          } catch (e) {
                            dateInputRef.current.focus();
                          }
                        }
                      }}
                    >
                      <span>{transactionDate ? formatDateTimeForDisplay(transactionDate) : "Select date"}</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={transactionDate}
                        disabled={transactionSelected?.source === "Bank Sync"}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          opacity: 0,
                          cursor: "pointer",
                        }}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Category</label>
                    <select
                      value={transactionCategory}
                      onChange={(e) => {
                        setTransactionCategory(e.target.value);
                      }}
                    >
                      <option value="">Select a category...</option>
                      {categories.map((category) => (
                        <option value={category.name} key={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {subCategories.length > 0 && (
                    <div className="field">
                      <label>Tags</label>
                      <select
                        value={transactionTag}
                        onChange={(e) => {
                          setTransactionTag(e.target.value);
                        }}
                      >
                        <option value="">Select a tag...</option>
                        {subCategories.map((subCategory) => (
                          <option value={subCategory.name} key={subCategory.id}>
                            {subCategory.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="field">
                    <label>
                      Account{" "}
                      {transactionSelected?.source === "Bank Sync" && (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--muted)",
                            fontWeight: "normal",
                          }}
                        >
                          (Locked by Bank)
                        </span>
                      )}
                    </label>
                    <select
                      value={transactionAccount}
                      disabled={transactionSelected?.source === "Bank Sync"}
                      style={
                        transactionSelected?.source === "Bank Sync"
                          ? { opacity: 0.7, cursor: "not-allowed" }
                          : {}
                      }
                      onChange={(e) => setTransactionAccount(e.target.value)}
                    >
                      <option value="">Select an account...</option>
                      {accounts.map((account) => (
                        <option value={account.name} key={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className="field"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <label style={{ margin: 0, color: "var(--ink)" }}>
                          Exclude from Budget
                        </label>
                        <label
                          className="switch"
                          style={{ flexShrink: 0, margin: 0 }}
                        >
                          <input
                            type="checkbox"
                            checked={transactionIsIgnored}
                            onChange={(e) =>
                              setTransactionIsIgnored(e.target.checked)
                            }
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--muted)",
                          fontWeight: "normal",
                          marginTop: "4px",
                          lineHeight: "1.4",
                          whiteSpace: "normal",
                          maxWidth: "65%",
                        }}
                      >
                        Hide this from your monthly and yearly spending.
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div
                      style={{
                        color: "var(--coral)",
                        fontSize: "14px",
                        marginBottom: "10px",
                        textAlign: "center",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      marginTop: error ? "5px" : "16px",
                    }}
                  >
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        try {
                          if (
                            !transactionName ||
                            !transactionAccount ||
                            !transactionAmount ||
                            !transactionCategory ||
                            (subCategories.length > 0 && !transactionTag)
                          ) {
                            setError("Please fill in all fields.");
                            return;
                          }
                          setError("");
                          await axios.put(
                            `${API_URL}/transactions`,
                            {
                              id: transactionSelected.id,
                              name: transactionName,
                              amount: parseFloat(transactionAmount),
                              category: transactionCategory,
                              account: transactionAccount,
                              tag: transactionTag,
                              is_ignored: transactionIsIgnored,
                              date: transactionDate || undefined,
                            },
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            },
                          );
                          setTransactionSelected(null);
                          setTransactionDate("");
                          setTransactionTag("");
                          setTransactionAmount("");
                          setTransactionCategory("");
                          setTransactionName("");
                          setTransactionAccount("");
                          setSubCategories([]);
                          onDataAdded();
                        } catch (err) {
                          console.error("Failed to save:", error);
                          setError(
                            err.response?.data?.error ||
                              "Failed to save transaction",
                          );
                        }
                      }}
                    >
                      Update Transaction
                    </button>
                    <button
                      className="btn"
                      style={{
                        background: "transparent",
                        color: "var(--muted)",
                        border: "1px solid var(--line)",
                      }}
                      onClick={() => {
                        setTransactionSelected(null);
                        setTransactionDate("");
                        setError("");
                        setTransactionTag("");
                        setTransactionAmount("");
                        setTransactionCategory("");
                        setTransactionName("");
                        setTransactionAccount("");
                        setSubCategories([]);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,

          // This is the destination where it teleports to!
          document.querySelector(".frame"),
        )}
    </div>
  );
}
