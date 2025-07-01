const Cart = require("../../Models/cartSchema");
const User = require("../../Models/userSchema");
const Product = require("../../Models/productSchema");
const Category = require("../../Models/categorySchema");
const Wishlist = require("../../Models/wishlistSchema");
const Offer = require("../../Models/offerSchema");
  

const calculateDiscountedPrice = async (product) => {
  try {
    const productOffer = await Offer.findOne({
      productId: product._id,
      type: 'product',
      status: true,
    }).lean();

    const categoryOffer = await Offer.findOne({
      categoryId: product.category,
      type: 'category',
      status: true,
    }).lean();

    const productDiscount = productOffer ? productOffer.discount : 0;
    const categoryDiscount = categoryOffer ? categoryOffer.discount : 0;
    const bestDiscount = Math.max(productDiscount, categoryDiscount);

    let salesPrice = product.regularPrice || 0;
    if (bestDiscount > 0 && product.regularPrice) {
      salesPrice = product.regularPrice * (1 - bestDiscount / 100);
    }

    return parseFloat(salesPrice.toFixed(2));
  } catch (error) {
    
    return parseFloat((product.regularPrice || 0).toFixed(2));
  }
};


const calculateCartTotals = (items) => {
  const subtotal = items.reduce((sum, item) => {
    if (!item.productId) return sum;

    const itemPrice = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 0;
    const itemTotal = itemPrice * quantity;

    return sum + itemTotal;
  }, 0);

  const discount = 0;
  const total = subtotal - discount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};


const getCartPage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const userId = req.session.user;
    const user = await User.findById(userId);

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
    });

    if (cart && cart.items) {
      cart.items = cart.items.filter(
        (item) => item.productId && !item.productId.isBlocked
      );
     
      for (let item of cart.items) {
        item.price = await calculateDiscountedPrice(item.productId);
      }
      await cart.save();
    }

    const cartItems = cart && cart.items && cart.items.length > 0
      ? cart.items.map((item) => ({
          id: item._id.toString(),
          imageUrl: item.productId.productImage[0] || '/default-image.jpg',
          name: item.productId.productName || 'Unknown Product',
          price: parseFloat(item.price) || 0,
          quantity: parseInt(item.quantity) || 0,
          stock: item.productId.quantity,
          isBlocked: item.productId.isBlocked || false,
        }))
      : [];

    const totals = calculateCartTotals(cart && cart.items ? cart.items : []);

    if (cart) {
      cart.subTotal = totals.total;
      await cart.save();
    }

    return res.render('cart', {
      cartItems,
      subtotal: totals.subtotal || 0,
      discount: totals.discount || 0,
      total: totals.total || 0,
      user: user || null,
    });
  } catch (error) {
   
    res.render('/pageNotFound');
  }
};

const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;
    const { fromWishlist } = req.query;

    if (!productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        details: {
          productId: !!productId,
          quantity: !!quantity,
        },
      });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const price = await calculateDiscountedPrice(product);

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    let newQuantity = quantity;
    if (existingItemIndex > -1) {
      newQuantity = cart.items[existingItemIndex].quantity + quantity;
    }

    if (newQuantity > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum quantity allowed is 5 items',
      });
    }

    if (newQuantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: 'Stock limit reached',
        availableStock: product.quantity,
      });
    }

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].price = price;
    } else {
      cart.items.push({
        productId,
        quantity,
        price,
      });
    }

    await cart.save();

    if (fromWishlist) {
      await Wishlist.updateOne(
        { userId: userId },
        {
          $pull: {
            products: { productId: productId },
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      cart,
    });
  } catch (error) {
    
    return res.status(500).json({
      success: false,
      message: 'Server error while adding to cart',
      error: error.message,
    });
  }
};


const updateCart = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const { quantity } = req.body;
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const item = cart.items.find((item) => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const product = await Product.findById(item.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    if (quantity > 5) {
      return res.status(400).json({ success: false, message: 'Maximum quantity is 5' });
    }

    if (quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: 'Stock limit reached',
        availableStock: product.quantity,
      });
    }

    item.quantity = quantity;
    item.price = await calculateDiscountedPrice(product);
    await cart.save();

    return res.status(200).json({ success: true, message: 'Cart updated' });
  } catch (error) {
   
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


const deleteItemFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.params.productId;

    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'Missing user or product ID' });
    }

    const cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter((item) => item.productId.toString() !== productId);

    await cart.save();

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getCartPage,
  addToCart,
  updateCart,
  deleteItemFromCart,
};