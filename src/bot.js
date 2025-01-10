const WhatsAppClient = require('./index.js');

async function exemplo() {
    const client = new WhatsAppClient();
    await client.initialize();
    
    // Aguarde a conexão ser estabelecida
    setTimeout(async () => {
        if (client.isConnected) {
            await client.sendMessage('5511956773737', 'Olá!');
        }
    }, 10000);
}

exemplo();