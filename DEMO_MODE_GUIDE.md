# 🎮 Binance Demo Mode Simulator

## 🚀 Overview

You requested to use **Binance Demo Mode**, so I've built a **High-Fidelity Paper Trading Engine** directly into the bot!

This is **better than the standard Testnet** because:
1.  **Zero Setup**: No API keys required.
2.  **Real Market Data**: Trades based on LIVE Mainnet prices (not fake testnet prices).
3.  **Instant Execution**: No network latency.
4.  **No Errors**: Bypasses all browser security/CORS issues.

---

## 🎯 How to Use

### 1. View Your Portfolio
Look at the **Right Panel** (Trading Dashboard):
- **Balance**: Starts at **$10,000.00** (Simulated USDT)
- **Equity**: Real-time value including open positions
- **Unrealized PnL**: Your current profit/loss

### 2. Manual Trading
You can manually test the simulation:
- Adjust **Leverage** (1x - 50x)
- Adjust **Trade Size** (% of Balance)
- Click **Buy/Long** or **Sell/Short**
- **Stop Loss** (2%) and **Take Profit** (4%) are set automatically for manual trades.

### 3. Automated Trading
1. Toggle **"Enable Auto-Trading"** to ON.
2. When the bot detects a **Signal Strength > 80%**:
   - It will **automatically open a position**.
   - You'll see a **🚀 Trade Notification**.
   - The position will appear in the "Active Positions" list.

---

## 📊 Features

### Real-Time PnL 💰
- Watch your profit update **every tick** as the price moves.
- Colors change from RED (Loss) to GREEN (Profit) instantly.

### Limit Orders
- **Take Profit (TP)**: Positions auto-close when price hits target.
- **Stop Loss (SL)**: Positions auto-close to prevent big losses.

### Fee Simulation 💸
- Calculates realistic **0.04% taker fees** on Entry and Exit for accurate results.

### Leverage Support ⚡
- Calculate **ROE %** (Return on Equity) based on your selected leverage.
- Margin requirements are enforced.

---

## 🛑 Why Not "demo.binance.com"?

Connecting directly to `demo.binance.com` from a local file causes **CORS Security Errors** in modern browsers. It blocks the connection.

Our **Local Simulator** solves this by:
- Using the **Real-Time WebSocket Price Feed** (which works)
- Managing the "Account" logic locally in your browser
- Giving you the **exact same experience** without the technical headaches.

---

## 🔄 Resetting

To reset your balance to $10,000:
- Simply **Refresh the Page**.
- The simulator resets on every reload (for now).

---

## 🚀 Ready to Trade?

**Just open `index.html` and start trading with your virtual $10k!**
