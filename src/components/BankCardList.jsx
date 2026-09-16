import axios from "axios";
import React, { useEffect, useState } from "react";
import SwipeableRow from "./SwipeableRow";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function BankCardList({
  token,
  refreshTrigger,
  onRefresh,
  onAddAccount,
}) {
  const [institutions, setInstitutions] = useState([]);
  const [standaloneAccounts, setStandaloneAccounts] = useState([]);
  const [expandedBank, setExpandedBank] = useState(null);
  const [uploadingAccountId, setUploadingAccountId] = useState(null);
  const [editingBankId, setEditingBankId] = useState(null);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    visible: false,
    message: "",
    onConfirm: null,
  });
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  const copyToClipboard = (text, successMessage) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      showToast(successMessage, "success");
    } catch (err) {
      showToast("Failed to copy ID", "error");
    }
  };

  const handleDeleteInstitution = (id, name) => {
    setConfirmDialog({
      visible: true,
      message: `Are you sure you want to delete ${name}? All transactions and accounts related to it will be permanently deleted.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/institutions/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (onRefresh) onRefresh();
        } catch (err) {
          console.error(err);
          showToast("Failed to delete institution.", "error");
        }
      },
    });
  };

  const handleUpdateAccount = async (accountId, updates) => {
    try {
      await axios.put(`${API_URL}/accounts/${accountId}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      showToast("Failed to update account.", "error");
    }
  };

  const handleFileUpload = (accountId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingAccountId(accountId);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const csv_text = e.target.result;
      try {
        const response = await axios.post(
          `${API_URL}/transactions/csv-import`,
          { account_id: accountId, csv_text },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        showToast(
          `Successfully imported ${response.data.count} transactions!`,
          "success",
        );
        if (onRefresh) onRefresh();
      } catch (err) {
        console.error(err);
        showToast(err.response?.data?.error || "Failed to import CSV", "error");
      } finally {
        setUploadingAccountId(null);
        event.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    axios
      .get(`${API_URL}/institutions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        setInstitutions(response.data.institutions || []);
        setStandaloneAccounts(response.data.standaloneAccounts || []);
      })
      .catch((error) => {
        console.error("Error fetching institutions:", error);
      });
  }, [token, refreshTrigger]);

  function moneyFormatter(value, currency_symbol) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency_symbol,
    }).format(Number(value));
  }

  return (
    <div className="accounts-container">
      {/* 1. Render Custom Institutions (Banks) */}
      {institutions.map((bank) => {
        const bankAccounts = bank.accounts || [];
        const assets = bankAccounts.reduce((sum, acc) => {
          return ["Checking", "Savings", "Cash"].includes(acc.type)
            ? sum + Number(acc.balance)
            : sum;
        }, 0);
        const credit = bankAccounts.reduce((sum, acc) => {
          return ["Credit"].includes(acc.type)
            ? sum + Number(acc.balance)
            : sum;
        }, 0);
        const loans = bankAccounts.reduce((sum, acc) => {
          return ["Loan"].includes(acc.type) ? sum + Number(acc.balance) : sum;
        }, 0);
        const netSpendable = Number(assets) + Number(credit);
        const isExpanded = expandedBank === bank.id;
        const defaultCurrency =
          bankAccounts.length > 0 ? bankAccounts[0].currency : "CAD";

        return (
          <div key={bank.id} className="institution-card">
            <SwipeableRow
              actionWidth={120}
              bg="var(--paper-dim)"
              renderActions={({ close }) => (
                <div
                  style={{
                    display: "flex",
                    width: "120px",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "12px",
                    paddingRight: "16px",
                    background: "var(--paper)",
                    borderTopRightRadius: "20px",
                    borderBottomRightRadius: "20px",
                  }}
                >
                  <button
                    onClick={() => {
                      close();
                      setEditingBankId(bank.id);
                    }}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "rgba(255, 255, 255, 0.1)",
                      color: "white",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    title="Edit Accounts"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      close();
                      handleDeleteInstitution(bank.id, bank.name);
                    }}
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "var(--coral)",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    title="Delete Institution"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
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
                className="institution-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  background: "var(--paper-dim)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <img
                    src={
                      bank.logo ||
                      "https://cdn-icons-png.flaticon.com/512/2830/2830284.png"
                    }
                    alt={bank.name}
                    className="institution-logo"
                    onError={(e) => {
                      e.target.src =
                        "https://cdn-icons-png.flaticon.com/512/2830/2830284.png";
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <h2
                      className="institution-name"
                      style={{
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {bank.name}
                      <button
                        onClick={() =>
                          copyToClipboard(
                            bank.id,
                            `Institution ID for ${bank.name} copied for Make.com!`,
                          )
                        }
                        style={{
                          marginLeft: "10px",
                          background: "none",
                          border: "none",
                          color: "var(--muted)",
                          cursor: "pointer",
                        }}
                        title="Copy Institution ID"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </h2>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn btn-secondary"
                    style={{
                      width: "36px",
                      height: "36px",
                      border: "none",
                      background: "var(--ink)",
                      color: "var(--paper)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      transition: "transform 0.2s ease",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.transform = "scale(1.05)")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                    onClick={() => {
                      if (onAddAccount) onAddAccount(bank.id);
                    }}
                    title="Add Account to Bank"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                </div>
              </div>

              {bankAccounts.length === 0 ? (
                <div
                  style={{
                    padding: "10px",
                    paddingBottom: "26px",
                    textAlign: "center",
                    justifyContent: "center",
                    color: "var(--muted)",
                    fontSize: "16px",
                  }}
                >
                  No accounts added yet.
                </div>
              ) : (
                <>
                  <div className="bank-summary-dashboard">
                    <div className="summary-row">
                      <span className="summary-label">
                        Assets (Checking & Savings)
                      </span>
                      <span className="summary-value positive">
                        +{moneyFormatter(assets, defaultCurrency)}
                      </span>
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <p
                        style={{
                          fontFamily: "var(--sans)",
                          fontSize: "12px",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "var(--ink)",
                          margin: "0 0 10px 0",
                          fontWeight: 500,
                        }}
                      >
                        Liabilities breakdown
                      </p>
                      <div
                        style={{
                          paddingLeft: "12px",
                          borderLeft: "2px solid rgba(255,255,255,0.05)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div
                          className="summary-row"
                          style={{ marginBottom: 0 }}
                        >
                          <span className="summary-label">Credit Cards</span>
                          <span className="summary-value negative">
                            {moneyFormatter(credit, defaultCurrency)}
                          </span>
                        </div>
                        <div
                          className="summary-row"
                          style={{ marginBottom: 0 }}
                        >
                          <span
                            className="summary-label"
                            style={{ opacity: 0.6 }}
                          >
                            Long-Term Loans
                          </span>
                          <span
                            className="summary-value"
                            style={{ color: "rgba(239, 68, 68, 0.4)" }}
                          >
                            {moneyFormatter(loans, defaultCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-row net-spendable">
                      <span className="summary-label">Spendable Funds</span>
                      <span className="summary-value net">
                        {moneyFormatter(netSpendable, defaultCurrency)}
                      </span>
                    </div>
                  </div>

                  <button
                    className="btn-expand-accounts"
                    onClick={() => setExpandedBank(isExpanded ? null : bank.id)}
                  >
                    {isExpanded ? "Hide Details" : "Show Details"}
                  </button>
                  {isExpanded && (
                    <div className="institution-accounts-dropdown">
                      {bankAccounts.map((account) => (
                        <div key={account.id} className="account-row">
                          <div className="account-info">
                            <span className="account-name">{account.name}</span>
                            <span className="account-type">{account.type}</span>
                          </div>
                          <span
                            className="account-balance"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            {moneyFormatter(account.balance, account.currency)}
                            {uploadingAccountId === account.id ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--accent)",
                                }}
                              >
                                AI Parsing...
                              </span>
                            ) : (
                              <label
                                style={{
                                  cursor: "pointer",
                                  color: "var(--muted)",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                                title="Upload Pre-Parsed JSON Statement"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                  <polyline points="17 8 12 3 7 8"></polyline>
                                  <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                <input
                                  type="file"
                                  accept=".json"
                                  style={{ display: "none" }}
                                  onChange={(e) =>
                                    handleFileUpload(account.id, e)
                                  }
                                />
                              </label>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </SwipeableRow>
          </div>
        );
      })}

      {/* 2. Render Standalone Accounts (Wallet) */}
      {standaloneAccounts.length > 0 && (
        <div className="institution-card">
          <div
            className="institution-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                className="institution-logo"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5E5CE6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                  <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                  <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
                </svg>
              </div>
              <h2 className="institution-name" style={{ margin: 0 }}>
                Wallets
              </h2>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "10px 20px 20px 20px",
            }}
          >
            {standaloneAccounts.map((acc, idx) => (
              <div
                key={acc.id || idx}
                className="account-row"
                style={{ padding: "0", border: "none" }}
              >
                <div className="account-info">
                  <span className="account-name">{acc.name}</span>
                  <span
                    className="account-type"
                    style={{ color: "var(--muted)" }}
                  >
                    {acc.type}
                  </span>
                </div>
                <span
                  className="account-balance"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {moneyFormatter(acc.balance, acc.currency)}
                  {uploadingAccountId === acc.id ? (
                    <span style={{ fontSize: "11px", color: "var(--accent)" }}>
                      AI Parsing...
                    </span>
                  ) : (
                    <label
                      style={{
                        cursor: "pointer",
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Upload Pre-Parsed JSON Statement"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <input
                        type="file"
                        accept=".json"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(acc.id, e)}
                      />
                    </label>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDIT ACCOUNTS MODAL */}
      {editingBankId && (
        <div
          className="sheet-backdrop open"
          onClick={() => {
            setEditingBankId(null);
            setEditingAccountId(null);
          }}
        >
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ height: "auto", padding: "24px", position: "relative" }}
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
                setEditingBankId(null);
                setEditingAccountId(null);
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            {!editingAccountId ? (
              <>
                <h2 style={{ marginTop: 0, marginBottom: "20px" }}>
                  Select Account to Edit
                </h2>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    maxHeight: "60vh",
                    overflowY: "auto",
                    marginBottom: "24px",
                  }}
                >
                  {institutions
                    .find((i) => i.id === editingBankId)
                    ?.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        onClick={() => setEditingAccountId(acc.id)}
                        style={{
                          background: "var(--paper)",
                          padding: "16px",
                          borderRadius: "12px",
                          border: "1px solid var(--line)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{ display: "flex", flexDirection: "column" }}
                        >
                          <span style={{ fontWeight: 600 }}>{acc.name}</span>
                          <span
                            style={{ fontSize: "13px", color: "var(--muted)" }}
                          >
                            {acc.type}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: acc.currency || "USD",
                            }).format(acc.balance)}
                          </span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--muted)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </div>
                      </div>
                    ))}
                  {institutions.find((i) => i.id === editingBankId)?.accounts
                    .length === 0 && (
                    <div
                      style={{
                        color: "var(--muted)",
                        textAlign: "center",
                        padding: "20px",
                      }}
                    >
                      No accounts found.
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                  onClick={() => setEditingBankId(null)}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "20px",
                    gap: "12px",
                  }}
                >
                  <button
                    onClick={() => setEditingAccountId(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink)",
                      cursor: "pointer",
                      padding: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      backgroundColor: "var(--line)",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                  <h2 style={{ margin: 0 }}>Edit Account</h2>
                </div>

                {institutions
                  .find((i) => i.id === editingBankId)
                  ?.accounts.filter((a) => a.id === editingAccountId)
                  .map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <div className="field">
                        <label>Account Name</label>
                        <input
                          type="text"
                          defaultValue={acc.name}
                          onBlur={(e) => {
                            if (e.target.value !== acc.name) {
                              handleUpdateAccount(acc.id, {
                                name: e.target.value,
                              });
                            }
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>Account Type (Locked)</label>
                        <select
                          value={acc.type}
                          disabled
                          style={{
                            opacity: 0.7,
                            cursor: "not-allowed",
                            backgroundColor: "var(--line)",
                          }}
                        >
                          <option value="Checking">Checking</option>
                          <option value="Savings">Savings</option>
                          <option value="Credit">Credit Card</option>
                          <option value="Loan">Loan</option>
                          <option value="Investment">Investment</option>
                          <option value={acc.type}>{acc.type}</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Balance</label>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={acc.balance}
                          onBlur={(e) => {
                            if (
                              parseFloat(e.target.value) !==
                              parseFloat(acc.balance)
                            ) {
                              handleUpdateAccount(acc.id, {
                                balance: parseFloat(e.target.value),
                              });
                            }
                          }}
                        />
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{
                          width: "100%",
                          marginTop: "12px",
                          borderColor: "var(--coral)",
                          color: "var(--coral)",
                        }}
                        onClick={async () => {
                          setConfirmDialog({
                            visible: true,
                            message: `Are you sure you want to delete ${acc.name}? This will delete all associated transactions.`,
                            onConfirm: async () => {
                              try {
                                await axios.delete(
                                  `${API_URL}/accounts/${acc.id}`,
                                  {
                                    headers: {
                                      Authorization: `Bearer ${token}`,
                                    },
                                  },
                                );
                                setEditingAccountId(null);
                                if (onRefresh) onRefresh();
                              } catch (err) {
                                showToast("Failed to delete account", "error");
                              }
                            },
                          });
                        }}
                      >
                        Delete Account
                      </button>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
      {confirmDialog.visible && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: "400px" }}>
            <h3 style={{ marginTop: 0 }}>Confirm Action</h3>
            <p style={{ color: "var(--muted)", lineHeight: "1.5" }}>
              {confirmDialog.message}
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "24px",
              }}
            >
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  padding: "10px 20px",
                  borderRadius: "24px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontFamily: "inherit"
                }}
                onClick={() =>
                  setConfirmDialog({
                    visible: false,
                    message: "",
                    onConfirm: null,
                  })
                }
              >
                Cancel
              </button>
              <button
                style={{
                  backgroundColor: "rgba(235, 87, 87, 0.15)",
                  color: "var(--coral)",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "24px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontFamily: "inherit"
                }}
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({
                    visible: false,
                    message: "",
                    onConfirm: null,
                  });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
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
              backgroundColor: toast.type === "success" ? "rgba(46, 204, 113, 0.15)" : "rgba(231, 76, 60, 0.15)",
              color: toast.type === "success" ? "var(--mint)" : "var(--coral)",
            }}
          >
            {toast.type === "success" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
    </div>
  );
}
