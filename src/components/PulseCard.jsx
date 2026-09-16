import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function PulseCard({
  token,
  user,
  userInfo,
  spendingStats,
  refreshTrigger,
  updateProfile,
}) {
  const [totalSpent, setTotalSpent] = useState(0);
  const [previousSpent, setPreviousSpent] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0);
  const [period, setPeriod] = useState("monthly");
  const [currency, setCurrency] = useState("CAD");

  function calculateTotalBudgetPerMonth(monthlyTarget, period) {
    const monthlyBudget = parseFloat(monthlyTarget);
    if (period === "monthly") {
      return monthlyBudget;
    } else if (period === "yearly") {
      return monthlyBudget * 12;
    }
  }

  function daysLeftInMonth() {
    const today = new Date();
    const LastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );
    return LastDayOfMonth.getDate() - today.getDate();
  }

  function getDaysLeftInYear() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const endOfYear = new Date(currentYear + 1, 0, 1);
    const msDiff = endOfYear - now;
    return Math.ceil(msDiff / (1000 * 60 * 60 * 24));
  }

  useEffect(() => {
    if (!userInfo || !spendingStats) return;

    const monthlyBudget = userInfo.monthly_target;

    const spentTotal =
      period === "monthly"
        ? spendingStats.current_month_spent
        : spendingStats.current_year_spent;
    
    const prevSpent =
      period === "monthly"
        ? spendingStats.last_month_spent_to_date
        : spendingStats.last_year_spent_to_date;

    const budgetTotal = calculateTotalBudgetPerMonth(monthlyBudget, period);

    setTotalSpent(spentTotal);
    setPreviousSpent(prevSpent);
    setTotalBudget(budgetTotal);
    setCurrency(userInfo.default_currency);
  }, [userInfo, spendingStats, period]);

  const budgetLeft = Number(totalBudget) - Number(totalSpent);
  const percentLeft = totalBudget > 0 ? (budgetLeft / totalBudget) * 100 : 100;
  let healthClass = "health-good";
  if (percentLeft < 0) healthClass = "health-danger";
  else if (percentLeft < 20) healthClass = "health-warning";

  function moneyFormatter(value, currency_symbol) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency_symbol,
    }).format(Number(value));
  }

  return (
    <div className="pulse-card">
      <div className="pulse-top">
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div className="pulse-label" style={{ margin: 0 }}>
              {`Spent this ${period === "monthly" ? "month" : "year"}`}
            </div>
            <div className="text-toggle">
              <span
                className={`toggle-tab ${period === "monthly" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeriod("monthly");
                }}
              >
                Monthly
              </span>
              <span className="toggle-sep">/</span>
              <span
                className={`toggle-tab ${period === "yearly" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeriod("yearly");
                }}
              >
                Yearly
              </span>
            </div>
          </div>

          <div className="pulse-amount-row">
            <div className="pulse-amount" style={{ margin: 0 }}>
              {moneyFormatter(totalSpent, currency)}
            </div>

            {previousSpent > 0 && (
              <div
                className={`pulse-comparison-pill ${totalSpent > previousSpent ? "higher" : "lower"}`}
              >
                <div className="pulse-comparison-icon">
                  {totalSpent > previousSpent ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  ) : (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="7" y1="7" x2="17" y2="17"></line>
                      <polyline points="17 7 17 17 7 17"></polyline>
                    </svg>
                  )}
                </div>
                <span>
                  {Math.abs(
                    ((totalSpent - previousSpent) / previousSpent) * 100,
                  ).toFixed(0)}
                  % from last {period === "monthly" ? "month" : "year"}
                </span>
              </div>
            )}
          </div>

          <div className="pulse-sub" style={{ marginTop: "12px" }}>
            {totalBudget > 0
              ? `of ${moneyFormatter(totalBudget, currency)} budget · `
              : ""}
            {period === "monthly" ? daysLeftInMonth() : getDaysLeftInYear()}{" "}
            days left
          </div>
          <div
            className={`pulse-remaining ${healthClass}`}
          >{`${moneyFormatter(Number(totalBudget) - Number(totalSpent), currency)} REMAINING`}</div>
        </div>
      </div>
    </div>
  );
}
