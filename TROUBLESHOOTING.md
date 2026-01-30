# Troubleshooting Guide - Trading Bot

## 🔧 Common Issues & Solutions

---

### Issue: "Bot stuck on 'Analyzing market...'"

#### **Cause:**
The bot needs to collect **20 candles** (15-minute timeframe) before it can start analyzing. This takes approximately **5 hours** in real-time.

#### **What you'll see now:**
✅ **Progress updates** showing:
```
Collecting market data... 5/20 candles (25%). 
Please wait 15 more candles (~4 minutes).
```

#### **Solution:**
**Just wait!** The bot will automatically:
1. Show progress: "0/20 candles (0%)"
2. Update every 15 minutes when a new candle closes
3. Start analyzing when it reaches "20/20 candles (100%)"

#### **Timeline:**
- **1 candle** = 15 minutes
- **20 candles** = 5 hours
- Progress updates every 15 minutes

#### **What happens after 20 candles:**
✅ Bot Analysis section will show real analysis
✅ Signals will start generating
✅ Trade opportunities will be detected
✅ All sections will become active

---

### Issue: "No signals appearing"

#### **Possible Causes:**

**1. Not enough data yet**
- Need 20+ candles
- Check progress message

**2. No trade setups in current market**
- Bot only signals when conditions are met
- Could be hours between signals
- This is normal!

**3. Market is ranging**
- Decision Factors will show: "○ Ranging market"
- Bot waits for clear trend

#### **Solution:**
- Be patient
- Check "Decision Factors" to see what's missing
- Wait for "Trade Opportunity Status" to change

---

### Issue: "WebSocket disconnected"

#### **Symptoms:**
- Status shows "Disconnected" (red)
- Price not updating
- No new candles

#### **Solution:**
1. **Check internet connection**
2. **Wait 5 seconds** - Auto-reconnects
3. **Refresh page** if still disconnected
4. **Check Binance status** - May be maintenance

---

### Issue: "Bot Analysis shows old data"

#### **Cause:**
Updates every 5 seconds, but only when:
- New price data arrives
- Candles close (every 15 min)
- Signals are generated

#### **Solution:**
This is normal! The bot updates:
- **Price**: Real-time
- **Analysis**: Every 5 seconds
- **Candles**: Every 15 minutes
- **Signals**: When conditions met

---

### Issue: "Performance stats not updating"

#### **Cause:**
Stats only update when signals complete (hit target or stop loss)

#### **Solution:**
- Wait for tracked signal to finish
- Stats update automatically
- Can take hours depending on volatility

---

## ⏱️ Expected Timelines

### Initial Setup:
```
0 min    → Page loads, connects to WebSocket
0-15 min → First candle arrives
15 min   → Progress: 1/20 (5%)
30 min   → Progress: 2/20 (10%)
...
5 hours  → Progress: 20/20 (100%) ✅
5+ hours → Bot starts analyzing!
```

### After Data Collection:
```
Every 5 sec  → Bot thinking updates
Every 15 min → New candle, re-analysis
Variable     → Signals (when conditions met)
```

---

## 🎯 Quick Checks

### ✅ Is everything working?

**Check these indicators:**

1. **Connection Status** (top right)
   - Should be: "Connected" (green)
   - If red: Wait 5 sec or refresh

2. **Current Price** (chart header)
   - Should be updating
   - If stuck: Check connection

3. **Bot Analysis - Current Market Assessment**
   - If shows progress (X/20): Still collecting
   - If shows analysis: Ready! ✅

4. **Trade Opportunity Status**
   - "Loading market data: X%": Still collecting
   - "Scanning...": Collecting complete, looking for trades
   - "Ready!": Trade opportunity found!

---

## 🚀 Speed Up Testing (Development Only)

**Want to test faster?** Modify `app.js`:

### Option 1: Reduce required candles
```javascript
// Line 798 (in updateBotThinking function)
if (state.candles.length < 20) {  // Change 20 to 5
```

```javascript
// Line 1053 (in startAnalysisLoop function)
if (state.candles.length >= 20) {  // Change 20 to 5
```

**Result:** Bot starts after 5 candles (~1.25 hours)

### Option 2: Use 1-minute candles
```javascript
// Line 4 (in CONFIG)
interval: '15m',  // Change to '1m'
```

**Result:** 20 candles in 20 minutes instead of 5 hours

⚠️ **Warning:** Shorter timeframes = more noise, less accurate signals

---

## 📊 What's Normal?

### ✅ Normal Behavior:

- **5 hours** initial wait for data
- **Hours** between high-quality signals
- **Multiple** decision factors changing
- **Occasional** "No signals" periods
- **Ranging** market status often

### ❌ Not Normal:

- **Never** connecting to WebSocket
- **Stuck** at same candle count for 20+ min
- **Error messages** in browser console
- **Blank** sections after 5+ hours

---

## 🔍 Debug Mode

### Check Browser Console:

**Open Console:**
- **Chrome/Edge**: F12 → Console tab
- **Firefox**: F12 → Console tab
- **Safari**: Cmd+Option+C

**Look for:**
- ✅ "WebSocket connected"
- ✅ Price updates
- ❌ Red error messages
- ❌ "WebSocket error"

---

## 💡 Pro Tips

1. **Leave page open** - Don't close while collecting data
2. **Check back in 5 hours** - Set a timer
3. **Stable internet** - Disconnects reset progress
4. **Be patient** - Quality signals take time
5. **Learn while waiting** - Read the documentation!

---

## 📞 Still Having Issues?

### Checklist:

- [ ] Waited at least 5 hours?
- [ ] WebSocket shows "Connected"?
- [ ] Internet connection stable?
- [ ] Browser console shows no errors?
- [ ] Tried refreshing the page?
- [ ] Checked Binance.com is accessible?

### If all checked and still broken:

1. **Clear browser cache**
2. **Try different browser**
3. **Check firewall/antivirus**
4. **Verify file integrity** (re-download if needed)

---

## ⚡ Quick Fix Summary

| Problem | Quick Fix |
|---------|-----------|
| Stuck analyzing | Wait 5 hours for 20 candles |
| No signals | Normal - wait for setup |
| Disconnected | Wait 5 sec, auto-reconnects |
| Old data | Updates every 5 sec (normal) |
| Blank sections | Still loading data |

---

**Remember:** The bot is working correctly if you see progress updates! Just be patient. 🎯

**Version:** 2.1.1  
**Last Updated:** 2026-01-30
