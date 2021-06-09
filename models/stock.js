import mongoose from 'mongoose'

const stockSchema = new mongoose.Schema({
    symbol: String,
    name: String, 
    exchange: String, 
    currency: String, 
    open: String, 
    high: String, 
    low: String, 
    close: String,
    previousClose: String, 
    history: Array,
})

const Stock = new mongoose.model('Stock', stockSchema)

export default Stock