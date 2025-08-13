const express = require('express')
const cors = require('cors')
const { poolPromise } = require('./db')

const app = express()
app.use(cors())

// 기본 API 확인용
app.get('/', (req, res) => {
  res.send('API 서버 정상 작동 중')
})

// pose 데이터 가져오기
app.get('/api/poses', async (req, res) => {
  try {
    const pool = await poolPromise
    const result = await pool.request().query(`
      SELECT id, tx, ty, tz, qx, qy, qz, qw
      FROM NavDeck
      ORDER BY id
    `)
    res.json(result.recordset)
  } catch (err) {
    console.error('쿼리 오류:', err)
    res.status(500).send('DB 오류 발생')
  }
})

app.listen(3002, () => {
  console.log('🚀 API 서버 실행 중: http://localhost:3002')
})
