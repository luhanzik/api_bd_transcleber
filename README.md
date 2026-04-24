# API BD Transcleber

Esta é uma API de leitura para PostgreSQL, construída com Node.js, Express e Knex. Ela fornece endpoints para acessar dados do banco de dados e inclui documentação Swagger.

## 🚀 Como usar em outro computador

Siga os passos abaixo para configurar e rodar o projeto localmente.

### 1. Pré-requisitos

Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (versão 14 ou superior recomendada)
- [Git](https://git-scm.com/)
- Um banco de dados PostgreSQL acessível

### 2. Clonar o Repositório

Abra o terminal e execute:

```bash
git clone https://github.com/luhanzik/api_bd_transcleber.git
cd api_bd_transcleber
```

### 3. Instalar Dependências

Instale os pacotes necessários usando o npm:

```bash
npm install
```

### 4. Configurar Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do projeto e adicione as credenciais do seu banco de dados PostgreSQL:

```env
DB_HOST=seu_host
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=seu_banco_de_dados
DB_PORT=5432
PORT=3002
```

### 5. Executar a API

Para iniciar o servidor em modo de desenvolvimento:

```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3002` (ou na porta que você definiu no `.env`).

### 6. Documentação (Swagger)

A documentação interativa da API estará disponível em:
`http://localhost:3002/api-docs`

---

## 🛠️ Tecnologias Utilizadas

- **Node.js** & **Express** - Servidor e roteamento.
- **Knex.js** - Query builder para SQL.
- **PostgreSQL** - Banco de dados relacional.
- **Swagger** - Documentação da API.
- **Dotenv** - Gerenciamento de variáveis de ambiente.
