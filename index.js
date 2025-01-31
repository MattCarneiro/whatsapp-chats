// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const amqp = require('amqplib');
const path = require('path');
const chatRoutes = require('./routes/chatRoutes');

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

// Conexão com RabbitMQ
let channel, connection, queueName;
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const RABBITMQ_PREFETCH = parseInt(process.env.RABBITMQ_PREFETCH, 10) || 10;
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'default_quorum_queue';

const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(RABBITMQ_URL);

    connection.on('error', (err) => {
      console.error('Erro de conexão RabbitMQ:', err);
    });

    connection.on('close', () => {
      console.error('Conexão RabbitMQ fechada. Tentando reconectar...');
      return setTimeout(connectRabbitMQ, 5000);
    });

    channel = await connection.createChannel();

    channel.on('error', (err) => {
      console.error('Erro no canal RabbitMQ:', err);
    });

    channel.on('close', () => {
      console.error('Canal RabbitMQ fechado. Tentando reconectar...');
      return setTimeout(connectRabbitMQ, 5000);
    });

    await channel.prefetch(RABBITMQ_PREFETCH);
    await channel.assertQueue(RABBITMQ_QUEUE, {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
      },
    });

    queueName = RABBITMQ_QUEUE;
    console.log(`Conectado ao RabbitMQ e fila quorum '${queueName}' está pronta.`);
  
    // Consumo de mensagens (exemplo básico)
    consumeMessages();

  } catch (error) {
    console.error('Erro ao conectar ao RabbitMQ:', error);
    return setTimeout(connectRabbitMQ, 5000); // Tentar reconectar após 5 segundos
  }
};

const consumeMessages = () => {
  try {
    channel.consume(queueName, (msg) => {
      if (msg !== null) {
        console.log(`Mensagem recebida: ${msg.content.toString()}`);
        // Processar a mensagem conforme a lógica da aplicação
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Erro ao consumir mensagens:', error);
  }
};

// Iniciar conexão com RabbitMQ
connectRabbitMQ();

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = { channel, connectRabbitMQ };
