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
    phone: {
        type: String,
        unique: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
        // default: null 
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
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
      
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist",
       
    }],
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
      status: {
        type: String,
        enum: ['Completed', 'Pending'],
        default: 'Completed',
      },
    },
  ],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order",
       
    }],
    createdOn: {
        type: Date,
        default: Date.now
    },
   
    redeemed: {
        type: Boolean,
       
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category"
        },
       
        searchOn: {
            type: Date,
            default: Date.now
        }
    }]
},{ timestamps: true });

const User = mongoose.model("User", userSchema);
module.exports = User;