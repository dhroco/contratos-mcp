import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { z } from "zod";

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

function createMcpServer() {
  const server = new McpServer({
    name: "contratos-mcp",
    version: "1.0.0"
  });

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

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint principal MCP - Streamable HTTP
app.all("/mcp", async (req, res) => {
  console.log("Body recibido:", JSON.stringify(req.body));
  console.log("Content-Type:", req.headers["content-type"]);
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "contratos-mcp running" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`contratos-mcp corriendo en puerto ${PORT}`);
});