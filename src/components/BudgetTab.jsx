import React, { useState, useEffect } from "react";
import axios from "axios";
import "../budget.css";
import getCategoryIcon from "../utils/CategoryIcons";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function BudgetTab({ token, setActiveTab, refreshTrigger, updateProfile }) {
  const [budgetedCategories, setBudgetedCategories] = useState([]);
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [periodFilter, setPeriodFilter] = useState("monthly");
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/budgets/summary?period=${periodFilter}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        setBudgetedCategories(response.data.categories);
        setMonthlyTarget(response.data.monthly_target);
        setCurrency(response.data.default_currency || "USD");
      })
      .catch((error) => {
        console.error("Error fetching budget summary:", error);
      });
  }, [token, refreshTrigger, updateProfile, periodFilter]);

  const isMonthlyView = periodFilter === 'monthly';
  
  const totalSpentGlobal = budgetedCategories.reduce(
    (sum, cat) => sum + cat.total_spent,
    0,
  );

  const monthlySpent = isMonthlyView
    ? budgetedCategories.reduce((sum, cat) => cat.budget_period !== 'yearly' ? sum + cat.total_spent : sum, 0)
    : totalSpentGlobal;

  const yearlySpent = isMonthlyView
    ? budgetedCategories.reduce((sum, cat) => cat.budget_period === 'yearly' ? sum + cat.total_spent : sum, 0)
    : 0;

  const totalMonthlyAllocated = budgetedCategories.reduce(
    (sum, cat) => cat.budget_period !== 'yearly' ? sum + cat.budgeted_amount : sum, 0
  );

  const totalYearlyAllocated = budgetedCategories.reduce(
    (sum, cat) => cat.budget_period === 'yearly' ? sum + cat.budgeted_amount : sum, 0
  );

  // The backend already multiplies the baseline target by 12 if periodFilter === 'yearly'.
  // We simply add the explicit yearly budgets on top of it for Option A math!
  const globalTarget = monthlyTarget + (isMonthlyView ? 0 : totalYearlyAllocated);

  const isOverTarget = isMonthlyView 
    ? monthlySpent > monthlyTarget && monthlyTarget > 0
    : totalSpentGlobal > globalTarget && globalTarget > 0;

  // Semi-circle math for the Global Header
  const arcLength = 471.239; // Math.PI * radius (150)
  const monthlyPercent = Math.min(Math.max(0, monthlySpent) / (globalTarget || 1), 1);
  const monthlyDashoffset = arcLength - monthlyPercent * arcLength;

  const yearlyPercent = Math.min(Math.max(0, yearlySpent) / (globalTarget || 1), 1 - monthlyPercent);
  const combinedDashoffset = arcLength - (monthlyPercent + yearlyPercent) * arcLength;

  function moneyFormatter(value, currency_symbol = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency_symbol,
    }).format(Number(value));
  }

  return (
    <div className="budget-tab-container">
      {/* TIME PERIOD TOGGLE */}
      <div style={{ padding: "0 20px 20px 20px", display: "flex", justifyContent: "center" }}>
        <div className="segmented-control" style={{ width: "100%", maxWidth: "300px" }}>
          {[
            { label: "Monthly", val: "monthly" },
            { label: "Yearly", val: "yearly" }
          ].map((opt) => (
            <button
              key={opt.val}
              className={`segment ${periodFilter === opt.val ? "active" : ""}`}
              onClick={() => setPeriodFilter(opt.val)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* GLOBAL HEALTH HEADER (Massive Semi-Circle) */}
      <div
        className={`budget-global-header ${isOverTarget ? "over-target" : ""}`}
      >
        <div className="budget-header-top" style={{ justifyContent: "center" }}>
          <h2>{periodFilter === 'yearly' ? 'Yearly Target' : 'Monthly Target'}</h2>
        </div>

        <div className="budget-global-bar">
          <svg width="340" height="180" viewBox="0 0 340 180">
            {/* Background track */}
            <path
              d="M 20 170 A 150 150 0 0 1 320 170"
              fill="none"
              stroke="var(--line)"
              strokeWidth="20"
              strokeLinecap="round"
            />
            {/* Yearly Track (Combines both, renders underneath) */}
            {isMonthlyView && yearlySpent > 0 && (
              <path
                d="M 20 170 A 150 150 0 0 1 320 170"
                fill="none"
                stroke="var(--coral)"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={arcLength}
                strokeDashoffset={combinedDashoffset}
                style={{
                  transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            )}
            {/* Primary Track (Monthly or Total) */}
            <path
              d="M 20 170 A 150 150 0 0 1 320 170"
              fill="none"
              stroke={isOverTarget ? "var(--coral)" : "var(--mint)"}
              strokeWidth="20"
              strokeLinecap="round"
              strokeDasharray={arcLength}
              strokeDashoffset={monthlyDashoffset}
              style={{
                transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </svg>
          <div className="budget-gauge-text" style={{ paddingBottom: "16px" }}>
            <strong>
              {moneyFormatter(monthlySpent, currency)}
            </strong>
            <span style={{ color: "var(--muted)", fontSize: "14px", marginTop: "2px" }}>
              of {moneyFormatter(globalTarget, currency)}
            </span>
          </div>
        </div>

        {isOverTarget && (
          <div className="budget-warning-box">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <p>You've spent more than your target!</p>
          </div>
        )}
      </div>

      {/* CATEGORIES LIST */}
      <div className="budget-category-list">
        {budgetedCategories.map((cat) => {
          // Hide categories that have $0 budget AND $0 spending
          if (cat.budgeted_amount === 0 && cat.total_spent === 0) return null;

          const progressPercent = Math.min(
            (cat.total_spent / (cat.budgeted_amount || 1)) * 100,
            100,
          );
          const isOverBudget =
            cat.total_spent > cat.budgeted_amount && cat.budgeted_amount > 0;
          const isExpanded = expandedCategoryId === cat.category_id;

          // Map exact database category names to the Plaid Codes that CategoryIcons expects
          const categoryToPlaid = {
            "Food & Drink": "FOOD_AND_DRINK",
            "Transportation": "TRANSPORTATION",
            "General Merchandise": "GENERAL_MERCHANDISE",
            "Rent & Utilities": "RENT_AND_UTILITIES",
            "Home Improvement": "HOME_IMPROVEMENT",
            "Entertainment": "ENTERTAINMENT",
            "Medical": "MEDICAL",
            "Personal Care": "PERSONAL_CARE",
            "Travel": "TRAVEL",
            "Bank Fees": "BANK_FEES",
            "Loan Payments": "LOAN_PAYMENTS",
            "Transfer Out": "TRANSFER_OUT",
            "Gov & Non-Profit": "GOVERNMENT_AND_NON_PROFIT",
            "General Services": "GENERAL_SERVICES"
          };

          const plaidCode =
            categoryToPlaid[cat.category_name] ||
            cat.category_name.toUpperCase().replace(/ /g, "_");
          const iconSvg = getCategoryIcon(plaidCode, 24);

          // Calculate untagged spending
          const taggedSpent = (cat.subcategories || []).reduce((sum, sub) => sum + Number(sub.spent), 0);
          const untaggedSpent = cat.total_spent - taggedSpent;
          const hasUntagged = Math.abs(untaggedSpent) > 0.01;
          const hasContent = (cat.subcategories && cat.subcategories.length > 0) || hasUntagged;

          return (
            <div
              key={cat.category_id}
              className={`budget-card ${isExpanded ? "expanded" : ""}`}
            >
              {/* CARD HEADER (Clickable) */}
              <div
                className="budget-card-header"
                onClick={() =>
                  setExpandedCategoryId(isExpanded ? null : cat.category_id)
                }
              >
                <div className="budget-card-info">
                  {/* Category Icon */}
                  <div
                    style={{
                      color: cat.category_color || "var(--mint)",
                      background: "var(--line)",
                      padding: "12px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {iconSvg}
                  </div>

                  <div className="budget-name-group">
                    <h4>{cat.category_name}</h4>
                    <span className="budget-spent-text">
                      {moneyFormatter(cat.total_spent, currency)} spent{" "}
                      {cat.budgeted_amount !== 0
                        ? `of ${moneyFormatter(cat.budgeted_amount, currency)}`
                        : `(Unbudgeted)`}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <svg
                  className={`budget-chevron ${isExpanded ? "open" : ""}`}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              {/* CATEGORY PROGRESS BAR (Linear) */}
              <div className="budget-progress-container">
                <div
                  className="budget-progress-fill"
                  style={{
                    width: `${Math.max(0, progressPercent)}%`,
                    backgroundColor: isOverBudget
                      ? "var(--coral)"
                      : cat.category_color || "var(--mint)",
                  }}
                ></div>
              </div>

              {/* ACCORDION CONTENT (Subcategories) */}
              {isExpanded && (
                <div className="budget-subcategories">
                  {hasContent ? (
                    <>
                      {cat.subcategories && cat.subcategories.map((sub) => (
                        <div key={sub.id} className="budget-sub-item">
                          <span className="budget-sub-name">• {sub.name}</span>
                          <span className="budget-sub-spent">
                            {moneyFormatter(sub.spent, currency)}
                          </span>
                        </div>
                      ))}
                      {hasUntagged && (
                        <div className="budget-sub-item">
                          <span className="budget-sub-name" style={{ fontStyle: 'italic', color: 'var(--muted)' }}>• Untagged</span>
                          <span className="budget-sub-spent">
                            {moneyFormatter(untaggedSpent, currency)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="budget-sub-item empty">
                      <span className="budget-sub-name">No spending yet.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
