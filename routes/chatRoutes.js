// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Rota atualizada para buscar mensagens com code
router.get('/:name/:phoneNumber/:code/messages', chatController.getMessages);

module.exports = router;
