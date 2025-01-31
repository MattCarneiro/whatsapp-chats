# Use uma imagem base oficial do Node.js
FROM node:18

# Instalar dependências do sistema e Chromium
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y nano chromium --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Clonar o repositório
RUN apt-get update && apt-get install -y git && \
    git clone https://github.com/easypanel-io/express-js-sample.git . && \
    apt-get remove -y git && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências principais
RUN npm install express cors dotenv pg amqplib && npm install --save-dev nodemon

# Compilar o projeto (se necessário)
# Caso seu projeto utilize TypeScript ou precise de um passo de build, descomente a linha abaixo
# RUN npm run build

# Copiar o código adicional da aplicação
COPY . .

# Expor a porta em que a aplicação vai rodar
EXPOSE 3000

# Comando para iniciar a aplicação
# Atualize o comando conforme o ponto de entrada da sua aplicação compilada
CMD ["node", "index.js"]
