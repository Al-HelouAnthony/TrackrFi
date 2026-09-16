import axios from "axios";
import React, { useEffect, useState, useRef } from "react";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// TODO: Create your AddTransactionSheet modal component here
// 1. Render form elements (inputs for note, number input for amount, select dropdown for category)
// 2. Control input state (name, amount, category)
// 3. Fire the onSave callback when user clicks "Save transaction"
export default function AddDataSheet({
  token,
  type,
  sheetOpen,
  onDataAdded,
  categories = [],
  accounts = [],
  budgets = [],
}) {
  const [dataName, setDataName] = useState("");
  const [dataAmount, setDataAmount] = useState("");
  const [dataDate, setDataDate] = useState("");
  const [dataCategory, setDataCategory] = useState("");
  const [dataAccount, setDataAccount] = useState("");
  const [dataPeriod, setDataPeriod] = useState("");
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [subCategories, setSubCategories] = useState([]);
  const [transactionSubCategory, setTransactionSubCategory] = useState("");
  const [transactionIsIgnored, setTransactionIsIgnored] = useState(false);

  const getDynamicPlaceholder = () => {
    const now = new Date();
    return `e.g. ${now.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const formatDateTimeForDisplay = (dateString) => {
    if (!dateString) return "";
    // Ensure we display the date in local timezone to avoid shifting
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const dateInputRef = useRef(null);

  function dataSheetPicker(type) {
    if (type === "Transaction") {
      return (
        <div className="sheet-actions">
          <div className="field">
            <label>Merchant</label>
            <input
              type="text"
              placeholder="e.g. Target Store"
              value={dataName}
              onChange={(e) => {
                setDataName(e.target.value);
              }}
            />
          </div>
          <div className="field">
            <label>Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={dataAmount}
              onChange={(e) => {
                setDataAmount(e.target.value ? Math.abs(e.target.value) : "");
              }}
            />
          </div>
          <div className="field">
            <label>Date (Optional)</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "12px",
                cursor: "pointer",
                color: dataDate ? "var(--ink)" : "var(--muted)",
                fontFamily: "var(--mono)",
                fontSize: "15px",
                position: "relative",
              }}
              onClick={() => {
                // Keep JS fallback for desktop browsers just in case
                if (dateInputRef.current) {
                  try {
                    dateInputRef.current.showPicker();
                  } catch (e) {
                    dateInputRef.current.focus();
                  }
                }
              }}
            >
              <span style={{ fontFamily: "var(--sans)" }}>
                {dataDate
                  ? formatDateTimeForDisplay(dataDate)
                  : getDynamicPlaceholder()}
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--muted)" }}
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <input
                ref={dateInputRef}
                type="date"
                value={dataDate}
                onChange={(e) => setDataDate(e.target.value)}
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
              value={dataCategory}
              onChange={(e) => {
                setDataCategory(e.target.value);
                setSelectedCategory(e.target.value);
              }}
            >
              <option value="">Select a category...</option>
              {categories.map((category) => {
                return (
                  <option value={category.name} key={category.id}>
                    {category.name}
                  </option>
                );
              })}
            </select>
          </div>
          {selectedCategory && subCategories.length > 0 && (
            <div className="field">
              <label>Tags</label>
              <select
                value={transactionSubCategory}
                onChange={(e) => {
                  setTransactionSubCategory(e.target.value);
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
            <label>Account</label>
            <select
              value={dataAccount}
              onChange={(e) => setDataAccount(e.target.value)}
            >
              <option value="">Select an account...</option>
              {accounts.map((account) => {
                return (
                  <option value={account.name} key={account.id}>
                    {account.name}
                  </option>
                );
              })}
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
                <label className="switch" style={{ flexShrink: 0, margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={transactionIsIgnored}
                    onChange={(e) => setTransactionIsIgnored(e.target.checked)}
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
          <div className="field">
            <button
              className="btn btn-primary"
              style={{ marginTop: "8px" }}
              onClick={async () => {
                try {
                  if (
                    !dataName ||
                    !dataAccount ||
                    !dataAmount ||
                    !dataCategory ||
                    (subCategories.length > 0 && !transactionSubCategory)
                  ) {
                    setError("Please fill in all fields.");
                    return;
                  }
                  setError("");
                  await axios.post(
                    `${API_URL}/transactions`,
                    {
                      name: dataName,
                      amount: parseFloat(dataAmount),
                      category: dataCategory,
                      account: dataAccount,
                      tag: transactionSubCategory,
                      is_ignored: transactionIsIgnored,
                      date: dataDate || undefined,
                    },
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );

                  sheetOpen(); // Close when done
                  onDataAdded();
                } catch (err) {
                  console.error("Failed to save:", error);
                  setError(
                    err.response?.data?.error || "Failed to save transaction",
                  );
                }
              }}
            >
              Save Transaction
            </button>
          </div>
        </div>
      );
    } else if (type === "Budget") {
      return (
        <div className="sheet-actions">
          <div className="field">
            <label>Category</label>
            <select
              value={dataCategory}
              onChange={(e) => setDataCategory(e.target.value)}
            >
              <option value="">Select a category...</option>
              {categories.map((category) => {
                return (
                  <option value={category.name} key={category.id}>
                    {category.name}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="field">
            <label>Goal Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={dataAmount}
              onChange={(e) => {
                setDataAmount(e.target.value ? Math.abs(e.target.value) : "");
              }}
            />
          </div>
          <div className="field">
            <label>Period</label>
            <select
              value={dataPeriod}
              onChange={(e) => setDataPeriod(e.target.value)}
            >
              <option value="">Select a period...</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
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
          <div className="field">
            <button
              className="btn btn-primary"
              style={{ marginTop: "8px" }}
              onClick={async () => {
                try {
                  if (!dataAmount || !dataCategory || !dataPeriod) {
                    setError("Please fill in all fields.");
                    return;
                  }
                  setError("");
                  await axios.post(
                    `${API_URL}/budgets`,
                    {
                      amount: parseFloat(dataAmount),
                      category: dataCategory,
                      period: dataPeriod,
                    },
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );
                  sheetOpen(); // Close when done
                  onDataAdded();
                } catch (err) {
                  console.error("Failed to save:", error);
                  setError(
                    err.response?.data?.error || "Failed to save budget goal.",
                  );
                }
              }}
            >
              {isUpdating ? "Update" : "Save"} Budget Goal
            </button>
          </div>
        </div>
      );
    }
  }
  useEffect(() => {
    setDataName("");
    setDataAmount("");
    setDataCategory("");
    setDataAccount("");
    setDataPeriod("");
    setTransactionSubCategory("");
    setSelectedCategory("");
    setError("");
  }, [type]);

  useEffect(() => {
    if (type !== "Budget" || !dataCategory) return;

    const cat = categories.find((c) => c.name === dataCategory);
    if (!cat) return;
    const existingBudget = budgets.find((b) => b.category_id === cat.id);
    if (existingBudget) {
      setDataAmount(existingBudget.amount); // Pre-fill the input box!
      setDataPeriod(existingBudget.period);
      setIsUpdating(true); // Tell the UI we are updating
    } else {
      setDataAmount(""); // Wipe it clean if it's a brand new budget
      setDataPeriod("");
      setIsUpdating(false);
    }
  }, [dataCategory, type, categories, budgets]);

  useEffect(() => {
    axios
      .get(`${API_URL}/subCategories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          categoryName: selectedCategory,
        },
      })
      .then((response) => setSubCategories(response.data))
      .catch((error) => {
        console.error("Error fetching sub-categories:", error);
      });
  }, [selectedCategory]);

  return (
    <div>
      <div className="sheet-handle"></div>

      <h2>
        {isUpdating ? "Edit" : "Add"} {type}
      </h2>

      {dataSheetPicker(type)}
    </div>
  );
}
