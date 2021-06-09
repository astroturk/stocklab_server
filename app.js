import dotenv  from "dotenv"
dotenv.config()

import mongoose from 'mongoose'
import express from 'express'
import cors from 'cors'
import passport from 'passport'
import axios from 'axios'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import session from 'express-session'
import bodyParser from 'body-parser'
import passportConfig from './passportConfig.js'
import dateFns from 'date-fns'
import multer from 'multer'
import { fileURLToPath } from 'url';
import fs from 'fs'
import path, {dirname} from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Set storage engine 
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + 
            path.extname(file.originalname))
    }
})

// Init upload 
const upload = multer({
    storage: storage
}).single('file')

// Models
import User from './models/user.js'
import Stock from './models/stock.js'
import UserData from './models/userData.js'
import StockNews from './models/stockNews.js'
import UserImage from './models/userImage.js'
import UserNotes from './models/userNotes.js'

// Routes

// Constants
const DATABASE_URL = `mongodb+srv://astroturk:${process.env.DATABASE_PASSWORD}@cluster0.bqomg.mongodb.net/stockLabDB?retryWrites=true&w=majority`

const { startOfYesterday, formatISO } = dateFns

var app = express()

// Middleware
app.use(express.static('public'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors({
    origin: 'http://localhost:3000', // Loacation of React App
    credentials: true
}))
app.use(session({
    secret: 'secretcode',
    resave: true,
    saveUninitialized: true
}))
app.use(cookieParser('secretcode'))
app.use(passport.initialize())
app.use(passport.session())
passportConfig(passport)

/*-------------------------------------------------------auth-routes---------------------------------------------------------------*/

// email authenticaion
app.post('/register/email', (req, res) => {
    console.log(req.body)
    User.findOne({username: req.body.username }, async (err, doc) => {
        if (err) throw err;
        if (doc) res.send('User already exists')
        if (!doc) {
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const newUser = new User({...req.body, password: hashedPassword});
            await newUser.save()
            res.send('New user created')
        }
    })
})

app.post('/login/email', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) throw err;
        if (!user) res.send('No user exists')
        else {
            req.logIn(user, err => {
                if (err) throw err
                res.send('User Successfully Authenticated')
            })
        }
    })(req, res, next)
})

app.post('/logout', (req, res) => {
    req.logout();
    res.send('User successfuly logged out')
})

app.get('/user', (req, res) => {
    res.send(req.user)
})
/*-------------------------------------------------------end-auth-routes------------------------------------------------------------*/

/*--------------------------------------------------------news-routes---------------------------------------------------------------*/
app.get('/searchresults', async function (req, res) {
    const yesterday = formatISO(startOfYesterday(), { representation: 'date' })
    console.log(req.query.searchQuery)
    const queryUrl = `https://newsapi.org/v2/everything?q=\'${req.query.searchQuery}\'&from=${yesterday}&sortBy=relevancy&language=en&apiKey=b2ab7ec07a6647d09b2cdafe8e483822`
    console.log(queryUrl)
    await axios.get(queryUrl)
        .then(response => res.send(response.data))
        .catch(error => res.send('Could not fetch data'))
})

async function getCompanyNews(symbol, name){
    const yesterday = formatISO(startOfYesterday(), { representation: 'date' })
    const queryUrl = `https://newsapi.org/v2/everything?q=\'${name}\'&from=${yesterday}&sortBy=relevancy&language=en&apiKey=b2ab7ec07a6647d09b2cdafe8e483822`
    console.log(queryUrl)
    await axios.get(queryUrl)
        .then(async function (res){
            StockNews.create({
                symbol: symbol,
                name: name, 
                articles: res.data.articles
            }, function (err) {
                if (err) throw err
                return 
            })
        })
        .catch(error => {
            const errorMessage = {code: 707, message: 'could not fetch compnay news'}
            throw errorMessage
        })
}

app.get('/news/stock', async function (req, res) {
    console.log(req.query.symbols)
    const symbols = req.query.symbols
    StockNews.find({symbol: {$in: symbols}}, function (err, stockNewsList) {
        if (err) {res.send('Cannot fetch stock news');}
        else {
            let news = []
            stockNewsList.forEach(stockNews => {
                stockNews.articles.forEach(article => news.push(article))
            })
            res.send(news)
        }
    })
})
/*-------------------------------------------------------end-news-routes------------------------------------------------------------*/

/*----------------------------------------------------------stock-info-routes-------------------------------------------------------*/


async function addStockSymbol(symbol, userId){
    const errorMessage = { code: 703, message: 'Could not add stock symbol' }
    await UserData.findByIdAndUpdate(userId, { $addToSet: { stockSymbolList: symbol } }, { upsert: true }, function (err) {
        if (err) throw errorMessage
    })
}

