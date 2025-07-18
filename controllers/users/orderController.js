const Order=require('../../Models/orderSchema');
const Product=require('../../Models/productSchema')
const User = require('../../Models/userSchema')
const STATUS_CODES= require("../../Models/status")

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemId } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login first' });
        }

        const order = await Order.findOne({ orderId, userId }).populate('items.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Pending' && order.status !== 'Processing') {
            return res.status(400).json({ success: false, message: 'Cannot cancel this order now' });
        }

        // Ensure original values are preserved
        if (!order.originalSubTotal) {
            order.originalSubTotal = order.subTotal;
        }
        if (!order.originalFinalAmount) {
            order.originalFinalAmount = order.finalAmount;
        }

        let refundAmount = 0;
        let cancelledItems = [];

        const discountFactor = order.originalSubTotal > 0 ? (order.originalFinalAmount / order.originalSubTotal) : 1;

        if (itemId) {
            const item = order.items.find(i => i.productId._id.toString() === itemId);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found in order' });
            }

            if (item.cancelStatus === 'Cancelled') {
                return res.status(400).json({ success: false, message: 'Item already cancelled' });
            }

            if (item.returnStatus !== 'Not Requested') {
                return res.status(400).json({ success: false, message: 'Cannot cancel item with an active return request' });
            }

            item.cancelStatus = 'Cancelled';

            const itemTotal = item.price * item.quantity;
            const discountedItemTotal = itemTotal * discountFactor;
            refundAmount = discountedItemTotal;

            cancelledItems.push({
                itemId,
                name: item.productId.productName,
                quantity: item.quantity,
                refundAmount: discountedItemTotal
            });

            await Product.findByIdAndUpdate(itemId, {
                $inc: { quantity: item.quantity }
            });

            const allCancelled = order.items.every(i => i.cancelStatus === 'Cancelled');
            if (allCancelled) {
                order.status = 'Cancelled';
            }
        } else {
            order.status = 'Cancelled';
            for (let item of order.items) {
                if (item.cancelStatus !== 'Cancelled' && item.returnStatus === 'Not Requested') {
                    item.cancelStatus = 'Cancelled';

                    const itemTotal = item.price * item.quantity;
                    const discountedItemTotal = itemTotal * discountFactor;
                    refundAmount += discountedItemTotal;

                    cancelledItems.push({
                        itemId: item.productId._id.toString(),
                        name: item.productId.productName,
                        quantity: item.quantity,
                        refundAmount: discountedItemTotal
                    });

                    await Product.findByIdAndUpdate(item.productId._id, {
                        $inc: { quantity: item.quantity }
                    });
                }
            }
        }

        // Recalculate subTotal and finalAmount
        order.subTotal = order.items
            .filter(i => i.cancelStatus !== 'Cancelled')
            .reduce((sum, i) => sum + (i.price * i.quantity), 0);
        order.finalAmount = order.subTotal * discountFactor;

        await order.save();

        if (order.paymentMethod !== 'cod' && refundAmount > 0) {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            user.wallet = (user.wallet || 0) + refundAmount;

            cancelledItems.forEach(item => {
                user.walletHistory.push({
                    transactionId: `TXN${Date.now()}-${item.itemId}`,
                    type: 'credit',
                    amount: item.refundAmount,
                    date: new Date(),
                    productId: item.itemId,
                    productName: item.name
                });
            });

            await user.save();
        }

        res.json({
            success: true,
            message: itemId ? 'Item cancelled successfully' : 'Order cancelled successfully',
            updatedOrder: {
                subTotal: order.subTotal,
                originalSubTotal: order.originalSubTotal,
                discount: order.discount,
                finalAmount: order.finalAmount,
                originalFinalAmount: order.originalFinalAmount,
                status: order.status,
                cancelledItems
            }
        });
    } catch (err) {
        console.error('Error cancelling order:', err.message);
        res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};

const returnOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemId, reason } = req.body;

       

        if (!reason || reason.trim().length < 10) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                success: false,
                message: 'Return reason is required and must be at least 10 characters long.'
            });
        }

        const order = await Order.findOne({ orderId }); 
        if (!order) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Order not found' });
        }

    
        if (order.status.toLowerCase() !== 'delivered') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                success: false,
                message: 'Return not allowed. Order is not delivered yet.'
            });
        }

        if (itemId) {
            const item = order.items.find(item => item.productId && item.productId._id?.toString() === itemId);
            if (!item) {
                return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Item not found in order' });
            }

            if (item.returnStatus !== 'Not Requested') {
                return res.status(STATUS_CODES.BAD_REQUEST).json({
                    success: false,
                    message: 'Return request for this item has already been submitted.'
                });
            }

            item.returnStatus = 'Requested';
            item.returnReason = reason.trim();
            item.returnRequestedAt = new Date();
        } else {
            
            const hasReturnableItems = order.items.some(
                item => item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Rejected'
            );
            if (!hasReturnableItems) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({
                    success: false,
                    message: 'No items are eligible for return in this order.'
                });
            }

       
            order.items.forEach(item => {
                if (item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Rejected') {
                    item.returnStatus = 'Requested';
                    item.returnReason = reason.trim();
                    item.returnRequestedAt = new Date();
                }
            });
        }
        if (order.items.some(item => item.returnStatus === 'Requested') && !order.status.includes('Return')) {
            order.status = 'Return Requested'; 
        }

        await order.save();
    

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: 'Return request submitted successfully'
        });
    } catch (error) {
    
        res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Server error' });
    }
};


module.exports = { cancelOrder ,
  
    returnOrder
};