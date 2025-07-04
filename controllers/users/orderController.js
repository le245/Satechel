const Order=require('../../Models/orderSchema');
const Product=require('../../Models/productSchema')
const User = require('../../Models/userSchema')

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

    let refundAmount = 0;
    let cancelledItems = [];

    const discountFactor = order.subTotal > 0 ? order.finalAmount / order.subTotal : 1;

    if (itemId) {
      const item = order.items.find(i => i.productId._id.toString() === itemId);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found in order' });
      }

      if (item.cancelStatus === 'Rejected') {
        return res.status(400).json({ success: false, message: 'Item already cancelled' });
      }

      item.cancelStatus = 'Rejected';

    
      const itemTotal = item.price * item.quantity;
      const discountedItemTotal = itemTotal * discountFactor;
      refundAmount = discountedItemTotal;

      order.subTotal -= itemTotal;
      order.finalAmount = order.subTotal * discountFactor;

      await Product.findByIdAndUpdate(itemId, {
        $inc: { quantity: item.quantity }
      });

      cancelledItems.push({
        itemId,
        name: item.productId.productName,
        quantity: item.quantity,
        refundAmount: discountedItemTotal
      });

      const allCancelled = order.items.every(i => i.cancelStatus === 'Rejected');
      if (allCancelled) {
        order.status = 'Cancelled';
      }
    } else {
      order.status = 'Cancelled';
      for (let item of order.items) {
        if (item.cancelStatus !== 'Rejected') {
          item.cancelStatus = 'Rejected';

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

      order.subTotal = 0;
      order.discount = 0;
      order.finalAmount = 0;
    }

    await order.save();

    if (order.paymentMethod !== 'cod' && refundAmount > 0) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      user.wallet = (user.wallet || 0) + refundAmount;
      user.walletHistory.push({
        transactionId: `TXN${Date.now()}`,
        type: 'credit',
        amount: refundAmount,
        date: new Date(),
        status: 'Completed'
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
    console.error('Error cancelling order:', err.message);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};


const returnOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemId, reason } = req.body;

    
        if (!reason || reason.length < 10) {
            return res.status(400).json({ success: false, message: 'Return reason is required and must be at least 10 characters long.' });
        }

       
        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status.toLowerCase() !== 'delivered') {
            return res.status(400).json({ success: false, message: 'Return not allowed. Order is not delivered yet.' });
        }

        if (itemId) {
            const item = order.items.find(item => item.productId.toString() === itemId);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Item not found in order' });
            }

          
            if (item.returnStatus !== 'Not Requested') {
                return res.status(400).json({ success: false, message: 'Return request for this item has already been submitted.' });
            }

        
            item.returnStatus = 'Requested';
            item.returnReason = reason;
            item.returnRequestedAt = new Date();
        } else {
            
            const hasReturnableItems = order.items.some(item => item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Rejected');
            if (!hasReturnableItems) {
                return res.status(400).json({ success: false, message: 'No items are eligible for return in this order.' });
            }

            order.items.forEach(item => {
                if (item.returnStatus === 'Not Requested' && item.cancelStatus !== 'Rejected') {
                    item.returnStatus = 'Requested';
                    item.returnReason = reason;
                    item.returnRequestedAt = new Date();
                }
            });
        }

      
        if (order.items.some(item => item.returnStatus === 'Requested') && !order.status.includes('Return')) {
            order.status = 'Return Request';
        }

        await order.save();

        res.status(200).json({ success: true, message: 'Return request submitted successfully' });
    } catch (error) {
        console.error('Error returning order:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



module.exports = { cancelOrder ,
  
    returnOrder
};