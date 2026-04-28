const express = require('express');
const cors = require('cors');
const db = require('./database');
require('dotenv').config();

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = 3002;

// Configurao do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Monitoramento de Pedidos - Grupo JB',
      version: '1.0.0',
      description: 'API para consulta de status de pedidos em tempo real.',
    },
    servers: [
      {
        url: 'http://localhost:3002',
        description: 'Servidor Local',
      },
      {
        url: `http://192.168.12.137:3002`,
        description: 'Servidor de Rede',
      }
    ],
  },
  apis: ['./src/server.js'], // Aponta para este próprio arquivo para ler as docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(cors());
app.use(express.json());

const dicionario = {
  em_rota: ['Transferido entre Roteiros', 'Saiu Para Entrega', 'Reentrega Liberada Automatica'],
  inserido: ['Inserido/Integrado'],
  na_filial: ['Associado a Roteiro', 'Chegada na Transportadora', 'Chegada na Transportadora (retido)', 'Falta de Volume'],
  retornos: ['1ª Tentativa de Entrega', '2ª Tentativa de Entrega', 'Reentrega Liberada', 'Local Perigoso - Área de Risco', 'Fora de Rota', 'Fora de Horário', 'Chuvas na Região', 'Nova Previsao de Entrega', 'Quebra do Veículo']
};

const statusFiltro = [...dicionario.em_rota, ...dicionario.inserido, ...dicionario.na_filial, ...dicionario.retornos];

/**
 * @swagger
 * /api/status/ultima-atualizacao:
 *   get:
 *     summary: Retorna a data e hora da última atualização no banco de dados.
 *     responses:
 *       200:
 *         description: Sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ultima:
 *                   type: string
 */
