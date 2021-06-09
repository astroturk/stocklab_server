import mongoose from 'mongoose'

const userNotesSchema = new mongoose.Schema({
    notes: Array, 
})

const UserNotes = new mongoose.model('UserNotes', userNotesSchema)
export default UserNotes