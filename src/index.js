// Importação das dependências necessárias do pacote baileys
const {
    default: makeWASocket,        // Função principal para criar a conexão com WhatsApp
    useMultiFileAuthState,        // Gerencia autenticação usando múltiplos arquivos
    DisconnectReason,            // Enum com razões de desconexão
    Browsers                     // Simula diferentes navegadores
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');  // Biblioteca para gerar QR Code no terminal
const fs = require('fs');                   // Módulo para manipulação de arquivos
const path = require('path');               // Módulo para manipulação de caminhos de arquivos

// Define o diretório onde serão salvos os dados de autenticação
const AUTH_DIR = path.join(__dirname, 'auth_data');
// Cria o diretório se ele não existir
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Classe principal que gerencia a conexão com WhatsApp
class WhatsAppClient {
    constructor() {
        this.sock = null;                    // Armazena a conexão
        this.isConnected = false;            // Status da conexão
        this.reconnectAttempts = 0;          // Contador de tentativas de reconexão
        this.maxReconnectAttempts = 5;       // Máximo de tentativas permitidas
    }

    // Método para inicializar a conexão
    async initialize() {
        try {
            // Carrega ou cria novo estado de autenticação
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

            // Cria nova conexão com WhatsApp
            this.sock = makeWASocket({
                auth: state,                  // Estado de autenticação
                printQRInTerminal: true,      // Mostra QR Code no terminal
                browser: Browsers.ubuntu('Chrome'), // Simula Chrome no Ubuntu
                connectTimeoutMs: 30000,      // Timeout de conexão (30 segundos)
                defaultQueryTimeoutMs: 60000, // Timeout de consultas (60 segundos)
                keepAliveIntervalMs: 10000    // Intervalo de keep-alive (10 segundos)
            });

            // Configura os listeners de eventos
            this.setupEventListeners(saveCreds);

            return this.sock;
        } catch (error) {
            console.error('Erro na inicialização:', error);
            throw error;
        }
    }

    // Configura os listeners para diferentes eventos
    setupEventListeners(saveCreds) {
        // Salva credenciais quando são atualizadas
        this.sock.ev.on('creds.update', saveCreds);

        // Gera e mostra QR Code quando necessário
        this.sock.ev.on('qr', (qr) => {
            qrcode.generate(qr, { small: true });
            console.log('\nPor favor, escaneie o QR Code acima para conectar ao WhatsApp\n');
        });

        // Gerencia mudanças no estado da conexão
        this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));

        // Gerencia novas mensagens recebidas
        this.sock.ev.on('messages.upsert', this.handleNewMessage.bind(this));
    }

    // Gerencia atualizações de estado da conexão
    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            // Conexão estabelecida com sucesso
            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log('Conexão estabelecida com sucesso!');
        } else if (connection === 'close') {
            // Conexão fechada
            this.isConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            // Verifica se deve tentar reconectar
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                  this.reconnectAttempts < this.maxReconnectAttempts;

            if (shouldReconnect) {
                // Tenta reconectar com delay crescente
                this.reconnectAttempts++;
                console.log(`Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                setTimeout(() => this.initialize(), 5000 * this.reconnectAttempts);
            } else {
                console.log('Conexão encerrada permanentemente.');
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('Dispositivo desconectado. Por favor, escaneie o QR Code novamente.');
                }
            }
        }
    }

    // Processa novas mensagens recebidas
    handleNewMessage(messageUpdate) {
        const message = messageUpdate.messages[0];
        // Ignora mensagens enviadas pelo próprio bot
        if (!message?.key?.fromMe) {
            console.log('Nova mensagem recebida:', {
                from: message.key.remoteJid,
                // Tenta extrair o texto da mensagem de diferentes formatos
                message: message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        'Mensagem não textual'
            });
        }
    }

    // Método para enviar mensagens
    async sendMessage(to, content) {
        if (!this.isConnected) {
            throw new Error('Cliente não está conectado ao WhatsApp');
        }

        try {
            // Formata o número do destinatário
            const formattedNumber = this.formatPhoneNumber(to);
            
            // Envia a mensagem
            const result = await this.sock.sendMessage(formattedNumber, {
                text: content
            });

            console.log(`Mensagem enviada com sucesso para ${to}`);
            return result;
        } catch (error) {
            console.error(`Erro ao enviar mensagem para ${to}:`, error);
            throw error;
        }
    }

    // Formata números de telefone para o formato do WhatsApp
    formatPhoneNumber(number) {
        // Remove caracteres não numéricos (parênteses, traços, etc)
        const cleaned = number.replace(/\D/g, '');
        // Adiciona sufixo @s.whatsapp.net se não existir
        return cleaned.endsWith('@s.whatsapp.net') ? cleaned : `${cleaned}@s.whatsapp.net`;
    }
}

// Função principal de exemplo
async function main() {
    const client = new WhatsAppClient();
    
    try {
        // Inicializa o cliente
        await client.initialize();
        
        // Exemplo: envia mensagem após 10 segundos
        setTimeout(async () => {
            if (client.isConnected) {
                try {
                    await client.sendMessage('5511999999999', 'Olá! Esta é uma mensagem de teste.');
                } catch (error) {
                    console.error('Erro ao enviar mensagem de teste:', error);
                }
            }
        }, 10000);
        
    } catch (error) {
        console.error('Erro na execução principal:', error);
    }
}

// Se este arquivo for executado diretamente (não importado como módulo)
if (require.main === module) {
    main().catch(console.error);
}

// Exporta a classe para ser usada em outros arquivos
module.exports = WhatsAppClient;