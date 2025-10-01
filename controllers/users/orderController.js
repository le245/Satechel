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

        let refundAmount = 0;
        let cancelledItems = [];

        const discountFactor = order.subTotal > 0 ? (order.finalAmount / order.subTotal) : 1;

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
                discount: order.discount,
                finalAmount: order.finalAmount,
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

      const itemTotal = item.price * item.quantity;
      const discountRatio = order.subTotal > 0 ? (order.discount || 0) / order.subTotal : 0;
      
      refundAmount = itemTotal - itemTotal * discountRatio;

      returnedItems.push({
        itemId: item.productId._id.toString(),
        name: item.productId?.productName || 'Unknown',
        quantity: item.quantity,
        refundAmount,
      });
    } else {
      
      const hasReturnableItems = order.items.some(
        (item) => item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Cancelled'
      );

      if (!hasReturnableItems) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'No items are eligible for return in this order.',
        });
      }

      order.items.forEach((item) => {
        if (item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Cancelled') {
          item.returnStatus = 'Requested';
          item.returnReason = reason.trim();
          item.returnRequestedAt = new Date();
          returnedItems.push({
            itemId: item.productId._id.toString(),
            name: item.productId?.productName || 'Unknown',
            quantity: item.quantity,
          });
        }
      });

      refundAmount = order.finalAmount;
    }

  
    order.refundedAmount = (order.refundedAmount || 0) + refundAmount;

   
    const activeItems = order.items.filter((i) => i.cancelStatus !== 'Cancelled');
    if (activeItems.every((i) => i.returnStatus === 'Returned')) {
      order.status = 'Returned';
    } else if (activeItems.some((i) => i.returnStatus === 'Requested')) {
      order.status = 'ReturnRequest';
    }

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
      refundedAmount: order.refundedAmount,
      items: order.items.map((item) => ({
          productId: item.productId._id.toString(),
          returnStatus: item.returnStatus,
          cancelStatus: item.cancelStatus,
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