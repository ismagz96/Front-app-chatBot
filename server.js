// Módulos necesarios
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

// Crear la aplicación Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- CONFIGURACIÓN DE IBM (VERSIÓN DE PRUEBA) ---
// ¡ACCIÓN REQUERIDA! REEMPLAZÁ LOS VALORES DE EJEMPLO CON TUS CREDENCIALES REALES.
const IBM_API_KEY = "T1XXQqn92YJi1rCX1AWXeyN2NChblbCCkh3bziH6Um7M";
const WATSONX_ENDPOINT = "https://api.us-south.assistant-builder.watson.cloud.ibm.com/instances/94b907de-dafe-4195-b83c-5bb0ae051407";

// ----------------------------------------------------

const IBM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token";

// --- RUTA PRINCIPAL ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// --- RUTA DE API PARA EL CHATBOT ---
app.post('/call-watsonx', async (req, res) => {
  console.log("--- INICIANDO LLAMADA A /call-watsonx ---");
  
  const userPrompt = req.body.prompt;
  if (!userPrompt) {
    return res.status(400).json({ error: 'Falta el "prompt".' });
  }
  console.log(`Prompt recibido: "${userPrompt}"`);

  try {
    // --- PASO 1: OBTENER EL BEARER TOKEN DE IBM ---
    console.log("Paso 1: Solicitando token de acceso a IBM...");
    const tokenResponse = await axios.post(
      IBM_TOKEN_URL,
      `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${IBM_API_KEY}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
    );
    const accessToken = tokenResponse.data.access_token;
    console.log("¡Token de acceso obtenido con éxito!");

    // --- PASO 2: LLAMAR AL ENDPOINT DE WATSONX.AI ---
    console.log("Paso 2: Enviando solicitud al endpoint de WatsonX AI...");
    
    // <<< CORRECCIÓN FINAL: Payload completo con parámetros de control >>>
    // Este es el formato más robusto para la API de "predictions".
    const watsonxPayload = {
      "input_data": [{
        "fields": ["prompt"],
        "values": [[userPrompt]]
      }],
      "params": {
        "max_new_tokens": 300,
        "min_new_tokens": 15,
        "temperature": 0.7
      }
    };

    const watsonxResponse = await axios.post(
      WATSONX_ENDPOINT,
      watsonxPayload,
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` } }
    );
    
    console.log("¡Respuesta de WatsonX recibida con éxito!");
    console.log("Respuesta completa de IBM:", JSON.stringify(watsonxResponse.data, null, 2));

    // <<< LEER LA RESPUESTA DE FORMA SEGURA >>>
    let aiResponseText = "No se pudo interpretar la respuesta del asistente.";
    if (watsonxResponse.data && watsonxResponse.data.predictions && watsonxResponse.data.predictions[0] && watsonxResponse.data.predictions[0].values && watsonxResponse.data.predictions[0].values.length > 0) {
        aiResponseText = watsonxResponse.data.predictions[0].values[0][0];
    } else {
       console.error("La estructura de la respuesta de IBM no era la esperada.");
    }

    // Adaptamos la respuesta del frontend para que funcione sin cambios.
    res.status(200).json({ predictions: [{ values: [[aiResponseText]] }] });

  } catch (error) {
    console.error("--- ¡ERROR! ---");
    if (error.response) {
      console.error("Status del Error:", error.response.status);
      console.error("Datos del Error:", JSON.stringify(error.response.data, null, 2));
      const errorMessage = error.response.data.errors ? error.response.data.errors[0].message || error.response.data.errors[0].code : 'Error desconocido de la API';
      res.status(500).json({ error: `Error de la API de IBM: ${errorMessage}` });
    } else {
      console.error("Error general:", error.message);
      res.status(500).json({ error: `Error interno en el servidor: ${error.message}` });
    }
  }
});


// Iniciar el servidor
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Tu app está escuchando en el puerto ' + listener.address().port);
});
