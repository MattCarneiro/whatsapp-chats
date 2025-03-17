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
  let hasMoreMessages = true;

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
      console.log('Mensagens recebidas:', data.messages);
      allMessages = data.messages.reverse(); // Ordem das mais antigas para as mais recentes
      renderMessages(true); // Primeira renderização
      loader.classList.add('hidden');
      chatContainer.classList.remove('hidden');

      // Se houver parâmetro 'date' na query string, rolar para a data informada
      const queryParams = new URLSearchParams(window.location.search);
      if (queryParams.has('date')) {
        scrollToDate();
      } else {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } catch (error) {
      loader.textContent = error.message;
      console.error(error);
    }
  };

  // Função para obter a data da primeira mensagem exibida (usada na renderização incremental)
  const getFirstMessageDate = () => {
    const firstDateSeparator = messagesContainer.querySelector('.date-separator');
    if (firstDateSeparator) {
      const dateText = firstDateSeparator.querySelector('.separator-text').textContent;
      const date = new Date(dateText);
      return date.toDateString();
    }
    return null;
  };

  // Função para renderizar as mensagens
  const renderMessages = (initial = false) => {
    if (initial) {
      messagesContainer.innerHTML = '';
    }

    const start = 0;
    const end = PAGE_SIZE * currentPage;
    const messagesToRender = allMessages.slice(-end, -start || undefined);

    let previousMessageDate = initial ? null : getFirstMessageDate();
    const elementsToAdd = [];

    messagesToRender.forEach(msg => {
      const messageDate = new Date(msg.messageTimestamp).toDateString();

      // Adicionar separador de data se for um novo dia
      if (previousMessageDate !== messageDate) {
        const dateSeparator = document.createElement('div');
        dateSeparator.classList.add('date-separator');
        
        const dateSpan = document.createElement('span');
        dateSpan.classList.add('separator-text');
        // Atribuir o atributo data-date com a data em formato ISO
        dateSpan.setAttribute('data-date', new Date(msg.messageTimestamp).toISOString());
        dateSpan.textContent = formatDateSeparator(msg.messageTimestamp);
        
        dateSeparator.appendChild(dateSpan);
        elementsToAdd.push(dateSeparator);
        
        previousMessageDate = messageDate;
      }

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
        const latitude = location.degreesLatitude || 0;
        const longitude = location.degreesLongitude || 0;
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

    if (allMessages.length > PAGE_SIZE * currentPage) {
      loadMoreButton.classList.remove('hidden');
      hasMoreMessages = true;
    } else {
      loadMoreButton.classList.add('hidden');
      hasMoreMessages = false;
    }

    if (!initial) {
      const previousScrollHeight = messagesContainer.scrollHeight;
      setTimeout(() => {
        const newScrollHeight = messagesContainer.scrollHeight;
        messagesContainer.scrollTop = newScrollHeight - previousScrollHeight;
      }, 100);
    }
  };

  // Função para rolar a tela até o separador da data desejada, com base na query string (?date=dd-mm-yyyy)
  const scrollToDate = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const dateParam = queryParams.get('date'); // Ex.: ?date=20-02-2025
    if (!dateParam) return;

    const parts = dateParam.split('-');
    if (parts.length !== 3) return;
    const targetDate = new Date(parts[2], parts[1] - 1, parts[0]);

    const separators = Array.from(document.querySelectorAll('.separator-text'));
    let scrollTarget = null;
    let closestDate = null;

    separators.forEach(separator => {
      const separatorDate = new Date(separator.getAttribute('data-date'));
      if (separatorDate <= targetDate) {
        if (!closestDate || separatorDate > closestDate) {
          closestDate = separatorDate;
          scrollTarget = separator;
        }
      }
    });

    if (scrollTarget) {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
