const cancelOrder=async(req,res)=>{

    try{
     
        const {orderId}=req.params;
        const{itemId}=req.body;

        const order=await Order.findOne({orderId,userId}).populate('items.productId')
       if(!order.orginalSubTotal){
        order.orginalSubTotal=order.subTotal
       }
       if()

        let refundAmount=0;
        let cancelledItems=[];

        let dicountdactor;

        if(order.orginalSubTotal>0){
            dicountdactor=order.orginalSubTotal/order.orginalSubTotal
        }else{
            return 1
        }
        const 
    }catch(error){

    }
}