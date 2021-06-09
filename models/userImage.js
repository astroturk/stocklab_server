import mongoose from 'mongoose'

const userImageSchema = new mongoose.Schema({
    img: {
        data: Buffer,
        contentType: String
    }
})

const UserImage = new mongoose.model('UserImage', userImageSchema)
export default UserImage