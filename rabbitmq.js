// rabbitmq.js
const amqp = require('amqplib');
const dotenv = require('dotenv');

dotenv.config();

let channel;
let connection;
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const RABBITMQ_PREFETCH = parseInt(process.env.RABBITMQ_PREFETCH, 10) || 10;
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'default_quorum_queue';
let queueName = RABBITMQ_QUEUE;

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

    // Se você tiver lógica de consumo, pode implementá-la aqui
    // consumeMessages();

  } catch (error) {
    console.error('Erro ao conectar ao RabbitMQ:', error);
    return setTimeout(connectRabbitMQ, 5000); // Tentar reconectar após 5 segundos
  }
};

// Opcional: Se você tiver uma função para consumir mensagens
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

module.exports = {
  getChannel: () => channel,
  connectRabbitMQ,
  queueName,
};
