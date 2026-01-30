// ===== Configuration =====
const CONFIG = {
    symbol: 'BTCUSDT',
    interval: '15m', // 15-minute timeframe for analysis
    binanceWsUrl: 'wss://fstream.binance.com/ws/',
    binanceApiUrl: 'https://fapi.binance.com',
    updateInterval: 5000, // Update signals every 5 seconds
    historicalLimit: 100, // Number of historical candles to fetch
    whaleThreshold: 100000, // USD value to consider a trade as "whale"
};

// ===== State Management =====
const state = {
    currentPrice: 0,
    priceHistory: [],
    pivotPoints: {},
    ictLevels: {},
    signals: [],
    apiConnected: false,
    apiKey: null,
    apiSecret: null,
    autoTrade: false,
    websocket: null,
    candles: [],
    // Signal tracking
    activeTrackedSignal: null,
    trackedSignalUpdates: [],
    // Performance stats
    performance: {
        totalSignals: 0,
        activeSignals: 0,
        wins: 0,
        losses: 0,
        profits: [],
        bestTrade: 0,
    },
    // Advanced market data
    fundingRate: 0,
    nextFundingTime: 0,
    openInterest: 0,
    openInterestChange: 0,
    longShortRatio: 0,
    whaleTrades: [],
    largeTradePatterns: {
        bullishWhales: 0,
        bearishWhales: 0,
        recentDirection: 'neutral',
    },
    dataLoaded: false,
    // Simulation State
    sim: {
        balance: 10000,
        equity: 10000,
        positions: [],
        orders: [],
        leverage: 10,
        tradeSizePercent: 10,
        fees: 0.0004, // 0.04% taker fee
        autoTrade: false,
    }
};

// ===== Simulation Engine =====
const SimEngine = {
    // Open a new position
    openPosition: (type, entryPrice, stopLoss, takeProfit) => {
        const sizeUsd = (state.sim.balance * (state.sim.tradeSizePercent / 100)) * state.sim.leverage;
        const quantity = sizeUsd / entryPrice;

        // Check margin
        const marginRequired = sizeUsd / state.sim.leverage;
        if (marginRequired > state.sim.balance) {
            alert('Insufficient balance for this trade');
            return;
        }

        const position = {
            id: Date.now(),
            symbol: 'BTCUSDT',
            type: type, // 'LONG' or 'SHORT'
            entryPrice: parseFloat(entryPrice),
            quantity: quantity,
            leverage: state.sim.leverage,
            margin: marginRequired,
            stopLoss: parseFloat(stopLoss),
            takeProfit: parseFloat(takeProfit),
            openTime: new Date().toLocaleTimeString(),
            pnl: 0,
            roe: 0,
        };

        // Deduct Fee
        const entryFee = sizeUsd * state.sim.fees;
        state.sim.balance -= entryFee;
        state.sim.equity -= entryFee;

        state.sim.positions.push(position);
        SimEngine.addOrderHistory(type, entryPrice, quantity, 'OPEN');
        SimEngine.updateUI();
    },

    // Close a position
    closePosition: (id) => {
        const posIndex = state.sim.positions.findIndex(p => p.id === id);
        if (posIndex === -1) return;

        const pos = state.sim.positions[posIndex];
        const currentPrice = state.currentPrice;

        // Calculate Final PnL
        let pnl = 0;
        const value = pos.quantity * currentPrice;

        if (pos.type === 'LONG') {
            pnl = (currentPrice - pos.entryPrice) * pos.quantity;
        } else {
            pnl = (pos.entryPrice - currentPrice) * pos.quantity;
        }

        // Deduct Fee
        const exitFee = value * state.sim.fees;
        const finalPnl = pnl - exitFee;

        state.sim.balance += finalPnl; // Margin is already in "balance" logic for simplicity here, but usually returned.
        // Actually, margin is part of balance. PnL is added/subtracted.

        state.sim.positions.splice(posIndex, 1);
        SimEngine.addOrderHistory(pos.type === 'SHORT' ? 'BUY' : 'SELL', currentPrice, pos.quantity, 'CLOSE', finalPnl);
        SimEngine.updateUI();
    },

    // Update PnL for active positions
    updatePositions: () => {
        if (state.sim.positions.length === 0) return;

        const currentPrice = state.currentPrice;
        let totalUnrealizedPnl = 0;

        state.sim.positions.forEach((pos, index) => {
            let pnl = 0;
            if (pos.type === 'LONG') {
                pnl = (currentPrice - pos.entryPrice) * pos.quantity;
            } else {
                pnl = (pos.entryPrice - currentPrice) * pos.quantity;
            }

            pos.pnl = pnl;
            pos.roe = (pnl / pos.margin) * 100;
            totalUnrealizedPnl += pnl;

            // Check TP/SL
            if (pos.type === 'LONG') {
                if (pos.takeProfit > 0 && currentPrice >= pos.takeProfit) SimEngine.closePosition(pos.id);
                if (pos.stopLoss > 0 && currentPrice <= pos.stopLoss) SimEngine.closePosition(pos.id);
            } else {
                if (pos.takeProfit > 0 && currentPrice <= pos.takeProfit) SimEngine.closePosition(pos.id);
                if (pos.stopLoss > 0 && currentPrice >= pos.stopLoss) SimEngine.closePosition(pos.id);
            }
        });

        state.sim.equity = state.sim.balance + totalUnrealizedPnl;
        SimEngine.updateUI();
    },

    // Add to history
    addOrderHistory: (side, price, qty, type, pnl = 0) => {
        const order = {
            time: new Date().toLocaleTimeString(),
            side, price, qty, type, pnl
        };
        state.sim.orders.unshift(order);
        if (state.sim.orders.length > 20) state.sim.orders.pop();
    },

    // Update Dashboard UI
    updateUI: () => {
        // Update Wallet
        document.getElementById('walletBalance').textContent = `$${state.sim.balance.toFixed(2)}`;
        document.getElementById('walletEquity').textContent = `$${state.sim.equity.toFixed(2)}`;

        const pnl = state.sim.equity - state.sim.balance;
        const pnlEl = document.getElementById('walletPnL');
        pnlEl.textContent = `$${pnl.toFixed(2)}`;
        pnlEl.className = `value ${pnl >= 0 ? 'success' : 'danger'}`;

        // Update Positions List
        const posList = document.getElementById('positionsList');
        const posCount = document.getElementById('positionCount');

        posCount.textContent = state.sim.positions.length;

        if (state.sim.positions.length === 0) {
            posList.innerHTML = `<div class="empty-state"><span class="icon">📉</span><p>No active positions</p></div>`;
        } else {
            posList.innerHTML = state.sim.positions.map(p => `
                <div class="position-card ${p.type.toLowerCase()}">
                    <div class="pos-header">
                        <span class="${p.type === 'LONG' ? 'success' : 'danger'}">${p.type} ${p.leverage}x</span>
                        <span>BTCUSDT</span>
                    </div>
                    <div class="pos-details">
                        <div class="pos-detail"><span>Entry</span> <b>${p.entryPrice.toFixed(2)}</b></div>
                        <div class="pos-detail"><span>Mark</span> <b>${state.currentPrice.toFixed(2)}</b></div>
                        <div class="pos-detail"><span>Size</span> <b>${p.quantity.toFixed(3)}</b></div>
                        <div class="pos-detail"><span>Margin</span> <b>$${p.margin.toFixed(2)}</b></div>
                    </div>
                    <div class="pos-pnl">
                        <span class="pnl-value ${p.pnl >= 0 ? 'success' : 'danger'}">
                            ${p.pnl.toFixed(2)} USDT (${p.roe.toFixed(2)}%)
                        </span>
                        <button class="close-btn" onclick="SimEngine.closePosition(${p.id})">Close</button>
                    </div>
                </div>
            `).join('');
        }

        // Update History
        const histList = document.getElementById('orderHistory');
        histList.innerHTML = state.sim.orders.map(o => `
            <div class="history-item">
                <span class="time">${o.time}</span>
                <span class="${o.side === 'LONG' || o.side === 'BUY' ? 'success' : 'danger'}">${o.side}</span>
                <span>${o.type}</span>
                <span>$${o.price.toFixed(2)}</span>
                ${o.pnl !== 0 ? `<span class="${o.pnl >= 0 ? 'success' : 'danger'}">${o.pnl.toFixed(2)}</span>` : ''}
            </div>
        `).join('');
    },

    // ===== API Integration =====
    connectApi: async (key, secret) => {
        state.apiKey = key;
        state.apiSecret = secret;

        try {
            await SimEngine.fetchAccountData();
            state.sim.useApi = true;
            console.log('API Connected!');
            alert('Connected to Binance Testnet! Showing REAL account data.');

            // Update UI
            document.getElementById('toggleApiFormBtn').textContent = '✅ Connected to Testnet';
            document.getElementById('toggleApiFormBtn').classList.add('success');
            document.getElementById('apiForm').classList.add('hidden');
            document.getElementById('disconnectBtn').disabled = false;

            // Start Sync Loop
            setInterval(() => SimEngine.fetchAccountData(), 5000);

        } catch (error) {
            console.error(error);
            alert('API Connection Failed: ' + error.message);
        }
    },

    fetchAccountData: async () => {
        if (!state.apiKey || !state.apiSecret) return;

        const baseUrl = 'https://testnet.binancefuture.com';
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = await SimEngine.hmacSHA256(state.apiSecret, queryString);

        try {
            const response = await fetch(`${baseUrl}/fapi/v2/account?${queryString}&signature=${signature}`, {
                headers: { 'X-MBX-APIKEY': state.apiKey }
            });
            const data = await response.json();

            if (data.code) throw new Error(data.msg); // Binance Error

            // Update Balance
            state.sim.balance = parseFloat(data.totalWalletBalance);
            state.sim.equity = parseFloat(data.totalMarginBalance);

            // Update Positions
            const activePositions = data.positions.filter(p => parseFloat(p.positionAmt) !== 0 && p.symbol === 'BTCUSDT');

            state.sim.positions = activePositions.map(p => ({
                id: 'REAL-' + Date.now() + Math.random(),
                symbol: p.symbol,
                type: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
                entryPrice: parseFloat(p.entryPrice),
                quantity: Math.abs(parseFloat(p.positionAmt)),
                leverage: parseInt(p.leverage),
                margin: parseFloat(p.initialMargin),
                pnl: parseFloat(p.unrealizedProfit),
                roe: 0, // Calculate manually if needed
                markPrice: 0,
                stopLoss: 0,
                takeProfit: 0
            }));

            SimEngine.updateUI();

        } catch (error) {
            console.error('Fetch Account Error:', error);
            // Don't throw to keep loop alive
        }
    },

    hmacSHA256: async (key, message) => {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(key);
        const msgData = encoder.encode(message);
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' },
            false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
};

// ===== TradingView Chart Initialization =====
function initTradingViewChart() {
    new TradingView.widget({
        autosize: true,
        symbol: 'BINANCE:BTCUSDT.P',
        interval: '15',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0a0e1a',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        container_id: 'tradingview_chart',
        studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies',
        ],
        disabled_features: ['use_localstorage_for_settings'],
        enabled_features: ['study_templates'],
        overrides: {
            'paneProperties.background': '#111827',
            'paneProperties.backgroundType': 'solid',
        },
    });
}

