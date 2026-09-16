import React, { useState, useEffect } from "react";
import axios from "axios";
import PulseCard from "./PulseCard.jsx";
import TransactionList from "./TransactionList.jsx";
import AddDataSheet from "./AddTransactionSheet.jsx";
import { usePlaidLink } from "react-plaid-link";
import ProfileTab from "./ProfileTab.jsx";
import getCategoryIcon from "../utils/CategoryIcons.jsx";
import BankCardList from "./BankCardList.jsx";
import BudgetTab from "./BudgetTab.jsx";
import { CANADIAN_BANKS } from "../lib/canadianBanks.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function HomeSkeleton({ token, user, onLogout }) {
  const date = new Date();

  const options = { weekday: "long", month: "long", day: "numeric" };
  const formattedDate = date.toLocaleDateString("en-US", options);
  const [greeting, setGreeting] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [spendingStats, setSpendingStats] = useState(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); // 'home', 'ledger', 'accounts'
  const [activeChip, setActiveChip] = useState("all"); // 'all', 'food', 'entertainment', etc.
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [DataSheetOpen, setDataSheetOpen] = useState("");
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [updateProfile, setUpdateProfile] = useState(0);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState("monthly");
  const [budgetWarning, setBudgetWarning] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [showManualWalletModal, setShowManualWalletModal] = useState(false);
  const [manualWalletName, setManualWalletName] = useState("");
  const [manualWalletBalance, setManualWalletBalance] = useState("");
  const [manualWalletCurrency, setManualWalletCurrency] = useState("CAD");
  const [manualWalletError, setManualWalletError] = useState("");
  const [addAccountInstitutionId, setAddAccountInstitutionId] = useState(null);

  const [showInstitutionModal, setShowInstitutionModal] = useState(false);
  const [institutionBankId, setInstitutionBankId] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [institutionError, setInstitutionError] = useState("");

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API_URL}/info`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API_URL}/transactions/spending`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API_URL}/budgets/summary?period=monthly`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API_URL}/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API_URL}/budgets`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(
        ([
          categoriesResponse,
          infoResponse,
          spendingResponse,
          budgetResponse,
          accountsResponse,
          budgetsDataResponse,
        ]) => {
          const userName = infoResponse.data.user_name;
          setGreeting(userName.split(" ")[0]);
          setUserInfo(infoResponse.data);
          setCategories(categoriesResponse.data);
          setAccounts(accountsResponse.data);
          setBudgets(budgetsDataResponse.data);
          setSpendingStats(spendingResponse.data);

          const allocated = budgetResponse.data.categories.reduce(
            (sum, cat) =>
              cat.budget_period !== "yearly" ? sum + cat.budgeted_amount : sum,
            0,
          );
          if (
            allocated > budgetResponse.data.monthly_target &&
            budgetResponse.data.monthly_target > 0
          ) {
            setBudgetWarning(true);
          } else {
            setBudgetWarning(false);
          }

          if (infoResponse.data.has_linked_bank) {
            // Future auto-sync logic can go here
          }
          setIsAppLoading(false);
        },
      )
      .catch((error) => {
        console.error("Error fetching user data:", error);
        setIsAppLoading(false);
      });
  }, [token, updateProfile, refreshTrigger]);

  useEffect(() => {
    setIsAvatarMenuOpen(false);
  }, [activeTab]);

  if (isAppLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100dvh",
          backgroundColor: "var(--bg)",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid var(--line)",
            borderTopColor: "var(--coral)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        ></div>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="frame">
      {budgetWarning && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--coral)",
            color: "white",
            padding: "12px 20px",
            borderRadius: "12px",
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(255, 107, 107, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "90%",
            maxWidth: "400px",
            animation: "slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ flexShrink: 0 }}
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span
            style={{
              fontSize: "14px",
              fontWeight: "600",
              lineHeight: "1.4",
              flex: 1,
            }}
          >
            Your allocated budgets exceed your monthly target!
          </span>
          <button
            onClick={() => setActiveTab("profile")}
            style={{
              backgroundColor: "white",
              color: "var(--coral)",
              border: "none",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            Increase Target
          </button>
        </div>
      )}
      <style>{`
        @keyframes slideDown {
          from { top: -50px; opacity: 0; }
          to { top: 20px; opacity: 1; }
        }
      `}</style>

      {/* Tab 1: Home Screen (add 'active' class to show, remove to hide) */}
      <div className={`screen ${activeTab == "home" ? "active" : ""}`}>
        <div className="topbar">
          <div>
            <div className="eyebrow">{formattedDate}</div>
            <h1>Hello, {greeting}</h1>
          </div>
          {/* Avatar circle */}
          {/* Avatar Area with Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative" }}>
              {/* The Avatar Button */}

              <div
                className="avatar"
                onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                style={{ cursor: "pointer" }}
              >
                {greeting.charAt(0)}
              </div>

              {/* The Floating Menu */}
              {isAvatarMenuOpen && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  onClick={() => setIsAvatarMenuOpen(false)}
                >
                  <div className="avatar-dropdown">
                    {/* Profile Button */}
                    <div
                      className="menu-item"
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        setActiveTab("profile");
                      }}
                    >
                      <div
                        className="menu-icon"
                        style={{ color: "var(--ink)" }}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                      <div>Profile</div>
                    </div>

                    {/* Logout Button (Themed Red!) */}
                    <div
                      className="menu-item"
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        onLogout();
                      }}
                    >
                      <div
                        className="menu-icon"
                        style={{
                          color: "var(--coral)",
                          background: "var(--coral-soft)",
                        }}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                      </div>
                      <div style={{ color: "var(--coral)" }}>Logout</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- MOUNT PULSE CARD HERE --- */}
        <div
          onClick={() => {
            setActiveTab("budget");
          }}
        >
          <PulseCard
            token={token}
            user={user}
            userInfo={userInfo}
            spendingStats={spendingStats}
            refreshTrigger={refreshTrigger}
            updateProfile={updateProfile}
          />
        </div>
        <div className="section-head">
          <h2>Recent activities</h2>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("ledger");
              setActiveChip("all");
              setTimeFilter("monthly");
            }}
          >
            See all
          </a>
        </div>
        {activeTab === "home" && (
          <TransactionList
            token={token}
            user={user}
            status="home"
            categories={categories}
            accounts={accounts}
            filter="all"
            timeFilter="monthly"
            refreshTrigger={refreshTrigger}
            onDataAdded={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}
        {/* --- MOUNT RECENT TRANSACTION LIST HERE --- */}
      </div>

      {/* Tab 2: Ledger Screen */}
      <div className={`screen ${activeTab === "ledger" ? "active" : ""}`}>
        <div
          className="topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div className="eyebrow">Ledger</div>
            <h1>Transactions</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* The Premium Filter Button */}
            <button
              className="btn-filter"
              onClick={() => setFilterSheetOpen(true)}
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
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
              Filters
            </button>
          </div>
        </div>
        {/* Chips filter row */}
        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom:
              "1px solid var(--line)" /* Optional: keep your line here if you like it */,
            marginBottom:
              "12px" /* Creates breathing room before the list starts */,
          }}
        >
          <span
            style={{
              color: "var(--muted)",
              fontSize: "14px",
              fontWeight: "500",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {activeChip === "all" ? "All Categories" : activeChip}
          </span>
          <span
            style={{
              color: "var(--muted)",
              fontSize: "14px",
              fontWeight: "500",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {timeFilter === "monthly"
              ? "This Month"
              : timeFilter
                  .replace(" month", " Months")
                  .replace(" year", " Year")}
          </span>
        </div>

        {activeTab === "ledger" && (
          <TransactionList
            key={`ledger-${activeChip}-${timeFilter}`}
            token={token}
            user={user}
            categories={categories}
            accounts={accounts}
            status="ledger"
            filter={activeChip}
            timeFilter={timeFilter}
            refreshTrigger={refreshTrigger}
            onDataAdded={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}
      </div>

      {/* Tab 3: Connected Accounts Screen */}
      <div className={`screen ${activeTab == "accounts" ? "active" : ""}`}>
        <div
          className="topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div className="eyebrow">Connected</div>
            <h1>Accounts</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                style={{
                  backgroundColor: "var(--paper-dim)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
                title="Add Account"
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
        </div>
        {/* --- MOUNT BANK CARD LIST HERE --- */}
        <BankCardList
          token={token}
          refreshTrigger={refreshTrigger}
          onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
          onAddAccount={(institutionId) => {
            setAddAccountInstitutionId(institutionId);
            setShowManualWalletModal(true);
          }}
        />
      </div>
      <div className={`screen ${activeTab === "profile" ? "active" : ""}`}>
        <div className="topbar">
          <div>
            <div className="eyebrow">Settings</div>
            <h1>Profile</h1>
          </div>
          <button className="navbtn" onClick={() => setActiveTab("home")}>
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        {activeTab === "profile" && (
          <ProfileTab
            token={token}
            closeTab={() => {
              setActiveTab("home");
              setUpdateProfile((prev) => prev + 1);
            }}
          />
        )}
      </div>
      <div className={`screen ${activeTab === "budget" ? "active" : ""}`}>
        <BudgetTab
          token={token}
          user={user}
          setActiveTab={setActiveTab}
          refreshTrigger={refreshTrigger}
          updateProfile={updateProfile}
        />
      </div>

      {/* Bottom Navigation Bar */}
      {activeTab !== "profile" && (
        <div className="navbar">
          {/* Add 'active' class to highlight the current tab */}
          <button
            className={`navbtn ${activeTab == "home" ? "active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            <span className="ic">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </span>
            Home
          </button>
          <button
            className={`navbtn ${activeTab == "ledger" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("ledger");
              setActiveChip("all");
              setTimeFilter("monthly");
            }}
          >
            <span className="ic">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </span>
            Ledger
          </button>
          {/* The floating action button (Plus) */}
          {/* The floating action button (Plus) */}
          <button
            className="navbtn fab"
            onClick={() => setIsSheetOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0, // Removes any hidden browser padding
              marginBottom: "10px",
            }}
          >
            <svg
              width="28"
              height="28"
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
          <button
            className={`navbtn ${activeTab == "accounts" ? "active" : ""}`}
            onClick={() => setActiveTab("accounts")}
          >
            <span className="ic">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </span>
            Accounts
          </button>
          <div style={{ position: "relative" }}>
            <button
              className={`navbtn ${activeTab === "budget" ? "active" : ""}`}
              onClick={() => setIsMoreSheetOpen(true)}
            >
              <span className="ic">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="19" cy="12" r="1"></circle>
                  <circle cx="5" cy="12" r="1"></circle>
                </svg>
              </span>
              More
            </button>
          </div>
        </div>
      )}
      <div
        className={`sheet-backdrop ${isSheetOpen ? "open" : ""}`}
        onClick={() => {
          setIsSheetOpen(false);
          setDataSheetOpen("");
        }}
      >
        <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          <button
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            onClick={() => { setIsSheetOpen(false); setDataSheetOpen(""); }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          {DataSheetOpen !== "" ? (
            <AddDataSheet
              type={DataSheetOpen}
              token={token}
              sheetOpen={isSheetOpen}
              onDataAdded={() => {
                setRefreshTrigger((prev) => prev + 1);
                setIsSheetOpen(false);
                setDataSheetOpen("");
              }}
              categories={categories}
              accounts={accounts}
              budgets={budgets}
            />
          ) : (
            <div>
              <div className="sheet-handle"></div>
              <h2 style={{ marginBottom: "8px" }}>Create New</h2>
              <div
                className="menu-item"
                onClick={() => {
                  setDataSheetOpen("Transaction"); // Opens your existing Add Transaction sheet!
                }}
              >
                <div className="menu-icon">
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
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                  </svg>
                </div>
                <div>Transaction</div>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setDataSheetOpen("Budget");
                }}
              >
                <div className="menu-icon">
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
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                  </svg>
                </div>
                <div>Budget Goal</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        className={`sheet-backdrop ${filterSheetOpen ? "open" : ""}`}
        onClick={() => setFilterSheetOpen(false)}
      >
        <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          <button
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            onClick={() => setFilterSheetOpen(false)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="sheet-actions filter-sheet">
            <div className="sheet-handle"></div>
            <h2 style={{ marginTop: 0, marginBottom: "24px" }}>
              Filter Transactions
            </h2>
            <div className="filter-section">
              <h3>Time Period</h3>
              <div className="segmented-control">
                {[
                  { label: "This Month", val: "monthly" },
                  { label: "3 Months", val: "3 month" },
                  { label: "6 Months", val: "6 month" },
                  { label: "1 Year", val: "1 year" },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    className={`segment ${timeFilter === opt.val ? "active" : ""}`}
                    onClick={() => setTimeFilter(opt.val)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-section">
              <h3>Categories</h3>
              <div className="category-grid">
                <div
                  className={`category-filter-chip ${activeChip === "all" ? "active" : ""}`}
                  onClick={() => setActiveChip("all")}
                >
                  <span className="cat-icon">
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
                      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
                    </svg>
                  </span>{" "}
                  All
                </div>

                {/* Dynamically Map Over Categories */}
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`category-filter-chip ${activeChip === cat.name ? "active" : ""}`}
                    onClick={() => setActiveChip(cat.name)}
                  >
                    <span className="cat-icon">
                      {getCategoryIcon(cat.plaid_primary_code, 16)}
                    </span>{" "}
                    {cat.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="filter-footer">
              <button
                className="btn btn-primary"
                style={{ width: "100%", padding: "16px", fontSize: "16px" }}
                onClick={() => setFilterSheetOpen(false)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className={`sheet-backdrop ${isMoreSheetOpen ? "open" : ""}`}
        onClick={() => setIsMoreSheetOpen(false)}
      >
        <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          <button
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            onClick={() => setIsMoreSheetOpen(false)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div>
            <div className="sheet-handle"></div>
            <h2 style={{ marginBottom: "16px" }}>More</h2>
            <div
              className="menu-item"
              onClick={() => {
                setActiveTab("budget");
                setIsMoreSheetOpen(false);
              }}
            >
              <div className="menu-icon">
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
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                  <polyline points="17 2 12 7 7 2"></polyline>
                </svg>
              </div>
              <div>Budgets</div>
            </div>
            {/* Future more options can go here */}
          </div>
        </div>
      </div>
      <div
        className={`sheet-backdrop ${showManualWalletModal ? "open" : ""}`}
        onClick={() => setShowManualWalletModal(false)}
      >
        <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          <button
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            onClick={() => setShowManualWalletModal(false)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div>
            <div className="sheet-handle"></div>
            <h2 style={{ marginBottom: "16px" }}>
              {addAccountInstitutionId
                ? "Add Account to Bank"
                : "Create Wallet"}
            </h2>

            <div className="sheet-actions">
              <div className="field">
                <label>
                  {addAccountInstitutionId ? "Account Name" : "Wallet Name"}
                </label>
                <input
                  type="text"
                  placeholder={
                    addAccountInstitutionId
                      ? "e.g., Checking"
                      : "e.g., Wallet Savings"
                  }
                  value={manualWalletName}
                  onChange={(e) => setManualWalletName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Starting Balance</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={manualWalletBalance}
                  onChange={(e) => setManualWalletBalance(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Account Type</label>

                <select
                  defaultValue={addAccountInstitutionId ? "Checking" : "Cash"}
                  onChange={(e) => {
                    // We'll reuse the wallet currency state as a hack or just pass type in API call
                  }}
                  id="acc-type-select"
                >
                  <option value="Checking">Checking</option>
                  <option value="Savings">Savings</option>
                  <option value="Credit">Credit Card</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div className="field">
                <label>Currency</label>
                <select
                  value={manualWalletCurrency}
                  onChange={(e) => setManualWalletCurrency(e.target.value)}
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              {manualWalletError && (
                <div
                  style={{
                    color: "var(--coral)",
                    fontSize: "14px",
                    marginBottom: "10px",
                    textAlign: "center",
                  }}
                >
                  {manualWalletError}
                </div>
              )}

              <div className="field">
                <button
                  className="btn btn-primary"
                  style={{ marginTop: "8px" }}
                  disabled={isAppLoading}
                  onClick={() => {
                    if (!manualWalletName || !manualWalletBalance) {
                      setManualWalletError("Please fill in all fields.");
                      return;
                    }
                    setManualWalletError("");
                    setIsAppLoading(true);
                    axios
                      .post(
                        `${API_URL}/accounts/manual`,
                        {
                          name: manualWalletName,
                          type:
                            document.getElementById("acc-type-select")?.value ||
                            "Checking",
                          currency: manualWalletCurrency,
                          balance: parseFloat(manualWalletBalance) || 0,
                          institution_id: addAccountInstitutionId,
                        },
                        { headers: { Authorization: `Bearer ${token}` } },
                      )
                      .then(() => {
                        setRefreshTrigger((prev) => prev + 1);
                        setShowManualWalletModal(false);
                        setManualWalletName("");
                        setManualWalletBalance("");
                        setManualWalletCurrency("CAD");
                        setAddAccountInstitutionId(null);
                        setIsAppLoading(false);
                      })
                      .catch((err) => {
                        console.error("Error creating wallet:", err);
                        setManualWalletError("Failed to create wallet.");
                        setIsAppLoading(false);
                      });
                  }}
                >
                  {isAppLoading ? "Creating..." : "Create Wallet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Institution Modal */}
      <div
        className={`sheet-backdrop ${showInstitutionModal ? "open" : ""}`}
        onClick={() => {
          setShowInstitutionModal(false);
          setInstitutionBankId("");
          setSetupToken("");
        }}
      >
        <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          <button
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            onClick={() => { setShowInstitutionModal(false); setInstitutionBankId(""); setSetupToken(""); }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div>
            <div className="sheet-handle"></div>
            <h2 style={{ marginBottom: "16px" }}>Add Institution</h2>

            <div className="sheet-actions">
              <div className="field">
                <label>Select Bank</label>
                <select
                  value={institutionBankId}
                  onChange={(e) => {
                    setInstitutionBankId(e.target.value);
                    setInstitutionError(""); // clear error when selecting
                  }}
                >
                  <option value="" disabled>
                    Select a bank...
                  </option>
                  {CANADIAN_BANKS.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>SimpleFin Setup Token (Optional)</label>
                <input
                  type="text"
                  placeholder="Paste your base64 setup token here..."
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                />
              </div>

              {institutionError && (
                <div
                  style={{
                    color: "var(--coral)",
                    fontSize: "14px",
                    marginBottom: "10px",
                    textAlign: "center",
                  }}
                >
                  {institutionError}
                </div>
              )}

              <div className="field">
                <button
                  className="btn btn-primary"
                  style={{ marginTop: "8px" }}
                  disabled={isAppLoading}
                  onClick={() => {
                    const bank = CANADIAN_BANKS.find(
                      (b) => b.id === institutionBankId,
                    );
                    if (!bank) {
                      setInstitutionError("Please select a bank from the list.");
                      return;
                    }
                    setInstitutionError("");
                    setIsAppLoading(true);
                    axios
                      .post(
                        `${API_URL}/institutions`,
                        {
                          name: bank.name,
                          logo: bank.logo,
                          setup_token: setupToken
                        },
                        { headers: { Authorization: `Bearer ${token}` } },
                      )
                      .then(() => {
                        setRefreshTrigger((prev) => prev + 1);
                        setShowInstitutionModal(false);
                        setIsAppLoading(false);
                        setInstitutionBankId("");
                        setSetupToken("");
                      })
                      .catch((err) => {
                        console.error("Error creating institution:", err);
                        setInstitutionError("Failed to add institution. Check your setup token.");
                        setIsAppLoading(false);
                      });
                  }}
                >
                  {isAppLoading ? "Adding..." : "Add Institution"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Add Menu Bottom Sheet */}
      <div
        className={`sheet-backdrop ${isAddMenuOpen ? "open" : ""}`}
        onClick={() => setIsAddMenuOpen(false)}
      >
        <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          <button
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            onClick={() => setIsAddMenuOpen(false)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div>
            <div className="sheet-handle"></div>
            <h2 style={{ marginBottom: "16px" }}>Add Account</h2>

            <div
              className="menu-item"
              onClick={() => {
                setIsAddMenuOpen(false);
                setShowInstitutionModal(true);
              }}
            >
              <div className="menu-icon" style={{ color: "var(--mint)" }}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 22h18" />
                  <path d="M6 18v-7" />
                  <path d="M10 18v-7" />
                  <path d="M14 18v-7" />
                  <path d="M18 18v-7" />
                  <path d="m12 2-8 5h16z" />
                </svg>
              </div>
              <div>Add Institution (Bank)</div>
            </div>

            <div
              className="menu-item"
              onClick={() => {
                setIsAddMenuOpen(false);
                setAddAccountInstitutionId(null);
                setShowManualWalletModal(true);
              }}
            >
              <div className="menu-icon" style={{ color: "var(--mint)" }}>
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
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </div>
              <div>Create Wallet</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
