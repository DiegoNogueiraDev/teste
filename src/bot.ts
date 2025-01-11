// Importação das dependências necessárias
import WhatsAppClient from './index.ts';

// Função assíncrona principal
async function exemplo(): Promise<void> {
    const client = new WhatsAppClient();
    await client.initialize();
    
    // Aguarde a conexão ser estabelecida
    setTimeout(async () => {
        if (client.isConnected) {
            await client.sendMessage('5511956773737', 'Olá!');
        }
    }, 10000);
}

// Chama a função principal
exemplo();