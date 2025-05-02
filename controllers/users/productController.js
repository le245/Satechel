const Product=require("../../Models/productSchema")
const User=require("../../Models/userSchema")



const getProductDetailPage = async(req,res) =>{
    try {
        
        const email = req.session.userEmail 
        if(!email){
            return res.redirect('/home')
        }
       const productId = req.params.id
       const product =await Product.findById(productId).populate('category')
       
      
       const userData=await User.findOne({email})
       
       const relatedProducts = await Product.find({
        category: product.category._id, 
        _id: { $ne: productId }, 
        isBlocked: false,})
        .limit(4) 
        .lean();

       res.render('product-detail',{
        user:userData,
        product,
        relatedProducts
       })
        
    } catch (error) {
        console.error('Error get product detail page:', error.message);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
}


module.exports = {
    getProductDetailPage
}