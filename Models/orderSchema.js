const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
       required: true,
       unique: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        cancelStatus: {
            type: String,
            enum: ['Pending', 'Completed', 'Cancelled'],
            default: 'Completed'
        },
        returnStatus: {
            type: String,
            enum: ['Not Requested', 'Requested', 'Approved', 'Rejected'],
            default: 'Not Requested'
        },
        returnReason: { type: String },
        returnRequestedAt: { type: Date }
    }],
    subTotal: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },originalSubTotal: {
        type: Number,
        required: true,
        default: 0 
    },
    originalFinalAmount: {
        type: Number,
        required: true,
        default: 0 
    },
  
   address: { type: Schema.Types.ObjectId, ref: 'Address' }, 
  selectedAddressId: { type: Schema.Types.ObjectId }, 
    invoiceDate: {
        type: Date
    },
    deliveryDate: {
        type: Date
    },
    status: {
      type: String,
      required: true,
      enum: [
        'Pending',
        'Payment Pending',
        'Processing',
        'Shipped',
        'Delivered',
        'Cancelled',
        'Return Requested',
        'Returned',
      ],
      
    },
    createOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['cod', 'razorpay', 'wallet']
    }
});

const Order = mongoose.model("Orders", orderSchema);

module.exports = Order;