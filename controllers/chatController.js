// controllers/chatController.js
const db = require('../models/db');
const { channel, connectRabbitMQ } = require('../index'); // Importa o canal e a função de reconexão do index.js

// Função para gerar o código de três dígitos a partir do nome
const generateCode = (name) => {
  let code = '';
  for (let i = 0; i < 3; i++) {
    const char = name[i] || ' '; // Pega o caractere ou espaço se não existir
    if (/[a-zA-Z]/.test(char)) {
      const lowerChar = char.toLowerCase();
      const position = lowerChar.charCodeAt(0) - 96; // 'a' = 1, 'b' = 2, ..., 'z' = 26
      if (position >= 1 && position <= 26) {
        code += position.toString(); // Mantém a posição completa (1-26)
      } else {
        code += '0'; // Fora do alfabeto
      }
    } else if (/[0-9]/.test(char)) {
      code += char; // Mantém o dígito
    } else {
      code += '0'; // Caractere inválido
    }
  }
  return code;
};

// Função para validar o código fornecido
const validateCode = (name, code) => {
  const expectedCode = generateCode(name);
  return expectedCode === code;
};

const getMessages = async (req, res) => {
  const { name, phoneNumber, code } = req.params;

  try {
    console.log(`Autenticando para name: ${name}, code: ${code}`);

    // 1. Validar o código fornecido
    if (!validateCode(name, code)) {
      console.log('Código inválido fornecido.');
      return res.status(403).json({ message: 'Acesso negado' });
    }

    // 2. Buscar a instância pelo nome
    const instanceResult = await db.query(
      'SELECT id, "ownerJid", name FROM "Instance" WHERE name = $1',
      [name]
    );

    if (instanceResult.rows.length === 0) {
      console.log('Conversa não encontrada para o name fornecido.');
      return res.status(404).json({ message: 'Conversa não encontrada' });
    }

    const instance = instanceResult.rows[0];

    // 3. Validar o código novamente com o nome real (opcional)
    if (!validateCode(instance.name, code)) {
      console.log('Código não corresponde ao nome real.');
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const instanceId = instance.id;
    console.log(`instanceId obtido: ${instanceId}`);

    // 4. Sanitizar o phoneNumber e construir o remoteJid
    const sanitizedPhoneNumber = phoneNumber.replace(/\D/g, '');
    const remoteJid = `${sanitizedPhoneNumber}@s.whatsapp.net`;
    console.log(`remoteJid completo: ${remoteJid}`);

    // 5. Buscar mensagens associadas ao remoteJid na coluna key
    const messagesResult = await db.query(
      `SELECT "messageTimestamp", key, message, "messageType" 
       FROM "Message" 
       WHERE "instanceId" = $1 AND key->>'remoteJid' = $2 
       ORDER BY "messageTimestamp" DESC`,
      [instanceId, remoteJid]
    );

    console.log(`Mensagens retornadas pela consulta: ${messagesResult.rows.length}`);

    if (messagesResult.rows.length === 0) {
      console.warn(
        `Nenhuma mensagem encontrada para instanceId: ${instanceId} e remoteJid: ${remoteJid}`
      );
    }

    // Função para remover parâmetros de consulta das URLs de mídia
    const removeQueryParameters = (messageContent) => {
      // Clonar o objeto para não modificar o original
      const newContent = JSON.parse(JSON.stringify(messageContent));

      const traverseAndClean = (obj) => {
        for (const key in obj) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            traverseAndClean(obj[key]);
          } else if (typeof obj[key] === 'string') {
            // Verificar se a string é uma URL que contém '?'
            if (obj[key].startsWith('http') && obj[key].includes('?')) {
              // Remover tudo após o '?'
              obj[key] = obj[key].split('?')[0];
            }
          }
        }
      };

      traverseAndClean(newContent);
      return newContent;
    };

    // Função para processar diferentes tipos de mensagens
    const processMessageContent = (messageType, messageContent) => {
      let processedContent = null;

      if (!messageContent) {
        return null;
      }

      // Adicionar logs para depuração
      console.log(`Processando messageType: ${messageType}`);
      console.log('Conteúdo da mensagem:', JSON.stringify(messageContent, null, 2));

      switch (messageType) {
        case 'contactMessage':
          // Verificar se 'contactMessage' existe em 'messageContent'
          if (messageContent.contactMessage) {
            processedContent = {
              displayName: messageContent.contactMessage.displayName || '',
              vcard: messageContent.contactMessage.vcard || '',
            };
          } else {
            processedContent = {
              displayName: '',
              vcard: '',
            };
          }
          break;

        case 'locationMessage':
          // Verificar se 'locationMessage' existe em 'messageContent'
          if (messageContent.locationMessage) {
            processedContent = {
              url: messageContent.locationMessage.url || '',
              name: messageContent.locationMessage.name || '',
              address: messageContent.locationMessage.address || '',
              latitude: messageContent.locationMessage.degreesLatitude || 0,
              longitude: messageContent.locationMessage.degreesLongitude || 0,
              jpegThumbnail: messageContent.locationMessage.jpegThumbnail || '',
            };
          } else {
            processedContent = {
              url: '',
              name: '',
              address: '',
              latitude: 0,
              longitude: 0,
              jpegThumbnail: '',
            };
          }
          break;

        default:
          // Outros tipos de mensagem (incluindo mídia)
          processedContent = messageContent;
          break;
      }

      return processedContent;
    };

    // 6. Processar as mensagens retornadas
    const messages = messagesResult.rows.map((msg) => {
      const keyParsed = msg.key; // key já é um objeto JSONB
      const messageType = msg.messageType;
      let messageContent = msg.message;

      // Limpar os parâmetros de consulta das URLs de mídia
      messageContent = removeQueryParameters(messageContent);

      // Processar o conteúdo da mensagem baseado no tipo
      const processedContent = processMessageContent(messageType, messageContent);

      return {
        messageTimestamp: msg.messageTimestamp * 1000, // Convertendo para milissegundos
        fromMe: keyParsed.fromMe || false, // Padrão para false se não estiver definido
        messageType: messageType,
        content: processedContent, // Usando o conteúdo processado
      };
    });

    console.log(`Conversa encontrada com ${messages.length} mensagens`);

    // 7. Publicar na fila RabbitMQ (exemplo)
    if (!channel || !channel.connection) {
      console.warn('Canal RabbitMQ não está disponível. Tentando reconectar...');
      await connectRabbitMQ();
    }

    if (channel) {
      const payload = {
        action: 'fetchMessages',
        data: {
          name,
          phoneNumber,
          messageCount: messages.length,
        },
      };
      channel.sendToQueue(
        process.env.RABBITMQ_QUEUE || 'default_quorum_queue',
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
      );
      console.log('Mensagem enviada para a fila RabbitMQ');
    } else {
      console.warn(
        'Canal RabbitMQ ainda não está disponível após reconexão. Mensagem não enviada.'
      );
    }

    // 8. Retornar as mensagens para o frontend
    res.json({ messages });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

module.exports = {
  getMessages,
};
