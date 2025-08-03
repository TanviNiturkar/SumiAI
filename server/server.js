import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import mongoose from 'mongoose'
import userRouter from './routes/userRoutes.js'
import imageRouter from './routes/imageRoutes.js'


const dbUrl = process.env.ATLASDB_URL
const PORT = process.env.PORT || 3000
main()
.then(()=>{
    console.log("connected to DB");
})
.catch((err)=>{
    console.log(err);
})
async function main(){
    await mongoose.connect(dbUrl);
}
const app = express()

app.use(express.json())
app.use(cors())


app.use('/api/user',userRouter)
app.use('/api/image',imageRouter)

app.get('/' , (req,res)=> res.send("API working finally ata ky  1 krav baba"))
app.listen(PORT , ()=> {
    console.log(`Server running on port ${PORT}`); // ✅ Correct

});
