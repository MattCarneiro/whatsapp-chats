document.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('loader');
  const chatContainer = document.getElementById('chat-container');
  const messagesContainer = document.getElementById('messages');
  const contactNumberSpan = document.getElementById('contact-number');
  const loadMoreButton = document.getElementById('load-more');

  // Obter os parâmetros da URL (usados para login/autenticação)
  const urlParts = window.location.pathname.split('/').filter(part => part !== '');
  const name = urlParts[0];
  const phoneNumber = urlParts[1];
  const code = urlParts[2];

  contactNumberSpan.textContent = phoneNumber;

  // Variáveis para paginação
  const PAGE_SIZE = 50;
  let allMessages = [];
  let currentPage = 1;
  let hasMoreMessages = true;

  // Função para formatar o timestamp (hora:minuto:segundo)
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Função para formatar a data do separador
  const formatDateSeparator = (timestamp) => {
    const date = new Date(timestamp);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('pt-BR', options);
  };

  // Função auxiliar que extrai a data no formato YYYY-MM-DD de um objeto Date.
  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Função para buscar mensagens no backend (realiza a "autenticação" via parâmetros)
  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/chat/${name}/${phoneNumber}/${code}/messages`);
      
      // Se a resposta não for OK (login ou conversa inválidos), redireciona para o site externo
      if (!response.ok) {
        window.location.href = 'https://neuralbroker.com.br';
        return;
      }
      
      const data = await response.json();
      console.log('Mensagens recebidas:', data.messages);
      // Inverte para ordem cronológica (das mais antigas para as mais recentes)
      allMessages = data.messages.reverse();

      // Armazena o parâmetro de data antes de trocar a URL
      const queryParams = new URLSearchParams(window.location.search);
      const dateParam = queryParams.get('date');
      let targetDate = null;
      if (dateParam) {
        const parts = dateParam.split('-');
        if (parts.length === 3) {
          targetDate = new Date(parts[2], parts[1] - 1, parts[0]);
        }
      }

      // Se houver data informada, renderiza todas as mensagens para garantir que o separador desejado apareça
      if (targetDate) {
        renderMessages(true, true);
      } else {
        renderMessages(true);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }

      // Após renderizar, substitui a URL por uma rota genérica
      window.history.replaceState({}, 'Chat', '/chats');

      // Se houver targetDate, chama a função de scroll com um delay para garantir que o DOM esteja pronto
      if (targetDate) {
        setTimeout(() => scrollToDate(targetDate), 150);
      }

      loader.classList.add('hidden');
      chatContainer.classList.remove('hidden');
    } catch (error) {
      console.error(error);
      window.location.href = 'https://neuralbroker.com.br';
    }
  };

  /**
   * Função para renderizar as mensagens.
   * @param {boolean} initial - Se true, limpa o container antes de renderizar.
   * @param {boolean} renderAll - Se true, renderiza todas as mensagens (ignora paginação).
   */
  const renderMessages = (initial = false, renderAll = false) => {
    if (initial) {
      messagesContainer.innerHTML = '';
    }

    let messagesToRender = [];
    if (renderAll) {
      messagesToRender = allMessages;
    } else {
      const end = PAGE_SIZE * currentPage;
      messagesToRender = allMessages.slice(-end);
    }

    let previousMessageDate = null;
    const elementsToAdd = [];

    messagesToRender.forEach(msg => {
      const messageDate = new Date(msg.messageTimestamp).toDateString();
      if (previousMessageDate !== messageDate) {
        // Cria separador de data com atributo data-date (formato ISO)
        const dateSeparator = document.createElement('div');
        dateSeparator.classList.add('date-separator');

        const dateSpan = document.createElement('span');
        dateSpan.classList.add('separator-text');
        dateSpan.setAttribute('data-date', new Date(msg.messageTimestamp).toISOString());
        dateSpan.textContent = formatDateSeparator(msg.messageTimestamp);

        dateSeparator.appendChild(dateSpan);
        elementsToAdd.push(dateSeparator);

        previousMessageDate = messageDate;
      }

      // Cria o elemento da mensagem
      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message');
      messageDiv.classList.add(msg.fromMe ? 'sent' : 'received');

      const media = msg.content;

      if (msg.messageType === 'conversation') {
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
      else if (msg.messageType === 'listMessage') {
        const listMsg = media.listMessage;
        const { title, description, footerText, buttonText, sections } = listMsg;
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
        const contact = media.contactMessage || media || {};
        const displayName = contact.displayName || 'Contato desconhecido';
        const vcard = contact.vcard || '';
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
        const location = media.locationMessage || media || {};
        const name = location.name || 'Localização';
        const address = location.address || '';
        const url = location.url || '#';
        const thumbnailBase64 = location.jpegThumbnail || '';
        let thumbnailImg = '';
        if (thumbnailBase64) {
          thumbnailImg = `<img src="data:image/jpeg;base64,${thumbnailBase64}" alt="Imagem" class="media-image">`;
        }
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
        messageDiv.textContent = "Recebido Mensagem de Visualização Única";
      }
      else {
        messageDiv.textContent = JSON.stringify(media);
      }

      const timestampDiv = document.createElement('div');
      timestampDiv.classList.add('timestamp');
      timestampDiv.textContent = formatTimestamp(msg.messageTimestamp);
      messageDiv.appendChild(timestampDiv);

      elementsToAdd.push(messageDiv);
    });

    if (initial) {
      elementsToAdd.forEach(element => messagesContainer.appendChild(element));
    } else {
      elementsToAdd.reverse().forEach(element => messagesContainer.insertBefore(element, messagesContainer.firstChild));
    }

    if (!renderAll && allMessages.length > PAGE_SIZE * currentPage) {
      loadMoreButton.classList.remove('hidden');
      hasMoreMessages = true;
    } else {
      loadMoreButton.classList.add('hidden');
      hasMoreMessages = false;
    }
  };

  /**
   * Função para rolar até o separador cuja data seja a mais próxima (mas não superior)
   * à data alvo (passada como parâmetro).
   * Usa somente a parte da data (YYYY-MM-DD) para comparação.
   */
  const scrollToDate = (targetDate) => {
    if (!targetDate) return;
    const targetDateStr = getLocalDateString(targetDate);
    let scrollTarget = null;
    let closestDateStr = null;
    const separators = document.querySelectorAll('.separator-text');
    separators.forEach(separator => {
      const sepDate = new Date(separator.getAttribute('data-date'));
      const sepDateStr = getLocalDateString(sepDate);
      if (sepDateStr <= targetDateStr) {
        if (!closestDateStr || sepDateStr > closestDateStr) {
          closestDateStr = sepDateStr;
          scrollTarget = separator;
        }
      }
    });
    if (scrollTarget) {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      messagesContainer.scrollTop = 0;
    }
  };

  loadMoreButton.addEventListener('click', () => {
    if (hasMoreMessages) {
      currentPage += 1;
      renderMessages();
    }
  });

  messagesContainer.addEventListener('click', (event) => {
    if (event.target && event.target.matches('.list-button')) {
      const parentDiv = event.target.closest('.list-message');
      const sectionsDiv = parentDiv.querySelector('.list-sections');
      if (sectionsDiv) {
        sectionsDiv.classList.toggle('hidden');
      }
    }
  });

  fetchMessages();
});
