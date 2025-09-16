const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
 
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        required: false,
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },

    wallet: {
        type: Number,
        default: 0,
    },
    walletHistory: [
        {
            transactionId: String,
            date: {
                type: Date,
                default: Date.now,
            },
            type: {
                type: String,
                enum: ['credit', 'debit'],
                required: true,
            },
            amount: {
                type: Number,
                required: true,
            },
            productId: {
                type: Schema.Types.ObjectId,
                ref: 'Product',
            },
            description: {
                type: String,
                default: null,
            },
        },
    ],

    createdOn: {
        type: Date,
        default: Date.now
    },
    redeemed: {
        type: Boolean,
    },

}, { timestamps: true });

const User = mongoose.model("User", userSchema);
module.exports = User;