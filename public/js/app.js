// public/js/app.js
document.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('loader');
  const chatContainer = document.getElementById('chat-container');
  const messagesContainer = document.getElementById('messages');
  const contactNumberSpan = document.getElementById('contact-number');
  const loadMoreButton = document.getElementById('load-more');

  // Obter os parâmetros da URL
  const urlParts = window.location.pathname.split('/').filter(part => part !== '');
  const name = urlParts[0];
  const phoneNumber = urlParts[1];
  const code = urlParts[2];

  contactNumberSpan.textContent = phoneNumber;

  // Variáveis para paginação
  const PAGE_SIZE = 50;
  let allMessages = [];
  let currentPage = 1;
  let hasMoreMessages = true; // Flag para verificar se há mais mensagens

  // Função para formatar o timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Função para formatar a data para o separador
  const formatDateSeparator = (timestamp) => {
    const date = new Date(timestamp);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('pt-BR', options);
  };

  // Função para buscar mensagens
  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/chat/${name}/${phoneNumber}/${code}/messages`);
      if (!response.ok) {
        throw new Error('Conversa não encontrada ou acesso negado');
      }
      const data = await response.json();
      console.log('Mensagens recebidas:', data.messages); // Log para verificar a estrutura
      allMessages = data.messages.reverse(); // Ordem cronológica: das mais antigas para as mais recentes
      renderMessages(true); // Passar 'true' para indicar que é a primeira renderização
      loader.classList.add('hidden');
      chatContainer.classList.remove('hidden');
      // Scroll para o final das mensagens após carregar
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
      loader.textContent = error.message;
      console.error(error);
    }
  };

  // Função para obter a data da primeira mensagem atualmente exibida
  const getFirstMessageDate = () => {
    const firstDateSeparator = messagesContainer.querySelector('.date-separator');
    if (firstDateSeparator) {
      const dateText = firstDateSeparator.querySelector('.separator-text').textContent;
      const date = new Date(dateText);
      return date.toDateString();
    }
    return null;
  };

  // Função para renderizar mensagens
  const renderMessages = (initial = false) => {
    if (initial) {
      messagesContainer.innerHTML = ''; // Limpa as mensagens atuais apenas na primeira renderização
    }

    const start = 0;
    const end = PAGE_SIZE * currentPage;
    const messagesToRender = allMessages.slice(-end, -start || undefined);

    let previousMessageDate = initial ? null : getFirstMessageDate();

    // Array para armazenar elementos a serem adicionados
    const elementsToAdd = [];

    messagesToRender.forEach(msg => {
      const messageDate = new Date(msg.messageTimestamp).toDateString();

      // Adicionar separador de data se for um novo dia
      if (previousMessageDate !== messageDate) {
        const dateSeparator = document.createElement('div');
        dateSeparator.classList.add('date-separator');
        dateSeparator.innerHTML = `<span class="separator-text">${formatDateSeparator(msg.messageTimestamp)}</span>`;
        elementsToAdd.push(dateSeparator);
        previousMessageDate = messageDate;
      }

      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message');
      messageDiv.classList.add(msg.fromMe ? 'sent' : 'received');

      // msg.content é o objeto original que veio do banco (JSONB)
      // e msg.messageType indica o tipo ("conversation", "audioMessage", "listMessage", etc.)
      const media = msg.content;

      if (msg.messageType === 'conversation') {
        // Texto puro
        messageDiv.textContent = media.conversation;
      }
      else if (msg.messageType === 'audioMessage') {
        messageDiv.innerHTML = `
          <audio controls>
            <source src="${media.mediaUrl}" type="audio/ogg">
            Seu navegador não suporta o elemento de áudio.
          </audio>
        `;
      }
      else if (msg.messageType === 'imageMessage') {
        messageDiv.innerHTML = `<img src="${media.mediaUrl}" alt="Imagem" class="media-image">`;
      }
      else if (msg.messageType === 'videoMessage') {
        messageDiv.innerHTML = `
          <video controls class="media-video">
            <source src="${media.mediaUrl}" type="video/mp4">
            Seu navegador não suporta o elemento de vídeo.
          </video>
        `;
      }
      else if (msg.messageType === 'documentMessage') {
        messageDiv.innerHTML = `<a href="${media.mediaUrl}" download>Baixar Documento</a>`;
      }

      // ---- AQUI ENTRAM OS NOVOS TIPOS ----
      else if (msg.messageType === 'listMessage') {
        // Seu código existente para listMessage permanece aqui
        const listMsg = media.listMessage;
        const { title, description, footerText, buttonText, sections } = listMsg;

        // Construir HTML para sections (ocultas inicialmente)
        let sectionsHtml = '';
        if (sections && sections.length > 0) {
          sectionsHtml = sections.map(section => {
            const rowsHtml = section.rows.map(row => `
              <li class="list-row">
                <strong>${row.title}</strong><br>
                <small>${row.description || ''}</small>
              </li>`).join('');

            return `
              <div class="list-section">
                <h4>${section.title}</h4>
                <ul>${rowsHtml}</ul>
              </div>`;
          }).join('');
        }

        // Montar estrutura com um botão para expandir/contrair as seções
        messageDiv.innerHTML = `
          <div class="list-message">
            <h3 class="list-title">${title}</h3>
            <p class="list-desc">${description || ''}</p>
            <button type="button" class="list-button">
              ${buttonText || 'Ver Opções'}
            </button>
            <div class="list-sections hidden">
              ${sectionsHtml}
            </div>
            <div class="list-footer">
              <em>${footerText || ''}</em>
            </div>
          </div>
        `;
      }
      else if (msg.messageType === 'listResponseMessage') {
        // Seu código existente para listResponseMessage permanece aqui
        const listResp = media.listResponseMessage;
        const { title, description, singleSelectReply } = listResp;

        messageDiv.innerHTML = `
          <div class="list-response-message">
            <strong>Resposta da lista:</strong><br/>
            <p><strong>Opção selecionada:</strong> ${title}</p>
            <p><strong>Descrição:</strong> ${description || ''}</p>
            <p><strong>RowID:</strong> ${singleSelectReply?.selectedRowId || ''}</p>
          </div>
        `;
      }
      else if (msg.messageType === 'contactMessage') {
        // Seu código existente para contactMessage permanece aqui
        const contact = media.contactMessage || media || {};
        const displayName = contact.displayName || 'Contato desconhecido';
        const vcard = contact.vcard || '';

        // Extrair o número de telefone do vCard usando regex
        let phoneNumberMatch = vcard.match(/waid=(\d+)/);
        let contactNumber = phoneNumberMatch ? phoneNumberMatch[1] : 'Número desconhecido';

        messageDiv.innerHTML = `
          <div class="contact-message">
            <p><strong>Contato:</strong> ${displayName}</p>
            <p><strong>Número:</strong> ${contactNumber}</p>
          </div>
        `;
      }
      else if (msg.messageType === 'locationMessage') {
        // Seu código existente para locationMessage permanece aqui
        const location = media.locationMessage || media || {};
        const name = location.name || 'Localização';
        const address = location.address || '';
        const url = location.url || '#';
        const latitude = location.degreesLatitude || 0;
        const longitude = location.degreesLongitude || 0;
        const thumbnailBase64 = location.jpegThumbnail || '';

        // Se quiser exibir a imagem thumbnail:
        let thumbnailImg = '';
        if (thumbnailBase64) {
          thumbnailImg = `<img src="data:image/jpeg;base64,${thumbnailBase64}" alt="Imagem" class="media-image">`;
        }

        // Corrigir o link para evitar redirecionamento incorreto
        messageDiv.innerHTML = `
          <div class="location-message">
            ${thumbnailImg}
            <p><strong>Local:</strong> ${name}</p>
            <p>${address}</p>
            <a href="${url}" target="_blank" rel="noopener noreferrer">Ver no mapa</a>
          </div>
        `;
      }
      else if (msg.messageType === 'viewOnceMessageV2') {
        // Mensagem de visualização única V2
        messageDiv.textContent = "Recebido Mensagem de Visualização Única";
      }
      else {
        // Caso não se encaixe em nenhum tipo conhecido, apenas imprime JSON
        messageDiv.textContent = JSON.stringify(media);
      }
      // ---- FIM DOS NOVOS TIPOS ----

      // Adicionar o timestamp
      const timestampDiv = document.createElement('div');
      timestampDiv.classList.add('timestamp');
      timestampDiv.textContent = formatTimestamp(msg.messageTimestamp);
      messageDiv.appendChild(timestampDiv);

      elementsToAdd.push(messageDiv);
    });

    if (initial) {
      // Adicionar todos os elementos ao final
      elementsToAdd.forEach(element => messagesContainer.appendChild(element));
    } else {
      // Prepend (adicionar ao início)
      elementsToAdd.reverse().forEach(element => messagesContainer.insertBefore(element, messagesContainer.firstChild));
    }

    // Mostrar ou esconder o botão de load more
    if (allMessages.length > PAGE_SIZE * currentPage) {
      loadMoreButton.classList.remove('hidden');
      hasMoreMessages = true;
    } else {
      loadMoreButton.classList.add('hidden');
      hasMoreMessages = false;
    }

    if (!initial) {
      // Ajustar o scroll para manter a posição após carregar mais mensagens
      const previousScrollHeight = messagesContainer.scrollHeight;
      setTimeout(() => {
        const newScrollHeight = messagesContainer.scrollHeight;
        messagesContainer.scrollTop = newScrollHeight - previousScrollHeight;
      }, 100);
    }
  };

  // Evento do botão "Ver mensagens mais antigas"
  loadMoreButton.addEventListener('click', () => {
    if (hasMoreMessages) {
      currentPage += 1;
      renderMessages();
    }
  });

  // Delegar evento de clique para o botão das listas
  messagesContainer.addEventListener('click', (event) => {
    if (event.target && event.target.matches('.list-button')) {
      const parentDiv = event.target.closest('.list-message');
      const sectionsDiv = parentDiv.querySelector('.list-sections');
      if (sectionsDiv) {
        sectionsDiv.classList.toggle('hidden');
      }
    }
  });

  // Iniciar busca
  fetchMessages();
});
