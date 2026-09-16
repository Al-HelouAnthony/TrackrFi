# TrackrFi

TrackrFi is a premium, full-stack personal finance and budgeting dashboard designed to provide a crystal-clear view of your financial health. Built with modern web technologies, it securely aggregates your bank accounts, credit cards, and cash wallets into one unified ledger through smart automation and manual entry.

## Features

- **Automated Ledger:** Automatically fetches and categorizes your transactions in real-time.
- **Pulse Dashboard:** Get instant insights into your monthly spending, net worth, and asset-to-liability ratios.
- **Advanced Filtering:** Filter transactions by category (Food, Subscriptions, Transport, etc.) or time period with smooth, instant pagination.
- **AI-Powered Email Parsing:** Uses Google Gemini to automatically ingest, categorize, and deduplicate e-transfer emails into transactions. Includes smart transfer logic that balances credit cards against checking accounts and ignores internal transfers between friends.
- **Premium UI/UX:** Built with a state-of-the-art dark mode aesthetic, featuring micro-animations, glassmorphism, custom native date/time pickers optimized for iOS/Webkit, and sleek CSS loaders.

## Tech Stack

**Frontend:**
- React 18 + Vite
- Vanilla CSS (Custom Design System with CSS Variables)
- Axios for API requests

**Backend:**
- Node.js & Express.js
- Google Gen AI SDK (`@google/genai`) for intelligent parsing and logic extraction
- pg (node-postgres) for raw, high-performance database queries

**Database:**
- Supabase (PostgreSQL)
- Relational schema tracking users, accounts, and transactions.
