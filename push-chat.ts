// @ts-nocheck
// Función «push-chat»: manda aviso al teléfono cuando entra un mensaje nuevo del chat.
// La llama el Webhook de la tabla «mensajes» (evento Insert).
// Secrets necesarios: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, PUSH_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-webhook-secret") !== Deno.env.get("PUSH_SECRET")) {
      return new Response("no autorizado", { status: 401 });
    }
    const body = await req.json();
    const m = body.record;
    if (!m || !m.cliente_id) return new Response("sin datos", { status: 200 });

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT"),
      Deno.env.get("VAPID_PUBLIC"),
      Deno.env.get("VAPID_PRIVATE"),
    );
    const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: c } = await admin.from("clientes").select("nombre,email").eq("id", m.cliente_id).single();
    if (!c) return new Response("cliente no existe", { status: 200 });

    let subs = [];
    let title = "Mi Coach";
    if (m.de === "coach") {
      // aviso para el alumno
      const r = await admin.from("push_subs").select("*").eq("email", String(c.email || "").toLowerCase());
      subs = r.data || [];
      title = "Tu coach te escribió";
    } else {
      // aviso para el/los coach
      const { data: cs } = await admin.from("profiles").select("id").eq("rol", "coach");
      const ids = (cs || []).map((x) => x.id);
      if (ids.length) {
        const r = await admin.from("push_subs").select("*").in("user_id", ids);
        subs = r.data || [];
      }
      title = c.nombre || "Un alumno";
    }

    const payload = JSON.stringify({ title, body: String(m.texto || "").slice(0, 140), url: "./" });
    let ok = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.sub, payload);
        ok++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
        }
      }
    }));
    return new Response(JSON.stringify({ enviados: ok }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(String((e && e.message) || e), { status: 500 });
  }
});
