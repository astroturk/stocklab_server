import mongoose from 'mongoose'

const stockNewsSchema = new mongoose.Schema({
    symbol: String,
    name: String,  
    articles: Array,
})

const StockNews = new mongoose.model('StockNews', stockNewsSchema)
export default StockNews