// ===== Fetch Historical Data =====
async function fetchHistoricalData() {
    try {
        console.log('Fetching historical data...');
        updateDataCollectionProgress('Fetching historical candles...');

        // Fetch historical klines
        const klinesUrl = `${CONFIG.binanceApiUrl}/fapi/v1/klines?symbol=${CONFIG.symbol}&interval=${CONFIG.interval}&limit=${CONFIG.historicalLimit}`;
        const klinesResponse = await fetch(klinesUrl);
        const klinesData = await klinesResponse.json();

        // Process historical candles
        state.candles = klinesData.map(k => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
        }));

        // Set current price from latest candle
        if (state.candles.length > 0) {
            state.currentPrice = state.candles[state.candles.length - 1].close;
            updatePriceDisplay(state.currentPrice);
        }

        console.log(`Loaded ${state.candles.length} historical candles`);

        // Fetch funding rate
        await fetchFundingRate();

        // Fetch open interest
        await fetchOpenInterest();

        // Fetch long/short ratio
        await fetchLongShortRatio();

        // Fetch recent large trades
        await fetchRecentTrades();

        // Mark data as loaded
        state.dataLoaded = true;

        // Immediately analyze
        calculatePivotPoints();
        analyzeICT();
        analyzeWhalePatterns();
        generateSignals();
        updateBotThinking();

        console.log('Historical data loaded and analyzed!');

    } catch (error) {
        console.error('Error fetching historical data:', error);
        updateDataCollectionProgress('Error loading data. Retrying...');
        // Retry after 5 seconds
        setTimeout(fetchHistoricalData, 5000);
    }
}

// ===== Fetch Funding Rate =====
async function fetchFundingRate() {
    try {
        const url = `${CONFIG.binanceApiUrl}/fapi/v1/premiumIndex?symbol=${CONFIG.symbol}`;
        const response = await fetch(url);
        const data = await response.json();

        state.fundingRate = parseFloat(data.lastFundingRate) * 100; // Convert to percentage
        state.nextFundingTime = data.nextFundingTime;

        console.log(`Funding Rate: ${state.fundingRate.toFixed(4)}%`);
    } catch (error) {
        console.error('Error fetching funding rate:', error);
    }
}

