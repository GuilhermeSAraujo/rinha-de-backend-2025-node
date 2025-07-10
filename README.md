# Rinha de Backend 2025 - Node.js API

Servidor Node.js otimizado para performance implementando os endpoints necessários para o teste k6 da Rinha de Backend 2025.

## 🚀 Otimizações de Performance

- **Dependências mínimas**: Removidas dependências desnecessárias (cors, helmet, morgan)
- **Processamento assíncrono**: Pagamentos processados em background com fila em memória
- **MongoDB otimizado**: Índices específicos para consultas de resumo
- **Nginx otimizado**: Configuração para alta performance com buffers e timeouts otimizados
- **Docker otimizado**: Multi-stage build com dumb-init para melhor gerenciamento de processos

## 📋 Endpoints Implementados

### POST /payments
Aceita requisições de pagamento e as processa de forma assíncrona.

**Request:**
```json
{
  "correlationId": "uuid",
  "amount": 19.90
}
```

**Response:** `202 Accepted`

### GET /payments-summary
Retorna resumo dos pagamentos processados.

**Query Parameters:**
- `from` (opcional): Data inicial (ISO string)
- `to` (opcional): Data final (ISO string)

**Response:**
```json
{
  "default": {
    "totalRequests": 100,
    "totalAmount": 1990.00
  },
  "fallback": {
    "totalRequests": 50,
    "totalAmount": 995.00
  }
}
```

### POST /purge-payments
Limpa todos os pagamentos do banco de dados.

**Response:** `200 OK`

### GET /health
Endpoint de health check.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "instance": "01"
}
```

## 🏗️ Arquitetura

- **Load Balancer**: Nginx na porta 9999
- **Backend**: 2 instâncias Node.js na porta 3000
- **Database**: MongoDB com autenticação
- **Payment Processors**: Integração com serviços externos (portas 8001 e 8002)

## 🚀 Execução

### Desenvolvimento
```bash
npm install
npm run dev
```

### Produção com Docker
```bash
docker-compose up --build
```

O servidor estará disponível em `http://localhost:9999`

## 🔧 Configuração

### Variáveis de Ambiente
- `PORT`: Porta do servidor (padrão: 3000)
- `INSTANCE_ID`: ID da instância
- `MONGODB_URI`: URI de conexão com MongoDB
- `PAYMENT_PROCESSOR_SERVICE_DEFAULT_URL`: URL do processador padrão
- `PAYMENT_PROCESSOR_SERVICE_FALLBACK_URL`: URL do processador de fallback

### Recursos Docker
- **Backend**: 1 CPU, 1GB RAM por instância
- **MongoDB**: 1 CPU, 1GB RAM
- **Nginx**: 0.25 CPU, 64MB RAM

## 📊 Monitoramento

- Health checks automáticos
- Logs estruturados
- Métricas de uptime por instância
- Graceful shutdown com SIGTERM/SIGINT

## Features

- 🚀 Express.js server with TypeScript
- 🔒 Security middleware (Helmet, CORS)
- 📝 Request logging (Morgan)
- 🏥 Health check endpoint
- ⚡ Hot reload for development
- 🛠️ Strict TypeScript configuration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Development mode (with hot reload):
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Start production server:
```bash
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests (placeholder)

## Project Structure

```
node-backend/
├── src/
│   └── index.ts          # Main server file
├── dist/                 # Compiled JavaScript (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## API Endpoints

- `GET /` - Root endpoint with API information
- `GET /health` - Health check endpoint

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Development

The server runs on `http://localhost:3000` by default.

Health check: `http://localhost:3000/health`

## TypeScript Configuration

The project uses strict TypeScript configuration with:
- ES2020 target
- CommonJS modules
- Source maps enabled
- Declaration files generated
- Strict type checking

## Dependencies

### Production
- `express` - Web framework
- `cors` - CORS middleware
- `helmet` - Security headers
- `morgan` - HTTP request logger

### Development
- `typescript` - TypeScript compiler
- `ts-node-dev` - Development server with hot reload
- `@types/*` - TypeScript type definitions 