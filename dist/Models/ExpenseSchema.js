"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require('mongoose');
const { Schema } = mongoose;
const CategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    // store color as HEX (e.g. '#ff9900'); validate simple HEX formats
    color: {
        type: String,
        default: '#CCCCCC',
        match: [/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/,
            'Invalid HEX color']
    },
    emoji: {
        type: String,
        default: '✨'
    }
}, { _id: false });
const ExpenseSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // money: prefer integer cents to avoid float problems
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        length: 3
    },
    category: {
        type: CategorySchema,
        required: true
    },
    payment_mode: {
        type: String,
        enum: ['cash', 'card', 'bank_transfer', 'wallet', 'UPI'],
        required: true,
    },
    notes: {
        type: String,
        trim: true
    },
    occurredAt: {
        type: Date,
        default: Date.now
    },
    // soft-delete flag
    deleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
/* Indexes for typical queries */
ExpenseSchema.index({ userId: 1, occurredAt: -1 });
ExpenseSchema.index({ 'category.name': 1 });
ExpenseSchema.index({ payment_mode: 1 });
exports.default = mongoose.model('Expense', ExpenseSchema);