// ===== Fetch Open Interest =====
async function fetchOpenInterest() {
    try {
        const url = `${CONFIG.binanceApiUrl}/fapi/v1/openInterest?symbol=${CONFIG.symbol}`;
        const response = await fetch(url);
        const data = await response.json();

        const newOI = parseFloat(data.openInterest);

        // Calculate change if we have previous data
        if (state.openInterest > 0) {
            state.openInterestChange = ((newOI - state.openInterest) / state.openInterest) * 100;
        }

        state.openInterest = newOI;

        console.log(`Open Interest: ${state.openInterest.toFixed(2)} (${state.openInterestChange >= 0 ? '+' : ''}${state.openInterestChange.toFixed(2)}%)`);
    } catch (error) {
        console.error('Error fetching open interest:', error);
    }
}

// ===== Fetch Long/Short Ratio =====
async function fetchLongShortRatio() {
    try {
        const url = `${CONFIG.binanceApiUrl}/futures/data/globalLongShortAccountRatio?symbol=${CONFIG.symbol}&period=5m&limit=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.length > 0) {
            state.longShortRatio = parseFloat(data[0].longShortRatio);
            console.log(`Long/Short Ratio: ${state.longShortRatio.toFixed(2)}`);
        }
    } catch (error) {
        console.error('Error fetching long/short ratio:', error);
    }
}

// ===== Fetch Recent Large Trades =====
async function fetchRecentTrades() {
    try {
        const url = `${CONFIG.binanceApiUrl}/fapi/v1/aggTrades?symbol=${CONFIG.symbol}&limit=500`;
        const response = await fetch(url);
        const trades = await response.json();

        // Filter whale trades (large volume)
        state.whaleTrades = trades
            .filter(t => {
                const value = parseFloat(t.p) * parseFloat(t.q);
                return value >= CONFIG.whaleThreshold;
            })
            .map(t => ({
                price: parseFloat(t.p),
                quantity: parseFloat(t.q),
                value: parseFloat(t.p) * parseFloat(t.q),
                time: t.T,
                isBuy: t.m === false, // m=false means buyer is maker (buy order)
            }))
            .slice(-50); // Keep last 50 whale trades

        console.log(`Found ${state.whaleTrades.length} whale trades (>${CONFIG.whaleThreshold} USD)`);
    } catch (error) {
        console.error('Error fetching recent trades:', error);
    }
}

// ===== Analyze Whale Patterns =====
function analyzeWhalePatterns() {
    if (state.whaleTrades.length === 0) return;

    let bullishWhales = 0;
    let bearishWhales = 0;

    state.whaleTrades.forEach(trade => {
        if (trade.isBuy) {
            bullishWhales++;
        } else {
            bearishWhales++;
        }
    });

    state.largeTradePatterns.bullishWhales = bullishWhales;
    state.largeTradePatterns.bearishWhales = bearishWhales;

    // Determine recent direction
    const ratio = bullishWhales / (bullishWhales + bearishWhales);
    if (ratio > 0.6) {
        state.largeTradePatterns.recentDirection = 'bullish';
    } else if (ratio < 0.4) {
        state.largeTradePatterns.recentDirection = 'bearish';
    } else {
        state.largeTradePatterns.recentDirection = 'neutral';
    }

    console.log(`Whale Pattern: ${state.largeTradePatterns.recentDirection} (${bullishWhales} buys, ${bearishWhales} sells)`);
}

// ===== WebSocket Connection =====
function connectWebSocket() {
    const wsUrl = `${CONFIG.binanceWsUrl}${CONFIG.symbol.toLowerCase()}@kline_${CONFIG.interval}`;

    state.websocket = new WebSocket(wsUrl);

    state.websocket.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus('Connected', true);
    };

    state.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.k) {
            handleKlineData(data.k);
        }
    };

    state.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus('Error', false);
    };

    state.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus('Disconnected', false);
        // Reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
    };
}

// ===== Handle Kline Data =====
function handleKlineData(kline) {
    const candle = {
        time: kline.t,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v),
    };

    // Update current price
    state.currentPrice = candle.close;
    updatePriceDisplay(candle.close);

    // Update active tracked signal
    if (state.activeTrackedSignal) {
        updateTrackedSignal(candle.close);
    }

    // Update Simulation Positions (Real-time PnL)
    if (state.sim && state.sim.positions.length > 0) {
        SimEngine.updatePositions();
    }

    // Store candle data
    if (kline.x) { // Candle is closed
        state.candles.push(candle);
        if (state.candles.length > 100) {
            state.candles.shift(); // Keep only last 100 candles
        }

        // Update progress message
        if (state.candles.length < 20) {
            updateDataCollectionProgress();
        }
    }

    // Update price history
    state.priceHistory.push(candle.close);
    if (state.priceHistory.length > 100) {
        state.priceHistory.shift();
    }

    // Update bot thinking immediately when we have enough data
    if (state.candles.length >= 20) {
        updateBotThinking();
    }
}


// ===== Update Data Collection Progress =====
function updateDataCollectionProgress(customMessage = null) {
    const progress = state.candles.length;
    const needed = 20;
    const percentage = Math.round((progress / needed) * 100);

    const thinkingElement = document.getElementById('currentThinking');
    if (thinkingElement) {
        if (customMessage) {
            thinkingElement.textContent = customMessage;
        } else {
            thinkingElement.textContent = `Collecting market data... ${progress}/${needed} candles (${percentage}%). Please wait ${needed - progress} more candles (~${Math.ceil((needed - progress) * 15 / 60)} minutes).`;
        }
    }

    const opportunityElement = document.getElementById('opportunityStatus');
    if (opportunityElement && !customMessage) {
        opportunityElement.innerHTML = `
            <div class="opportunity-badge waiting">
                <span class="badge-icon">⏳</span>
                <span class="badge-text">Loading market data: ${percentage}% complete</span>
            </div>
        `;
    }

    const actionElement = document.getElementById('nextAction');
    if (actionElement && !customMessage) {
        actionElement.textContent = `Waiting for ${needed - progress} more candles before analysis can begin...`;
        actionElement.className = 'action-text waiting';
    }
}

// ===== Pivot Points Calculation =====
function calculatePivotPoints() {
    if (state.candles.length < 2) return;

    const lastCandle = state.candles[state.candles.length - 1];
    const high = lastCandle.high;
    const low = lastCandle.low;
    const close = lastCandle.close;

    // Standard Pivot Points
    const pivot = (high + low + close) / 3;
    const r1 = (2 * pivot) - low;
    const s1 = (2 * pivot) - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);
    const r3 = high + 2 * (pivot - low);
    const s3 = low - 2 * (high - pivot);

    state.pivotPoints = {
        pivot: pivot.toFixed(2),
        r1: r1.toFixed(2),
        r2: r2.toFixed(2),
        r3: r3.toFixed(2),
        s1: s1.toFixed(2),
        s2: s2.toFixed(2),
        s3: s3.toFixed(2),
    };

    updateAnalysisDisplay();
}

// ===== ICT Methodology Analysis =====
function analyzeICT() {
    if (state.candles.length < 20) return;

    const candles = state.candles.slice(-20);

    // Market Structure Analysis
    const marketStructure = determineMarketStructure(candles);

    // Order Blocks Detection
    const orderBlock = detectOrderBlocks(candles);

    // Fair Value Gaps (FVG)
    const fvg = detectFairValueGaps(candles);

    // Liquidity Zones
    const liquidityZone = detectLiquidityZones(candles);

    state.ictLevels = {
        marketStructure,
        orderBlock,
        fvg,
        liquidityZone,
    };

    updateAnalysisDisplay();
}

// ===== Market Structure Determination =====
function determineMarketStructure(candles) {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const recentHighs = highs.slice(-5);
    const recentLows = lows.slice(-5);

    const isHigherHighs = recentHighs[recentHighs.length - 1] > recentHighs[0];
    const isHigherLows = recentLows[recentLows.length - 1] > recentLows[0];

    if (isHigherHighs && isHigherLows) return 'Bullish';
    if (!isHigherHighs && !isHigherLows) return 'Bearish';
    return 'Ranging';
}

// ===== Order Blocks Detection =====
function detectOrderBlocks(candles) {
    // Simplified order block detection
    const lastCandles = candles.slice(-5);
    let strongestBlock = null;
    let maxVolume = 0;

    lastCandles.forEach(candle => {
        if (candle.volume > maxVolume) {
            maxVolume = candle.volume;
            strongestBlock = candle;
        }
    });

    if (strongestBlock) {
        const isBullish = strongestBlock.close > strongestBlock.open;
        return `${isBullish ? 'Bullish' : 'Bearish'} @ ${strongestBlock.close.toFixed(2)}`;
    }

    return 'None detected';
}

// ===== Fair Value Gaps Detection =====
function detectFairValueGaps(candles) {
    if (candles.length < 3) return 'None';

    const last3 = candles.slice(-3);
    const gap1 = last3[0].low - last3[2].high;
    const gap2 = last3[2].low - last3[0].high;

    if (Math.abs(gap1) > state.currentPrice * 0.001) {
        return `Bullish FVG @ ${((last3[0].low + last3[2].high) / 2).toFixed(2)}`;
    }

    if (Math.abs(gap2) > state.currentPrice * 0.001) {
        return `Bearish FVG @ ${((last3[2].low + last3[0].high) / 2).toFixed(2)}`;
    }

    return 'None';
}

// ===== Liquidity Zones Detection =====
function detectLiquidityZones(candles) {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);

    const currentPrice = state.currentPrice;

    if (currentPrice > maxHigh * 0.99) {
        return `Above @ ${maxHigh.toFixed(2)}`;
    } else if (currentPrice < minLow * 1.01) {
        return `Below @ ${minLow.toFixed(2)}`;
    }

    return 'Mid-range';
}

// ===== Generate Thought Process =====
function generateThoughtProcess(signal) {
    const thoughts = [];

    // Market structure analysis
    thoughts.push(`Market structure is ${state.ictLevels.marketStructure}`);

    // Pivot analysis
    const currentPrice = state.currentPrice;
    const pivot = parseFloat(state.pivotPoints.pivot);

    if (currentPrice > pivot) {
        thoughts.push(`Price trading above pivot point ($${pivot.toFixed(2)})`);
    } else {
        thoughts.push(`Price trading below pivot point ($${pivot.toFixed(2)})`);
    }

    // Signal-specific reasoning
    if (signal.type === 'BUY') {
        thoughts.push('Identified potential long opportunity');
        if (signal.method === 'ICT') {
            thoughts.push('ICT methodology confirms bullish bias');
        }
        thoughts.push(`Risk/Reward ratio: ${calculateRiskReward(signal).toFixed(2)}:1`);
    } else {
        thoughts.push('Identified potential short opportunity');
        if (signal.method === 'ICT') {
            thoughts.push('ICT methodology confirms bearish bias');
        }
        thoughts.push(`Risk/Reward ratio: ${calculateRiskReward(signal).toFixed(2)}:1`);
    }

    return thoughts;
}

// ===== Calculate Risk/Reward =====
function calculateRiskReward(signal) {
    const entry = parseFloat(signal.entry);
    const target = parseFloat(signal.target);
    const stopLoss = parseFloat(signal.stopLoss);

    const reward = Math.abs(target - entry);
    const risk = Math.abs(entry - stopLoss);

    return risk > 0 ? reward / risk : 0;
}


// ===== Signal Generation =====
function generateSignals() {
    if (state.candles.length < 20) return;

    const signals = [];
    const currentPrice = state.currentPrice;
    const pivot = parseFloat(state.pivotPoints.pivot);
    const r1 = parseFloat(state.pivotPoints.r1);
    const s1 = parseFloat(state.pivotPoints.s1);

    // Advanced market indicators
    const fundingBullish = state.fundingRate < -0.01; // Negative funding = bullish
    const fundingBearish = state.fundingRate > 0.01; // Positive funding = bearish
    const oiIncreasing = state.openInterestChange > 2; // OI increasing = strong trend
    const longBias = state.longShortRatio > 1.2; // More longs than shorts
    const shortBias = state.longShortRatio < 0.8; // More shorts than longs
    const whalesBullish = state.largeTradePatterns.recentDirection === 'bullish';
    const whalesBearish = state.largeTradePatterns.recentDirection === 'bearish';

    // Pivot-based signals with enhanced confirmation
    if (currentPrice < pivot && currentPrice > s1) {
        let strength = 75;
        let confirmations = [];

        // Add strength based on confirmations
        if (fundingBullish) {
            strength += 5;
            confirmations.push('Negative funding rate supports longs');
        }
        if (whalesBullish) {
            strength += 5;
            confirmations.push('Whale accumulation detected');
        }
        if (oiIncreasing && longBias) {
            strength += 5;
            confirmations.push('Rising OI with long bias');
        }

        const signal = {
            type: 'BUY',
            reason: 'Price near support S1, bouncing towards pivot' + (confirmations.length > 0 ? ` + ${confirmations.length} confirmations` : ''),
            entry: currentPrice.toFixed(2),
            target: pivot.toFixed(2),
            stopLoss: s1.toFixed(2),
            strength: Math.min(strength, 95),
            method: 'Pivot Points + Market Data',
            confirmations: confirmations,
        };
        signal.thoughts = generateThoughtProcess(signal);
        signals.push(signal);
    }

    if (currentPrice > pivot && currentPrice < r1) {
        let strength = 70;
        let confirmations = [];

        if (fundingBearish) {
            strength += 5;
            confirmations.push('Positive funding rate supports shorts');
        }
        if (whalesBearish) {
            strength += 5;
            confirmations.push('Whale distribution detected');
        }
        if (oiIncreasing && shortBias) {
            strength += 5;
            confirmations.push('Rising OI with short bias');
        }

        const signal = {
            type: 'SELL',
            reason: 'Price near resistance R1, potential reversal' + (confirmations.length > 0 ? ` + ${confirmations.length} confirmations` : ''),
            entry: currentPrice.toFixed(2),
            target: pivot.toFixed(2),
            stopLoss: r1.toFixed(2),
            strength: Math.min(strength, 95),
            method: 'Pivot Points + Market Data',
            confirmations: confirmations,
        };
        signal.thoughts = generateThoughtProcess(signal);
        signals.push(signal);
    }

    // ICT-based signals with whale confirmation
    if (state.ictLevels.marketStructure === 'Bullish' && state.ictLevels.fvg.includes('Bullish')) {
        let strength = 85;
        let confirmations = [];

        if (whalesBullish) {
            strength += 5;
            confirmations.push(`${state.largeTradePatterns.bullishWhales} whale buy orders`);
        }
        if (fundingBullish) {
            strength += 3;
            confirmations.push('Funding rate favors longs');
        }
        if (longBias) {
            strength += 2;
            confirmations.push('Long/short ratio bullish');
        }

        const signal = {
            type: 'BUY',
            reason: 'Bullish market structure with FVG support' + (confirmations.length > 0 ? ` + ${confirmations.length} confirmations` : ''),
            entry: currentPrice.toFixed(2),
            target: r1.toFixed(2),
            stopLoss: (currentPrice * 0.98).toFixed(2),
            strength: Math.min(strength, 98),
            method: 'ICT + Whale Analysis',
            confirmations: confirmations,
        };
        signal.thoughts = generateThoughtProcess(signal);
        signals.push(signal);
    }

    if (state.ictLevels.marketStructure === 'Bearish' && state.ictLevels.fvg.includes('Bearish')) {
        let strength = 80;
        let confirmations = [];

        if (whalesBearish) {
            strength += 5;
            confirmations.push(`${state.largeTradePatterns.bearishWhales} whale sell orders`);
        }
        if (fundingBearish) {
            strength += 3;
            confirmations.push('Funding rate favors shorts');
        }
        if (shortBias) {
            strength += 2;
            confirmations.push('Long/short ratio bearish');
        }

        const signal = {
            type: 'SELL',
            reason: 'Bearish market structure with FVG resistance' + (confirmations.length > 0 ? ` + ${confirmations.length} confirmations` : ''),
            entry: currentPrice.toFixed(2),
            target: s1.toFixed(2),
            stopLoss: (currentPrice * 1.02).toFixed(2),
            strength: Math.min(strength, 98),
            method: 'ICT + Whale Analysis',
            confirmations: confirmations,
        };
        signal.thoughts = generateThoughtProcess(signal);
        signals.push(signal);
    }

    // Update signals
    state.signals = signals;
    displaySignals();

    // Auto-track the strongest signal if no active tracking
    if (signals.length > 0) {
        const strongestSignal = signals.reduce((prev, current) =>
            (prev.strength > current.strength) ? prev : current
        );

        if (!state.activeTrackedSignal) {
            trackSignal(strongestSignal);
        }

        // AUTO-TRADE IMPLEMENTATION
        if (state.sim.autoTrade && strongestSignal.strength > 80) {
            // Check if we already have this position
            const alreadyInTrade = state.sim.positions.some(p => p.type === (strongestSignal.type === 'BUY' ? 'LONG' : 'SHORT'));

            if (!alreadyInTrade) {
                const type = strongestSignal.type === 'BUY' ? 'LONG' : 'SHORT';
                SimEngine.openPosition(type, strongestSignal.entry, strongestSignal.stopLoss, strongestSignal.target);

                // Notification
                const notif = document.createElement('div');
                notif.className = 'trade-notification';
                notif.innerHTML = `🚀 Auto-Executed ${type} Trade based on ${strongestSignal.strength}% signal`;
                document.body.appendChild(notif);
                setTimeout(() => notif.remove(), 5000);
            }
        }
    }
}

// ===== Track Signal =====
function trackSignal(signal) {
    state.activeTrackedSignal = {
        ...signal,
        id: Date.now(),
        startTime: new Date(),
        startPrice: state.currentPrice,
        currentPrice: state.currentPrice,
        status: 'active',
        updates: [],
    };

    state.trackedSignalUpdates = [];
    state.performance.totalSignals++;
    state.performance.activeSignals++;

    addSignalUpdate('Signal activated and tracking started');
    displayTrackedSignal();
    updatePerformanceStats();
}

// ===== Update Tracked Signal =====
function updateTrackedSignal(currentPrice) {
    if (!state.activeTrackedSignal) return;

    const signal = state.activeTrackedSignal;
    signal.currentPrice = currentPrice;

    const entry = parseFloat(signal.entry);
    const target = parseFloat(signal.target);
    const stopLoss = parseFloat(signal.stopLoss);

    // Check if target hit
    if (signal.type === 'BUY' && currentPrice >= target) {
        completeSignal('won', currentPrice);
        return;
    }

    if (signal.type === 'SELL' && currentPrice <= target) {
        completeSignal('won', currentPrice);
        return;
    }

    // Check if stop loss hit
    if (signal.type === 'BUY' && currentPrice <= stopLoss) {
        completeSignal('lost', currentPrice);
        return;
    }

    if (signal.type === 'SELL' && currentPrice >= stopLoss) {
        completeSignal('lost', currentPrice);
        return;
    }

    // Add periodic updates
    const profitPercent = ((currentPrice - entry) / entry * 100) * (signal.type === 'BUY' ? 1 : -1);

    if (Math.abs(profitPercent) > 0.5 && state.trackedSignalUpdates.length < 10) {
        const lastUpdate = state.trackedSignalUpdates[state.trackedSignalUpdates.length - 1];
        if (!lastUpdate || Math.abs(profitPercent - parseFloat(lastUpdate.profit)) > 0.3) {
            addSignalUpdate(`Price moved ${profitPercent > 0 ? 'favorably' : 'unfavorably'} by ${Math.abs(profitPercent).toFixed(2)}%`);
        }
    }

    displayTrackedSignal();
}

// ===== Complete Signal =====
function completeSignal(result, exitPrice) {
    if (!state.activeTrackedSignal) return;

    const signal = state.activeTrackedSignal;
    signal.status = result;
    signal.exitPrice = exitPrice;
    signal.endTime = new Date();

    const entry = parseFloat(signal.entry);
    const profitPercent = ((exitPrice - entry) / entry * 100) * (signal.type === 'BUY' ? 1 : -1);

    // Update performance stats
    state.performance.activeSignals--;

    if (result === 'won') {
        state.performance.wins++;
        state.performance.profits.push(profitPercent);
        addSignalUpdate(`✅ Target reached! Profit: +${profitPercent.toFixed(2)}%`);

        if (profitPercent > state.performance.bestTrade) {
            state.performance.bestTrade = profitPercent;
        }
    } else {
        state.performance.losses++;
        state.performance.profits.push(profitPercent);
        addSignalUpdate(`❌ Stop loss hit. Loss: ${profitPercent.toFixed(2)}%`);
    }

    displayTrackedSignal();
    updatePerformanceStats();

    // Clear tracked signal after 10 seconds
    setTimeout(() => {
        state.activeTrackedSignal = null;
        state.trackedSignalUpdates = [];
        displayTrackedSignal();
    }, 10000);
}

// ===== Add Signal Update =====
function addSignalUpdate(message) {
    state.trackedSignalUpdates.push({
        time: new Date().toLocaleTimeString(),
        message: message,
    });
}

// ===== Display Functions =====
function updatePriceDisplay(price) {
    const priceElement = document.getElementById('currentPrice');
    const changeElement = document.getElementById('priceChange');

    if (priceElement) {
        priceElement.textContent = `$${price.toFixed(2)}`;
    }

    if (changeElement && state.priceHistory.length > 1) {
        const oldPrice = state.priceHistory[0];
        const change = ((price - oldPrice) / oldPrice) * 100;
        changeElement.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        changeElement.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
    }
}

function updateConnectionStatus(status, isConnected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

function updateAnalysisDisplay() {
    // Update pivot points
    document.getElementById('pivotPoint').textContent = `$${state.pivotPoints.pivot || '--'}`;
    document.getElementById('r1').textContent = `$${state.pivotPoints.r1 || '--'}`;
    document.getElementById('s1').textContent = `$${state.pivotPoints.s1 || '--'}`;

    // Update ICT analysis
    document.getElementById('marketStructure').textContent = state.ictLevels.marketStructure || '--';
    document.getElementById('orderBlock').textContent = state.ictLevels.orderBlock || '--';
    document.getElementById('fvg').textContent = state.ictLevels.fvg || '--';
    document.getElementById('liquidityZone').textContent = state.ictLevels.liquidityZone || '--';

    // Update trend
    const trend = state.ictLevels.marketStructure;
    const trendElement = document.getElementById('trend');
    if (trendElement) {
        trendElement.textContent = trend || '--';
        trendElement.style.color = trend === 'Bullish' ? 'var(--accent-green)' :
            trend === 'Bearish' ? 'var(--accent-red)' :
                'var(--text-secondary)';
    }
}

function displaySignals() {
    const signalsList = document.getElementById('signalsList');

    if (state.signals.length === 0) {
        signalsList.innerHTML = `
            <div class="signal-placeholder">
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                    <circle cx="30" cy="30" r="25" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
                    <path d="M30 15V45M15 30H45" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
                </svg>
                <p>No signals at the moment</p>
            </div>
        `;
        updateSignalStrength(0);
        return;
    }

    // Calculate average strength
    const avgStrength = state.signals.reduce((sum, s) => sum + s.strength, 0) / state.signals.length;
    updateSignalStrength(avgStrength);

    signalsList.innerHTML = state.signals.map(signal => `
        <div class="signal-item ${signal.type.toLowerCase()}">
            <div class="signal-header">
                <span class="signal-type ${signal.type.toLowerCase()}">${signal.type} SIGNAL</span>
                <span class="signal-time">${new Date().toLocaleTimeString()}</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0.5rem 0;">
                ${signal.reason}
            </p>
            <div class="signal-details">
                <div class="signal-detail">
                    <span class="label">Entry:</span>
                    <span class="value">$${signal.entry}</span>
                </div>
                <div class="signal-detail">
                    <span class="label">Target:</span>
                    <span class="value">$${signal.target}</span>
                </div>
                <div class="signal-detail">
                    <span class="label">Stop Loss:</span>
                    <span class="value">$${signal.stopLoss}</span>
                </div>
                <div class="signal-detail">
                    <span class="label">Method:</span>
                    <span class="value">${signal.method}</span>
                </div>
            </div>
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">Signal Strength</span>
                    <span style="font-weight: 600; color: var(--accent-cyan);">${signal.strength}%</span>
                </div>
            </div>
        </div>
    `).join('');
}

function displayTrackedSignal() {
    const trackerContainer = document.getElementById('activeTracker');

    if (!state.activeTrackedSignal) {
        trackerContainer.innerHTML = `
            <div class="tracker-placeholder">
                <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                    <circle cx="25" cy="25" r="20" stroke="rgba(0,245,255,0.2)" stroke-width="2"/>
                    <path d="M25 15L28 22L35 23L30 28L31 35L25 31L19 35L20 28L15 23L22 22L25 15Z" fill="rgba(0,245,255,0.1)" stroke="rgba(0,245,255,0.3)" stroke-width="1"/>
                </svg>
                <p>No active signal being tracked</p>
                <small>Signals will be tracked automatically when generated</small>
            </div>
        `;
        return;
    }

    const signal = state.activeTrackedSignal;
    const entry = parseFloat(signal.entry);
    const target = parseFloat(signal.target);
    const stopLoss = parseFloat(signal.stopLoss);
    const currentPrice = signal.currentPrice;

    const profitPercent = ((currentPrice - entry) / entry * 100) * (signal.type === 'BUY' ? 1 : -1);
    const progressPercent = Math.abs((currentPrice - entry) / (target - entry) * 100);

    const statusClass = signal.status === 'won' ? 'success' : signal.status === 'lost' ? 'failed' : 'active';

    trackerContainer.innerHTML = `
        <div class="tracked-signal ${statusClass}">
            <div class="tracker-header">
                <span class="tracker-title ${signal.type.toLowerCase()}">${signal.type} Signal</span>
                <span class="tracker-status-badge ${signal.status}">${signal.status.toUpperCase()}</span>
            </div>
            
            <div class="thought-process">
                <div class="thought-header">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1C4.13 1 1 4.13 1 8s3.13 7 7 7c.39 0 .77-.04 1.13-.1.36.59.94 1.03 1.63 1.18.69.15 1.42-.02 1.97-.47.55-.45.87-1.12.87-1.83 0-.71-.32-1.38-.87-1.83-.55-.45-1.28-.62-1.97-.47-.69.15-1.27.59-1.63 1.18-.36-.06-.74-.1-1.13-.1-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6v.5" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                    Bot's Thought Process
                </div>
                <div class="thought-content">
                    <ul class="thought-list">
                        ${signal.thoughts.map(thought => `<li>${thought}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="tracker-progress">
                <div class="progress-label">
                    <span>Progress to Target</span>
                    <span style="font-weight: 600; color: ${profitPercent >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
                        ${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%
                    </span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${profitPercent >= 0 ? 'profit' : 'loss'}" 
                         style="width: ${Math.min(Math.abs(progressPercent), 100)}%"></div>
                </div>
            </div>
            
            <div class="tracker-metrics">
                <div class="tracker-metric">
                    <div class="label">Entry</div>
                    <div class="value">$${signal.entry}</div>
                </div>
                <div class="tracker-metric">
                    <div class="label">Current</div>
                    <div class="value" style="color: ${profitPercent >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
                        $${currentPrice.toFixed(2)}
                    </div>
                </div>
                <div class="tracker-metric">
                    <div class="label">Target</div>
                    <div class="value">$${signal.target}</div>
                </div>
            </div>
            
            ${state.trackedSignalUpdates.length > 0 ? `
                <div class="update-log">
                    ${state.trackedSignalUpdates.slice(-5).reverse().map(update => `
                        <div class="update-item">
                            <span class="update-time">${update.time}</span>
                            <span>${update.message}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function updatePerformanceStats() {
    const totalSignals = state.performance.totalSignals;
    const wins = state.performance.wins;
    const losses = state.performance.losses;
    const successRate = totalSignals > 0 ? (wins / totalSignals * 100) : 0;

    const avgProfit = state.performance.profits.length > 0
        ? state.performance.profits.reduce((a, b) => a + b, 0) / state.performance.profits.length
        : 0;

    document.getElementById('successRate').textContent = `${successRate.toFixed(1)}%`;
    document.getElementById('winCount').textContent = wins;
    document.getElementById('lossCount').textContent = losses;
    document.getElementById('totalSignals').textContent = totalSignals;
    document.getElementById('activeSignals').textContent = state.performance.activeSignals;
    document.getElementById('avgProfit').textContent = `${avgProfit >= 0 ? '+' : ''}${avgProfit.toFixed(2)}%`;
    document.getElementById('bestTrade').textContent = `+${state.performance.bestTrade.toFixed(2)}%`;
}

function updateSignalStrength(strength) {
    const strengthFill = document.getElementById('strengthIndicator');
    const strengthValue = document.getElementById('strengthValue');

    if (strengthFill) {
        strengthFill.style.width = `${strength}%`;
    }

    if (strengthValue) {
        strengthValue.textContent = `${Math.round(strength)}%`;
    }
}

// ===== API Management =====
function handleApiSubmit(event) {
    event.preventDefault();

    const apiKey = document.getElementById('apiKey').value;
    const apiSecret = document.getElementById('apiSecret').value;

    if (!apiKey || !apiSecret) {
        alert('Please enter both Testnet API Key and Secret');
        return;
    }

    SimEngine.connectApi(apiKey, apiSecret);
}

function handleApiDisconnect() {
    state.apiKey = null;
    state.apiSecret = null;
    state.sim.useApi = false;

    // UI Reset
    document.getElementById('toggleApiFormBtn').textContent = '🔌 Connect Binance Testnet API';
    document.getElementById('toggleApiFormBtn').classList.remove('success');
    document.getElementById('apiForm').classList.add('hidden');
    document.getElementById('disconnectBtn').disabled = true;

    alert('Disconnected from Testnet. Returning to Local Simulation Mode.');

    // Reset Balance to default if desired
    state.sim.balance = 10000;
    state.sim.equity = 10000;
    state.sim.positions = [];
    SimEngine.updateUI();
}

// Toggle API Form
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleApiFormBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('apiForm').classList.toggle('hidden');
        });
    }
});

function resetPerformanceStats() {
    if (confirm('Are you sure you want to reset all performance statistics?')) {
        state.performance = {
            totalSignals: 0,
            activeSignals: 0,
            wins: 0,
            losses: 0,
            profits: [],
            bestTrade: 0,
        };
        updatePerformanceStats();
    }
}

// ===== Update Bot Thinking Display =====
function updateBotThinking() {
    if (state.candles.length < 20) {
        document.getElementById('currentThinking').textContent = 'Collecting market data... Need at least 20 candles for analysis.';
        return;
    }

    const currentPrice = state.currentPrice;
    const pivot = parseFloat(state.pivotPoints.pivot);
    const r1 = parseFloat(state.pivotPoints.r1);
    const s1 = parseFloat(state.pivotPoints.s1);
    const marketStructure = state.ictLevels.marketStructure;
    const fvg = state.ictLevels.fvg;

    // Current Market Assessment
    let assessment = `Analyzing BTCUSDT at $${currentPrice.toFixed(2)}. `;

    if (currentPrice > pivot) {
        assessment += `Price is trading ${((currentPrice - pivot) / pivot * 100).toFixed(2)}% above pivot point ($${pivot.toFixed(2)}), indicating bullish momentum. `;
    } else {
        assessment += `Price is trading ${((pivot - currentPrice) / pivot * 100).toFixed(2)}% below pivot point ($${pivot.toFixed(2)}), indicating bearish pressure. `;
    }

    assessment += `Market structure shows ${marketStructure} trend. `;

    if (fvg !== 'None') {
        assessment += `Detected ${fvg}.`;
    }

    document.getElementById('currentThinking').textContent = assessment;

    // Trade Opportunity Status
    updateOpportunityStatus();

    // Decision Factors
    updateDecisionFactors();

    // Next Action
    updateNextAction();
}

function updateOpportunityStatus() {
    const opportunityContainer = document.getElementById('opportunityStatus');

    if (state.signals.length === 0) {
        opportunityContainer.innerHTML = `
            <div class="opportunity-badge waiting">
                <span class="badge-icon">⏳</span>
                <span class="badge-text">Scanning for opportunities...</span>
            </div>
        `;
        return;
    }

    // Check if we have high-strength signals
    const highStrengthSignals = state.signals.filter(s => s.strength >= 75);

    if (highStrengthSignals.length > 0) {
        const strongest = highStrengthSignals.reduce((prev, current) =>
            (prev.strength > current.strength) ? prev : current
        );

        opportunityContainer.innerHTML = `
            <div class="opportunity-badge ready">
                <span class="badge-icon">🎯</span>
                <span class="badge-text">High-probability ${strongest.type} opportunity detected! (${strongest.strength}% confidence)</span>
            </div>
        `;
    } else if (state.signals.length > 0) {
        opportunityContainer.innerHTML = `
            <div class="opportunity-badge evaluating">
                <span class="badge-icon">🔍</span>
                <span class="badge-text">Evaluating ${state.signals.length} potential ${state.signals[0].type} setup(s)...</span>
            </div>
        `;
    } else {
        opportunityContainer.innerHTML = `
            <div class="opportunity-badge found">
                <span class="badge-icon">✓</span>
                <span class="badge-text">Opportunity found - analyzing confirmation...</span>
            </div>
        `;
    }
}

function updateDecisionFactors() {
    const factorsContainer = document.getElementById('decisionFactors');
    const factors = [];

    const currentPrice = state.currentPrice;
    const pivot = parseFloat(state.pivotPoints.pivot);
    const r1 = parseFloat(state.pivotPoints.r1);
    const s1 = parseFloat(state.pivotPoints.s1);
    const marketStructure = state.ictLevels.marketStructure;
    const fvg = state.ictLevels.fvg;

    // Market Structure Factor
    if (marketStructure === 'Bullish') {
        factors.push({
            type: 'positive',
            icon: '✓',
            text: 'Bullish market structure - higher highs and higher lows'
        });
    } else if (marketStructure === 'Bearish') {
        factors.push({
            type: 'negative',
            icon: '✗',
            text: 'Bearish market structure - lower highs and lower lows'
        });
    } else {
        factors.push({
            type: 'neutral',
            icon: '○',
            text: 'Ranging market - no clear directional bias'
        });
    }

    // Pivot Point Factor
    if (currentPrice > pivot) {
        const distanceToR1 = ((r1 - currentPrice) / currentPrice * 100);
        if (distanceToR1 < 0.5) {
            factors.push({
                type: 'negative',
                icon: '⚠',
                text: `Price near resistance R1 ($${r1.toFixed(2)}) - potential reversal zone`
            });
        } else {
            factors.push({
                type: 'positive',
                icon: '✓',
                text: `Price above pivot with room to R1 ($${r1.toFixed(2)})`
            });
        }
    } else {
        const distanceToS1 = ((currentPrice - s1) / currentPrice * 100);
        if (distanceToS1 < 0.5) {
            factors.push({
                type: 'positive',
                icon: '✓',
                text: `Price near support S1 ($${s1.toFixed(2)}) - potential bounce zone`
            });
        } else {
            factors.push({
                type: 'negative',
                icon: '✗',
                text: `Price below pivot with room to S1 ($${s1.toFixed(2)})`
            });
        }
    }

    // FVG Factor
    if (fvg.includes('Bullish')) {
        factors.push({
            type: 'positive',
            icon: '✓',
            text: 'Bullish Fair Value Gap detected - potential support'
        });
    } else if (fvg.includes('Bearish')) {
        factors.push({
            type: 'negative',
            icon: '✗',
            text: 'Bearish Fair Value Gap detected - potential resistance'
        });
    }

    // Signal Strength Factor
    if (state.signals.length > 0) {
        const avgStrength = state.signals.reduce((sum, s) => sum + s.strength, 0) / state.signals.length;
        if (avgStrength >= 80) {
            factors.push({
                type: 'positive',
                icon: '✓',
                text: `Very strong signal confidence (${avgStrength.toFixed(0)}%)`
            });
        } else if (avgStrength >= 70) {
            factors.push({
                type: 'neutral',
                icon: '○',
                text: `Moderate signal confidence (${avgStrength.toFixed(0)}%)`
            });
        }
    }

    // Render factors
    factorsContainer.innerHTML = factors.map(factor => `
        <div class="factor-item ${factor.type}">
            <span class="factor-icon">${factor.icon}</span>
            <span class="factor-text">${factor.text}</span>
        </div>
    `).join('');
}

function updateNextAction() {
    const actionElement = document.getElementById('nextAction');

    if (state.signals.length === 0) {
        actionElement.textContent = 'Monitoring market conditions for entry opportunities...';
        actionElement.className = 'action-text waiting';
        return;
    }

    const highStrengthSignals = state.signals.filter(s => s.strength >= 75);

    if (highStrengthSignals.length > 0) {
        const strongest = highStrengthSignals[0];
        actionElement.textContent = `Ready to execute ${strongest.type} trade at $${strongest.entry} | Target: $${strongest.target} | Stop: $${strongest.stopLoss}`;
        actionElement.className = 'action-text ready-to-trade';
    } else if (state.signals.length > 0) {
        actionElement.textContent = 'Waiting for stronger confirmation before entering trade...';
        actionElement.className = 'action-text preparing';
    } else {
        actionElement.textContent = 'Analyzing current setup for potential entry...';
        actionElement.className = 'action-text preparing';
    }
}

// ===== Analysis Loop =====
function startAnalysisLoop() {
    setInterval(() => {
        if (state.candles.length >= 20) {
            calculatePivotPoints();
            analyzeICT();
            analyzeWhalePatterns();
            generateSignals();
            updateBotThinking(); // Update bot thinking display
        }
    }, CONFIG.updateInterval);

    // Refresh market data every 30 seconds
    setInterval(async () => {
        if (state.dataLoaded) {
            await fetchFundingRate();
            await fetchOpenInterest();
            await fetchLongShortRatio();
            await fetchRecentTrades();
            analyzeWhalePatterns();
        }
    }, 30000);
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize TradingView chart
    initTradingViewChart();

    // Fetch historical data FIRST (instant analysis!)
    await fetchHistoricalData();

    // Connect to Binance WebSocket for live updates
    connectWebSocket();

    // Start analysis loop
    startAnalysisLoop();

    // Start analysis loop
    startAnalysisLoop();

    // Trading Controls - Leverage
    const levInput = document.getElementById('leverageInput');
    levInput.addEventListener('input', (e) => {
        state.sim.leverage = parseInt(e.target.value);
        document.getElementById('leverageValue').textContent = `${state.sim.leverage}x`;
    });

    // Trading Controls - Size
    const sizeInput = document.getElementById('sizeInput');
    sizeInput.addEventListener('input', (e) => {
        state.sim.tradeSizePercent = parseInt(e.target.value);
        document.getElementById('sizeValue').textContent = `${state.sim.tradeSizePercent}%`;
    });

    // Trading Controls - Auto Trade
    document.getElementById('autoTradeToggle').addEventListener('change', (e) => {
        state.sim.autoTrade = e.target.checked;
    });

    // Manual Trade Buttons
    document.getElementById('buyBtn').addEventListener('click', () => {
        const sl = state.currentPrice * 0.98; // Default 2% SL
        const tp = state.currentPrice * 1.04; // Default 4% TP
        SimEngine.openPosition('LONG', state.currentPrice, sl, tp);
    });

    document.getElementById('sellBtn').addEventListener('click', () => {
        const sl = state.currentPrice * 1.02; // Default 2% SL
        const tp = state.currentPrice * 0.96; // Default 4% TP
        SimEngine.openPosition('SHORT', state.currentPrice, sl, tp);
    });

    // Clear History
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        state.sim.orders = [];
        SimEngine.updateUI();
    });

    // Reset stats button
    document.getElementById('resetStats').addEventListener('click', resetPerformanceStats);

    // Initialize displays
    updatePerformanceStats();
    SimEngine.updateUI(); // Init Sim UI
});

// ===== Cleanup on page unload =====
window.addEventListener('beforeunload', () => {
    if (state.websocket) {
        state.websocket.close();
    }
});