app.get('/api/status/ultima-atualizacao', async (req, res) => {
  try {
    const result = await db.raw("SELECT TO_CHAR(MAX(data_insercao), 'DD/MM/YYYY HH24:MI:SS') as ultima FROM pedidos");
    res.json({ ultima: result.rows[0].ultima || 'N/A' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

/**
 * @swagger
 * /api/pedidos/hoje/resumo:
 *   get:
 *     summary: Retorna o resumo de pedidos do dia por filial.
 *     responses:
 *       200:
 *         description: Sucesso
 */
app.get('/api/pedidos/hoje/resumo', async (req, res) => {
  try {
    const fRota = dicionario.em_rota.map(s => `'${s}'`).join(',');
    const fInserido = dicionario.inserido.map(s => `'${s}'`).join(',');
    const fFilial = dicionario.na_filial.map(s => `'${s}'`).join(',');
    const fRetorno = dicionario.retornos.map(s => `'${s}'`).join(',');
    const filterAll = statusFiltro.map(s => `'${s}'`).join(',');

    const query = `
      SELECT p.cd, COUNT(*) AS total,
      COUNT(*) FILTER (WHERE p.ultima_ocorrencia IN (${fRota})) AS em_rota,
      COUNT(*) FILTER (WHERE p.ultima_ocorrencia IN (${fInserido})) AS inserido,
      COUNT(*) FILTER (WHERE p.ultima_ocorrencia IN (${fFilial})) AS na_filial,
      COUNT(*) FILTER (WHERE p.ultima_ocorrencia IN (${fRetorno})) AS retornos
      FROM (
          SELECT DISTINCT p.cd, p.pedido, p.remessa, p.numero_nfe, p.ultima_ocorrencia
          FROM pedidos p
          WHERE p.data_prev_entrega >= CURRENT_DATE 
            AND p.data_prev_entrega < CURRENT_DATE + INTERVAL '1 day'
            AND p.ultima_ocorrencia IN (${filterAll})
      ) p
      GROUP BY p.cd ORDER BY total DESC;
    `;
    const result = await db.raw(query);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

/**
 * @swagger
 * /api/pedidos/hoje/detalhe:
 *   get:
 *     summary: Retorna os detalhes dos pedidos com filtros e paginação.
 *     parameters:
 *       - in: query
 *         name: cd
 *         schema:
 *           type: string
 *         description: Nome da filial
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Categoria do status (ex. em_rota)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Termo de busca (Pedido, NFE ou Remessa)
 *     responses:
 *       200:
 *         description: Sucesso
 */
app.get('/api/pedidos/hoje/detalhe', async (req, res) => {
  const { cd, tipo, page = 0, limit = 20, search = '' } = req.query;
  const offset = parseInt(page) * parseInt(limit);
  try {
    let query = db('pedidos').where('data_prev_entrega', '>=', db.raw('CURRENT_DATE')).andWhere('data_prev_entrega', '<', db.raw("CURRENT_DATE + INTERVAL '1 day'"));
    if (cd) query = query.andWhere('cd', 'ILIKE', cd);
    if (tipo && dicionario[tipo]) query = query.whereIn('ultima_ocorrencia', dicionario[tipo]);
    else query = query.whereIn('ultima_ocorrencia', statusFiltro);
    if (search) {
      query = query.andWhere(function() {
        this.where(db.raw('CAST(pedido AS TEXT)'), 'ILIKE', `%${search}%`)
            .orWhere(db.raw('CAST(numero_nfe AS TEXT)'), 'ILIKE', `%${search}%`)
            .orWhere(db.raw('CAST(remessa AS TEXT)'), 'ILIKE', `%${search}%`);
      });
    }
    const data = await query.select('*').limit(parseInt(limit)).offset(offset);
    res.json(Array.isArray(data) ? data : []);
  } catch (error) { res.json([]); }
});

/**
 * @swagger
 * /api/pedidos/vencidos/resumo:
 *   get:
 *     summary: Retorna o resumo de pedidos vencidos por filial.
 *     responses:
 *       200:
 *         description: Sucesso
 */
app.get('/api/pedidos/vencidos/resumo', async (req, res) => {
  try {
    const fRota = dicionario.em_rota.map(s => `'${s}'`).join(',');
    const fInserido = dicionario.inserido.map(s => `'${s}'`).join(',');
    const fFilial = dicionario.na_filial.map(s => `'${s}'`).join(',');
    const fRetorno = dicionario.retornos.map(s => `'${s}'`).join(',');
    const filterAll = statusFiltro.map(s => `'${s}'`).join(',');

    const query = `
      SELECT p.cd, COUNT(*) AS total,
      COUNT(*) FILTER (WHERE p.ultima_ocorrencia IN (${fRota})) AS em_rota,
      COUNT(*) FILTER (WHERE p.ultima_ocorrencia IN (${fInserido})) AS inserido,
      COUNT(*) FILTER (WHERE p.ultima_ocorrencia IN (${fFilial})) AS na_filial,
      COUNT(*) FILTER (WHERE p.ultima_ocorrencia IN (${fRetorno})) AS retornos
      FROM (
          SELECT DISTINCT p.cd, p.pedido, p.remessa, p.numero_nfe, p.ultima_ocorrencia
          FROM pedidos p
          WHERE p.data_prev_entrega < CURRENT_DATE
            AND p.data_insercao >= CURRENT_DATE - INTERVAL '60 days'
            AND p.ultima_ocorrencia IN (${filterAll})
      ) p
      GROUP BY p.cd ORDER BY total DESC;
    `;
    const result = await db.raw(query);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

/**
 * @swagger
 * /api/pedidos/vencidos/detalhe:
 *   get:
 *     summary: Retorna os detalhes dos pedidos vencidos com filtros e paginação.
 *     parameters:
 *       - in: query
 *         name: cd
 *         schema:
 *           type: string
 *         description: Nome da filial
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Categoria do status (ex. em_rota)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Termo de busca (Pedido, NFE ou Remessa)
 *     responses:
 *       200:
 *         description: Sucesso
 */
app.get('/api/pedidos/vencidos/detalhe', async (req, res) => {
  const { cd, tipo, page = 0, limit = 20, search = '' } = req.query;
  const offset = parseInt(page) * parseInt(limit);
  try {
    let query = db('pedidos')
      .where('data_prev_entrega', '<', db.raw('CURRENT_DATE'))
      .andWhere('data_insercao', '>=', db.raw("CURRENT_DATE - INTERVAL '60 days'"));
    if (cd) query = query.andWhere('cd', 'ILIKE', cd);
    if (tipo && dicionario[tipo]) query = query.whereIn('ultima_ocorrencia', dicionario[tipo]);
    else query = query.whereIn('ultima_ocorrencia', statusFiltro);
    if (search) {
      query = query.andWhere(function() {
        this.where(db.raw('CAST(pedido AS TEXT)'), 'ILIKE', `%${search}%`)
            .orWhere(db.raw('CAST(numero_nfe AS TEXT)'), 'ILIKE', `%${search}%`)
            .orWhere(db.raw('CAST(remessa AS TEXT)'), 'ILIKE', `%${search}%`);
      });
    }
    const data = await query.select('*').limit(parseInt(limit)).offset(offset);
    res.json(Array.isArray(data) ? data : []);
  } catch (error) { res.json([]); }
});

app.listen(PORT, '0.0.0.0', () => { console.log('🚀 API RODANDO EM TODAS AS INTERFACES NA PORTA: ' + PORT); });
