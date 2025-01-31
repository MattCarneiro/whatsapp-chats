// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const chatRoutes = require('./routes/chatRoutes');
const rabbitmq = require('./rabbitmq'); // Importa o módulo rabbitmq.js

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rotas
app.use('/api/chat', chatRoutes);

// Rota para servir o frontend com code
app.get('/:name/:phoneNumber/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Opcional: Se houver lógica de consumo de mensagens no index.js
// Você pode acessar o canal do RabbitMQ usando rabbitmq.getChannel()