async function fetchStockData(symbol){
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.STOCK_API_KEY}`
    const historyUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1week&apikey=${process.env.STOCK_API_KEY}`
    const errorMessage1 = { code: 701, message: 'Could not fetch data' }
    const errorMessage2 = { code: 702, message: 'Symbol does not exist' }

    await axios({
        method: 'get',
        url: quoteUrl
    })
    .then(res => res.data)
    .then( async function (data) {
        if (data.status) throw errorMessage2 
        await axios({
            method: 'get',
            url: historyUrl
        })
        .then(res => res.data.values)
        .then(async function (hist) {
            await Stock.create({
                symbol: data.symbol, 
                name: data.name, 
                exchange: data.exchange, 
                currency: data.currency,
                open: data.open, 
                high: data.high, 
                low: data.low, 
                close: data.close,
                previousClose: data.previous_close,
                history: hist
            },
            async function (err, newStock) {
                if (err) { throw errorMessage1 }
                console.log('Data fetched and added to database : ' + newStock.name)
                await getCompanyNews(newStock.symbol, newStock.name)
                console.log('Stock news added to database')
            })
        })
        .catch(err => { throw errorMessage1 })
    })
    .catch(err => { throw errorMessage1 })
}

app.post('/stock/addstock', async function (req, res) {
    console.log(req.body.symbol)
    console.log(req.user)

    const symbol = req.body.symbol
    const user = req.user

    await Stock.findOne({symbol: symbol}, async function (err, stock){
        if (err) {
            res.send(errorMessage)
            return 
        }
        else if (stock) {
            console.log('Stock already exists in database') 
            StockNews.findOne({symbol: symbol}, async function (err, stockNews) {
                if (err) throw err
                else if (stockNews) {
                    try {
                        await addStockSymbol(symbol, user._id)
                        res.send('Stock symbol added to User Data')
                    } catch (error) {
                        res.send('Could not add symbol to User Data')
                    }
                }
                else {
                    try {
                        await getCompanyNews(stock.symbol, stock.name)
                        console.log('Stock news added to database')
                        await addStockSymbol(symbol, user._id)
                        res.send('Stock symbol added to User Data')
                    } catch (error) {
                        res.send('Could not add symbol to User Data')
                    }
                }
            })
        }
        else {
            try {
                await fetchStockData(symbol)
                console.log('Stock data added to database')
                await addStockSymbol(symbol, user._id)
                res.send('Stock symbol added to User Data')
            } catch (error) {
                console.log(error)
                res.send('Could not add symbol to User Data')
                return 
            }
        }
    })
})

app.delete('/stock/removestock', async function (req, res) {
    console.log(req.user)
    console.log(req.body.symbol)
    const user = req.user
    const symbol = req.body.symbol
    await UserData.update({ _id: user._id }, {$pull : { 'stockSymbolList': symbol } }, async function (err, userData) {
        if (err) res.send('Cannot remove symbol from list')
        else res.send('Removed data from list')
    })
})

app.get('/stock/list', async function (req, res) {
    const user = req.user
    await UserData.findOne({ _id: user._id }, function (err, userData){
        if (err) res.send('Cannot fetch stock list')
        else if (userData) res.send(userData.stockSymbolList)
        else res.send([])
    })
})

app.get('/stock/data', async function (req, res) {
    const symbols = req.query.symbols
    Stock.find({ symbol: { $in: symbols}}, function (err, stockData){
        if (err) res.send('Cannot fetch stock data')
        else if (stockData) res.send(stockData)
        else res.send([])
    })
})

/*-------------------------------------------------------end-stock-info-routes-------------------------------------------------------*/

/*-----------------------------------------------------------user-photo-info---------------------------------------------------------*/

app.post('/userimage',  (req, res) => {
    console.log(req.user)
    const user  = req.user
    upload(req, res, async function (err){
        if (err) res.send('Cannot upload user image')
        else {
            console.log(req.file)
            var obj = {
                img: {
                    data: fs.readFileSync(path.join(__dirname + '/public/uploads/' + req.file.filename)),
                    contentType: req.file.mimetype
                }
            }
            await UserImage.findByIdAndUpdate(user._id, obj, {upsert: true}, function(err, doc){
                if (err) res.send('Cannot upload user image')
                else res.send('Successfuly uploaded user image')
            })
        }
    })
})

app.get('/userimage', function (req, res){
    const user = req.user
    UserImage.findOne({ _id: user._id }, function (err, userImage) {
        if (err) res.send('Cannot find user image')
        else res.send(userImage)
    })
})

/*-----------------------------------------------------------end-user-photo-info-----------------------------------------------------*/

/*-------------------------------------------------------------user-notes------------------------------------------------------------*/

app.get('/notes', function (req, res){
    const user = req.user
    UserNotes.findOne({_id: user._id}, function(err, userNotes){
        if (err) res.send('Could not fetch user notes')
        else if (!userNotes) res.send([])
        else res.send(userNotes.notes)
    })
})

app.post('/notes', function (req, res){
    const notes = req.body.notes
    const user = req.user
    UserNotes.findByIdAndUpdate(user._id, {notes: notes}, {upsert: true}, function (err, userNote) {
        if (err) res.send('Cannot update user notes')
        else res.send('Updated user notes')
    })
})

/*-----------------------------------------------------------end-user-notes----------------------------------------------------------*/


// App listening to port
app.listen(4000, () => {
    console.log('App listening on Port 4000!');
})

// Connecting to MongoDB server
mongoose.connect(DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Successfully connected mongoDB database'))
    .catch(() => console.log('Could not connect to server'))
