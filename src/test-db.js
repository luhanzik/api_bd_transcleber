const db = require('./database');

async function testConnection() {
  console.log('Tentando conectar ao banco de dados...');
  try {
    const result = await db.raw('SELECT NOW()');
    console.log('✅ Conexão estabelecida com sucesso!');
    console.log('Horário do servidor:', result.rows[0].now);
    process.exit(0);
  } catch (error) {
    console.error('❌ Falha na conexão:');
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();
