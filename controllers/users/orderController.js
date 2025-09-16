const Order=require('../../Models/orderSchema');
const Product=require('../../Models/productSchema')
const User = require('../../Models/userSchema')
const mongoose = require('mongoose')
const STATUS_CODES= require("../../Models/status")

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemId } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'Please login first' });
        }

        const order = await Order.findOne({ orderId, userId }).populate('items.productId');
        if (!order) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Pending' && order.status !== 'Processing') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Cannot cancel this order now' });
        }

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
                return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Item not found in order' });
            }

            if (item.cancelStatus === 'Cancelled') {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Item already cancelled' });
            }

            if (item.returnStatus !== 'Not Requested') {
                return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Cannot cancel item with an active return request' });
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

        order.subTotal = order.items
            .filter(i => i.cancelStatus !== 'Cancelled')
            .reduce((sum, i) => sum + (i.price * i.quantity), 0);
        order.finalAmount = order.subTotal * discountFactor;

        await order.save();

        if (order.paymentMethod !== 'cod' && refundAmount > 0) {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
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
        console.error('Error cancelling order:', err);
        res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: 'Something went wrong' });
    }
};

const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { itemId, reason } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'Please login first' });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Return reason is required and must be at least 10 characters long.',
      });
    }

    const order = await Order.findOne({ orderId, userId }).populate('items.productId');
    if (!order) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    if (!['Delivered', 'ReturnRequest'].includes(order.status)) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Return not allowed. Order is not delivered yet.',
      });
    }

    
    if (!order.originalSubTotal || order.originalSubTotal === 0) {
      order.originalSubTotal = order.items.reduce((sum, item) => {
        const price = item.price || (item.productId?.price || 0);
        const quantity = item.quantity || 1;
        return sum + price * quantity;
      }, 0);
    }

    if (!order.originalFinalAmount) {
      order.originalFinalAmount = order.finalAmount || order.originalSubTotal - (order.discount || 0);
    }

    let returnedItems = [];
    let refundAmount = 0;

    if (itemId) {
   
      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid item ID format' });
      }

      const item = order.items.find((i) => i.productId && i.productId._id.toString() === itemId);
      if (!item) {
        return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'Item not found in order' });
      }

      item.returnStatus = item.returnStatus || 'Not Requested';
      item.cancelStatus = item.cancelStatus || 'Not Cancelled';

      if (item.returnStatus !== 'Not Requested') {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Return request for this item has already been submitted or processed.',
        });
      }

      if (item.cancelStatus === 'Cancelled') {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Cannot request return for a cancelled item.',
        });
      }

      item.returnStatus = 'Requested';
      item.returnReason = reason.trim();
      item.returnRequestedAt = new Date();

      const itemSubTotal = (item.price * item.quantity).toFixed(2);
      const discountRatio = order.originalSubTotal > 0 ? (order.discount || 0) / order.originalSubTotal : 0;
      refundAmount = (itemSubTotal - itemSubTotal * discountRatio).toFixed(2);

      returnedItems.push({
        itemId: item.productId._id.toString(),
        name: item.productId ? item.productId.productName : 'Unknown',
        quantity: item.quantity,
        refundAmount: parseFloat(refundAmount),
      });
    } else {
    
      const hasReturnableItems = order.items.some((item) => {
        const returnStatus = item.returnStatus || 'Not Requested';
        const cancelStatus = item.cancelStatus || 'Not Cancelled';
        return returnStatus === 'Not Requested' && cancelStatus !== 'Cancelled';
      });

      if (!hasReturnableItems) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'No items are eligible for return in this order.',
        });
      }

      order.items.forEach((item) => {
        item.returnStatus = item.returnStatus || 'Not Requested';
        item.cancelStatus = item.cancelStatus || 'Not Cancelled';
        if (item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Cancelled') {
          item.returnStatus = 'Requested';
          item.returnReason = reason.trim();
          item.returnRequestedAt = new Date();
          returnedItems.push({
            itemId: item.productId._id.toString(),
            name: item.productId ? item.productId.productName : 'Unknown',
            quantity: item.quantity,
          });
        }
      });

      refundAmount = order.finalAmount.toFixed(2);
    }

    
    const activeItems = order.items.filter((item) => {
      const returnStatus = item.returnStatus || 'Not Requested';
      const cancelStatus = item.cancelStatus || 'Not Cancelled';
      return cancelStatus !== 'Cancelled' && returnStatus !== 'Returned';
    });

    order.subTotal = activeItems.reduce((sum, item) => {
      const price = item.price || (item.productId?.price || 0);
      const quantity = item.quantity || 1;
      return sum + price * quantity;
    }, 0);

    order.finalAmount = Math.max(0, order.subTotal - (order.discount || 0));

    
    order.displaySubTotal = order.originalSubTotal;
    order.displayFinalAmount = order.originalFinalAmount;
    order.refundedAmount = (order.refundedAmount || 0) + parseFloat(refundAmount);

    const determineOrderStatus = (items) => {
      const activeItems = items.filter((item) => (item.cancelStatus || 'Not Cancelled') !== 'Cancelled');
      if (activeItems.length === 0) return 'Cancelled';
      if (activeItems.every((item) => (item.returnStatus || 'Not Requested') === 'Returned')) {
        return 'Returned';
      }
      if (activeItems.some((item) => (item.returnStatus || 'Not Requested') === 'Requested')) {
        return activeItems.every((item) => (item.returnStatus || 'Not Requested') === 'Requested' || (item.returnStatus || 'Not Requested') === 'Returned')
          ? 'ReturnRequest'
          : 'Delivered';
      }
      return 'Delivered';
    };

    order.status = determineOrderStatus(order.items);

    await order.save();

    res.status(STATUS_CODES.OK).json({
      success: true,
      message: itemId ? 'Item return requested successfully' : 'Order return requested successfully',
      updatedStatus: order.status,
      updatedOrder: {
        subTotal: order.subTotal,
        finalAmount: order.finalAmount,
        discount: order.discount || 0,
        couponApplied: order.couponApplied || false,
        originalSubTotal: order.originalSubTotal,
        originalFinalAmount: order.originalFinalAmount,
        displaySubTotal: order.displaySubTotal,
        displayFinalAmount: order.displayFinalAmount,
        refundedAmount: order.refundedAmount,
        items: order.items.map((item) => ({
          productId: item.productId._id.toString(),
          returnStatus: item.returnStatus || 'Not Requested',
          cancelStatus: item.cancelStatus || 'Not Cancelled',
        })),
      },
      returnedItems,
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(STATUS_CODES.SERVER_ERROR).json({ success: false, message: `Server error: ${error.message}` });
  }
};




module.exports = { cancelOrder ,
  
    returnOrder
};