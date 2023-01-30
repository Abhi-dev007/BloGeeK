const mongoose=require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const blogSchema = new mongoose.Schema({
    author:{
        type: String,
        required:true
    },
    title:{
        type: String,
        required: true
    },
    body:{
        type: String
    },
    image:{
        caption:{
            type: String
        },
        link:{ 
            type: String
        }
    },
    createdAt: {
        type: Date,
        default: new Date()
    }

});
blogSchema.plugin(mongoosePaginate);
module.exports=mongoose.model('Blog', blogSchema);