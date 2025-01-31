// models/db.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});

pool.on('connect', () => {
  console.log('Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Erro na conexão com PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
