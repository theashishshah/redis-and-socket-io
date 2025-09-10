import express from "express"
import axios from "axios"
import Redis from "ioredis"

const PORT = process.env.PORT ?? 8000
const redis = new Redis.default({ host: "localhost", port: Number(6379) })
const app = express()


// Cached the total number page count of a book
// implement rate limiter 

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