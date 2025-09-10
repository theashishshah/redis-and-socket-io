import express from "express"
import axios from "axios"
import Redis from "ioredis"
import cookieParser from "cookie-parser"
import {v4 as uuidv4} from 'uuid'

const PORT = process.env.PORT ?? 8000
const redis = new Redis.default({ host: "localhost", port: Number(6379) })
const app = express()


app.use(cookieParser());
app.use(async (req, res, next) => {
    let cookie = req.cookies.session_id
    if (!cookie) {
        res.cookie("session_id", uuidv4(), { maxAge: 900000, httpOnly: true })
    }
    next()
})

app.use(async (req, res, next) => {
    const cookie = req.cookies.session_id
    const key = `rate-limiter-${cookie}`
    const cached = await redis.get(key)

    console.log(`${cached} value.`);
    if (cached === null) {
        await redis.set(key, 0)
        await redis.expire(key, 30) // key, seconds
    }

    if (Number(cached) > 10) {
        return res.status(429).json({
            messsage: "Too many request, wait for cool down period",
            success: false
        })
    }
    
    await redis.incr(key)

    next()
})

app.get("/books/page-count",  async (req, res) => {
    const key = `total-pages`
    const cached = await redis.get(key)
    if (cached) {
        console.log(`cache hit.`);
        return res.status(200).json({
            message: "Data fetched from Redis cache",
            success: true,
            total: cached,
        });
    }

    try {
        const url = `https://api.freeapi.app/api/v1/public/books`;
        const { data } = await axios.get(url);

        const booksArray = data.data.data;
        const total = booksArray.reduce((acc: number, curr: {volumeInfo: {pageCount: number}}) => acc + curr?.volumeInfo?.pageCount || 0, 0);

        await redis.set(key, total);

        console.log(`cache miss.`);
        return res.status(200).json({
            message: "Data fetched from external API and cached in Redis",
            success: true,
            total: total, 
        });
    } catch (error: any) {
        console.log(`Error while fetching data: ${error}`);
        return res.status(500).json({
            message: "Internal server error",
            success: false,
            error: error.message || error,
        });
    }
})


app.get('/', (req, res) => {
    res.status(201).json({
        message: "Ok",
        success: true
    })
})


app.listen(PORT, () => console.log(`Server is running on port ${PORT}`))