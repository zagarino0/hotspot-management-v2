import { connectMikroTik } from "../src/mikrotik/connection.js";

/* ============================================================
   TEST ROUTER CONNECTION
   Teste manuellement la connexion au routeur MikroTik
============================================================ */

async function testConnection() {
  console.log("🔧 Test de connexion au routeur MikroTik...");

  try {
    const api = await connectMikroTik({
      host: "192.168.88.1",
      port: 8728,
      user: "admin",
      password: "admin",
    });

    console.log("✅ Connexion réussie!");

    const identity = await api.write("/system/identity/print");
    console.log("📋 Identity:", identity[0]?.name);

    const resource = await api.write("/system/resource/print");
    console.log("💻 Board:", resource[0]?.["board-name"]);
    console.log("🌐 Version:", resource[0]?.version);

    await api.close();
  } catch (error: any) {
    console.error("❌ Erreur de connexion:", error.message);
    console.error("Détails:", error);
    process.exit(1);
  }
}

testConnection();
