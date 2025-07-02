require('dotenv').config()
const sql = require('mssql')

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
}

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('📦 MSSQL 연결 완료')
    return pool
  })
  .catch(err => {
    console.error('❌ DB 연결 실패:', err)
  })

module.exports = {
  sql, poolPromise
}
