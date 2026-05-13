import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";

// Templates de contratos
const templates = {
  influencer: {
    campos: ["nombre", "rut", "monto", "duracion", "red_social"],
    clausulas: [
      "El influencer se compromete a publicar contenido promocional.",
      "El pago se realizará dentro de 30 días de emitida la boleta.",
      "Queda prohibida la promoción de marcas competidoras durante la vigencia.",
    ]
  },
  servicios: {
    campos: ["nombre", "rut", "monto", "descripcion_servicio", "fecha_entrega"],
    clausulas: [
      "El proveedor se compromete a entregar el servicio en la fecha acordada.",
      "El pago se realizará contra entrega conforme del servicio.",
      "Cualquier modificación debe ser acordada por escrito.",
    ]
  }
};

// Crear servidor Express
const app = express();
const transports = {};

// Endpoint SSE — Claude se conecta aquí
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;

  res.on("close", () => {
    delete transports[transport.sessionId];
  });

  const server = createMcpServer();
  await server.connect(transport);
});

// Endpoint para recibir mensajes de Claude
app.post("/messages", express.json(), async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: "Session not found" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "contratos-mcp running" });
});

// Función que crea y configura el servidor MCP
function createMcpServer() {
  const server = new McpServer({
    name: "contratos-mcp",
    version: "1.0.0"
  });

  // Herramienta 1: obtener_contrato
  server.tool(
    "obtener_contrato",
    "Retorna los campos requeridos para un tipo de contrato",
    { tipo: z.string().describe("Tipo de contrato: 'influencer' o 'servicios'") },
    async ({ tipo }) => {
      const template = templates[tipo];
      if (!template) {
        return {
          content: [{ type: "text", text: `Tipo de contrato '${tipo}' no encontrado. Opciones: influencer, servicios` }]
        };
      }
      return {
        content: [{ type: "text", text: `Campos requeridos para contrato '${tipo}': ${template.campos.join(", ")}` }]
      };
    }
  );

  // Herramienta 2: generar_contrato
  server.tool(
    "generar_contrato",
    "Genera un contrato rellenando los campos del template sin modificar las cláusulas",
    {
      tipo: z.string().describe("Tipo de contrato: 'influencer' o 'servicios'"),
      datos: z.object({
        nombre: z.string().optional(),
        rut: z.string().optional(),
        monto: z.string().optional(),
        duracion: z.string().optional(),
        red_social: z.string().optional(),
        descripcion_servicio: z.string().optional(),
        fecha_entrega: z.string().optional(),
      }).describe("Datos para rellenar el contrato")
    },
    async ({ tipo, datos }) => {
      const template = templates[tipo];
      if (!template) {
        return {
          content: [{ type: "text", text: `Tipo de contrato '${tipo}' no encontrado.` }]
        };
      }

      const fecha = new Date().toLocaleDateString("es-CL");
      const contrato = `
====================================
CONTRATO DE ${tipo.toUpperCase()}
Fecha: ${fecha}
====================================

DATOS DE LA CONTRAPARTE:
- Nombre: ${datos.nombre || "NO ESPECIFICADO"}
- RUT: ${datos.rut || "NO ESPECIFICADO"}
- Monto: ${datos.monto || "NO ESPECIFICADO"}
${datos.duracion ? `- Duración: ${datos.duracion}` : ""}
${datos.red_social ? `- Red Social: ${datos.red_social}` : ""}
${datos.descripcion_servicio ? `- Servicio: ${datos.descripcion_servicio}` : ""}
${datos.fecha_entrega ? `- Fecha Entrega: ${datos.fecha_entrega}` : ""}

CLÁUSULAS (no modificables):
${template.clausulas.map((c, i) => `${i + 1}. ${c}`).join("\n")}

====================================
Firma contraparte: _________________
Firma Incrementa.la: _______________
====================================
      `;

      return {
        content: [{ type: "text", text: contrato }]
      };
    }
  );

  return server;
}

// Iniciar servidor HTTP
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`contratos-mcp corriendo en puerto ${PORT}`);
});