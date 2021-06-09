import User from './models/user.js'
import bcrypt from 'bcryptjs'
import passportLocal from 'passport-local'

const localStrategy = passportLocal.Strategy

export default function (passport) {
    passport.use('local', new localStrategy((username, password, done) => {
        User.findOne({username: username}, (err, user) => {
            if (err) throw err;
            if (!user) return done(null, false)
            bcrypt.compare(password, user.password, (err, result) =>{
                if (err) throw err
                if (result){
                    return done(null, user);
                } else {
                    return done(null, false);
                }
            })
        })
    })
    )

    passport.serializeUser((user, cb) => {
        cb(null, user.id);
    })
    passport.deserializeUser((id, cb) => {
        User.findOne({_id: id}, (err, user) => {
            cb(err, user)        
        })
    })
}
