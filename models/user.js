import mongoose from 'mongoose'
import passportLocalMongoose from 'passport-local-mongoose'

const userSchema = new mongoose.Schema({
    username: String, 
    firstName: String, 
    lastName: String,
    email: String, 
    birthday: String, 
    password: String, 
}) 

userSchema.plugin(passportLocalMongoose)
const User = new mongoose.model('User', userSchema)

export default User 