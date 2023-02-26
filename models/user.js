const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        minlength: 3,
        maxlength: 50,
        required: true,
    },
    email: {
        type: String,
        minlength: 3,
        maxlength: 50,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        minlength: 3,
        maxlength: 255,
        required: true,
    },
    machines: [{
        type: mongoose.Schema.Types.ObjectId,
    }]
})

const user=mongoose.model("user", userSchema)

exports.userModel=user