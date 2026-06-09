const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

// Database Schemas
const UserSchema = new mongoose.Schema({
    username: String,
    coins: { type: Number, default: 0 },
    diamonds: { type: Number, default: 0 },
    role: { type: String, enum: ['host', 'user', 'agency_owner'], default: 'user' },
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null },
    wallet: {
        easypaisa_number: String,
        jazzcash_number: String,
        balance_usd: { type: Number, default: 0 }
    }
});
const User = mongoose.model('User', UserSchema);

const AgencySchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agency_name: String,
    total_hosts: { type: Number, default: 0 }
});
const Agency = mongoose.model('Agency', AgencySchema);

// 1. Buy Coins ($1 = 100k Coins)
app.post('/buy-coins', async (req, res) => {
    try {
        const { userId, dollarsSpent } = req.body;
        const coinsAmount = dollarsSpent * 100000;
        await User.findByIdAndUpdate(userId, { $inc: { coins: coinsAmount } });
        res.json({ success: true, message: `${coinsAmount} coins added.` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Convert Diamonds to Dollars (5k Diamonds = $3)
app.post('/convert-diamonds', async (req, res) => {
    try {
        const { hostId, diamondsToConvert } = req.body;
        if (diamondsToConvert < 5000) return res.status(400).json({ error: "Minimum 5000 diamonds required." });
        const dollarsEarned = (diamondsToConvert / 5000) * 3;
        await User.findByIdAndUpdate(hostId, { $inc: { diamonds: -diamondsToConvert, "wallet.balance_usd": dollarsEarned } });
        res.json({ success: true, earnings_usd: dollarsEarned });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Host Withdrawal & Agency Commission ($1 to Owner)
app.post('/withdraw', async (req, res) => {
    try {
        const { hostId, amountToWithdraw, paymentMethod } = req.body;
        const host = await User.findById(hostId).populate('agencyId');
        if (!host.agencyId) return res.status(400).json({ error: "Agency join karna lazmi hai!" });
        if (host.wallet.balance_usd < (amountToWithdraw + 1)) return res.status(400).json({ error: "In-sufficient balance." });

        await User.findByIdAndUpdate(hostId, { $inc: { "wallet.balance_usd": -(amountToWithdraw + 1) } });
        await User.findByIdAndUpdate(host.agencyId.ownerId, { $inc: { "wallet.balance_usd": 1 } });
        res.json({ success: true, message: "Withdrawal success. Agency owner
