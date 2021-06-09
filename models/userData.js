import mongoose from 'mongoose'

const userDataSchema = new mongoose.Schema({
    stockSymbolList: Array,
    coinSymbolList: Array,
})

const UserData = new mongoose.model('UserData', userDataSchema)
export default UserData